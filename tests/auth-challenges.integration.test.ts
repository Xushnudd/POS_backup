import { test,after } from 'node:test'
import assert from 'node:assert/strict'
import { randomUUID,randomBytes } from 'node:crypto'
import { prisma } from '@/lib/prisma'
import { sessionHash,verifySession } from '@/server/auth/session'
import { hashPassword,verifyPassword } from '@/lib/auth'
import { requestChallenge,verifyChallenge,requestPasswordReset,completePasswordReset,processAuthenticationDeliveries,assertStepUp,contactStatus } from '@/server/auth/challenges'
import { authenticationDelivery } from '@/server/auth/delivery'
import { mockAuthenticationDelivery } from './helpers/auth-delivery'
import { payloadHash,runOperation,audit } from '@/server/operations'
import { POST as resetRequestAPI } from '@/app/api/auth/password-reset/request/route'
import { NextRequest } from 'next/server'
const url=new URL(process.env.DATABASE_URL??'')
if(url.hostname!=='127.0.0.1'||url.port!=='55439'||url.pathname!=='/pos_test')throw new Error('Isolated DB only')
const orgs:string[]=[],users:string[]=[],secret='b'.repeat(64)
after(async()=>{await prisma.organization.deleteMany({where:{id:{in:orgs}}});await prisma.user.deleteMany({where:{id:{in:users}}});await prisma.$disconnect()})
async function fixture(){
 const org=await prisma.organization.create({data:{name:'Auth challenge test',phone:randomUUID()}});orgs.push(org.id)
 const user=await prisma.user.create({data:{fullName:'Challenge owner',phone:randomUUID(),email:randomUUID()+'@example.test',passwordHash:await hashPassword('test-only-password')}});users.push(user.id)
 await prisma.organizationUser.create({data:{organizationId:org.id,userId:user.id,role:'owner'}})
 const token=randomBytes(32).toString('base64url');await prisma.session.create({data:{userId:user.id,organizationId:org.id,tokenHash:sessionHash(token),expiresAt:new Date(Date.now()+3600000),idleExpiresAt:new Date(Date.now()+3600000)}})
 return {org,user,token,context:(await verifySession(token))!}
}
test('Queued OTP is encrypted, undelivered codes cannot verify, foreign session and replay fail',async()=>{
 const f=await fixture(),foreign=await fixture(),mock=mockAuthenticationDelivery('sms'),deps={delivery:mock.provider,secret}
 const request={kind:'verify_phone' as const,channel:'sms' as const}
 const source=await requestChallenge(f.context,request,deps)
 assert.equal(mock.messages.length,0)
 await assert.rejects(requestChallenge(f.context,request,deps),{code:'RATE_LIMITED'})
 await assert.rejects(verifyChallenge(f.context,{challengeId:source.challengeId,code:'000000'},deps),{code:'AUTH_CHALLENGE_INVALID'})
 assert.equal(await prisma.verifiedContact.count({where:{userId:f.user.id}}),0)
 assert.equal((await processAuthenticationDeliveries(20,deps)).delivered,1)
 const code=mock.messages[0].secret,row=await prisma.authChallenge.findUniqueOrThrow({where:{id:source.challengeId}})
 assert.notEqual(row.secretHash,code);assert.equal(row.sealedSecret,null)
 await assert.rejects(verifyChallenge(foreign.context,{challengeId:source.challengeId,code},deps),{code:'AUTH_CHALLENGE_INVALID'})
 await verifyChallenge(f.context,{challengeId:source.challengeId,code},deps)
 await assert.rejects(verifyChallenge(f.context,{challengeId:source.challengeId,code},deps),{code:'AUTH_CHALLENGE_INVALID'})
 assert.equal(await prisma.verifiedContact.count({where:{userId:f.user.id,channel:'sms'}}),1)
 await assert.rejects(prisma.authChallenge.update({where:{id:source.challengeId},data:{attempts:0,usedAt:null}}))
})
test('Wrong attempts commit to a five-try lockout; real expiry never verifies',async()=>{
 const f=await fixture(),mock=mockAuthenticationDelivery('sms'),deps={delivery:mock.provider,secret}
 const source=await requestChallenge(f.context,{kind:'verify_phone',channel:'sms'},deps)
 await processAuthenticationDeliveries(20,deps)
 const correct=mock.messages[0].secret,wrong=correct==='000000'?'000001':'000000'
 for(let i=0;i<5;i++)await assert.rejects(verifyChallenge(f.context,{challengeId:source.challengeId,code:wrong},deps),{code:'AUTH_CHALLENGE_INVALID'})
 assert.equal((await prisma.authChallenge.findUniqueOrThrow({where:{id:source.challengeId}})).attempts,5)
 await assert.rejects(verifyChallenge(f.context,{challengeId:source.challengeId,code:correct},deps),{code:'AUTH_CHALLENGE_INVALID'})
 const expiring=await fixture(),next=mockAuthenticationDelivery('email'),nextDeps={delivery:next.provider,secret,ttlMs:1000}
 const expired=await requestChallenge(expiring.context,{kind:'verify_email',channel:'email'},nextDeps)
 await processAuthenticationDeliveries(20,nextDeps)
 await new Promise(resolve=>setTimeout(resolve,1100))
 await assert.rejects(verifyChallenge(expiring.context,{challengeId:expired.challengeId,code:next.messages[0].secret},nextDeps),{code:'AUTH_CHALLENGE_INVALID'})
})
test('Reset is one-use, encrypted and atomic; password change revokes sessions and never verifies a contact',async()=>{
 const f=await fixture(),mock=mockAuthenticationDelivery('email'),deps={delivery:mock.provider,secret}
 assert.deepEqual(await requestPasswordReset({identifier:f.user.email!,channel:'email'},deps),{accepted:true})
 assert.deepEqual(await requestPasswordReset({identifier:f.user.email!,channel:'email'},deps),{accepted:true})
 assert.equal(await prisma.authChallenge.count({where:{userId:f.user.id,kind:'password_reset'}}),1)
 assert.deepEqual(await requestPasswordReset({identifier:randomUUID()+'@example.test',channel:'email'},deps),{accepted:true})
 const row=await prisma.authChallenge.findFirstOrThrow({where:{userId:f.user.id,kind:'password_reset'}})
 assert.ok(row.sealedSecret?.startsWith('v1.'));assert.equal(mock.messages.length,0)
 await processAuthenticationDeliveries(20,deps)
 const token=mock.messages[0].secret
 assert.ok(!row.sealedSecret!.includes(token));assert.notEqual(row.secretHash,token)
 const races=await Promise.allSettled([1,2].map(()=>completePasswordReset({token,newPassword:'test-only-new-password'})))
 assert.equal(races.filter(result=>result.status==='fulfilled').length,1)
 assert.ok(await verifyPassword('test-only-new-password',(await prisma.user.findUniqueOrThrow({where:{id:f.user.id}})).passwordHash))
 assert.equal(await verifySession(f.token),null)
 assert.equal(await prisma.verifiedContact.count({where:{userId:f.user.id}}),0)
 await assert.rejects(completePasswordReset({token,newPassword:'test-only-password'}),{code:'AUTH_CHALLENGE_INVALID'})
})
test('Step-up binds exact action, key, hash and session, and late audit rollback preserves proof for original retry',async()=>{
 const f=await fixture(),mock=mockAuthenticationDelivery('sms'),deps={delivery:mock.provider,secret}
 const contact=await requestChallenge(f.context,{kind:'verify_phone',channel:'sms'},deps);await processAuthenticationDeliveries(20,deps)
 await verifyChallenge(f.context,{challengeId:contact.challengeId,code:mock.messages[0].secret},deps)
 const command={operationId:randomUUID(),name:'Protected test action'},action='test.protected',hash=payloadHash(command)
 const proof=await requestChallenge(f.context,{kind:'step_up',channel:'sms',action,operationKey:command.operationId,payloadHash:hash},deps)
 const authorize=(tx:Parameters<typeof assertStepUp>[0])=>assertStepUp(tx,f.context,action,command.operationId,hash)
 const work=async(tx:Parameters<typeof assertStepUp>[0])=>{await audit(tx,f.context,'Organization',f.org.id,'protected_test_action');return {accepted:true}}
 await assert.rejects(runOperation(f.context,action,command.operationId,command,work,authorize),{code:'STEP_UP_REQUIRED'})
 await processAuthenticationDeliveries(20,deps)
 await verifyChallenge(f.context,{challengeId:proof.challengeId,code:mock.messages[1].secret},deps)
 await assert.rejects(prisma.$transaction(tx=>assertStepUp(tx,f.context,action,randomUUID(),hash)),{code:'STEP_UP_REQUIRED'})
 const fault='auth_audit_fault_'+randomUUID().replaceAll('-','')
 await prisma.$executeRawUnsafe(`CREATE FUNCTION ${fault}() RETURNS trigger LANGUAGE plpgsql AS $$ BEGIN RAISE EXCEPTION 'Auth audit fault'; END $$`)
 try{
  await prisma.$executeRawUnsafe(`CREATE TRIGGER ${fault} BEFORE INSERT ON "AuditLog" FOR EACH ROW WHEN (NEW."organizationId"='${f.org.id}' AND NEW.action='protected_test_action') EXECUTE FUNCTION ${fault}()`)
  await assert.rejects(runOperation(f.context,action,command.operationId,command,work,authorize))
  assert.equal((await prisma.authChallenge.findUniqueOrThrow({where:{id:proof.challengeId}})).approvedOperationAt,null)
 }finally{await prisma.$executeRawUnsafe(`DROP TRIGGER IF EXISTS ${fault} ON "AuditLog"`);await prisma.$executeRawUnsafe(`DROP FUNCTION ${fault}()`)}
 await runOperation(f.context,action,command.operationId,command,work,authorize);await runOperation(f.context,action,command.operationId,command,work,authorize)
 assert.equal(await prisma.auditLog.count({where:{organizationId:f.org.id,action:'protected_test_action'}}),1)
})
test('Unconfigured production endpoints and mocks fail closed without creating or confirming an account',async()=>{
 const response=await resetRequestAPI(new NextRequest('http://localhost:3000/api/auth/password-reset/request',{method:'POST',headers:{origin:'http://localhost:3000','content-type':'application/json'},body:JSON.stringify({identifier:'not-an-account@example.test',channel:'email'})}),undefined)
 assert.equal(response.status,503);assert.equal((await response.json()).error.code,'AUTH_DELIVERY_UNAVAILABLE')
 const mock=mockAuthenticationDelivery('sms'),previous=process.env.NODE_ENV
 try{Object.assign(process.env,{NODE_ENV:'production'});assert.throws(()=>authenticationDelivery('sms',mock.provider),{code:'AUTH_DELIVERY_UNAVAILABLE'})}
 finally{if(previous===undefined)Reflect.deleteProperty(process.env,'NODE_ENV');else Object.assign(process.env,{NODE_ENV:previous})}
})
test('Delivery failure cannot confirm a contact; competing workers send once and production never trusts mock proof',async()=>{
 const f=await fixture(),mock=mockAuthenticationDelivery('sms'),deps={delivery:mock.provider,secret}
 const source=await requestChallenge(f.context,{kind:'verify_phone',channel:'sms'},deps)
 await assert.rejects(prisma.authChallenge.update({where:{id:source.challengeId},data:{sealedSecret:'tampered'}}))
 const results=await Promise.all([processAuthenticationDeliveries(20,deps),processAuthenticationDeliveries(20,deps)])
 assert.equal(results.reduce((sum,result)=>sum+result.delivered,0),1);assert.equal(mock.messages.length,1)
 await verifyChallenge(f.context,{challengeId:source.challengeId,code:mock.messages[0].secret},deps)
 assert.equal((await contactStatus(f.context)).phoneVerified,true)
 const previous=process.env.NODE_ENV
 try{Object.assign(process.env,{NODE_ENV:'production'});assert.equal((await contactStatus(f.context)).phoneVerified,false)}
 finally{if(previous===undefined)Reflect.deleteProperty(process.env,'NODE_ENV');else Object.assign(process.env,{NODE_ENV:previous})}
 const failed=await fixture(),failure=mockAuthenticationDelivery('email')
 failure.provider.send=async()=>{throw new Error('Test delivery failure')}
 const failedDeps={delivery:failure.provider,secret},pending=await requestChallenge(failed.context,{kind:'verify_email',channel:'email'},failedDeps)
 assert.equal((await processAuthenticationDeliveries(20,failedDeps)).failed,1)
 const row=await prisma.authChallenge.findUniqueOrThrow({where:{id:pending.challengeId}})
 assert.equal(row.deliveredAt,null);assert.equal(row.deliveryAttempts,1)
 await assert.rejects(verifyChallenge(failed.context,{challengeId:pending.challengeId,code:'000000'},failedDeps),{code:'AUTH_CHALLENGE_INVALID'})
 assert.equal(await prisma.verifiedContact.count({where:{userId:failed.user.id}}),0)
})
