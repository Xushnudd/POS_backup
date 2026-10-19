import { test, after } from 'node:test'
import assert from 'node:assert/strict'
import { randomUUID, randomBytes } from 'node:crypto'
import { prisma } from '@/lib/prisma'
import { sessionHash, verifySession } from '@/server/auth/session'
import { recordCost, cancelCost, costReport } from '@/server/billing/costs'
const url=new URL(process.env.DATABASE_URL??'')
if(url.hostname!=='127.0.0.1'||url.port!=='55439'||url.pathname!=='/pos_test')throw new Error('Isolated DB only')
const orgs:string[]=[],users:string[]=[]
after(async()=>{await prisma.organization.deleteMany({where:{id:{in:orgs}}});await prisma.user.deleteMany({where:{id:{in:users}}});await prisma.$disconnect()})
async function fixture(admin=false){
 const org=await prisma.organization.create({data:{name:'Cost test',phone:randomUUID()}});orgs.push(org.id)
 const user=await prisma.user.create({data:{fullName:'Cost owner',phone:randomUUID(),passwordHash:'not-a-login'}});users.push(user.id)
 await prisma.organizationUser.create({data:{organizationId:org.id,userId:user.id,role:'owner'}})
 if(admin)await prisma.platformOperator.create({data:{userId:user.id,role:'platform_admin'}})
 const token=randomBytes(32).toString('base64url');await prisma.session.create({data:{userId:user.id,organizationId:org.id,tokenHash:sessionHash(token),expiresAt:new Date(Date.now()+3600000),idleExpiresAt:new Date(Date.now()+3600000)}})
 return {org,context:(await verifySession(token))!}
}
function input(org:string){return {operationId:randomUUID(),targetOrganizationId:org,kind:'hosting' as const,source:'Vendor statement 1',currency:'UZS',periodStart:'2026-01-01T00:00:00Z',periodEnd:'2026-02-01T00:00:00Z',usageQuantity:'1',unitPrice:'2.005',estimated:false,basis:'Supplier statement',reason:'Verified source cost record'}}
const window={from:'2026-01-01T00:00:00Z',to:'2026-04-01T00:00:00Z'}
test('Cost ledger uses exact decimals, idempotency and period identity without creating POS money',async()=>{
 const admin=await fixture(true),owner=await fixture(),command=input(owner.org.id)
 await assert.rejects(recordCost(owner.context,command),{code:'PLATFORM_ADMIN_REQUIRED'})
 const [a,b]=await Promise.all([recordCost(admin.context,command),recordCost(admin.context,command)])
 assert.equal(a.id,b.id);assert.equal(a.amount.toString(),'2.01')
 await assert.rejects(recordCost(admin.context,{...command,operationId:randomUUID()}))
 const next=await recordCost(admin.context,{...command,operationId:randomUUID(),periodStart:'2026-02-01T00:00:00Z',periodEnd:'2026-03-01T00:00:00Z'})
 assert.notEqual(next.id,a.id)
 await assert.rejects(prisma.integrationCost.update({where:{id:a.id},data:{unitPrice:'3',amount:'3'}}))
 const report=await costReport(admin.context,{targetOrganizationId:owner.org.id,...window})
 assert.equal(report.total,2);assert.equal(report.recordedCostUZS,'4.02');assert.equal(report.recordedContributionUZS,'-4.02');assert.equal(report.marginComplete,false)
 assert.ok(report.missingKinds.includes('fiscal'))
 assert.equal(await prisma.payment.count({where:{organizationId:owner.org.id}}),0)
 assert.equal(await prisma.cashMovement.count({where:{shift:{register:{store:{organizationId:owner.org.id}}}}}),0)
 const cancellation={operationId:randomUUID(),reason:'Source corrected with preserved history'}
 await cancelCost(admin.context,a.id,cancellation);await cancelCost(admin.context,a.id,cancellation)
 assert.equal((await costReport(admin.context,{targetOrganizationId:owner.org.id,...window})).total,1)
 await assert.rejects(prisma.integrationCost.delete({where:{id:a.id}}))
 await recordCost(admin.context,{...command,operationId:randomUUID()})
})
test('Cost report separates currencies, estimates and partial periods; CSV exports all pages safely',async()=>{
 const admin=await fixture(true),owner=await fixture()
 for(let i=0;i<22;i++)await recordCost(admin.context,{...input(owner.org.id),operationId:randomUUID(),source:i===0?'=FORMULA()':'Source '+i,currency:i===1?'USD':'UZS',estimated:i===2})
 await recordCost(admin.context,{...input(owner.org.id),operationId:randomUUID(),source:'Partial period',periodStart:'2025-12-01T00:00:00Z'})
 const query={targetOrganizationId:owner.org.id,...window}
 await assert.rejects(costReport(owner.context,query),{code:'PLATFORM_ADMIN_REQUIRED'})
 const report=await costReport(admin.context,query)
 assert.equal(report.total,22);assert.equal(report.rows.length,20);assert.equal(report.overlappingPeriodsExcluded,1);assert.equal(report.marginComplete,false)
 assert.equal(report.recordedCostUZS,'42.21');assert.ok(report.grouped.some(row=>row.currency==='USD'&&row.amount==='2.01'))
 const exported=await costReport(admin.context,query,true)
 assert.equal(exported.file!.content.trim().split('\r\n').length,23)
 assert.ok(exported.file!.content.includes("'=formula()"));assert.equal(exported.rows.length,0)
})
test('Late audit failure rolls back source cost and operation; original-key retry commits once',async()=>{
 const admin=await fixture(true),command=input(admin.org.id),name='cost_fault_'+randomUUID().replaceAll('-','')
 await prisma.$executeRawUnsafe(`CREATE FUNCTION ${name}() RETURNS trigger LANGUAGE plpgsql AS $$ BEGIN RAISE EXCEPTION 'Cost audit fault'; END $$`)
 try{
  await prisma.$executeRawUnsafe(`CREATE TRIGGER ${name} BEFORE INSERT ON "AuditLog" FOR EACH ROW WHEN (NEW."organizationId"='${admin.org.id}' AND NEW.action='integration_cost_recorded') EXECUTE FUNCTION ${name}()`)
  await assert.rejects(recordCost(admin.context,command));assert.equal(await prisma.integrationCost.count({where:{organizationId:admin.org.id}}),0)
  assert.equal(await prisma.operation.count({where:{organizationId:admin.org.id,type:'billing.cost.record'}}),0)
 }finally{await prisma.$executeRawUnsafe(`DROP TRIGGER IF EXISTS ${name} ON "AuditLog"`);await prisma.$executeRawUnsafe(`DROP FUNCTION ${name}()`)}
 await recordCost(admin.context,command);await recordCost(admin.context,command)
 assert.equal(await prisma.integrationCost.count({where:{organizationId:admin.org.id}}),1)
 await prisma.platformOperator.update({where:{userId:admin.context.userId},data:{isActive:false}})
 await assert.rejects(recordCost(admin.context,command),{code:'PLATFORM_ADMIN_REQUIRED'})
})
