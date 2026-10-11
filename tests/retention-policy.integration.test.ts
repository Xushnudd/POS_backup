import {test,before,after} from 'node:test'
import assert from 'node:assert/strict'
import {randomUUID,randomBytes} from 'node:crypto'
import {NextRequest} from 'next/server'
import {prisma} from '@/lib/prisma'
import {sessionHash,verifySession} from '@/server/auth/session'
import {publishRetentionPolicy,retentionStatus} from '@/server/retention/service'
import {GET,POST} from '@/app/api/billing/retention/route'
const dbUrl=new URL(process.env.DATABASE_URL??'');if(dbUrl.hostname!=='127.0.0.1'||dbUrl.port!=='55439'||dbUrl.pathname!=='/pos_test'||dbUrl.username!=='pos_test')throw new Error('Isolated retention database required')
const orgs:string[]=[],users:string[]=[]
async function actor(role='owner',operator=false){const org=await prisma.organization.create({data:{name:'Retention fixture',phone:randomUUID()}});orgs.push(org.id);const user=await prisma.user.create({data:{fullName:'Retention actor',phone:randomUUID(),passwordHash:'not-a-login'}});users.push(user.id);await prisma.organizationUser.create({data:{organizationId:org.id,userId:user.id,role}});if(operator)await prisma.platformOperator.create({data:{userId:user.id,role:'platform_admin'}});const token=randomBytes(32).toString('base64url');const session=await prisma.session.create({data:{organizationId:org.id,userId:user.id,tokenHash:sessionHash(token),expiresAt:new Date(Date.now()+3600000),idleExpiresAt:new Date(Date.now()+3600000)}});return {org,user,session,token,context:(await verifySession(token))!}}
type Fixture=Awaited<ReturnType<typeof actor>>
let admin:Fixture,original:Awaited<ReturnType<typeof retentionStatus>>['policy']
const fields=(p:typeof original)=>({expiredSubscriptionDays:p.expiredSubscriptionDays,closureCancellationDays:p.closureCancellationDays,auditRetentionDays:p.auditRetentionDays,technicalLogRetentionDays:p.technicalLogRetentionDays,backupRetentionDays:p.backupRetentionDays,proposedFinancialRetentionYears:p.proposedFinancialRetentionYears})
before(async()=>{admin=await actor('owner',true);original=(await retentionStatus(admin.context)).policy})
after(async()=>{try{await prisma.platformOperator.update({where:{userId:admin.user.id},data:{isActive:true}});const current=(await retentionStatus(admin.context)).policy;if(JSON.stringify(fields(current))!==JSON.stringify(fields(original)))await publishRetentionPolicy(admin.context,{...fields(original),operationId:randomUUID(),expectedVersionId:current.id,reason:'Restore isolated test policy settings'})}finally{await prisma.organization.deleteMany({where:{id:{in:orgs}}});await prisma.user.deleteMany({where:{id:{in:users}}});await prisma.$disconnect()}})
function request(f:Fixture,body?:unknown){return new NextRequest('http://localhost:3000/api/billing/retention',{method:body===undefined?'GET':'POST',headers:{cookie:'pos_session='+f.token,origin:'http://localhost:3000','content-type':'application/json'},...(body===undefined?{}:{body:JSON.stringify(body)})})}
test('Owner sees safe planning data; admin/cashier do not inherit platform authority; unknown destructive switches fail validation',async()=>{
 const owner=await actor(),businessAdmin=await actor('admin'),cashier=await actor('cashier')
 const idleExpiry=new Date(Date.now()+600000)
 await prisma.session.update({where:{id:owner.session.id},data:{idleExpiresAt:idleExpiry}})
 const response=await GET(request(owner),undefined);assert.equal(response.status,200);const status=(await response.json()).data
 assert.equal((await prisma.session.findUniqueOrThrow({where:{id:owner.session.id}})).idleExpiresAt.getTime(),idleExpiry.getTime())
 assert.equal(status.canManage,false);assert.equal(status.automaticDeletionEnabled,false);assert.equal(status.closureAvailable,true);assert.equal(status.legalPolicyStatus,'review_required');assert.equal(status.plannedReviewAt,null)
 assert.ok(!('createdBy' in status.policy));assert.ok(!('reason' in status.policy))
 for(const f of [businessAdmin,cashier])assert.equal((await GET(request(f),undefined)).status,403)
 const input={...fields(original),expectedVersionId:original.id,operationId:randomUUID(),reason:'Unauthorized retention change'}
 assert.equal((await POST(request(owner,input),undefined)).status,403)
 assert.equal((await POST(request(admin,{...input,automaticDeletionEnabled:true}),undefined)).status,400)
 assert.equal(await prisma.operation.count({where:{organizationId:owner.org.id}}),0)
})
test('Publication commits one immutable version/audit; replay uses original key and rechecks current operator authority',async()=>{
 const current=(await retentionStatus(admin.context)).policy
 const input={...fields(current),expiredSubscriptionDays:120,operationId:randomUUID(),expectedVersionId:current.id,reason:'Reviewed retention planning update'}
 const result=await publishRetentionPolicy(admin.context,input),replay=await publishRetentionPolicy(admin.context,input)
 assert.equal(result.id,replay.id);assert.equal(result.version,current.version+1);assert.equal(await prisma.auditLog.count({where:{entityId:result.id,action:'retention_policy_published'}}),1)
 assert.equal((await retentionStatus(admin.context)).policy.expiredSubscriptionDays,120)
 await assert.rejects(prisma.retentionPolicyVersion.update({where:{id:result.id},data:{expiredSubscriptionDays:999}}))
 await assert.rejects(prisma.retentionPolicy.update({where:{key:'default'},data:{currentVersionId:current.id}}))
 await assert.rejects(prisma.retentionPolicy.delete({where:{key:'default'}}))
 await prisma.platformOperator.update({where:{userId:admin.user.id},data:{isActive:false}})
 await assert.rejects(publishRetentionPolicy(admin.context,input),{code:'PLATFORM_ADMIN_REQUIRED'})
 await prisma.platformOperator.update({where:{userId:admin.user.id},data:{isActive:true}})
 assert.equal((await publishRetentionPolicy(admin.context,input)).id,result.id)
})
test('Concurrent reviewed edits cannot overwrite one another; old expected version and altered payload are rejected',async()=>{
 const current=(await retentionStatus(admin.context)).policy
 const inputs=Array.from({length:8},(_,i)=>91+i).map(days=>({...fields(current),expiredSubscriptionDays:days,operationId:randomUUID(),expectedVersionId:current.id,reason:'Parallel reviewed retention update'}))
 const settled=await Promise.allSettled(inputs.map(input=>publishRetentionPolicy(admin.context,input)))
 assert.equal(settled.filter(r=>r.status==='fulfilled').length,1)
 const denied=settled.filter(r=>r.status==='rejected') as PromiseRejectedResult[]
 assert.equal(denied.length,7)
 for(const result of denied)assert.equal(result.reason.code,'RETENTION_POLICY_CHANGED')
 assert.equal((await retentionStatus(admin.context)).policy.version,current.version+1)
 const winner=settled.findIndex(r=>r.status==='fulfilled')
 await assert.rejects(publishRetentionPolicy(admin.context,{...inputs[winner],expiredSubscriptionDays:365}),{code:'OPERATION_PAYLOAD_CONFLICT'})
})
test('Failed audit rolls back version, pointer and operation; a valid retry with the same original key then succeeds',async()=>{
 const current=(await retentionStatus(admin.context)).policy,input={...fields(current),backupRetentionDays:14,operationId:randomUUID(),expectedVersionId:current.id,reason:'Atomic audit rollback acceptance'}
 await prisma.$executeRawUnsafe(`CREATE FUNCTION retention_test_audit_failure() RETURNS trigger LANGUAGE plpgsql AS $$ BEGIN IF NEW.action='retention_policy_published' THEN RAISE EXCEPTION 'Isolated audit failure'; END IF; RETURN NEW; END $$`)
 await prisma.$executeRawUnsafe('CREATE TRIGGER retention_test_audit_failure BEFORE INSERT ON "AuditLog" FOR EACH ROW EXECUTE FUNCTION retention_test_audit_failure()')
 try{await assert.rejects(publishRetentionPolicy(admin.context,input));assert.equal((await retentionStatus(admin.context)).policy.id,current.id);assert.equal(await prisma.retentionPolicyVersion.count({where:{version:current.version+1}}),0);assert.equal(await prisma.operation.count({where:{organizationId:admin.org.id,key:input.operationId}}),0)}finally{await prisma.$executeRawUnsafe('DROP TRIGGER retention_test_audit_failure ON "AuditLog"');await prisma.$executeRawUnsafe('DROP FUNCTION retention_test_audit_failure()')}
 assert.equal((await publishRetentionPolicy(admin.context,input)).version,current.version+1)
})
test('Direct forged version authors and expired sessions do not create policy versions',async()=>{
 const owner=await actor(),current=(await retentionStatus(admin.context)).policy
 await assert.rejects(prisma.retentionPolicyVersion.create({data:{...fields(current),version:current.version+1,createdBy:owner.user.id,reason:'Forged operator authorization'}}))
 await prisma.session.update({where:{id:owner.session.id},data:{revokedAt:new Date()}})
 await assert.rejects(retentionStatus(owner.context),{code:'SESSION_CHANGED'})
 assert.equal((await GET(request(owner),undefined)).status,401)
 assert.equal((await retentionStatus(admin.context)).policy.id,current.id)
})
