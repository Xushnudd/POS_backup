import {test,after} from 'node:test'
import assert from 'node:assert/strict'
import {randomUUID,createHash} from 'node:crypto'
import {execFileSync} from 'node:child_process'
import {mkdtempSync,readFileSync,rmSync,statSync,chmodSync,openSync,closeSync} from 'node:fs'
import {join} from 'node:path'
import {tmpdir} from 'node:os'
import {Prisma,PrismaClient} from '@prisma/client'
import {prisma} from '@/lib/prisma'
import {tenantExport} from '@/server/jobs/tenant-export'
import {planTenantRecovery} from '@/server/jobs/tenant-recovery'
const connection=new URL(process.env.DATABASE_URL??'')
if(connection.hostname!=='127.0.0.1'||connection.port!=='55439'||connection.pathname!=='/pos_test'||connection.username!=='pos_test')throw new Error('Isolated database only')
const container=process.env.POS_TEST_PSQL_CONTAINER??'pos-plan-test-db'
if(!/^[a-zA-Z0-9][a-zA-Z0-9_.-]{0,127}$/.test(container))throw new Error('Isolated PostgreSQL container only')
const organizations:string[]=[],users:string[]=[]
after(async()=>{await prisma.organization.deleteMany({where:{id:{in:organizations}}});await prisma.user.deleteMany({where:{id:{in:users}}});await prisma.$disconnect()})
const docker=(args:string[],input?:string|Buffer)=>execFileSync('docker',['exec','-i',container,...args],{input,maxBuffer:64*1024*1024,stdio:['pipe','pipe','pipe']})
async function fixture(){
 const org=await prisma.organization.create({data:{name:'Recovery organization',phone:randomUUID()}});organizations.push(org.id)
 const user=await prisma.user.create({data:{fullName:'Recovery owner',phone:randomUUID(),passwordHash:'not-a-login'}});users.push(user.id)
 await prisma.organizationUser.create({data:{organizationId:org.id,userId:user.id,role:'owner'}})
 const product=await prisma.product.create({data:{organizationId:org.id,name:'Recovered original product',sku:randomUUID(),barcode:randomUUID(),unit:'dona',salePrice:'12.01',costPrice:'0.123456'}})
 return {org,user,product}
}
test('Tenant recovery plans from a real isolated clone are read-only, retain current-only rows and preserve unrelated/shared-identity tenant hashes',async()=>{
 const own=await fixture(),foreign=await fixture()
 await prisma.organizationUser.create({data:{organizationId:foreign.org.id,userId:own.user.id,role:'admin'}})
 const deleted=await prisma.category.create({data:{organizationId:own.org.id,name:'Source-only unreferenced category'}})
 const database='pos_tenant_recovery_'+randomUUID().replaceAll('-',''),directory=mkdtempSync(join(tmpdir(),'pos-recovery-plan-'))
 const url=new URL(connection);url.pathname='/'+database
 let source:PrismaClient|undefined,created=false
 try{
  const dumpPath=join(directory,'isolated.dump'),dumpOutput=openSync(dumpPath,'wx',0o600)
  try{execFileSync('docker',['exec','-i',container,'pg_dump','-U','pos_test','-d','pos_test','--format=custom','--no-owner','--no-acl'],{stdio:['pipe',dumpOutput,'pipe']})}finally{closeSync(dumpOutput)}
  docker(['createdb','-U','pos_test',database]);created=true
  const dumpInput=openSync(dumpPath,'r')
  try{execFileSync('docker',['exec','-i',container,'pg_restore','-U','pos_test','-d',database,'--exit-on-error','--single-transaction','--no-owner','--no-acl'],{stdio:[dumpInput,'pipe','pipe']})}finally{closeSync(dumpInput)}
  docker(['psql','-X','-U','pos_test','-d',database,'-v','ON_ERROR_STOP=1'],readFileSync('scripts/ops/auth-restore-quarantine.sql'))
  source=new PrismaClient({datasources:{db:{url:url.toString()}}})
  const foreignBefore=JSON.parse((await tenantExport(foreign.org.id,prisma,{readOnly:true})).data.toString()).manifest.datasets
  await prisma.product.update({where:{id:own.product.id},data:{name:'Current edited product'}})
  await prisma.category.delete({where:{id:deleted.id}})
  const added=await prisma.product.create({data:{organizationId:own.org.id,name:'Current-only preserved product',sku:randomUUID(),barcode:randomUUID(),unit:'dona',salePrice:1,costPrice:1}})
  let readonlySnapshots=0
  const readonlyClient=(client:PrismaClient)=>({$transaction:async(work:(tx:Prisma.TransactionClient)=>Promise<unknown>,options:{isolationLevel:Prisma.TransactionIsolationLevel;timeout:number})=>client.$transaction(async tx=>{
   const result=await work(tx)
   const setting=await tx.$queryRaw<{transaction_read_only:string}[]>`SHOW transaction_read_only`;assert.equal(setting[0].transaction_read_only,'on');readonlySnapshots++;return result
  },options)}) as unknown as Pick<PrismaClient,'$transaction'>
  const plan=await planTenantRecovery(own.org.id,readonlyClient(source),readonlyClient(prisma),{reviewer:'Isolated fixture operator',caseReference:'Fixture recovery comparison only'})
  assert.equal(readonlySnapshots,2);assert.equal(plan.applyEnabled,false);assert.equal(plan.deleteEnabled,false);assert.equal(plan.overwriteEnabled,false)
  const product=plan.differences.find(row=>row.model==='Product')!
  assert.deepEqual(product.changed.map(row=>row.key.id),[own.product.id]);assert.deepEqual(plan.differences.find(row=>row.model==='Category')!.missing.map(row=>row.key.id),[deleted.id]);assert.deepEqual(product.currentOnly.map(row=>row.key.id),[added.id]);assert.ok(product.foreignKeys.some(key=>key.model==='Organization'))
  assert.equal((await prisma.product.findUniqueOrThrow({where:{id:own.product.id}})).name,'Current edited product');assert.ok(await prisma.product.findUnique({where:{id:added.id}}));assert.equal(await prisma.category.findUnique({where:{id:deleted.id}}),null)
  assert.equal((await source.product.findUniqueOrThrow({where:{id:own.product.id}})).name,'Recovered original product')
  const [migration]=await source.$queryRaw<{id:string;checksum:string}[]>`SELECT id,checksum FROM "_prisma_migrations" WHERE finished_at IS NOT NULL AND rolled_back_at IS NULL ORDER BY migration_name LIMIT 1`
  await source.$executeRaw`UPDATE "_prisma_migrations" SET checksum=${'0'.repeat(64)} WHERE id=${migration.id}`
  try{await assert.rejects(planTenantRecovery(own.org.id,source,prisma,{reviewer:'Isolated operator',caseReference:'Tampered source schema fixture'}),error=>error instanceof Error&&'code' in error&&error.code==='RECOVERY_SCHEMA_UNREVIEWED')}
  finally{await source.$executeRaw`UPDATE "_prisma_migrations" SET checksum=${migration.checksum} WHERE id=${migration.id}`}
  const failedMigration=randomUUID()
  await source.$executeRaw`INSERT INTO "_prisma_migrations" (id,checksum,migration_name,started_at,applied_steps_count) VALUES (${failedMigration},${'f'.repeat(64)},'isolated_failed_fixture',now(),0)`
  try{await assert.rejects(planTenantRecovery(own.org.id,source,prisma,{reviewer:'Isolated operator',caseReference:'Unfinished source migration fixture'}),error=>error instanceof Error&&'code' in error&&error.code==='RECOVERY_SCHEMA_UNREVIEWED')}
  finally{await source.$executeRaw`DELETE FROM "_prisma_migrations" WHERE id=${failedMigration}`}
  const env={...process.env,TENANT_RECOVERY_SOURCE_URL:url.toString(),TENANT_RECOVERY_TARGET_URL:connection.toString(),TENANT_RECOVERY_SOURCE_CONFIRM_DATABASE:database,TENANT_RECOVERY_TARGET_CONFIRM_DATABASE:'pos_test',TENANT_RECOVERY_ORGANIZATION_ID:own.org.id,TENANT_RECOVERY_REVIEWER:'Isolated operator',TENANT_RECOVERY_CASE_REFERENCE:'Fixture operator comparison, no apply',TENANT_RECOVERY_PLAN_FILE:join(directory,'plan.json')}
  const cli=(changes:Record<string,string>={})=>execFileSync(process.execPath,['--require','./scripts/worker-resolver.cjs','.worker-build/scripts/workers/tenant-recovery-plan.js'],{env:{...env,...changes},stdio:['pipe','pipe','pipe'],encoding:'utf8'})
  assert.throws(()=>cli({TENANT_RECOVERY_SOURCE_CONFIRM_DATABASE:'wrong_database'}))
  assert.throws(()=>cli({TENANT_RECOVERY_SOURCE_URL:connection.toString(),TENANT_RECOVERY_SOURCE_CONFIRM_DATABASE:'pos_test'}))
  const output=cli();assert.equal(JSON.parse(output).status,'planned');assert.ok(!output.includes(connection.toString()));assert.ok(!output.includes(directory));assert.equal(statSync(env.TENANT_RECOVERY_PLAN_FILE).mode&0o777,0o600)
  const stored=readFileSync(env.TENANT_RECOVERY_PLAN_FILE,'utf8');assert.ok(!stored.includes(own.user.phone));assert.ok(!stored.includes('not-a-login'));assert.equal(JSON.parse(stored).applyEnabled,false);assert.equal(JSON.parse(output).planSHA256,createHash('sha256').update(stored).digest('hex'))
  assert.throws(()=>cli());assert.equal(readFileSync(env.TENANT_RECOVERY_PLAN_FILE,'utf8'),stored)
  chmodSync(directory,0o755)
  try{assert.throws(()=>cli(),error=>{assert.ok(error instanceof Error);return String((error as Error&{stderr?:unknown}).stderr).includes('RECOVERY_PRIVATE_OUTPUT_REQUIRED')})}finally{chmodSync(directory,0o700)}

  await assert.rejects(planTenantRecovery(randomUUID(),source,prisma,{reviewer:'Isolated operator',caseReference:'Missing organization fixture'}))
  const foreignAfter=JSON.parse((await tenantExport(foreign.org.id,prisma,{readOnly:true})).data.toString()).manifest.datasets;assert.deepEqual(foreignAfter,foreignBefore)
 }finally{
  if(source)await source.$disconnect()
  if(created)docker(['dropdb','-U','pos_test',database])
  rmSync(directory,{recursive:true,force:true})
 }
})
