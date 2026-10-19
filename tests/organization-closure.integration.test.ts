import {test,after} from 'node:test'
import assert from 'node:assert/strict'
import {randomUUID,randomBytes} from 'node:crypto'
import {hash} from 'bcryptjs'
import {NextRequest} from 'next/server'
import {prisma} from '@/lib/prisma'
import {sessionHash,verifySession} from '@/server/auth/session'
import {requestClosure,cancelClosure,closureStatus} from '@/server/retention/closure'
import {newClosureSnapshot} from '@/server/retention/closure-phase'
import {runOperation} from '@/server/operations'
import {billingDatabaseError} from '@/server/billing/errors'
import {billingStatus} from '@/server/billing/service'
import {enqueueJob,claimJob,executeJob} from '@/server/jobs/service'
import {readJobExport} from '@/server/jobs/catalog-export'
import {POST as closePOST,GET as closeGET} from '@/app/api/billing/closure/route'
const url=new URL(process.env.DATABASE_URL??'');if(url.hostname!=='127.0.0.1'||url.port!=='55439'||url.pathname!=='/pos_test'||url.username!=='pos_test')throw new Error('Isolated closure DB required')
const orgs:string[]=[],users:string[]=[]
after(async()=>{await prisma.organization.deleteMany({where:{id:{in:orgs}}});await prisma.user.deleteMany({where:{id:{in:users}}});await prisma.$disconnect()})
const closing=(e:unknown)=>!!e&&typeof e==='object'&&'code'in e&&e.code==='ORGANIZATION_CLOSING'||billingDatabaseError(e)?.code==='ORGANIZATION_CLOSING'
async function fixture(legacy=false){
 const org=legacy?await prisma.$transaction(async tx=>{
  // Isolated fixture only: reproduce an organization awaiting explicit enrollment.
  await tx.$executeRawUnsafe('ALTER TABLE "Organization" DISABLE TRIGGER billing_enroll_new_org')
  const row=await tx.organization.create({data:{name:'Closure legacy fixture',phone:randomUUID()}})
  await tx.$executeRawUnsafe('ALTER TABLE "Organization" ENABLE TRIGGER billing_enroll_new_org');return row
 }):await prisma.organization.create({data:{name:'Closure test organization',phone:randomUUID()}});orgs.push(org.id)
 const password='isolated-owner-password',user=await prisma.user.create({data:{fullName:'Closure owner',phone:randomUUID(),passwordHash:await hash(password,4)}});users.push(user.id)
 const member=await prisma.organizationUser.create({data:{organizationId:org.id,userId:user.id,role:'owner'}})
 const product=await prisma.product.create({data:{organizationId:org.id,name:'Retained product',sku:randomUUID(),barcode:randomUUID(),unit:'dona',salePrice:'10',costPrice:'3'}})
 const token=randomBytes(32).toString('base64url'),session=await prisma.session.create({data:{organizationId:org.id,userId:user.id,tokenHash:sessionHash(token),expiresAt:new Date(Date.now()+3600000),idleExpiresAt:new Date(Date.now()+3600000)}}),ctx=(await verifySession(token))!
 const pointer=await prisma.retentionPolicy.findUniqueOrThrow({where:{key:'default'},include:{currentVersion:true}})
 return {org,user,member,product,password,token,session,ctx,policy:pointer.currentVersion}
}
async function exported(f:Awaited<ReturnType<typeof fixture>>,download=true){
 const job=await enqueueJob(f.ctx,{type:'tenant_export',operationId:randomUUID(),reason:'Owner export before organization closure'})
 const lease=(await claimJob())!;assert.equal(lease.id,job.id);assert.equal((await executeJob(lease)).succeeded,true)
 if(download)await readJobExport(f.ctx,job.id)
 return {operationId:randomUUID(),expectedPolicyVersionId:f.policy.id,exportJobId:job.id,reason:'Owner requests organization closure',password:f.password}
}
function request(f:Awaited<ReturnType<typeof fixture>>,body?:unknown){return new NextRequest('http://localhost:3000/api/billing/closure',{method:body?'POST':'GET',headers:{cookie:'pos_session='+f.token,origin:'http://localhost:3000','content-type':'application/json'},...(body?{body:JSON.stringify(body)}:{})})}
test('Owner reauth, real downloaded export, close replay and cancellation are atomic; business guards enforce closure',async()=>{
 const f=await fixture(),input=await exported(f),row=await requestClosure(f.ctx,input)
 assert.equal(row.cancellationDays,f.policy.closureCancellationDays)
 assert.equal((await closureStatus(f.ctx)).phase.cancellationAllowed,true)
 const reads=await Promise.all(Array.from({length:8},async()=>{await verifySession(f.token);return closeGET(request(f),undefined)}))
 assert.ok(reads.every(response=>response.status===200),'No-touch closure GET must coexist with real session touches')
 assert.deepEqual(await requestClosure(f.ctx,input),row)
 const stored=await prisma.operation.findFirstOrThrow({where:{organizationId:f.org.id,key:input.operationId}})
 assert.ok(!JSON.stringify(stored).includes(f.password));assert.ok(!JSON.stringify(await prisma.auditLog.findMany({where:{organizationId:f.org.id}})).includes(f.password))
 await assert.rejects(prisma.product.update({where:{id:f.product.id},data:{name:'Forbidden mutation'}}),closing)
 await assert.rejects(runOperation(f.ctx,'job.enqueue',randomUUID(),{},tx=>tx.product.update({where:{id:f.product.id},data:{name:'Exception cannot bypass'}})),closing)
 const retained=await exported(f);assert.equal(JSON.parse((await readJobExport(f.ctx,retained.exportJobId)).data!.toString()).datasets.OrganizationClosure[0].id,row.id)
 const cancel={operationId:randomUUID(),closureId:row.id,reason:'Owner reverses closure within window',password:f.password}
 const cancelled=await cancelClosure(f.ctx,cancel);assert.deepEqual(await cancelClosure(f.ctx,cancel),cancelled)
 assert.equal((await closureStatus(f.ctx)).phase.closureBlocksBusinessWrites,false)
 await prisma.product.update({where:{id:f.product.id},data:{name:'Business restored'}})
 assert.equal(await prisma.organizationClosure.count({where:{organizationId:f.org.id}}),1)
 assert.equal(await prisma.auditLog.count({where:{organizationId:f.org.id,action:'organization_closure_requested'}}),1)
 assert.equal(await prisma.auditLog.count({where:{organizationId:f.org.id,action:'organization_closure_cancelled'}}),1)
 assert.equal(await prisma.payment.count({where:{organizationId:f.org.id}}),0)
})
test('Fresh current password, live owner and downloaded export are required, including replay; HTTP admission fails closed',async()=>{
 const f=await fixture(),input=await exported(f,false)
 await assert.rejects(requestClosure(f.ctx,{...input,password:'incorrect-password'}),{code:'REAUTHENTICATION_FAILED'})
 await assert.rejects(requestClosure(f.ctx,input),{code:'CLOSURE_EXPORT_REQUIRED'})
 await readJobExport(f.ctx,input.exportJobId)
 const response=await closePOST(request(f,input),undefined);assert.equal(response.status,200)
 await assert.rejects(requestClosure(f.ctx,{...input,reason:'Changed public payload'}),{code:'OPERATION_PAYLOAD_CONFLICT'})
 await prisma.user.update({where:{id:f.user.id},data:{passwordHash:await hash('new-current-password',4)}})
 await assert.rejects(requestClosure(f.ctx,input),{code:'REAUTHENTICATION_FAILED'})
 await prisma.organizationUser.update({where:{id:f.member.id},data:{role:'admin'}}).catch(e=>{assert.ok(closing(e))})
 // Membership edits are business writes and are blocked while closing. Session
 // revocation remains available and rejects both stored result and GET.
 await prisma.session.update({where:{id:f.session.id},data:{revokedAt:new Date()}})
 await assert.rejects(closureStatus(f.ctx),{code:'SESSION_CHANGED'})
 assert.equal((await closeGET(request(f),undefined)).status,401)
})
test('Competing requests create one history/operation; immutable history and revision cannot be forged',async()=>{
 const f=await fixture(),input=await exported(f)
 const results=await Promise.allSettled([requestClosure(f.ctx,input),requestClosure(f.ctx,{...input,operationId:randomUUID()})])
 assert.equal(results.filter(r=>r.status==='fulfilled').length,1)
 assert.equal(await prisma.organizationClosure.count({where:{organizationId:f.org.id}}),1)
 assert.equal(await prisma.operation.count({where:{organizationId:f.org.id,type:'retention.closure.request'}}),1)
 const row=await prisma.organizationClosure.findFirstOrThrow({where:{organizationId:f.org.id}})
 await assert.rejects(prisma.organizationClosure.update({where:{id:row.id},data:{reason:'Silent history rewrite'}}))
 await assert.rejects(prisma.organizationClosure.delete({where:{id:row.id}}))
 await assert.rejects(prisma.organization.update({where:{id:f.org.id},data:{closureRevision:{increment:1}}}))
 assert.equal((await prisma.organization.findUniqueOrThrow({where:{id:f.org.id}})).closureRevision,1)
})
test('Closure fences an already established Serializable snapshot; stale business entitlement cannot survive its commit',async()=>{
 const f=await fixture(),input=await exported(f)
 let started!:()=>void,resume!:()=>void
 const ready=new Promise<void>(r=>{started=r}),gate=new Promise<void>(r=>{resume=r})
 const stale=prisma.$transaction(async tx=>{await tx.organization.findUniqueOrThrow({where:{id:f.org.id}});started();await gate;await tx.$queryRaw`SELECT assert_business_writable(${f.org.id})::text`},{isolationLevel:'Serializable',timeout:15000})
 await ready
 try{await requestClosure(f.ctx,input)}finally{resume()}
 await assert.rejects(stale,e=>e instanceof Error&&('code'in e&&e.code==='P2034'||'meta'in e&&!!e.meta&&typeof e.meta==='object'&&'code'in e.meta&&e.meta.code==='40001'))
 await assert.rejects(prisma.product.update({where:{id:f.product.id},data:{name:'Stale write'}}),closing)
})
test('Expired cancellation window remains read-only, never deletes retained records and never grants cancellation',async()=>{
 const f=await fixture(),input=await exported(f),artifact=await prisma.jobExport.findUniqueOrThrow({where:{jobId:input.exportJobId}})
 const snapshot=newClosureSnapshot(new Date(Date.now()-(f.policy.closureCancellationDays+1)*86400000),f.policy)
 const row=await prisma.organizationClosure.create({data:{...snapshot,organizationId:f.org.id,requestedBy:f.user.id,exportJobId:input.exportJobId,exportSha256:artifact.sha256,reason:input.reason}})
 const status=await closureStatus(f.ctx);assert.equal(status.phase.state,'review_required');assert.equal(status.automaticDeletionEnabled,false)
 await assert.rejects(cancelClosure(f.ctx,{operationId:randomUUID(),closureId:row.id,reason:'Too late cancellation',password:f.password}),{code:'CLOSURE_CANCELLATION_EXPIRED'})
 await assert.rejects(prisma.product.update({where:{id:f.product.id},data:{name:'Forbidden late write'}}),closing)
 assert.equal(await prisma.product.count({where:{organizationId:f.org.id}}),1)
 assert.equal(await prisma.operation.count({where:{organizationId:f.org.id,type:'retention.closure.cancel'}}),0)
})
test('Late closure audit failure rolls back history, revision and operation together',async()=>{
 const f=await fixture(),input=await exported(f),suffix=randomUUID().replaceAll('-',''),trigger='closure_fault_'+suffix,fn=trigger+'_fn'
 await prisma.$executeRawUnsafe(`CREATE FUNCTION "${fn}"() RETURNS trigger LANGUAGE plpgsql AS $$ BEGIN IF NEW.action='organization_closure_requested' AND NEW."organizationId"='${f.org.id}' THEN RAISE EXCEPTION 'isolated closure audit fault';END IF;RETURN NEW;END $$`)
 await prisma.$executeRawUnsafe(`CREATE TRIGGER "${trigger}" BEFORE INSERT ON "AuditLog" FOR EACH ROW EXECUTE FUNCTION "${fn}"()`)
 try{await assert.rejects(requestClosure(f.ctx,input));assert.equal(await prisma.organizationClosure.count({where:{organizationId:f.org.id}}),0);assert.equal((await prisma.organization.findUniqueOrThrow({where:{id:f.org.id}})).closureRevision,0);assert.equal(await prisma.operation.count({where:{organizationId:f.org.id,key:input.operationId}}),0)}finally{await prisma.$executeRawUnsafe(`DROP TRIGGER "${trigger}" ON "AuditLog"`);await prisma.$executeRawUnsafe(`DROP FUNCTION "${fn}"()`)}
 await requestClosure(f.ctx,input)
})

