import { createHash, createHmac, createCipheriv, createDecipheriv, hkdfSync, randomInt, randomBytes, randomUUID, timingSafeEqual } from 'node:crypto'
import { Prisma } from '@prisma/client'
import { z } from 'zod'
import { prisma } from '@/lib/prisma'
import { hashPassword, type TokenPayload } from '@/lib/auth'
import { AccessError } from './policy'
import { consumeLimit } from './rate-limit'
import { authenticationDelivery, authenticationDeliveryStatus, type AuthenticationDelivery } from './delivery'
import { assertLiveContext, audit } from '../operations'
import { newPasswordSchema } from './password-policy'
import { totpAvailable } from './totp-availability'
import { assertTotpStepUp } from './totp-service'

type Dependencies={delivery?:AuthenticationDelivery;secret?:string;ttlMs?:number}
const contactHash=(value:string)=>createHash('sha256').update(value).digest('hex')
const resetHash=(value:string)=>contactHash('reset\0'+value)
function pepper(deps:Dependencies){
 if(process.env.NODE_ENV==='production'&&(deps.secret||deps.ttlMs))throw new AccessError(503,'AUTH_DELIVERY_UNAVAILABLE')
 const value=deps.secret??process.env.AUTH_CHALLENGE_SECRET
 if(!value||!/^[0-9a-f]{64}$/i.test(value))throw new AccessError(503,'AUTH_DELIVERY_UNAVAILABLE','Tasdiqlash xizmati hali sozlanmagan')
 return value
}
const otpHash=(id:string,code:string,key:string)=>createHmac('sha256',Buffer.from(key,'hex')).update(id+'\0'+code).digest('hex')
function deliveryKey(key:string){return Buffer.from(hkdfSync('sha256',Buffer.from(key,'hex'),'pos-auth-v1','delivery',32))}
function seal(secret:string,id:string,key:string){const iv=randomBytes(12),cipher=createCipheriv('aes-256-gcm',deliveryKey(key),iv);cipher.setAAD(Buffer.from(id));const bytes=Buffer.concat([cipher.update(secret,'utf8'),cipher.final()]);return ['v1',iv.toString('base64url'),cipher.getAuthTag().toString('base64url'),bytes.toString('base64url')].join('.')}
function unseal(value:string,id:string,key:string){const [version,iv,tag,bytes,...extra]=value.split('.');if(version!=='v1'||extra.length)throw new Error('Invalid sealed source');const decipher=createDecipheriv('aes-256-gcm',deliveryKey(key),Buffer.from(iv,'base64url'));decipher.setAAD(Buffer.from(id));decipher.setAuthTag(Buffer.from(tag,'base64url'));return Buffer.concat([decipher.update(Buffer.from(bytes,'base64url')),decipher.final()]).toString('utf8')}
const matches=(left:string,right:string)=>timingSafeEqual(Buffer.from(left,'hex'),Buffer.from(right,'hex'))
function destination(user:{phone:string;email:string|null},channel:'sms'|'email'){
 const value=channel==='sms'?user.phone:user.email
 if(!value)throw new AccessError(409,'CONTACT_REQUIRED')
 return value
}
function usable(row:{expiresAt:Date;deliveredAt:Date|null;failedAt:Date|null;usedAt:Date|null;attempts:number;providerMode:string},now:Date){
 return !!row.deliveredAt&&!row.failedAt&&!row.usedAt&&row.attempts<5&&row.expiresAt>now&&!(process.env.NODE_ENV==='production'&&row.providerMode==='mock')
}
export const challengeRequestSchema=z.object({kind:z.enum(['verify_phone','verify_email','step_up']),channel:z.enum(['sms','email']),
 action:z.string().regex(/^[a-z][a-z0-9_.]{2,80}$/).optional(),operationKey:z.string().uuid().optional(),payloadHash:z.string().regex(/^[0-9a-f]{64}$/).optional()}).strict()
