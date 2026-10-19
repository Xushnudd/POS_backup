// Run only against this turn's isolated 127.0.0.1:55439/pos_test database.
const fs=require('fs'),assert=require('assert/strict'),{randomUUID,randomBytes,createHash}=require('crypto');
const {prisma}=require(process.cwd()+'/.test-build/src/lib/prisma'),{verifySession,sessionHash}=require(process.cwd()+'/.test-build/src/server/auth/session'),{enqueueJob,claimJob,executeJob}=require(process.cwd()+'/.test-build/src/server/jobs/service'),{verifyChunkedExport}=require(process.cwd()+'/.test-build/src/server/jobs/export-chunks');
const url=new URL(process.env.DATABASE_URL??'');if(url.hostname!=='127.0.0.1'||url.port!=='55439'||url.pathname!=='/pos_test'||url.username!=='pos_test')throw Error('Own isolated DB required');
const state='/tmp/pos-preparation-restart-fixture.json';
async function main(){
 if(process.argv[2]==='prepare'){
  const org=await prisma.organization.create({data:{name:'Synthetic server restart '+randomUUID(),phone:randomUUID()}}),user=await prisma.user.create({data:{fullName:'Synthetic restart owner',phone:randomUUID(),passwordHash:'not-a-login'}});
  await prisma.organizationUser.create({data:{organizationId:org.id,userId:user.id,role:'owner'}});
  const product=await prisma.product.create({data:{organizationId:org.id,name:'Restart fixture item',sku:randomUUID(),barcode:randomUUID(),unit:'dona',salePrice:1,costPrice:1}}),data=Buffer.alloc(524288,42);
  await prisma.fileAsset.createMany({data:Array.from({length:25},(_,i)=>({organizationId:org.id,productId:product.id,createdBy:user.id,name:'restart-'+i+'.webp',mime:'image/webp',width:1,height:1,size:data.length,sha256:createHash('sha256').update(data).digest('hex'),data}))});
  const token=randomBytes(32).toString('base64url');await prisma.session.create({data:{organizationId:org.id,userId:user.id,tokenHash:sessionHash(token),expiresAt:new Date(Date.now()+3600000),idleExpiresAt:new Date(Date.now()+3600000)}});
  const job=await enqueueJob(await verifySession(token),{type:'tenant_export',operationId:randomUUID(),reason:'Isolated persistent storage restart fixture'}),lease=await claimJob();assert.equal(lease.id,job.id);assert.equal((await executeJob(lease)).succeeded,true);
  const file=await prisma.jobExport.findUniqueOrThrow({where:{jobId:job.id}});assert.ok(file.chunkCount>64);await verifyChunkedExport(file);
  fs.writeFileSync(state,JSON.stringify({organizationId:org.id,userId:user.id,jobId:job.id,size:file.size,sha256:file.sha256,chunkCount:file.chunkCount}),{mode:0o600});console.log(JSON.stringify({prepared:true,size:file.size,chunks:file.chunkCount}));return;
 }
 const fixture=JSON.parse(fs.readFileSync(state)),org=await prisma.organization.findUniqueOrThrow({where:{id:fixture.organizationId}}),user=await prisma.user.findUniqueOrThrow({where:{id:fixture.userId}});assert.ok(org.name.startsWith('Synthetic server restart '));assert.equal(user.passwordHash,'not-a-login');
 if(process.argv[2]==='verify'){
  const file=await prisma.jobExport.findUniqueOrThrow({where:{jobId:fixture.jobId}});assert.equal(file.size,fixture.size);assert.equal(file.sha256,fixture.sha256);assert.equal(file.chunkCount,fixture.chunkCount);await verifyChunkedExport(file);
  assert.equal((await prisma.backgroundJob.findUniqueOrThrow({where:{id:fixture.jobId}})).state,'succeeded');assert.equal(await prisma.jobExport.count({where:{jobId:fixture.jobId}}),1);
  const proof={at:new Date().toISOString(),scope:'Isolated PostgreSQL SIGKILL/restart on an owned persistent Docker volume; not a physical power-loss or production/off-site test',survived:true,size:file.size,sha256:file.sha256,chunks:file.chunkCount,publicationCount:1,guardsDisabled:false};fs.writeFileSync('tasks/evidence/server-preparation-20261017/database-restart.json',JSON.stringify(proof,null,2)+'\n');console.log(JSON.stringify(proof));return;
 }
 if(process.argv[2]!=='cleanup')throw Error('Unknown synthetic phase');await prisma.organization.delete({where:{id:org.id}});await prisma.user.delete({where:{id:user.id}});fs.unlinkSync(state);console.log('Synthetic restart fixture cleaned');
}
main().catch(e=>{console.error(e.message);process.exitCode=1}).finally(()=>prisma.$disconnect());