test('Open till work rejects closure without stranding shifts; actual non-owner and foreign exports cannot close',async()=>{
 const f=await fixture(),input=await exported(f)
 const store=await prisma.store.create({data:{organizationId:f.org.id,name:'Open branch'}}),register=await prisma.register.create({data:{storeId:store.id,name:'Open till',code:randomUUID()}})
 const shift=await prisma.shift.create({data:{registerId:register.id,organizationUserId:f.member.id,openingCash:'0'}})
 await assert.rejects(requestClosure(f.ctx,input),{code:'CLOSURE_ACTIVE_WORK'})
 assert.equal((await prisma.shift.findUniqueOrThrow({where:{id:shift.id}})).status,'open')
 assert.equal(await prisma.organizationClosure.count({where:{organizationId:f.org.id}}),0)
 await prisma.shift.update({where:{id:shift.id},data:{status:'closed',closedAt:new Date(),expectedCash:'0',countedCash:'0',cashDifference:'0'}})
 await prisma.organizationUser.update({where:{id:f.member.id},data:{role:'admin'}})
 const admin=(await verifySession(f.token))!
 await assert.rejects(requestClosure(admin,input),{code:'OWNER_REQUIRED'})
 assert.equal((await closePOST(request(f,input),undefined)).status,403)
 await prisma.organizationUser.update({where:{id:f.member.id},data:{role:'owner'}})
 const foreign=await fixture(),foreignExport=await exported(foreign)
 await assert.rejects(requestClosure(f.ctx,{...input,exportJobId:foreignExport.exportJobId}),{code:'CLOSURE_EXPORT_REQUIRED'})
})

