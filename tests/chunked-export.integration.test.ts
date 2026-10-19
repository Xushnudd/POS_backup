import {test,after} from 'node:test'
import assert from 'node:assert/strict'
import {randomUUID,randomBytes,createHash} from 'node:crypto'
import {spawn} from 'node:child_process'
import {hash} from 'bcryptjs'
import {NextRequest} from 'next/server'
import {prisma} from '@/lib/prisma'
import {sessionHash,verifySession} from '@/server/auth/session'
import {enqueueJob,claimJob,executeJob,recoverJobs} from '@/server/jobs/service'
import {pruneJobExports} from '@/server/jobs/catalog-export'
import {EXPORT_CHUNK_BYTES} from '@/server/jobs/export-chunks'
import {requestClosure} from '@/server/retention/closure'
import {GET} from '@/app/api/jobs/[id]/export/route'
const url=new URL(process.env.DATABASE_URL??'')
if(url.hostname!=='127.0.0.1'||url.port!=='55439'||url.pathname!=='/pos_test'||url.username!=='pos_test')throw Error('Isolated test DB required')
const orgs:string[]=[],users:string[]=[]
after(async()=>{await prisma.organization.deleteMany({where:{id:{in:orgs}}});await prisma.user.deleteMany({where:{id:{in:users}}});await prisma.$disconnect()})
async function fixture(large=false){
 const org=await prisma.organization.create({data:{name:'Synthetic chunk export',phone:randomUUID()}});orgs.push(org.id)
 const password='synthetic-export-password',user=await prisma.user.create({data:{fullName:'Chunk owner',phone:randomUUID(),passwordHash:await hash(password,4)}});users.push(user.id)
 await prisma.organizationUser.create({data:{organizationId:org.id,userId:user.id,role:'owner'}})
 const product=await prisma.product.create({data:{organizationId:org.id,name:'Export exact product',sku:randomUUID(),barcode:randomUUID(),unit:'dona',salePrice:'0.01',costPrice:'1.123456'}})
 if(large){const data=Buffer.alloc(524288,42),sha256=createHash('sha256').update(data).digest('hex');await prisma.fileAsset.createMany({data:Array.from({length:25},(_,i)=>({organizationId:org.id,productId:product.id,createdBy:user.id,name:'synthetic-'+i+'.webp',mime:'image/webp',width:1,height:1,data,size:data.length,sha256}))})}
 const token=randomBytes(32).toString('base64url'),session=await prisma.session.create({data:{organizationId:org.id,userId:user.id,tokenHash:sessionHash(token),expiresAt:new Date(Date.now()+3600000),idleExpiresAt:new Date(Date.now()+3600000)}})
 return {org,user,product,password,token,session,ctx:(await verifySession(token))!}
}
async function enqueue(f:Awaited<ReturnType<typeof fixture>>){return enqueueJob(f.ctx,{type:'tenant_export',operationId:randomUUID(),reason:'Owner approved synthetic complete export'})}
const request=(token:string,id:string,metadata=false)=>new NextRequest('http://localhost:3000/api/jobs/'+id+'/export'+(metadata?'?metadata=1':''),{headers:{cookie:'pos_session='+token}})
const download=(token:string,id:string,metadata=false)=>GET(request(token,id,metadata),{params:Promise.resolve({id})})
test('Large web archive is exact, private, immutable and auditable only after complete streaming; closure accepts it',async()=>{
 const f=await fixture(true),foreign=await fixture(),job=await enqueue(f),lease=(await claimJob())!
 assert.equal(lease.id,job.id);assert.equal((await executeJob(lease)).succeeded,true)
 const artifact=await prisma.jobExport.findUniqueOrThrow({where:{jobId:job.id}})
 assert.equal(artifact.data,null);assert.ok(artifact.size>16*1024*1024);assert.ok(artifact.chunkCount>64)
 assert.equal(await prisma.jobExportChunk.count({where:{jobId:job.id}}),artifact.chunkCount)
 const metadata=await download(f.token,job.id,true);assert.equal(metadata.status,200);assert.equal((await metadata.json()).data.sha256,artifact.sha256)
 assert.equal((await download(foreign.token,job.id)).status,404)
 const cancelled=await download(f.token,job.id);assert.equal(cancelled.status,200);assert.equal(cancelled.headers.get('content-length'),String(artifact.size))
 const reader=cancelled.body!.getReader(),first=await reader.read();assert.ok(first.value!.length<=EXPORT_CHUNK_BYTES);await reader.cancel()
 assert.equal(await prisma.auditLog.count({where:{entityId:job.id,action:'export_downloaded'}}),0)
 const policy=await prisma.retentionPolicy.findUniqueOrThrow({where:{key:'default'}}),close={operationId:randomUUID(),expectedPolicyVersionId:policy.currentVersionId,exportJobId:job.id,reason:'Synthetic closure after complete delivery',password:f.password}
 await assert.rejects(requestClosure(f.ctx,close),{code:'CLOSURE_EXPORT_REQUIRED'})
 const response=await download(f.token,job.id),bytes=Buffer.from(await response.arrayBuffer())
 assert.equal(bytes.length,artifact.size);assert.equal(createHash('sha256').update(bytes).digest('hex'),artifact.sha256)
 assert.equal(response.headers.get('x-content-type-options'),'nosniff');assert.match(response.headers.get('content-security-policy')??'',/sandbox/)
 const archive=JSON.parse(bytes.toString());assert.equal(archive.datasets.Product[0].costPrice,'1.123456');assert.equal(archive.datasets.FileAsset.length,25)
 assert.equal(archive.datasets.JobExportChunk,undefined);assert.equal(archive.datasets.Session,undefined);assert.ok(!bytes.includes(Buffer.from(foreign.org.id)));assert.ok(!bytes.includes(Buffer.from(f.token)))
 assert.equal(await prisma.auditLog.count({where:{entityId:job.id,action:'export_downloaded'}}),1)
 assert.equal((await prisma.auditLog.findFirstOrThrow({where:{entityId:job.id,action:'export_downloaded'}})).requestId,response.headers.get('x-request-id'))
 const chunk=await prisma.jobExportChunk.findFirstOrThrow({where:{jobId:job.id}})
 await assert.rejects(prisma.jobExportChunk.update({where:{jobId_attempt_ordinal:{jobId:job.id,attempt:chunk.attempt,ordinal:chunk.ordinal}},data:{data:Buffer.from('tampered')}}))
 await assert.rejects(prisma.jobExportChunk.deleteMany({where:{jobId:job.id}}))
 await assert.rejects(prisma.jobExport.update({where:{jobId:job.id},data:{chunkCount:1}}))
 const closed=await requestClosure(f.ctx,close);assert.equal(closed.exportSha256,artifact.sha256)
 const pending=await download(f.token,job.id),revokeReader=pending.body!.getReader();await revokeReader.read()
 await prisma.session.update({where:{id:f.session.id},data:{revokedAt:new Date()}})
 await assert.rejects(revokeReader.read());assert.equal(await prisma.auditLog.count({where:{entityId:job.id,action:'export_downloaded'}}),1)
 assert.equal((await download(f.token,job.id)).status,401)
 assert.equal(await prisma.sale.count({where:{organizationId:f.org.id}}),0);assert.equal(await prisma.payment.count({where:{organizationId:f.org.id}}),0)
})
test('A killed worker never exposes partial bytes; persisted lease recovery fences the old attempt and publishes exactly once',async()=>{
 const f=await fixture(true),job=await enqueue(f)
 const child=spawn(process.execPath,['--require','./scripts/test-resolver.cjs','-e',"const {prisma}=require('./.test-build/src/lib/prisma');const {claimJob,executeJob}=require('./.test-build/src/server/jobs/service');(async()=>{const j=await claimJob();if(!j)throw Error('No synthetic job');await executeJob(j)})().finally(()=>prisma.$disconnect())"],{env:{...process.env},stdio:'ignore'})
 const exited=new Promise(resolve=>child.once('exit',resolve))
 let staged=false
 try{
  const until=Date.now()+20000
  while(Date.now()<until){if(await prisma.jobExportChunk.count({where:{jobId:job.id}})>0){staged=true;break}if(child.exitCode!==null)break;await new Promise(resolve=>setTimeout(resolve,10))}
  assert.equal(staged,true)
 }finally{child.kill('SIGKILL');await exited}
 const stale=await prisma.backgroundJob.findUniqueOrThrow({where:{id:job.id}});assert.equal(stale.state,'running');assert.ok(await prisma.jobExportChunk.count({where:{jobId:job.id}})>0)
 assert.equal(await prisma.jobExport.count({where:{jobId:job.id}}),0);assert.equal((await download(f.token,job.id)).status,404)
 await prisma.backgroundJob.update({where:{id:job.id},data:{leaseUntil:new Date(Date.now()-1000)}})
 await recoverJobs();await pruneJobExports();assert.equal(await prisma.jobExportChunk.count({where:{jobId:job.id}}),0)
 await prisma.backgroundJob.update({where:{id:job.id},data:{nextRunAt:new Date(Date.now()-1)}})
 const current=(await claimJob())!;assert.equal(current.id,job.id);assert.notEqual(current.leaseToken,stale.leaseToken)
 assert.equal((await executeJob(stale)).succeeded,false)
 const data=Buffer.from('stale')
 await assert.rejects(prisma.jobExportChunk.create({data:{jobId:job.id,organizationId:f.org.id,attempt:stale.leaseToken!,ordinal:0,data,size:data.length,sha256:createHash('sha256').update(data).digest('hex')}}))
 assert.equal((await executeJob(current)).succeeded,true)
 assert.equal(await prisma.jobExport.count({where:{jobId:job.id}}),1);assert.equal(await prisma.auditLog.count({where:{entityId:job.id,action:'system_job_succeeded'}}),1)
 assert.equal(await prisma.jobEvent.count({where:{jobId:job.id,event:'lease_lost'}}),1)
})
test('Expired chunk bytes are pruned while metadata/history stays and incomplete publication is rejected natively',async()=>{
 const f=await fixture(),job=await enqueue(f),lease=(await claimJob())!,data=Buffer.from('synthetic'),sha256=createHash('sha256').update(data).digest('hex')
 assert.equal(lease.id,job.id)
 await prisma.jobExportChunk.create({data:{jobId:job.id,organizationId:f.org.id,attempt:lease.leaseToken!,ordinal:0,data,size:data.length,sha256}})
 const meta={jobId:job.id,organizationId:f.org.id,filename:'synthetic.json',mime:'application/json',size:data.length,sha256,rowCount:0,asOf:new Date(),expiresAt:new Date(Date.now()-1000),chunkAttempt:lease.leaseToken}
 await assert.rejects(prisma.jobExport.create({data:{...meta,chunkCount:2}}))
 await prisma.$transaction(async tx=>{await tx.jobExport.create({data:{...meta,chunkCount:1}});await tx.backgroundJob.update({where:{id:job.id},data:{state:'succeeded',leaseToken:null,leaseUntil:null}})})
 assert.equal((await download(f.token,job.id)).status,410)
 await pruneJobExports();assert.equal(await prisma.jobExportChunk.count({where:{jobId:job.id}}),0)
 assert.equal((await prisma.jobExport.findUniqueOrThrow({where:{jobId:job.id}})).sha256,sha256)
 assert.equal((await prisma.backgroundJob.findUniqueOrThrow({where:{id:job.id}})).state,'succeeded')
})
