import {test,after} from 'node:test'
import assert from 'node:assert/strict'
import {randomUUID,randomBytes} from 'node:crypto'
import {NextRequest} from 'next/server'
import {prisma} from '@/lib/prisma'
import {sessionHash,verifySession} from '@/server/auth/session'
import {runOperation} from '@/server/operations'
import {billingDatabaseError} from '@/server/billing/errors'
import {billingStatus} from '@/server/billing/service'
import {createInvoice,confirmBillingPayment} from '@/server/billing/invoices'
import {READ_ONLY_BUSINESS_MODELS} from '@/server/billing/read-only-policy'
import {enqueueJob,claimJob,executeJob} from '@/server/jobs/service'
import {readJobExport} from '@/server/jobs/catalog-export'
import {reserveStock,expireReservations} from '@/server/inventory/reservations'
import {POST as productsPOST,GET as productsGET} from '@/app/api/products/route'
const url=new URL(process.env.DATABASE_URL??'');if(url.hostname!=='127.0.0.1'||url.port!=='55439'||url.pathname!=='/pos_test'||url.username!=='pos_test')throw new Error('Isolated readonly DB required')
const orgs:string[]=[],users:string[]=[]
after(async()=>{await prisma.organization.deleteMany({where:{id:{in:orgs}}});await prisma.user.deleteMany({where:{id:{in:users}}});await prisma.$disconnect()})
const expired=(e:unknown)=>!!e&&typeof e==='object'&&'code'in e&&e.code==='SUBSCRIPTION_EXPIRED'||billingDatabaseError(e)?.code==='SUBSCRIPTION_EXPIRED'
async function fixture(){
 const org=await prisma.$transaction(async tx=>{await tx.$executeRawUnsafe('ALTER TABLE "Organization" DISABLE TRIGGER billing_enroll_new_org');const row=await tx.organization.create({data:{name:'Read-only fixture',phone:randomUUID()}});await tx.$executeRawUnsafe('ALTER TABLE "Organization" ENABLE TRIGGER billing_enroll_new_org');return row});orgs.push(org.id)
 const user=await prisma.user.create({data:{fullName:'Read-only owner',phone:randomUUID(),passwordHash:'not-a-login'}});users.push(user.id)
 const member=await prisma.organizationUser.create({data:{organizationId:org.id,userId:user.id,role:'owner'}}),store=await prisma.store.create({data:{organizationId:org.id,name:'Original branch'}}),register=await prisma.register.create({data:{storeId:store.id,name:'Original till',code:randomUUID()}})
 const product=await prisma.product.create({data:{organizationId:org.id,name:'Original product',sku:randomUUID(),barcode:randomUUID(),unit:'dona',salePrice:'10',costPrice:'3'}})
 await prisma.inventoryBalance.create({data:{storeId:store.id,productId:product.id,quantity:5}})
 const token=randomBytes(32).toString('base64url'),session=await prisma.session.create({data:{organizationId:org.id,userId:user.id,tokenHash:sessionHash(token),expiresAt:new Date(Date.now()+3600000),idleExpiresAt:new Date(Date.now()+3600000)}})
 return {org,user,member,store,register,product,token,session,ctx:(await verifySession(token))!}
}
async function expire(f:Awaited<ReturnType<typeof fixture>>,ends=new Date(Date.now()-8*86400000)){await prisma.organizationSubscription.create({data:{organizationId:f.org.id,planVersionId:'initial-pro-v1',trialStartedAt:new Date(ends.getTime()-14*86400000),trialEndsAt:ends}})}
function req(f:Awaited<ReturnType<typeof fixture>>,body?:unknown){return new NextRequest('http://localhost:3000/api/products'+(body?'':'?organizationId='+f.org.id),{method:body?'POST':'GET',headers:{cookie:'pos_session='+f.token,origin:'http://localhost:3000','content-type':'application/json'},...(body?{body:JSON.stringify(body)}:{})})}
test('All reviewed business tables have DB guards; root/child CRUD and tenant reassignment cannot bypass read-only',async()=>{
 // Batch, serial and cost journals use reviewed dedicated native guards,
 // rather than the historical generic trigger name. Check the actual function
 // and its writable admission, so renaming a trigger cannot mask a missing guard.
 const guarded=await prisma.$queryRaw<{name:string}[]>`SELECT DISTINCT c.relname AS name FROM pg_trigger t JOIN pg_class c ON c.oid=t.tgrelid JOIN pg_proc p ON p.oid=t.tgfoid WHERE NOT t.tgisinternal AND p.proname IN ('subscription_business_write_guard','batch_business_write_guard','receipt_cost_application_guard','receipt_cost_continuation_guard') AND pg_get_functiondef(p.oid) LIKE '%assert_business_writable%'`
 assert.deepEqual(guarded.map(r=>r.name).sort(),[...READ_ONLY_BUSINESS_MODELS].sort())
 const own=await fixture(),foreign=await fixture();await expire(own)
 for(const work of [()=>prisma.product.create({data:{...own.product,id:randomUUID(),sku:randomUUID(),barcode:randomUUID()}}),()=>prisma.product.update({where:{id:own.product.id},data:{name:'Forbidden edit'}}),()=>prisma.product.delete({where:{id:own.product.id}}),()=>prisma.register.update({where:{id:own.register.id},data:{name:'Forbidden child edit'}}),()=>prisma.inventoryBalance.update({where:{storeId_productId:{storeId:own.store.id,productId:own.product.id}},data:{quantity:99}}),()=>prisma.product.update({where:{id:own.product.id},data:{organizationId:foreign.org.id}})])await assert.rejects(work,expired)
 await assert.rejects(runOperation(own.ctx,'job.enqueue',randomUUID(),{},tx=>tx.product.update({where:{id:own.product.id},data:{name:'Recovery-type bypass'}})),expired)
 assert.equal((await prisma.product.findUniqueOrThrow({where:{id:own.product.id}})).name,'Original product')
 const response=await productsPOST(req(own,{organizationId:own.org.id,name:'HTTP forbidden product',sku:randomUUID(),barcode:randomUUID(),unit:'dona',salePrice:'10',costPrice:'3'}),undefined)
 assert.equal(response.status,409);assert.equal((await response.json()).error.code,'SUBSCRIPTION_EXPIRED')
 assert.equal((await productsGET(req(own),undefined)).status,200)
 assert.equal((await billingStatus(own.ctx)).businessWritesAllowed,false);assert.equal((await billingStatus(foreign.ctx)).businessWritesAllowed,true)
})
test('Original committed replay remains available after expiry, but new operation cannot run work and revoked actor cannot replay',async()=>{
 const own=await fixture(),key=randomUUID(),payload={name:'Committed before expiry'}
 const work=()=>runOperation(own.ctx,'test.readonly',key,payload,async tx=>{await tx.product.update({where:{id:own.product.id},data:{name:payload.name}});return {id:own.product.id,name:payload.name}})
 const original=await work();await expire(own);assert.deepEqual(await work(),original)
 let called=false
 await assert.rejects(runOperation(own.ctx,'test.readonly',randomUUID(),{},async()=>{called=true;return {ok:true}}),expired);assert.equal(called,false)
 await assert.rejects(runOperation(own.ctx,'test.readonly',key,{name:'Altered'},async()=>({ok:true})),{code:'OPERATION_PAYLOAD_CONFLICT'})
 await prisma.session.update({where:{id:own.session.id},data:{revokedAt:new Date()}});await assert.rejects(work(),{code:'SESSION_CHANGED'})
})
test('Real grace deadline crossed during work rolls back business mutation and terminal operation',async()=>{
 const own=await fixture();await expire(own,new Date(Date.now()-7*86400000+1500));const key=randomUUID()
 await assert.rejects(runOperation(own.ctx,'test.readonly.deadline',key,{},async tx=>{await tx.product.update({where:{id:own.product.id},data:{name:'Must roll back'}});await tx.$queryRaw`SELECT pg_sleep(2)::text`;return {id:own.product.id}}),expired)
 assert.equal((await prisma.product.findUniqueOrThrow({where:{id:own.product.id}})).name,'Original product');assert.equal(await prisma.operation.count({where:{organizationId:own.org.id,key}}),0)
})
test('Expired owner exports existing data and renews through audited billing; ordinary business writes then resume without POS cash posting',async()=>{
 const own=await fixture();await expire(own)
 const job=await enqueueJob(own.ctx,{type:'tenant_export',operationId:randomUUID(),reason:'Owner exports retained business data'}),lease=(await claimJob())!;assert.equal(lease.id,job.id);assert.equal((await executeJob(lease)).succeeded,true)
 assert.equal(JSON.parse((await readJobExport(own.ctx,job.id)).data!.toString()).datasets.Product[0].id,own.product.id)
 await prisma.platformOperator.create({data:{userId:own.user.id,role:'platform_admin'}})
 const plan=await prisma.billingPlan.findUniqueOrThrow({where:{code:'start'}}),invoice=await createInvoice(own.ctx,{operationId:randomUUID(),planCode:plan.code,planVersionId:plan.currentVersionId})
 await confirmBillingPayment(own.ctx,{operationId:randomUUID(),billingInvoiceId:invoice.id,proofReference:'TEST-RENEW-'+randomUUID(),reason:'Operator reviewed isolated manual bank proof'})
 assert.equal((await billingStatus(own.ctx)).businessWritesAllowed,true)
 await prisma.product.update({where:{id:own.product.id},data:{name:'Renewed write'}})
 assert.equal(await prisma.payment.count({where:{organizationId:own.org.id}}),0)
})
test('Expired manual reservation housekeeping remains narrowly allowed while active stock writes remain denied',async()=>{
 const own=await fixture(),hold=await reserveStock(own.ctx,{operationId:randomUUID(),storeId:own.store.id,expiresAt:new Date(Date.now()+1000).toISOString(),reason:'Existing manual reservation expiry',items:[{productId:own.product.id,locationId:null,quantity:'1'}]})
 await expire(own);await prisma.$queryRaw`SELECT pg_sleep(1.1)::text`
 assert.equal(await expireReservations(own.org.id),1);assert.equal((await prisma.stockReservation.findUniqueOrThrow({where:{id:hold.id}})).status,'expired')
 assert.equal((await prisma.reservationItem.findFirstOrThrow({where:{reservationId:hold.id}})).remainingQuantity.toString(),'0')
 assert.equal((await prisma.inventoryBalance.findUniqueOrThrow({where:{storeId_productId:{storeId:own.store.id,productId:own.product.id}}})).quantity.toString(),'5')
 await assert.rejects(reserveStock(own.ctx,{operationId:randomUUID(),storeId:own.store.id,expiresAt:new Date(Date.now()+60000).toISOString(),reason:'Denied new reservation',items:[{productId:own.product.id,locationId:null,quantity:'1'}]}),expired)
})
test('Subscription row changed after a Serializable snapshot cannot supply stale write entitlement',async()=>{
 const own=await fixture();await expire(own,new Date(Date.now()-86400000))
 let snapshotStarted!:()=>void,resume!:()=>void
 const started=new Promise<void>(resolve=>{snapshotStarted=resolve}),gate=new Promise<void>(resolve=>{resume=resolve})
 const stale=prisma.$transaction(async tx=>{await tx.organizationSubscription.findUniqueOrThrow({where:{organizationId:own.org.id}});snapshotStarted();await gate;await tx.$queryRaw`SELECT assert_business_writable(${own.org.id})::text`},{isolationLevel:'Serializable',timeout:15000})
 await started
 try{await prisma.organizationSubscription.update({where:{organizationId:own.org.id},data:{cancelAtPeriodEnd:true}})}finally{resume()}
 await assert.rejects(stale,e=>!!e&&typeof e==='object'&&(('code'in e&&e.code==='P2034')||('meta'in e&&!!e.meta&&typeof e.meta==='object'&&'code'in e.meta&&e.meta.code==='40001')))
 await prisma.$transaction(tx=>tx.$queryRaw`SELECT assert_business_writable(${own.org.id})::text`,{isolationLevel:'Serializable'})
})
test('Expired owner can cancel only an unposted draft intent; tombstone replay stays actor/hash bound and cannot become a posting',async()=>{
 const own=await fixture(),foreign=await fixture();await expire(own)
 const {cancelDraftIntent}=await import('@/server/sales/cancel-intent'),{saleDraftSchema,createDraft}=await import('@/server/sales/service')
 const operationId=randomUUID(),payload=saleDraftSchema.parse({organizationId:own.org.id,storeId:own.store.id,registerId:own.register.id,shiftId:randomUUID(),operationId,items:[{productId:own.product.id,quantity:1}]})
 const input={operationId,payload}
 assert.deepEqual(await cancelDraftIntent(own.ctx,input),{state:'cancelled'});assert.deepEqual(await cancelDraftIntent(own.ctx,input),{state:'cancelled'})
 await assert.rejects(cancelDraftIntent(foreign.ctx,input),{code:'FORBIDDEN'})
 await assert.rejects(cancelDraftIntent(own.ctx,{...input,payload:{...payload,note:'Changed hash'}}),{code:'OPERATION_PAYLOAD_CONFLICT'})
 await assert.rejects(createDraft(own.ctx,payload,operationId),{code:'OPERATION_CANCELLED'})
 for(const [type,state] of [['sale.create','completed'],['payment.manual','cancelled']])await assert.rejects(prisma.operation.create({data:{organizationId:own.org.id,actorId:own.user.id,type,state,key:randomUUID(),payloadHash:'0'.repeat(64),result:{cancelled:true}}}),expired)
 assert.equal(await prisma.sale.count({where:{organizationId:own.org.id}}),0);assert.equal(await prisma.payment.count({where:{organizationId:own.org.id}}),0)
 assert.equal(await prisma.auditLog.count({where:{organizationId:own.org.id,action:'unposted_draft_intent_cancelled'}}),1)
})
