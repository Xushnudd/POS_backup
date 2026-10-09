import {createHash} from 'node:crypto'
import {Prisma} from '@prisma/client'
import type {TokenPayload} from '@/lib/auth'
import {prisma} from '@/lib/prisma'
import {AccessError} from '@/server/auth/policy'
import {assertLiveContext,runOperation} from '@/server/operations'
import {requestTrace} from '@/server/observability/context'
const RETENTION_MS=90*86400000
// A change of this browser hint is a heuristic, never an authentication factor.
// No IP/geolocation/device model is inferred; neither raw input nor its hash is exposed.
export function loginClientHash(userAgent:string|null,deviceId?:string){
 return createHash('sha256').update('pos-browser-v1\0'+(deviceId??'no-device-id')+'\0'+(userAgent??'unknown').slice(0,512)).digest('hex')
}
export async function recordLogin(tx:Prisma.TransactionClient,input:{userId:string;organizationId:string;success:boolean;sessionId?:string;clientHash?:string}){
 const now=(await tx.$queryRaw<{now:Date}[]>`SELECT clock_timestamp() AT TIME ZONE 'UTC' AS now`)[0].now,where={userId:input.userId,type:'login_succeeded',expiresAt:{gt:now}}
 const suspicious=input.success
  ? !!await tx.securityEvent.findFirst({where,select:{id:true}})&&!await tx.securityEvent.findFirst({where:{...where,clientHash:input.clientHash},select:{id:true}})
  : await tx.securityEvent.count({where:{userId:input.userId,type:'login_failed',createdAt:{gte:new Date(now.getTime()-15*60000)}}})>=2
 const event=await tx.securityEvent.create({data:{userId:input.userId,organizationId:input.organizationId,type:input.success?'login_succeeded':'login_failed',suspicious,sourceSessionId:input.sessionId,clientHash:input.success?input.clientHash:undefined,createdAt:now,expiresAt:new Date(now.getTime()+RETENTION_MS)}})
 // A bad password is not evidence that the target account performed an action.
 await tx.auditLog.create({data:{organizationId:input.organizationId,actorId:input.success?input.userId:null,entityType:'SecurityEvent',entityId:event.id,action:input.success?'login_succeeded':'login_failed',requestId:requestTrace.getStore()?.requestId,afterData:{suspicious}}})
 return event
}
export async function listSecurity(context:TokenPayload,page:number,limit:number){
 if(!Number.isSafeInteger(page)||page<1||!Number.isSafeInteger(limit)||limit<1||limit>100||(page-1)*limit>2147483647)throw new AccessError(400,'INVALID_PAGINATION')
 return prisma.$transaction(async tx=>{
  await assertLiveContext(tx,context);const now=new Date(),where={userId:context.userId,expiresAt:{gt:now}}
  const total=await tx.securityEvent.count({where}),rows=await tx.securityEvent.findMany({where,skip:(page-1)*limit,take:limit,orderBy:[{createdAt:'desc'},{id:'asc'}],select:{id:true,type:true,suspicious:true,organizationId:true,sourceSessionId:true,createdAt:true,expiresAt:true,outbox:{select:{state:true,attempts:true,maxAttempts:true}}}})
  const noticeWhere={event:where},unread=await tx.securityNotice.count({where:{...noticeWhere,readAt:null}}),notices=await tx.securityNotice.findMany({where:noticeWhere,orderBy:[{readAt:{sort:'asc',nulls:'first'}},{createdAt:'desc'},{id:'asc'}],take:20,select:{id:true,eventId:true,createdAt:true,readAt:true,event:{select:{type:true,organizationId:true}}}})
  return {data:{events:rows.map(({outbox,...row})=>({...row,deliveryState:outbox?.state??null,deliveryAttempts:outbox?.attempts??null,deliveryMaxAttempts:outbox?.maxAttempts??null,canRetry:outbox?.state==='dead'&&outbox.maxAttempts<30})),notices:notices.map(({event,...row})=>({...row,...event})),unread},pagination:{page,limit,total,totalPages:Math.ceil(total/limit)}}
 },{isolationLevel:'RepeatableRead'})
}
export async function readSecurityNotice(context:TokenPayload,noticeId:string,operationId:string){
 return runOperation(context,'security_notice_read',operationId,{noticeId},async tx=>{
  const notice=await tx.securityNotice.findFirst({where:{id:noticeId,event:{userId:context.userId,expiresAt:{gt:new Date()}}},select:{id:true,readAt:true}})
  if(!notice)throw new AccessError(404,'NOT_FOUND')
  if(!notice.readAt)await tx.securityNotice.updateMany({where:{id:noticeId,readAt:null},data:{readAt:new Date()}})
  return tx.securityNotice.findUniqueOrThrow({where:{id:noticeId},select:{id:true,readAt:true}})
 })
}
export async function retrySecurityNotice(context:TokenPayload,eventId:string,operationId:string){
 return runOperation(context,'security_notice_retry',operationId,{eventId},async tx=>{
  const outbox=await tx.securityNoticeOutbox.findFirst({where:{eventId,event:{userId:context.userId,expiresAt:{gt:new Date()}}},select:{id:true,state:true,attempts:true,maxAttempts:true}})
  if(!outbox)throw new AccessError(404,'NOT_FOUND')
  if(outbox.state!=='dead')throw new AccessError(409,'NOTICE_NOT_RETRYABLE','Bildirishnoma xatoli navbatda emas; joriy holatni tekshiring')
  if(outbox.maxAttempts>=30)throw new AccessError(409,'NOTICE_RETRY_LIMIT','Bildirishnoma uchun 30 urinish tugagan; mas’ulga murojaat qiling')
  const result=await tx.securityNoticeOutbox.update({where:{id:outbox.id},data:{state:'pending',maxAttempts:outbox.maxAttempts+3,lastError:null,nextRunAt:new Date()},select:{eventId:true,state:true,attempts:true,maxAttempts:true}})
  await tx.auditLog.create({data:{organizationId:context.organizationId,actorId:context.userId,entityType:'SecurityEvent',entityId:eventId,action:'security_notice_retried',afterData:{attempts:outbox.attempts,maxAttempts:result.maxAttempts}}})
  return result
 })
}
// Short DB-only delivery: SKIP LOCKED + unique source + inbox/audit/outbox in one transaction.
// No owner impersonation and no dependency on the old login session still being live.
export async function deliverSecurityNotices(limit=25,shouldStop:()=>boolean=()=>false){
 if(!Number.isInteger(limit)||limit<1||limit>100)throw new Error('Invalid security batch')
 let delivered=0,processed=0,failed=0
 for(let i=0;i<limit&&!shouldStop();i++){
  let sourceId:string|undefined,sourceBudget:number|undefined
  try{
   const result=await prisma.$transaction(async tx=>{
    const rows=await tx.$queryRaw<{id:string}[]>`SELECT id FROM "SecurityNoticeOutbox" WHERE state='pending' AND "nextRunAt"<=clock_timestamp() ORDER BY "createdAt",id FOR UPDATE SKIP LOCKED LIMIT 1`
    if(!rows[0])return null;sourceId=rows[0].id
    const source=await tx.securityNoticeOutbox.findUniqueOrThrow({where:{id:sourceId},include:{event:true}}),event=source.event;sourceBudget=source.maxAttempts
    const recipients=await tx.$queryRaw<{isActive:boolean}[]>`SELECT "isActive" FROM "User" WHERE id=${event.userId} FOR SHARE`
    const expired=event.expiresAt<=new Date(),active=recipients[0]?.isActive
    if(expired||!active){await tx.securityNoticeOutbox.update({where:{id:source.id},data:{state:'skipped',lastError:expired?'EVENT_EXPIRED':'RECIPIENT_INACTIVE'}});await tx.auditLog.create({data:{organizationId:event.organizationId,actorId:null,entityType:'SecurityEvent',entityId:event.id,action:'security_notice_skipped',afterData:{code:expired?'EVENT_EXPIRED':'RECIPIENT_INACTIVE'}}});return {delivered:false}}
    await tx.securityNotice.create({data:{eventId:event.id}})
    await tx.auditLog.create({data:{organizationId:event.organizationId,actorId:null,entityType:'SecurityEvent',entityId:event.id,action:'security_notice_delivered',afterData:{type:event.type}}})
    await tx.securityNoticeOutbox.update({where:{id:source.id},data:{state:'delivered',attempts:{increment:1},deliveredAt:new Date()}})
    return {delivered:true}
   },{timeout:10000})
   if(!result)break;processed++;if(result.delivered)delivered++
  }catch{
   // Delivery tx rolled back: a concurrent successful worker must never be demoted.
   if(!sourceId||sourceBudget===undefined)throw new Error('Security outbox unavailable')
   await prisma.$executeRaw`UPDATE "SecurityNoticeOutbox" SET attempts=attempts+1,state=CASE WHEN attempts+1>="maxAttempts" THEN 'dead' ELSE 'pending' END,"lastError"='DELIVERY_FAILED',"nextRunAt"=clock_timestamp()+INTERVAL '1 minute' WHERE id=${sourceId} AND state='pending' AND "maxAttempts"=${sourceBudget} AND attempts<"maxAttempts"`
   processed++;failed++
  }
 }
 return {processed,delivered,failed}
}
// Security metadata only. Session identities held by offline/financial records are never purged.
export async function pruneSecurityHistory(limit=100){
 if(!Number.isInteger(limit)||limit<1||limit>1000)throw new Error('Invalid security retention batch')
 return prisma.$transaction(async tx=>{
  const rows=await tx.$queryRaw<{id:string;organizationId:string}[]>`SELECT id,"organizationId" FROM "SecurityEvent" WHERE "expiresAt"<=clock_timestamp() ORDER BY "expiresAt",id FOR UPDATE SKIP LOCKED LIMIT ${limit}`
  for(const row of rows){const pending=await tx.securityNoticeOutbox.findFirst({where:{eventId:row.id,state:{in:['pending','dead']}}});if(pending)await tx.auditLog.create({data:{organizationId:row.organizationId,actorId:null,entityType:'SecurityEvent',entityId:row.id,action:'security_notice_expired',afterData:{code:'EVENT_EXPIRED'}}});await tx.securityEvent.delete({where:{id:row.id}})}
  return rows.length
 },{timeout:10000})
}
