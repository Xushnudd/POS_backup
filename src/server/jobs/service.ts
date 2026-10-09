import {randomUUID} from 'node:crypto'
import {Prisma,type BackgroundJob} from '@prisma/client'
import {z} from 'zod'
import {prisma} from '@/lib/prisma'
import type {TokenPayload} from '@/lib/auth'
import {AccessError} from '../auth/policy'
import {assertLiveContext,audit,runOperation} from '../operations'
import {scanOrganization} from '../monitoring/service'
export const jobSchema=z.object({operationId:z.string().uuid(),type:z.literal('reconciliation'),storeId:z.string().uuid().optional(),reason:z.string().trim().min(3).max(2000)}).strict()
export const retryJobSchema=z.object({operationId:z.string().uuid(),reason:z.string().trim().min(3).max(2000)}).strict()
const payloadSchema=z.object({storeId:z.string().uuid().optional()}).strict()
function owner(ctx:TokenPayload){if(ctx.role!=='owner')throw new AccessError(403,'OWNER_REQUIRED')}
async function event(tx:Prisma.TransactionClient,job:Pick<BackgroundJob,'id'|'attempts'|'generation'>,kind:string,code?:string){await tx.jobEvent.create({data:{jobId:job.id,event:kind,attempt:job.attempts,generation:job.generation,code}})}
function publicJob(job:BackgroundJob){const {leaseToken,payload,...safe}=job;void leaseToken;void payload;return safe}
async function authorize(tx:Prisma.TransactionClient,ctx:TokenPayload,job:BackgroundJob,reason:string){return tx.jobAuthorization.create({data:{jobId:job.id,organizationId:ctx.organizationId,generation:job.generation,userId:ctx.userId,sessionId:ctx.sessionId,reason}})}
export async function enqueueJob(ctx:TokenPayload,input:z.infer<typeof jobSchema>){owner(ctx);return runOperation(ctx,'job.enqueue',input.operationId,input,async tx=>{
 await tx.$queryRaw`SELECT pg_advisory_xact_lock(hashtextextended(${'jobs:'+ctx.organizationId},0))::text`
 if(input.storeId&&!await tx.store.findFirst({where:{id:input.storeId,organizationId:ctx.organizationId,isActive:true}}))throw new AccessError(404,'STORE_NOT_FOUND')
 if(await tx.backgroundJob.count({where:{organizationId:ctx.organizationId,state:{in:['queued','running']}}})>=20)throw new AccessError(429,'JOB_LIMIT')
 const job=await tx.backgroundJob.create({data:{organizationId:ctx.organizationId,type:input.type,payload:input.storeId?{storeId:input.storeId}:{},expiresAt:new Date(Date.now()+3600000)}})
 await authorize(tx,ctx,job,input.reason);await event(tx,job,'queued');await audit(tx,ctx,'BackgroundJob',job.id,'job_queued',{type:job.type,storeId:input.storeId,reason:input.reason});return publicJob(job)
 })}
export async function retryJob(ctx:TokenPayload,id:string,input:z.infer<typeof retryJobSchema>){owner(ctx);return runOperation(ctx,'job.retry',input.operationId,{id,...input},async tx=>{
 await tx.$queryRaw`SELECT id FROM "BackgroundJob" WHERE id=${id} AND "organizationId"=${ctx.organizationId} FOR UPDATE`
 const job=await tx.backgroundJob.findFirst({where:{id,organizationId:ctx.organizationId}});if(!job)throw new AccessError(404,'NOT_FOUND')
 if(job.state!=='dead'||job.generation>=9)throw new AccessError(409,'JOB_NOT_RETRYABLE')
 const payload=payloadSchema.parse(job.payload);if(payload.storeId&&!await tx.store.findFirst({where:{id:payload.storeId,organizationId:ctx.organizationId,isActive:true}}))throw new AccessError(404,'STORE_NOT_FOUND')
 const next={...job,generation:job.generation+1};await authorize(tx,ctx,next,input.reason)
 const updated=await tx.backgroundJob.update({where:{id},data:{generation:next.generation,state:'queued',maxAttempts:job.attempts+3,nextRunAt:new Date(),expiresAt:new Date(Date.now()+3600000),lastError:null,result:Prisma.DbNull,updatedAt:new Date()}})
 await event(tx,updated,'manual_retry');await audit(tx,ctx,'BackgroundJob',id,'job_retried',{generation:updated.generation,reason:input.reason,previousError:job.lastError});return publicJob(updated)
 })}
