import {createHash} from 'node:crypto'
import {Prisma,type BackgroundJob,type JobExport} from '@prisma/client'
import {prisma} from '@/lib/prisma'
import {AccessError} from '../auth/policy'

export const EXPORT_CHUNK_BYTES=256*1024
export const TENANT_EXPORT_BYTES=1024*1024*1024
const GLOBAL_EXPORT_BYTES=4*TENANT_EXPORT_BYTES
type Authorization=(tx:Prisma.TransactionClient,job:BackgroundJob,lock?:boolean)=>Promise<unknown>

export async function lockExportStorage(tx:Prisma.TransactionClient){
 await tx.$queryRaw`SELECT pg_advisory_xact_lock(hashtextextended('exports:chunk-storage',0))::text`
}
export async function assertJobLease(tx:Prisma.TransactionClient,job:BackgroundJob){
 const rows=await tx.$queryRaw<{id:string}[]>`SELECT id FROM "BackgroundJob" WHERE id=${job.id} AND "organizationId"=${job.organizationId} AND state='running' AND generation=${job.generation} AND "leaseToken"=${job.leaseToken} AND "leaseUntil">clock_timestamp() AND "expiresAt">clock_timestamp() FOR SHARE`
 if(!rows.length)throw new AccessError(409,'JOB_LEASE_LOST')
}
async function reserve(tx:Prisma.TransactionClient,organizationId:string,bytes:number){
 const rows=await tx.$queryRaw<{own:bigint;total:bigint}[]>`
 SELECT COALESCE(sum(size) FILTER(WHERE "organizationId"=${organizationId}),0)::bigint AS own,COALESCE(sum(size),0)::bigint AS total FROM (
 SELECT "organizationId",size FROM "JobExportChunk"
 UNION ALL SELECT "organizationId",size FROM "JobExport" WHERE data IS NOT NULL AND "expiresAt">clock_timestamp()
 UNION ALL SELECT "organizationId",size FROM "ReportScheduleRun" WHERE result IS NOT NULL AND "expiresAt">clock_timestamp()
 ) storage`
 if(rows[0].own+BigInt(bytes)>BigInt(TENANT_EXPORT_BYTES)||rows[0].total+BigInt(bytes)>BigInt(GLOBAL_EXPORT_BYTES))throw new AccessError(413,'EXPORT_QUOTA')
}
// Staged bytes are private until the atomic JobExport + succeeded publication.
// Every write fences a stale worker and rechecks its current owner authorization.
export function tenantExportSink(job:BackgroundJob,authorize:Authorization){
 let buffer=Buffer.alloc(EXPORT_CHUNK_BYTES),used=0,ordinal=0
 const flush=async()=>{
  if(!used)return
  const data=Buffer.from(buffer.subarray(0,used))
  await prisma.$transaction(async tx=>{
   await lockExportStorage(tx);await assertJobLease(tx,job);await authorize(tx,job,true)
   await reserve(tx,job.organizationId,data.length)
   await tx.jobExportChunk.create({data:{jobId:job.id,organizationId:job.organizationId,attempt:job.leaseToken!,ordinal,data,size:data.length,sha256:createHash('sha256').update(data).digest('hex')}})
  })
  ordinal++;used=0
 }
 return {
  async write(chunk:Buffer){
   let offset=0
   while(offset<chunk.length){const count=Math.min(EXPORT_CHUNK_BYTES-used,chunk.length-offset);chunk.copy(buffer,used,offset,offset+count);used+=count;offset+=count;if(used===EXPORT_CHUNK_BYTES)await flush()}
  },
  async finish(){await flush();buffer=Buffer.alloc(0);return ordinal},
 }
}
export async function discardExportAttempt(job:BackgroundJob){
 if(!job.leaseToken)return
 await prisma.jobExportChunk.deleteMany({where:{jobId:job.id,attempt:job.leaseToken,
  job:{exports:{none:{chunkAttempt:job.leaseToken}},OR:[{state:{not:'running'}},{leaseToken:{not:job.leaseToken}},{leaseUntil:{lte:new Date()}},{expiresAt:{lte:new Date()}}]}}})
}
export async function readExportChunk(tx:Prisma.TransactionClient|typeof prisma,file:Pick<JobExport,'jobId'|'organizationId'|'chunkAttempt'>,ordinal:number){
 const row=await tx.jobExportChunk.findUnique({where:{jobId_attempt_ordinal:{jobId:file.jobId,attempt:file.chunkAttempt!,ordinal}}})
 if(!row||row.organizationId!==file.organizationId||row.size!==row.data.length||row.sha256!==createHash('sha256').update(row.data).digest('hex'))throw new AccessError(503,'EXPORT_CORRUPTED')
 return row.data
}
export async function verifyChunkedExport(file:JobExport,signal?:AbortSignal){
 const hash=createHash('sha256');let bytes=0
 for(let ordinal=0;ordinal<file.chunkCount;ordinal++){if(signal?.aborted)throw new AccessError(400,'EXPORT_CANCELLED');const data=await readExportChunk(prisma,file,ordinal);bytes+=data.length;hash.update(data)}
 if(bytes!==file.size||hash.digest('hex')!==file.sha256)throw new AccessError(503,'EXPORT_CORRUPTED')
}
