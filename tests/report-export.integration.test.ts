import {test,after} from 'node:test'
import assert from 'node:assert/strict'
import {randomUUID,randomBytes} from 'node:crypto'
import {writeFileSync} from 'node:fs'
import ExcelJS from 'exceljs'
import {prisma} from '@/lib/prisma'
import {sessionHash,verifySession} from '@/server/auth/session'
import {enqueueJob,claimJob,executeJob} from '@/server/jobs/service'
import {readJobExport} from '@/server/jobs/catalog-export'
import {reportExport} from '@/server/jobs/report-export'
import {REPORT_EXPORTS} from '@/lib/report-exports'
import {reportRows} from '@/server/exports/report-formats'
const url=new URL(process.env.DATABASE_URL??'');if(url.hostname!=='127.0.0.1'||url.port!=='55439'||url.pathname!=='/pos_test')throw Error('Isolated DB only')
const orgs:string[]=[],users:string[]=[]
after(async()=>{await prisma.organization.deleteMany({where:{id:{in:orgs}}});await prisma.user.deleteMany({where:{id:{in:users}}});await prisma.$disconnect()})
async function fixture(){const org=await prisma.organization.create({data:{name:'Synthetic report export',phone:randomUUID()}});orgs.push(org.id);const user=await prisma.user.create({data:{fullName:'Report owner',phone:randomUUID(),passwordHash:'not-a-login'}});users.push(user.id);const member=await prisma.organizationUser.create({data:{organizationId:org.id,userId:user.id,role:'owner'}});const token=randomBytes(32).toString('base64url'),session=await prisma.session.create({data:{organizationId:org.id,userId:user.id,tokenHash:sessionHash(token),expiresAt:new Date(Date.now()+3600000),idleExpiresAt:new Date(Date.now()+3600000)}});const store=await prisma.store.create({data:{organizationId:org.id,name:'Selected branch'}}),register=await prisma.register.create({data:{storeId:store.id,name:'Report register',code:randomUUID()}}),shift=await prisma.shift.create({data:{registerId:register.id,organizationUserId:member.id,openingCash:0}});return {org,user,member,token,session,store,register,shift,ctx:(await verifySession(token))!}}
async function run(f:Awaited<ReturnType<typeof fixture>>,format:'csv'|'xlsx'|'pdf'){
 const input={operationId:randomUUID(),type:'report_export' as const,report:{report:'reports-sales' as const,format,filters:{storeId:f.store.id,startDate:'2026-01-01',endDate:'2026-01-01'}},reason:'Full filtered report acceptance'}
 const a=await enqueueJob(f.ctx,input),b=await enqueueJob(f.ctx,input);assert.equal(a.id,b.id)
 const claimed=(await claimJob())!;assert.equal(claimed.id,a.id);assert.equal((await executeJob(claimed)).succeeded,true)
 assert.equal((await executeJob(claimed)).succeeded,false);assert.equal(await prisma.jobExport.count({where:{jobId:a.id}}),1)
 return {job:a,file:await readJobExport(f.ctx,a.id)}
}
test('1001 selected report rows survive CSV/XLSX/native PDF document in background without foreign/out-of-period rows; exact decimals and artifact fencing',async()=>{
 const f=await fixture(),foreign=await fixture()
 for(let start=0;start<1001;start+=100)await prisma.sale.createMany({data:Array.from({length:Math.min(100,1001-start)},(_,i)=>({organizationId:f.org.id,storeId:f.store.id,registerId:f.register.id,shiftId:f.shift.id,cashierId:f.user.id,receiptNo:'ROW-'+String(start+i).padStart(4,'0'),subtotal:'1.01',totalAmount:'1.01',status:'completed',completedAt:new Date('2026-01-01T10:00:00Z'),createdAt:new Date('2026-01-01T10:00:00Z')}))})
 await prisma.sale.create({data:{organizationId:f.org.id,storeId:f.store.id,registerId:f.register.id,shiftId:f.shift.id,cashierId:f.user.id,receiptNo:'OUTSIDE-PERIOD',subtotal:9,totalAmount:9,status:'completed',completedAt:new Date('2025-12-01T00:00:00Z')}})
 await prisma.sale.create({data:{organizationId:foreign.org.id,storeId:foreign.store.id,registerId:foreign.register.id,shiftId:foreign.shift.id,cashierId:foreign.user.id,receiptNo:'FOREIGN-TENANT',subtotal:99,totalAmount:99,status:'completed',completedAt:new Date('2026-01-01T10:00:00Z')}})
 const csv=await run(f,'csv'),excel=await run(f,'xlsx'),print=await run(f,'pdf'),rows=reportRows(csv.file.data!.toString())
 assert.equal(rows.filter(row=>row[0]==='sale').length,1001);assert.ok(csv.file.data!.toString().includes('1011.01'));assert.ok(!csv.file.data!.toString().includes('OUTSIDE-PERIOD'));assert.ok(!csv.file.data!.toString().includes('FOREIGN-TENANT'))
 const book=new ExcelJS.Workbook();await book.xlsx.load(excel.file.data! as never);const sheet=book.worksheets[0],names:string[]=[];sheet.eachRow(row=>{if(row.getCell(1).value==='sale'){names.push(String(row.getCell(3).value));assert.equal(row.getCell(10).value,'1.01')}});assert.equal(names.length,1001)
 const html=print.file.data!.toString();for(let n=0;n<1001;n++){const key='ROW-'+String(n).padStart(4,'0');assert.ok(names.includes(key),key);assert.ok(html.includes(key),key)}
 assert.equal((html.match(/data-export-row=/g)??[]).length,rows.length);assert.ok(!html.includes('FOREIGN-TENANT'));assert.ok(!html.includes('OUTSIDE-PERIOD'))
 writeFileSync('/tmp/pos-report-pdf-qa.html',html,{mode:0o600})
 await assert.rejects(readJobExport(foreign.ctx,csv.job.id),{code:'NOT_FOUND'})
 await assert.rejects(readJobExport({...f.ctx,role:'admin'},csv.job.id),{code:'OWNER_REQUIRED'})
 await assert.rejects(prisma.jobExport.update({where:{jobId:excel.job.id},data:{data:Buffer.from('changed')}}))
 await prisma.session.update({where:{id:f.session.id},data:{revokedAt:new Date()}});await assert.rejects(readJobExport(f.ctx,print.job.id),{code:'SESSION_CHANGED'})
})
test('Every reviewed report uses the existing filtered CSV query for XLSX/print; arbitrary filters and cross-tenant resources cannot publish',async()=>{
 const f=await fixture(),foreign=await fixture()
 for(const report of Object.keys(REPORT_EXPORTS) as (keyof typeof REPORT_EXPORTS)[]){const artifact=await reportExport(f.ctx,{report,format:'xlsx',filters:{}});assert.ok(artifact.size>0,report);assert.ok(artifact.filename.endsWith('.xlsx'),report)}
 await assert.rejects(reportExport(f.ctx,{report:'reports-sales',format:'csv',filters:{storeId:foreign.store.id}}),{code:'NOT_FOUND'})
 await assert.rejects(reportExport(f.ctx,{report:'reports-sales',format:'csv',filters:{url:'http://evil.invalid'}}))
 const job=await enqueueJob(f.ctx,{operationId:randomUUID(),type:'report_export',report:{report:'reports-sales',format:'xlsx',filters:{}},reason:'Revoked source must not publish'}),claimed=(await claimJob())!;assert.equal(claimed.id,job.id)
 await prisma.session.update({where:{id:f.session.id},data:{revokedAt:new Date()}});assert.equal((await executeJob(claimed)).succeeded,false);assert.equal(await prisma.jobExport.count({where:{jobId:job.id}}),0);assert.equal((await prisma.backgroundJob.findUniqueOrThrow({where:{id:job.id}})).lastError,'AUTHORIZATION_CHANGED')
})
test('Expired report file is unavailable; late audit rollback preserves original-key job retry and publishes only one complete artifact',async()=>{
 const f=await fixture(),job=await enqueueJob(f.ctx,{operationId:randomUUID(),type:'report_export',report:{report:'reports-sales',format:'csv',filters:{}},reason:'Audit rollback acceptance'}),name='report_fail_'+randomUUID().replaceAll('-','')
 await prisma.$executeRawUnsafe(`CREATE FUNCTION ${name}() RETURNS trigger LANGUAGE plpgsql AS $$ BEGIN RAISE EXCEPTION 'Isolated report audit failure'; END $$`)
 try{await prisma.$executeRawUnsafe(`CREATE TRIGGER ${name} BEFORE INSERT ON "AuditLog" FOR EACH ROW WHEN (NEW."entityId"='${job.id}' AND NEW.action='system_job_succeeded') EXECUTE FUNCTION ${name}()`);assert.equal((await executeJob((await claimJob())!)).succeeded,false);assert.equal(await prisma.jobExport.count({where:{jobId:job.id}}),0)}finally{await prisma.$executeRawUnsafe(`DROP TRIGGER IF EXISTS ${name} ON "AuditLog"`);await prisma.$executeRawUnsafe(`DROP FUNCTION ${name}()`)}
 await prisma.backgroundJob.update({where:{id:job.id},data:{nextRunAt:new Date()}});assert.equal((await executeJob((await claimJob())!)).succeeded,true);assert.equal(await prisma.auditLog.count({where:{entityId:job.id,action:'system_job_succeeded'}}),1)
 const expired=await enqueueJob(f.ctx,{operationId:randomUUID(),type:'report_export',report:{report:'reports-sales',format:'csv',filters:{}},reason:'Expired file acceptance'}),claimed=(await claimJob())!;assert.equal(claimed.id,expired.id)
 const {createHash}=await import('node:crypto'),data=Buffer.from('expired')
 await prisma.$transaction(async tx=>{await tx.jobExport.create({data:{jobId:expired.id,organizationId:f.org.id,data,filename:'expired.csv',mime:'text/csv',size:data.length,sha256:createHash('sha256').update(data).digest('hex'),rowCount:0,asOf:new Date(Date.now()-2000),expiresAt:new Date(Date.now()-1000)}});await tx.backgroundJob.update({where:{id:expired.id},data:{state:'succeeded',leaseToken:null,leaseUntil:null}})})
 await assert.rejects(readJobExport(f.ctx,expired.id),{code:'EXPORT_EXPIRED'})
})
test('Malformed native report payload fails closed rather than falling back to an unfiltered catalogue export',async()=>{
 const f=await fixture(),job=await prisma.$transaction(async tx=>{const row=await tx.backgroundJob.create({data:{organizationId:f.org.id,type:'report_export',payload:{},expiresAt:new Date(Date.now()+3600000)}});await tx.jobAuthorization.create({data:{jobId:row.id,organizationId:f.org.id,generation:row.generation,userId:f.user.id,sessionId:f.session.id,reason:'Isolated malformed payload fixture'}});return row})
 const claimed=(await claimJob())!;assert.equal(claimed.id,job.id);assert.equal((await executeJob(claimed)).succeeded,false);assert.equal(await prisma.jobExport.count({where:{jobId:job.id}}),0)
 await prisma.backgroundJob.update({where:{id:job.id},data:{nextRunAt:new Date(Date.now()+86400000)}})
})