export async function listJobs(ctx:TokenPayload,page:number,state?:string){owner(ctx);if(!Number.isSafeInteger(page)||page<1||(page-1)*20>2147483647||state&&!['queued','running','succeeded','dead','cancelled'].includes(state))throw new AccessError(400,'INVALID_PAGINATION');return prisma.$transaction(async tx=>{await assertLiveContext(tx,ctx);const where={organizationId:ctx.organizationId,...(state?{state}:{})};return {rows:(await tx.backgroundJob.findMany({where,orderBy:[{createdAt:'desc'},{id:'asc'}],skip:(page-1)*20,take:20})).map(publicJob),total:await tx.backgroundJob.count({where})}},{isolationLevel:'RepeatableRead'})}
export async function jobEvents(ctx:TokenPayload,id:string){owner(ctx);return prisma.$transaction(async tx=>{await assertLiveContext(tx,ctx);if(!await tx.backgroundJob.findFirst({where:{id,organizationId:ctx.organizationId}}))throw new AccessError(404,'NOT_FOUND');return tx.jobEvent.findMany({where:{jobId:id},orderBy:[{createdAt:'desc'},{id:'desc'}],take:100})},{isolationLevel:'RepeatableRead'})}
async function liveAuthorization(tx:Prisma.TransactionClient,job:BackgroundJob,lock=false){
 const rows=await tx.$queryRaw<{valid:boolean}[]>(Prisma.sql`SELECT TRUE AS valid FROM "JobAuthorization" a JOIN "Session" s ON s.id=a."sessionId" JOIN "User" u ON u.id=a."userId" JOIN "OrganizationUser" m ON m."userId"=a."userId" AND m."organizationId"=a."organizationId" WHERE a."jobId"=${job.id} AND a.generation=${job.generation} AND a."organizationId"=${job.organizationId} AND s."organizationId"=a."organizationId" AND s."userId"=a."userId" AND s."revokedAt" IS NULL AND s."expiresAt">clock_timestamp() AND s."idleExpiresAt">clock_timestamp() AND m.role='owner' AND m."isActive" AND u."isActive" ${lock?Prisma.sql`FOR SHARE OF s,m,u`:Prisma.empty}`)
 if(!rows[0]?.valid)throw new AccessError(403,'AUTHORIZATION_CHANGED')
 const payload=payloadSchema.parse(job.payload);if(payload.storeId&&!await tx.store.findFirst({where:{id:payload.storeId,organizationId:job.organizationId,isActive:true}}))throw new AccessError(403,'AUTHORIZATION_CHANGED');return payload
}
export async function recoverJobs(){return prisma.$transaction(async tx=>{
 const rows=await tx.$queryRaw<BackgroundJob[]>`SELECT * FROM "BackgroundJob" WHERE (state='running' AND "leaseUntil"<=NOW()) OR (state='queued' AND "expiresAt"<=NOW()) ORDER BY "createdAt",id FOR UPDATE SKIP LOCKED LIMIT 25`
 for(const job of rows){const expired=job.expiresAt.getTime()<=Date.now(),state=expired?'cancelled':job.attempts>=job.maxAttempts?'dead':'queued',code=expired?'JOB_EXPIRED':'LEASE_EXPIRED';await tx.backgroundJob.update({where:{id:job.id},data:{state,leaseToken:null,leaseUntil:null,lastError:code,nextRunAt:new Date(Date.now()+1000*Math.min(300,2**job.attempts)),updatedAt:new Date()}});await event(tx,job,state==='queued'?'lease_lost':state,code)}return rows.length
 })}