test('Cancelling closure does not renew an expired subscription or unblock business writes',async()=>{
 const f=await fixture(true),input=await exported(f)
 const ends=new Date(Date.now()-8*86400000)
 await prisma.organizationSubscription.create({data:{organizationId:f.org.id,planVersionId:'initial-pro-v1',trialStartedAt:new Date(ends.getTime()-14*86400000),trialEndsAt:ends}})
 const row=await requestClosure(f.ctx,input)
 assert.equal((await billingStatus(f.ctx)).businessWritesAllowed,false)
 await cancelClosure(f.ctx,{operationId:randomUUID(),closureId:row.id,reason:'Owner cancels, subscription remains expired',password:f.password})
 const status=await billingStatus(f.ctx);assert.equal(status.closureBlocksBusinessWrites,false);assert.equal(status.businessWritesAllowed,false)
 await assert.rejects(prisma.product.update({where:{id:f.product.id},data:{name:'Subscription still expired'}}),e=>billingDatabaseError(e)?.code==='SUBSCRIPTION_EXPIRED')
})

test('SQL cancellation guard enforces actual wall-clock at persistence, not a backdated submitted event',async()=>{
 const f=await fixture(),input=await exported(f),artifact=await prisma.jobExport.findUniqueOrThrow({where:{jobId:input.exportJobId}})
 const snapshot=newClosureSnapshot(new Date(Date.now()-f.policy.closureCancellationDays*86400000+900),f.policy)
 const row=await prisma.organizationClosure.create({data:{...snapshot,organizationId:f.org.id,requestedBy:f.user.id,exportJobId:input.exportJobId,exportSha256:artifact.sha256,reason:input.reason}})
 await assert.rejects(prisma.$transaction(async tx=>{
  const event=new Date();await tx.$queryRaw`SELECT pg_sleep(1.2)::text`
  await tx.organizationClosure.update({where:{id:row.id},data:{cancelledAt:event,cancelledBy:f.user.id,cancellationReason:'Backdated cancellation must not bypass deadline'}})
 }),e=>billingDatabaseError(e)?.code==='CLOSURE_CANCELLATION_EXPIRED')
 assert.equal((await prisma.organizationClosure.findUniqueOrThrow({where:{id:row.id}})).cancelledAt,null)
 assert.equal((await prisma.organization.findUniqueOrThrow({where:{id:f.org.id}})).closureRevision,1)
})

test('Repeated reauthentication failures are rate limited without creating a closure or exposing password data',async()=>{
 const f=await fixture(),input={operationId:randomUUID(),expectedPolicyVersionId:f.policy.id,exportJobId:randomUUID(),reason:'Rate limit test closure',password:'invalid-current-password'}
 for(let attempt=0;attempt<5;attempt++)await assert.rejects(requestClosure(f.ctx,input),{code:'REAUTHENTICATION_FAILED'})
 await assert.rejects(requestClosure(f.ctx,input),{code:'RATE_LIMITED'})
 assert.equal(await prisma.organizationClosure.count({where:{organizationId:f.org.id}}),0)
 assert.equal(await prisma.operation.count({where:{organizationId:f.org.id,type:'retention.closure.request'}}),0)
})