export async function contactStatus(context:TokenPayload){
 return prisma.$transaction(async tx=>{
  await assertLiveContext(tx,context)
  const user=await tx.user.findUniqueOrThrow({where:{id:context.userId}})
  const proofs=await tx.verifiedContact.findMany({where:{userId:context.userId,...(process.env.NODE_ENV==='production'?{challenge:{providerMode:'real'}}:{})}})
  return {...authenticationDeliveryStatus(),phoneVerified:proofs.some(row=>row.channel==='sms'&&row.targetHash===contactHash(user.phone)),emailVerified:!!user.email&&proofs.some(row=>row.channel==='email'&&row.targetHash===contactHash(user.email!)),hasEmail:!!user.email}
 })
}
export async function requestChallenge(context:TokenPayload,input:z.input<typeof challengeRequestSchema>,deps:Dependencies={}){
 const parsed=challengeRequestSchema.parse(input)
 if(parsed.kind==='verify_phone'&&parsed.channel!=='sms'||parsed.kind==='verify_email'&&parsed.channel!=='email')throw new AccessError(400,'INVALID_CHALLENGE_CHANNEL')
 if(parsed.kind==='step_up'&&(!parsed.action||!parsed.operationKey||!parsed.payloadHash)||parsed.kind!=='step_up'&&(parsed.action||parsed.operationKey||parsed.payloadHash))throw new AccessError(400,'INVALID_CHALLENGE_BINDING')
 const provider=authenticationDelivery(parsed.channel,deps.delivery),key=pepper(deps)
 await consumeLimit('auth.challenge.resend',context.userId+':'+parsed.kind,1,60000)
 await consumeLimit('auth.challenge.issue',context.userId,5,15*60000)
 const id=randomUUID(),code=String(randomInt(0,1000000)).padStart(6,'0')
 const source=await prisma.$transaction(async tx=>{
  await assertLiveContext(tx,context)
  await tx.$queryRaw`SELECT id FROM "User" WHERE id=${context.userId} FOR UPDATE`
  const user=await tx.user.findUniqueOrThrow({where:{id:context.userId}}),target=destination(user,parsed.channel)
  if(parsed.kind==='step_up'){
   if(!await tx.session.findFirst({where:{id:context.sessionId,authenticationMethod:'password'}}))throw new AccessError(403,'PASSWORD_SESSION_REQUIRED')
   if(!await tx.verifiedContact.findFirst({where:{userId:context.userId,channel:parsed.channel,targetHash:contactHash(target),...(process.env.NODE_ENV==='production'?{challenge:{providerMode:'real'}}:{})}}))throw new AccessError(403,'CONTACT_NOT_VERIFIED')
  }
  const [{now}]=await tx.$queryRaw<{now:Date}[]>`SELECT clock_timestamp() AT TIME ZONE 'UTC' AS now`
  await tx.authChallenge.updateMany({where:{userId:context.userId,sessionId:context.sessionId,kind:parsed.kind,usedAt:null,failedAt:null},data:{failedAt:now,sealedSecret:null,deliveryLease:null,deliveryLeaseUntil:null}})
  const ttl=deps.ttlMs??5*60000
  if(!Number.isInteger(ttl)||ttl<1000||ttl>5*60000)throw new AccessError(400,'INVALID_CHALLENGE_TTL')
  const row=await tx.authChallenge.create({data:{id,userId:context.userId,sessionId:context.sessionId,kind:parsed.kind,channel:parsed.channel,providerId:provider.id,providerMode:provider.mode,targetHash:contactHash(target),secretHash:otpHash(id,code,key),sealedSecret:seal(code,id,key),action:parsed.action,operationKey:parsed.operationKey,payloadHash:parsed.payloadHash,createdAt:now,expiresAt:new Date(now.getTime()+ttl)}})
  return {row,target}
 })
 return {challengeId:id,expiresAt:source.row.expiresAt}
}
export const verifyChallengeSchema=z.object({challengeId:z.string().uuid(),code:z.string().regex(/^\d{6}$/)}).strict()
export async function verifyChallenge(context:TokenPayload,input:z.input<typeof verifyChallengeSchema>,deps:Dependencies={}){
 const parsed=verifyChallengeSchema.parse(input),key=pepper(deps)
 await consumeLimit('auth.challenge.verify',context.userId,20,15*60000)
 const result=await prisma.$transaction(async tx=>{
  await assertLiveContext(tx,context)
  await tx.$queryRaw`SELECT id FROM "User" WHERE id=${context.userId} FOR UPDATE`
  await tx.$queryRaw`SELECT id FROM "AuthChallenge" WHERE id=${parsed.challengeId} AND "userId"=${context.userId} FOR UPDATE`
  const row=await tx.authChallenge.findFirst({where:{id:parsed.challengeId,userId:context.userId,sessionId:context.sessionId}})
  const [{now}]=await tx.$queryRaw<{now:Date}[]>`SELECT clock_timestamp() AT TIME ZONE 'UTC' AS now`
  if(!row||row.kind==='password_reset'||!usable(row,now))return false
  const user=await tx.user.findUniqueOrThrow({where:{id:context.userId}})
  if(row.targetHash!==contactHash(destination(user,row.channel as 'sms'|'email')))return false
  if(!matches(row.secretHash,otpHash(row.id,parsed.code,key))){
   const attempts=row.attempts+1
   await tx.authChallenge.update({where:{id:row.id},data:{attempts,failedAt:attempts===5?now:undefined}})
   return false // Commit attempts before reporting an invalid code.
  }
  await tx.authChallenge.update({where:{id:row.id},data:{usedAt:now}})
  if(row.kind!=='step_up')await tx.verifiedContact.upsert({where:{userId_channel:{userId:context.userId,channel:row.channel}},create:{userId:context.userId,channel:row.channel,targetHash:row.targetHash,challengeId:row.id,verifiedAt:now},update:{targetHash:row.targetHash,challengeId:row.id,verifiedAt:now}})
  await audit(tx,context,'AuthChallenge',row.id,row.kind==='step_up'?'step_up_verified':'contact_verified',{channel:row.channel,kind:row.kind})
  return true
 })
 if(!result)throw new AccessError(409,'AUTH_CHALLENGE_INVALID','Kod noto‘g‘ri, muddati tugagan yoki ishlatilgan')
 return {verified:true}
}
export async function assertStepUp(tx:Prisma.TransactionClient,context:TokenPayload,action:string,operationKey:string,hash:string){
 await assertLiveContext(tx,context)
 const [{now}]=await tx.$queryRaw<{now:Date}[]>`SELECT clock_timestamp() AT TIME ZONE 'UTC' AS now`
 const proof=await tx.authChallenge.findFirst({where:{userId:context.userId,sessionId:context.sessionId,kind:'step_up',action,operationKey,payloadHash:hash,usedAt:{not:null},failedAt:null,expiresAt:{gt:now},...(process.env.NODE_ENV==='production'?{providerMode:'real'}:{})}})
 if(!proof){
  if(totpAvailable())return assertTotpStepUp(tx,context,action,operationKey,hash)
  throw new AccessError(403,'STEP_UP_REQUIRED','Shu amal uchun ikkinchi faktor tasdig‘i kerak')
 }
 if(!proof.approvedOperationAt)await tx.authChallenge.update({where:{id:proof.id},data:{approvedOperationAt:now}})
 // Only the identical action/key/hash/session can replay this consumed proof.
}
export const resetRequestSchema=z.object({identifier:z.string().trim().min(3).max(200),channel:z.enum(['sms','email'])}).strict()
export async function requestPasswordReset(input:z.input<typeof resetRequestSchema>,deps:Dependencies={}){
 const parsed=resetRequestSchema.parse(input),provider=authenticationDelivery(parsed.channel,deps.delivery),key=pepper(deps)
 await consumeLimit('auth.reset.request',parsed.channel+':'+parsed.identifier.toLowerCase(),3,15*60000)
 const users=await prisma.user.findMany({where:{isActive:true,...(parsed.channel==='sms'?{phone:parsed.identifier}:{email:{equals:parsed.identifier,mode:'insensitive'}})},take:2})
 if(users.length!==1)return {accepted:true}
 const user=users[0],target=destination(user,parsed.channel)
 try{await consumeLimit('auth.reset.resend',user.id,1,60000)}catch(error){
  // Account-specific throttling must not disclose whether this identifier exists.
  if(error instanceof AccessError&&error.code==='RATE_LIMITED')return {accepted:true}
  throw error
 }
 const token=randomBytes(32).toString('base64url'),id=randomUUID()
 await prisma.$transaction(async tx=>{
  await tx.$queryRaw`SELECT id FROM "User" WHERE id=${user.id} FOR UPDATE`
  const current=await tx.user.findUniqueOrThrow({where:{id:user.id}})
  if(!current.isActive||destination(current,parsed.channel)!==target)return
  const [{now}]=await tx.$queryRaw<{now:Date}[]>`SELECT clock_timestamp() AT TIME ZONE 'UTC' AS now`
  await tx.authChallenge.updateMany({where:{userId:user.id,kind:'password_reset',usedAt:null,failedAt:null},data:{failedAt:now,sealedSecret:null,deliveryLease:null,deliveryLeaseUntil:null}})
  const ttl=deps.ttlMs??15*60000
  if(process.env.NODE_ENV==='production'&&deps.ttlMs||!Number.isInteger(ttl)||ttl<1000||ttl>15*60000)throw new AccessError(400,'INVALID_CHALLENGE_TTL')
  return tx.authChallenge.create({data:{id,userId:user.id,kind:'password_reset',channel:parsed.channel,providerId:provider.id,providerMode:provider.mode,targetHash:contactHash(target+'\0'+current.passwordHash),secretHash:resetHash(token),sealedSecret:seal(token,id,key),createdAt:now,expiresAt:new Date(now.getTime()+ttl)}})
 })
 return {accepted:true} // Never return the secret, user ID or account existence.
}
export const resetCompleteSchema=z.object({token:z.string().regex(/^[A-Za-z0-9_-]{43}$/),newPassword:newPasswordSchema}).strict()
export async function completePasswordReset(input:z.input<typeof resetCompleteSchema>){
 const parsed=resetCompleteSchema.parse(input),digest=resetHash(parsed.token)
 await consumeLimit('auth.reset.complete',digest,5,15*60000)
 const source=await prisma.authChallenge.findFirst({where:{secretHash:digest,kind:'password_reset'}})
 if(!source||!usable(source,new Date()))throw new AccessError(409,'AUTH_CHALLENGE_INVALID')
 const passwordHash=await hashPassword(parsed.newPassword)
 const accepted=await prisma.$transaction(async tx=>{
  await tx.$queryRaw`SELECT id FROM "User" WHERE id=${source.userId} FOR UPDATE`
  await tx.$queryRaw`SELECT id FROM "AuthChallenge" WHERE id=${source.id} FOR UPDATE`
  const row=await tx.authChallenge.findUniqueOrThrow({where:{id:source.id}}),user=await tx.user.findUniqueOrThrow({where:{id:row.userId}})
  const [{now}]=await tx.$queryRaw<{now:Date}[]>`SELECT clock_timestamp() AT TIME ZONE 'UTC' AS now`
  if(!user.isActive||!usable(row,now)||row.targetHash!==contactHash(destination(user,row.channel as 'sms'|'email')+'\0'+user.passwordHash))return false
  await tx.authChallenge.update({where:{id:row.id},data:{usedAt:now}})
  await tx.user.update({where:{id:user.id},data:{passwordHash}})
  await tx.organizationUser.updateMany({where:{userId:user.id,pinHash:{not:null}},data:{pinHash:null}})
  await tx.session.updateMany({where:{userId:user.id,revokedAt:null},data:{revokedAt:now}})
  await tx.authChallenge.updateMany({where:{userId:user.id,usedAt:null,failedAt:null},data:{failedAt:now,sealedSecret:null,deliveryLease:null,deliveryLeaseUntil:null}})
  const memberships=await tx.organizationUser.findMany({where:{userId:user.id,isActive:true},select:{organizationId:true}})
  for(const membership of memberships)await tx.auditLog.create({data:{organizationId:membership.organizationId,actorId:user.id,entityType:'User',entityId:user.id,action:'password_changed',afterData:{source:'password_reset'}}})
  return true
 })
 if(!accepted)throw new AccessError(409,'AUTH_CHALLENGE_INVALID')
 return {reset:true}
}