export async function claimJob(){return prisma.$transaction(async tx=>{
 const token=randomUUID(),rows=await tx.$queryRaw<BackgroundJob[]>`UPDATE "BackgroundJob" SET state='running',attempts=attempts+1,"leaseToken"=${token},"leaseUntil"=NOW()+INTERVAL '30 seconds',"heartbeatAt"=NOW(),"updatedAt"=NOW() WHERE id=(SELECT id FROM "BackgroundJob" WHERE state='queued' AND "nextRunAt"<=NOW() AND "expiresAt">NOW() AND attempts<"maxAttempts" ORDER BY "nextRunAt",id FOR UPDATE SKIP LOCKED LIMIT 1) RETURNING *`
 const job=rows[0];if(job)await event(tx,job,'claimed');return job??null
 })}
export async function heartbeatJob(job:BackgroundJob){const changed=await prisma.backgroundJob.updateMany({where:{id:job.id,state:'running',leaseToken:job.leaseToken,leaseUntil:{gt:new Date()},expiresAt:{gt:new Date()}},data:{leaseUntil:new Date(Date.now()+30000),heartbeatAt:new Date(),updatedAt:new Date()}});return changed.count===1}
export async function failJob(job:BackgroundJob,code:'WORK_FAILED'|'AUTHORIZATION_CHANGED'='WORK_FAILED'){return prisma.$transaction(async tx=>{
 await tx.$queryRaw`SELECT id FROM "BackgroundJob" WHERE id=${job.id} FOR UPDATE`
 const current=await tx.backgroundJob.findUnique({where:{id:job.id}});if(!current||current.state!=='running'||current.leaseToken!==job.leaseToken)return false
 const state=code==='AUTHORIZATION_CHANGED'||current.attempts>=current.maxAttempts?'dead':'queued',changed=await tx.backgroundJob.update({where:{id:job.id},data:{state,leaseToken:null,leaseUntil:null,lastError:code,nextRunAt:new Date(Date.now()+1000*Math.min(300,2**current.attempts)),updatedAt:new Date()}});await event(tx,changed,state==='queued'?'retry':'dead',code);return true
 })}
export async function executeJob(job:BackgroundJob){let active=true,inFlight:Promise<boolean>|undefined;const timer=setInterval(()=>{if(active&&!inFlight){inFlight=heartbeatJob(job).catch(()=>false);void inFlight.finally(()=>{inFlight=undefined})}},5000);try{
 const result=await prisma.$transaction(async tx=>{
  const source=await tx.backgroundJob.findFirst({where:{id:job.id,state:'running',generation:job.generation,leaseToken:job.leaseToken,leaseUntil:{gt:new Date()},expiresAt:{gt:new Date()}}});if(!source)throw new AccessError(409,'JOB_LEASE_LOST')
  const payload=await liveAuthorization(tx,source);if(source.type!=='reconciliation')throw new AccessError(400,'UNSUPPORTED_JOB')
  const result=await scanOrganization(tx,source.organizationId,payload.storeId?[payload.storeId]:undefined)
  await liveAuthorization(tx,source,true)
  const updated=await tx.backgroundJob.updateMany({where:{id:job.id,state:'running',generation:job.generation,leaseToken:job.leaseToken,leaseUntil:{gt:new Date()},expiresAt:{gt:new Date()}},data:{state:'succeeded',leaseToken:null,leaseUntil:null,result,lastError:null,updatedAt:new Date()}})
  if(updated.count!==1)throw new AccessError(409,'JOB_LEASE_LOST')
  await event(tx,source,'succeeded');await tx.auditLog.create({data:{organizationId:source.organizationId,actorId:null,entityType:'BackgroundJob',entityId:source.id,action:'system_job_succeeded',afterData:{type:source.type,generation:source.generation,attempt:source.attempts,result}}});return result
 },{isolationLevel:'ReadCommitted',timeout:20000});return {succeeded:true,result}
 }catch(e){await failJob(job,e instanceof AccessError&&e.code==='AUTHORIZATION_CHANGED'?'AUTHORIZATION_CHANGED':'WORK_FAILED');return {succeeded:false}}
 finally{active=false;clearInterval(timer);if(inFlight)await inFlight}
}
