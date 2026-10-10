import test,{after} from 'node:test';import assert from 'node:assert/strict';import {randomUUID,randomBytes} from 'node:crypto';import {prisma} from '@/lib/prisma';import {sessionHash,verifySession} from '@/server/auth/session';import {enqueueJob,claimJob,executeJob} from '@/server/jobs/service';
const url=new URL(process.env.DATABASE_URL??'');if(url.hostname!=='127.0.0.1'||url.port!=='55439'||url.pathname!=='/pos_test')throw Error('Isolated DB only');const orgs:string[]=[],users:string[]=[];after(async()=>{await prisma.organization.deleteMany({where:{id:{in:orgs}}});await prisma.user.deleteMany({where:{id:{in:users}}});await prisma.$disconnect()});const rejected=(code:string)=>(e:unknown)=>!!e&&typeof e==='object'&&'code'in e&&e.code===code;
async function fixture(){const org=await prisma.organization.create({data:{name:'Background jobs',phone:randomUUID()}});orgs.push(org.id);const user=await prisma.user.create({data:{fullName:'Job owner',phone:randomUUID(),passwordHash:'not-a-login'}});users.push(user.id);const member=await prisma.organizationUser.create({data:{organizationId:org.id,userId:user.id,role:'owner'}}),store=await prisma.store.create({data:{organizationId:org.id,name:'Selected branch'}}),otherStore=await prisma.store.create({data:{organizationId:org.id,name:'Other branch'}}),product=await prisma.product.create({data:{organizationId:org.id,name:'Physical stock discrepancy',sku:randomUUID(),barcode:randomUUID(),unit:'dona',salePrice:1,costPrice:0}});for(const branch of [store,otherStore])await prisma.inventoryBalance.create({data:{storeId:branch.id,productId:product.id,quantity:2}});const token=randomBytes(32).toString('base64url'),session=await prisma.session.create({data:{organizationId:org.id,userId:user.id,tokenHash:sessionHash(token),expiresAt:new Date(Date.now()+3600000),idleExpiresAt:new Date(Date.now()+3600000)}}),ctx=(await verifySession(token))!;return {org,user,member,store,otherStore,session,ctx,token,product}}
import {runOperation} from '@/server/operations'
import {createHash} from 'node:crypto'
import {tenantExport} from '@/server/jobs/tenant-export'
import {readJobExport} from '@/server/jobs/catalog-export'
import {jobSchema} from '@/server/jobs/service'
import {NextRequest} from 'next/server'
import {GET} from '@/app/api/jobs/[id]/export/route'
test('Tenant archive includes all branches and child rows, exact decimals, binary files and a verifiable manifest, never foreign data or credentials',async()=>{
 const own=await fixture(),foreign=await fixture()
 await prisma.product.updateMany({where:{organizationId:own.org.id},data:{salePrice:'99999999.99',costPrice:'1.123456'}})
 await prisma.user.update({where:{id:own.user.id},data:{passwordHash:'PASSWORD_SENTINEL'}})
 const bytes=Buffer.from('isolated file content')
 await prisma.fileAsset.create({data:{organizationId:own.org.id,productId:own.product.id,createdBy:own.user.id,name:'fixture.webp',mime:'image/webp',size:bytes.length,sha256:createHash('sha256').update(bytes).digest('hex'),width:1,height:1,data:bytes}})
 await runOperation(own.ctx,'test.export.secret',randomUUID(),{},async()=>({token:'OPERATION_CREDENTIAL_SENTINEL'}))
 const file=await tenantExport(own.org.id),text=file.data.toString(),archive=JSON.parse(text)
 assert.equal(file.sha256,createHash('sha256').update(file.data).digest('hex'))
 assert.equal(archive.organizationId,own.org.id);assert.equal(archive.datasets.Store.length,2);assert.equal(archive.datasets.InventoryBalance.length,2)
 assert.equal(archive.datasets.Product[0].salePrice,'99999999.99');assert.equal(archive.datasets.Product[0].costPrice,'1.123456')
 assert.equal(archive.datasets.FileAsset[0].data.data,bytes.toString('base64'))
 for(const entry of archive.manifest.datasets){const rows=archive.datasets[entry.model];assert.equal(rows.length,entry.rows);assert.equal(createHash('sha256').update(rows.map((row:unknown)=>JSON.stringify(row)+'\n').join('')).digest('hex'),entry.sha256)}
 assert.equal(file.rowCount,Object.values(archive.datasets).reduce((total:number,rows)=>total+(rows as unknown[]).length,0))
 for(const forbidden of [foreign.org.id,foreign.user.id,foreign.store.id,own.token,'PASSWORD_SENTINEL','OPERATION_CREDENTIAL_SENTINEL'])assert.ok(!text.includes(forbidden),forbidden)
 assert.ok(!('passwordHash' in archive.datasets.User[0]));assert.ok(!('pinHash' in archive.datasets.OrganizationUser[0]));assert.ok(!('Session' in archive.datasets));assert.ok(!('Operation' in archive.datasets));assert.ok(archive.manifest.omittedModels.Session);assert.ok(archive.manifest.omittedFields.AuditLog.includes('afterData'))
})
test('Tenant export uses the existing durable job, one artifact, scoped audited download and live authorization',async()=>{
 const own=await fixture(),foreign=await fixture(),input={type:'tenant_export' as const,operationId:randomUUID(),reason:'Owner approved complete business export'}
 assert.equal(jobSchema.safeParse({...input,storeId:own.store.id}).success,false)
 assert.equal(jobSchema.safeParse({...input,filter:{active:'all'}}).success,false)
 const job=await enqueueJob(own.ctx,input);assert.equal((await enqueueJob(own.ctx,input)).id,job.id)
 const claimed=(await claimJob())!;assert.equal(claimed.id,job.id);assert.equal((await executeJob(claimed)).succeeded,true)
 assert.equal((await executeJob(claimed)).succeeded,false);assert.equal(await prisma.jobExport.count({where:{jobId:job.id}}),1)
 const artifact=await readJobExport(own.ctx,job.id);assert.equal(artifact.mime,'application/json');assert.equal(JSON.parse(artifact.data!.toString()).organizationId,own.org.id)
 await assert.rejects(readJobExport(foreign.ctx,job.id),rejected('NOT_FOUND'))
 const request=new NextRequest('http://localhost:3000/api/jobs/'+job.id+'/export',{headers:{cookie:'pos_session='+own.token}})
 const response=await GET(request,{params:Promise.resolve({id:job.id})});assert.equal(response.status,200);assert.equal(response.headers.get('content-type'),'application/json');assert.equal((await response.json()).organizationId,own.org.id)
 await prisma.session.update({where:{id:own.session.id},data:{revokedAt:new Date()}})
 await assert.rejects(readJobExport(own.ctx,job.id),rejected('SESSION_CHANGED'))
 const other=await fixture(),next=await enqueueJob(other.ctx,{...input,operationId:randomUUID()});const lease=(await claimJob())!;assert.equal(lease.id,next.id)
 await prisma.session.update({where:{id:other.session.id},data:{revokedAt:new Date()}})
 assert.equal((await executeJob(lease)).succeeded,false);assert.equal(await prisma.jobExport.count({where:{jobId:next.id}}),0)
})
test('Oversized exports fail without publishing a partial artifact or business mutation',async()=>{
 const own=await fixture(),bytes=Buffer.alloc(524288,42),sha256=createHash('sha256').update(bytes).digest('hex')
 await prisma.fileAsset.createMany({data:Array.from({length:25},(_,i)=>({id:randomUUID(),organizationId:own.org.id,productId:own.product.id,createdBy:own.user.id,name:'limit-'+i+'.webp',mime:'image/webp',size:bytes.length,sha256,width:1,height:1,data:bytes}))})
 await assert.rejects(tenantExport(own.org.id),rejected('EXPORT_TOO_LARGE'))
 const job=await enqueueJob(own.ctx,{type:'tenant_export',operationId:randomUUID(),reason:'Reviewed oversized archive failure'})
 const lease=(await claimJob())!;assert.equal(lease.id,job.id);assert.equal((await executeJob(lease)).succeeded,false)
 assert.equal(await prisma.jobExport.count({where:{jobId:job.id}}),0)
 const failed=await prisma.backgroundJob.findUniqueOrThrow({where:{id:job.id}});assert.equal(failed.state,'dead');assert.equal(failed.lastError,'EXPORT_TOO_LARGE')
 assert.equal(await prisma.sale.count({where:{organizationId:own.org.id}}),0)
 assert.equal(await claimJob(),null)
})
test('Late success-audit failure rolls back artifact and job success; the same claimed job retries safely',async()=>{
 const own=await fixture(),job=await enqueueJob(own.ctx,{type:'tenant_export',operationId:randomUUID(),reason:'Atomic tenant export artifact audit'})
 const lease=(await claimJob())!;assert.equal(lease.id,job.id)
 await prisma.$executeRawUnsafe(`CREATE FUNCTION tenant_export_test_failure() RETURNS trigger LANGUAGE plpgsql AS $$ BEGIN IF NEW.action='system_job_succeeded' THEN RAISE EXCEPTION 'Isolated late audit failure'; END IF; RETURN NEW; END $$`)
 await prisma.$executeRawUnsafe('CREATE TRIGGER tenant_export_test_failure BEFORE INSERT ON "AuditLog" FOR EACH ROW EXECUTE FUNCTION tenant_export_test_failure()')
 try{assert.equal((await executeJob(lease)).succeeded,false);assert.equal(await prisma.jobExport.count({where:{jobId:job.id}}),0);assert.equal((await prisma.backgroundJob.findUniqueOrThrow({where:{id:job.id}})).state,'queued')}finally{await prisma.$executeRawUnsafe('DROP TRIGGER tenant_export_test_failure ON "AuditLog"');await prisma.$executeRawUnsafe('DROP FUNCTION tenant_export_test_failure()')}
 await prisma.backgroundJob.update({where:{id:job.id},data:{nextRunAt:new Date(Date.now()-1)}})
 const retry=(await claimJob())!;assert.equal(retry.id,job.id);assert.equal((await executeJob(retry)).succeeded,true)
 assert.equal(await prisma.jobExport.count({where:{jobId:job.id}}),1);assert.equal(await prisma.auditLog.count({where:{entityId:job.id,action:'system_job_succeeded'}}),1)
})