export async function processAuthenticationDeliveries(limit=20,deps:Dependencies={}){
 if(!Number.isInteger(limit)||limit<1||limit>100)throw new Error('Invalid authentication batch')
 // Expired secrets must be erased even after the delivery provider/key is removed.
 // Bound cleanup and skip live worker locks; retain challenge metadata for history.
 await prisma.$executeRaw`WITH expired AS (
  SELECT id FROM "AuthChallenge" WHERE "usedAt" IS NULL AND "failedAt" IS NULL
   AND "deliveredAt" IS NULL AND "expiresAt"<=clock_timestamp()
  ORDER BY "expiresAt",id FOR UPDATE SKIP LOCKED LIMIT ${limit}
 ) UPDATE "AuthChallenge" c SET "failedAt"=clock_timestamp(),"sealedSecret"=NULL,
  "deliveryLease"=NULL,"deliveryLeaseUntil"=NULL FROM expired WHERE c.id=expired.id`
 const status=authenticationDeliveryStatus(),channels=deps.delivery?[deps.delivery.channel]:(['sms','email'] as const).filter(channel=>status[channel])
 // An unconfigured production worker neither sends nor simulates success.
 if(!channels.length)return {processed:0,delivered:0,failed:0}
 const key=pepper(deps);for(const channel of channels)authenticationDelivery(channel,deps.delivery)
 let processed=0,delivered=0,failed=0
 for(let i=0;i<limit;i++){
  const lease=randomUUID()
  const source=await prisma.$transaction(async tx=>{
   const rows=await tx.$queryRaw<{id:string}[]>`SELECT id FROM "AuthChallenge" WHERE channel IN (${Prisma.join(channels)}) AND "deliveredAt" IS NULL AND "failedAt" IS NULL AND "usedAt" IS NULL AND "expiresAt">clock_timestamp() AND "sealedSecret" IS NOT NULL AND "deliveryAttempts"<3 AND "nextDeliveryAt"<=clock_timestamp() AND ("deliveryLeaseUntil" IS NULL OR "deliveryLeaseUntil"<=clock_timestamp()) ORDER BY "createdAt",id FOR UPDATE SKIP LOCKED LIMIT 1`
   if(!rows[0])return null
   return tx.authChallenge.update({where:{id:rows[0].id},data:{deliveryLease:lease,deliveryLeaseUntil:new Date(Date.now()+30000),deliveryAttempts:{increment:1}}})
  })
  if(!source)break
  processed++
  const provider=authenticationDelivery(source.channel as 'sms'|'email',deps.delivery)
  let timer:ReturnType<typeof setTimeout>|undefined
  try{
   if(source.providerId!==provider.id||source.providerMode!==provider.mode)throw new Error('Delivery binding changed')
   const user=await prisma.user.findUniqueOrThrow({where:{id:source.userId}}),target=destination(user,source.channel as 'sms'|'email')
   const expected=contactHash(source.kind==='password_reset'?target+'\0'+user.passwordHash:target)
   if(!user.isActive||source.targetHash!==expected)throw new Error('Recipient changed')
   if(source.sessionId&&!await prisma.session.count({where:{id:source.sessionId,userId:user.id,revokedAt:null,expiresAt:{gt:new Date()},idleExpiresAt:{gt:new Date()}}}))throw new Error('Source revoked')
   const secret=unseal(source.sealedSecret!,source.id,key)
   await Promise.race([provider.send({purpose:source.kind as 'verify_phone'|'verify_email'|'password_reset'|'step_up',destination:target,secret,expiresAt:source.expiresAt}),new Promise<never>((_,reject)=>{timer=setTimeout(()=>reject(new Error('Delivery timeout')),10000);timer.unref()})])
   const timestamp=new Date()
   const result=await prisma.authChallenge.updateMany({where:{id:source.id,deliveryLease:lease,failedAt:null,usedAt:null,deliveredAt:null,expiresAt:{gt:timestamp}},data:{deliveredAt:timestamp,sealedSecret:null,deliveryLease:null,deliveryLeaseUntil:null}})
   if(result.count)delivered++
  }catch{
   const terminal=source.deliveryAttempts>=3
   await prisma.authChallenge.updateMany({where:{id:source.id,deliveryLease:lease,failedAt:null,usedAt:null,deliveredAt:null},data:{failedAt:terminal?new Date():undefined,sealedSecret:terminal?null:undefined,deliveryLease:null,deliveryLeaseUntil:null,nextDeliveryAt:new Date(Date.now()+60000)}})
   failed++ // No raw provider exception, destination or secret is logged.
  }finally{if(timer)clearTimeout(timer)}
 }
 // A worker may die after its final claim. Exhausted expired leases fail closed.
 await prisma.authChallenge.updateMany({where:{usedAt:null,failedAt:null,deliveredAt:null,deliveryAttempts:3,deliveryLeaseUntil:{lte:new Date()}},data:{failedAt:new Date(),sealedSecret:null,deliveryLease:null,deliveryLeaseUntil:null}})
 return {processed,delivered,failed}
}
