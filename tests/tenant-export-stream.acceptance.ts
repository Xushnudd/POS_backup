import test,{after} from 'node:test'
import assert from 'node:assert/strict'
import {randomUUID,randomBytes,createHash} from 'node:crypto'
import {mkdtemp,readFile,readdir,rm,stat,writeFile,chmod} from 'node:fs/promises'
import {tmpdir} from 'node:os'
import {join} from 'node:path'
import {prisma} from '@/lib/prisma'
import {sessionHash,verifySession} from '@/server/auth/session'
import {tenantExport,streamTenantExport} from '@/server/jobs/tenant-export'
import {tenantExportToFile} from '@/server/jobs/tenant-export-file'

const url=new URL(process.env.DATABASE_URL??'')
if(url.hostname!=='127.0.0.1'||url.port!=='55449'||url.pathname!=='/pos_export_test')throw Error('Dedicated export test DB only')
const orgs:string[]=[],users:string[]=[],dirs:string[]=[]
after(async()=>{
 await prisma.organization.deleteMany({where:{id:{in:orgs}}});await prisma.user.deleteMany({where:{id:{in:users}}})
 await prisma.$disconnect();for(const dir of dirs)await rm(dir,{recursive:true,force:true})
})
async function fixture(){
 const org=await prisma.organization.create({data:{name:'Private export fixture',phone:randomUUID()}});orgs.push(org.id)
 const user=await prisma.user.create({data:{fullName:'Export owner',phone:randomUUID(),passwordHash:'OMIT_TEST_PASSWORD'}});users.push(user.id)
 await prisma.organizationUser.create({data:{organizationId:org.id,userId:user.id,role:'owner'}})
 const product=await prisma.product.create({data:{organizationId:org.id,name:'Export product',sku:randomUUID(),barcode:randomUUID(),unit:'dona',salePrice:'123.45',costPrice:'1.123456'}})
 const token=randomBytes(32).toString('base64url')
 const session=await prisma.session.create({data:{organizationId:org.id,userId:user.id,tokenHash:sessionHash(token),expiresAt:new Date(Date.now()+3600000),idleExpiresAt:new Date(Date.now()+3600000)}})
 const ctx=(await verifySession(token,{touch:false}))!
 const dir=await mkdtemp(join(tmpdir(),'private-tenant-export-'));dirs.push(dir)
 return {org,user,product,session,ctx,dir,token}
}
test('large private export exceeds 16MiB with exact manifest, no foreign rows, and original bounded API retained',async()=>{
 const own=await fixture(),foreign=await fixture(),bytes=randomBytes(524288),sha256=createHash('sha256').update(bytes).digest('hex')
 await prisma.fileAsset.createMany({data:Array.from({length:25},(_,i)=>({id:randomUUID(),organizationId:own.org.id,productId:own.product.id,createdBy:own.user.id,name:'test-'+i+'.webp',mime:'image/webp',size:bytes.length,sha256,width:1,height:1,data:bytes}))})
 await assert.rejects(tenantExport(own.org.id),{code:'EXPORT_TOO_LARGE'})
 const output=join(own.dir,'archive.json'),meta=await tenantExportToFile(own.ctx,output,'Reviewed isolated large export')
 const raw=await readFile(output),archive=JSON.parse(raw.toString())
 assert.ok(raw.length>16*1024*1024);assert.equal(meta.size,raw.length)
 assert.equal(meta.sha256,createHash('sha256').update(raw).digest('hex'))
 assert.equal((await stat(output)).mode&0o777,0o600)
 assert.equal(archive.datasets.FileAsset.length,25)
 assert.equal(archive.datasets.Product[0].costPrice,'1.123456')
 for(const forbidden of [foreign.org.id,foreign.user.id,own.token,'OMIT_TEST_PASSWORD'])assert.ok(!raw.includes(forbidden))
 for(const ds of archive.manifest.datasets){const rows=archive.datasets[ds.model];assert.equal(ds.rows,rows.length);assert.equal(ds.sha256,createHash('sha256').update(rows.map((row:unknown)=>JSON.stringify(row)+'\n').join('')).digest('hex'))}
 assert.equal(await prisma.jobExport.count({where:{organizationId:own.org.id}}),0)
 assert.equal(await prisma.auditLog.count({where:{organizationId:own.org.id,action:'operator_export_prepared'}}),1)
 assert.deepEqual(await readdir(own.dir),['archive.json'])
})
test('stream keeps one snapshot while concurrent rows are added and awaits every sink write',async()=>{
 const own=await fixture();let inserted=false,busy=false
 const chunks:Buffer[]=[]
 const meta=await streamTenantExport(own.org.id,async chunk=>{
  assert.equal(busy,false);busy=true
  if(!inserted){inserted=true;await prisma.product.create({data:{organizationId:own.org.id,name:'AFTER_SNAPSHOT',sku:randomUUID(),barcode:randomUUID(),unit:'dona',salePrice:1,costPrice:1}})}
  await new Promise(resolve=>setTimeout(resolve,1));chunks.push(chunk);busy=false
 })
 const raw=Buffer.concat(chunks);assert.equal(meta.size,raw.length)
 const data=JSON.parse(raw.toString());assert.equal(data.datasets.Product.length,1)
 assert.ok(!raw.includes('AFTER_SNAPSHOT'))
 await assert.rejects(streamTenantExport(own.org.id,async()=>{throw Error('DISK_FAILURE')}),/DISK_FAILURE/)
})
test('file publication rejects nonowners, revoked sessions, public directories and overwrites',async()=>{
 const own=await fixture(),output=join(own.dir,'archive.json')
 await assert.rejects(tenantExportToFile({...own.ctx,role:'cashier'},output,'Denied export'),{code:'OWNER_REQUIRED'})
 await chmod(own.dir,0o755)
 await assert.rejects(tenantExportToFile(own.ctx,output,'Denied export'),{code:'EXPORT_PRIVATE_DIRECTORY_REQUIRED'})
 await chmod(own.dir,0o700);await writeFile(output,'original',{mode:0o600})
 await assert.rejects(tenantExportToFile(own.ctx,output,'No overwrite'),{code:'EEXIST'})
 assert.equal(await readFile(output,'utf8'),'original');assert.deepEqual(await readdir(own.dir),['archive.json'])
 await prisma.session.update({where:{id:own.session.id},data:{revokedAt:new Date()}})
 await assert.rejects(tenantExportToFile(own.ctx,join(own.dir,'denied.json'),'Revoked owner'),{code:'SESSION_CHANGED'})
})
test('late audit failure leaves no final or partial archive',async()=>{
 const own=await fixture(),output=join(own.dir,'archive.json')
 await prisma.$executeRawUnsafe(`CREATE FUNCTION export_stream_test_failure() RETURNS trigger LANGUAGE plpgsql AS $$ BEGIN IF NEW.action='operator_export_prepared' THEN RAISE EXCEPTION 'ISOLATED_AUDIT_FAILURE'; END IF; RETURN NEW; END $$`)
 await prisma.$executeRawUnsafe('CREATE TRIGGER export_stream_test_failure BEFORE INSERT ON "AuditLog" FOR EACH ROW EXECUTE FUNCTION export_stream_test_failure()')
 try{await assert.rejects(tenantExportToFile(own.ctx,output,'Audit failure check'));assert.deepEqual(await readdir(own.dir),[])}
 finally{await prisma.$executeRawUnsafe('DROP TRIGGER export_stream_test_failure ON "AuditLog"');await prisma.$executeRawUnsafe('DROP FUNCTION export_stream_test_failure()')}
})
