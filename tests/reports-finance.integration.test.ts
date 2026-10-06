import { test, after } from 'node:test'
import assert from 'node:assert/strict'
import { randomUUID, randomBytes } from 'node:crypto'
import { NextRequest } from 'next/server'
import { prisma } from '@/lib/prisma'
import type { TokenPayload } from '@/lib/auth'
import { sessionHash, verifySession } from '@/server/auth/session'
import { createDraft, completeSale } from '@/server/sales/service'
import { returnSale, returnSchema } from '@/server/returns/service'
import { cashMovement, closeShift, correctShift, openShift, shiftCashSummary } from '@/server/finance/shifts'
import { GET as salesReport } from '@/app/api/reports/sales/route'
import { GET as productReport } from '@/app/api/reports/products/route'
import { GET as dashboard } from '@/app/api/reports/dashboard/route'
import { GET as reconciliation } from '@/app/api/reports/reconciliation/route'
const connection=new URL(process.env.DATABASE_URL??'')
if(connection.hostname!=='127.0.0.1'||connection.port!=='55439'||connection.username!=='pos_test'||connection.pathname!=='/pos_test')throw new Error('Isolated test DB required')
const orgs:string[]=[],users:string[]=[]
after(async()=>{await prisma.organization.deleteMany({where:{id:{in:orgs}}});await prisma.user.deleteMany({where:{id:{in:users}}});await prisma.$disconnect()})
function req(path:string,cookie:string,body?:unknown){return new NextRequest('http://localhost:3000/api'+path,{method:body===undefined?'GET':'POST',headers:{cookie,origin:'http://localhost:3000','content-type':'application/json'},...(body===undefined?{}:{body:JSON.stringify(body)})})}
async function actor(organizationId:string,storeId:string,role='owner'){
 const user=await prisma.user.create({data:{fullName:'Finance '+role,phone:randomUUID(),passwordHash:'not-a-login'}});users.push(user.id)
 const member=await prisma.organizationUser.create({data:{organizationId,userId:user.id,role}})
 await prisma.userStore.create({data:{organizationUserId:member.id,storeId}})
 const token=randomBytes(32).toString('base64url'),session=await prisma.session.create({data:{tokenHash:sessionHash(token),organizationId,userId:user.id,expiresAt:new Date(Date.now()+3600000),idleExpiresAt:new Date(Date.now()+3600000)}})
 const context:TokenPayload={userId:user.id,organizationId,organizationUserId:member.id,storeIds:[storeId],sessionId:session.id,role}
 return {user,member,context,token,cookie:'pos_session='+token}
}
async function fixture(quantity=10,openingCash=0){
 const org=await prisma.organization.create({data:{name:'Report/finance fixture',phone:randomUUID()}});orgs.push(org.id)
 const store=await prisma.store.create({data:{organizationId:org.id,name:'Main'}}),owner=await actor(org.id,store.id)
 const register=await prisma.register.create({data:{storeId:store.id,name:'Till',code:randomUUID()}})
 const shift=await prisma.shift.create({data:{registerId:register.id,organizationUserId:owner.member.id,openingCash}})
 const product=await prisma.product.create({data:{organizationId:org.id,name:'Frozen',sku:randomUUID(),barcode:randomUUID(),unit:'dona',salePrice:100,costPrice:50}})
 await prisma.inventoryBalance.create({data:{storeId:store.id,productId:product.id,quantity}})
 const draft={organizationId:org.id,storeId:store.id,registerId:register.id,shiftId:shift.id,discountAmount:0,items:[{productId:product.id,quantity:1,discountAmount:0}]}
 return {org,store,register,shift,product,draft,...owner}
}

test('Staff archive preserves financial history, revokes sessions and restores only to blocked state',async()=>{
 const {updateMember}=await import('@/server/users/service')
 const f=await fixture(),staff=await actor(f.org.id,f.store.id,'cashier')
 const register=await prisma.register.create({data:{storeId:f.store.id,name:'Staff till',code:randomUUID()}})
 const shift=await prisma.shift.create({data:{registerId:register.id,organizationUserId:staff.member.id,openingCash:0}})
 const draft=await createDraft(staff.context,{...f.draft,registerId:register.id,shiftId:shift.id},randomUUID())
 await completeSale(staff.context,draft.id,{payments:[{paymentType:'cash',amount:100}]},randomUUID())
 await updateMember(f.context,staff.member.id,{role:'admin',storeIds:[f.store.id]})
 const activeToken=randomBytes(32).toString('base64url')
 await prisma.session.create({data:{tokenHash:sessionHash(activeToken),organizationId:f.org.id,userId:staff.user.id,expiresAt:new Date(Date.now()+3600000),idleExpiresAt:new Date(Date.now()+3600000)}})
 assert.ok(await verifySession(activeToken))
 const archived=await updateMember(f.context,staff.member.id,{action:'archive'})
 assert.ok(archived.archivedAt);assert.equal(archived.isActive,false)
 assert.equal(await verifySession(staff.token),null)
 assert.equal(await verifySession(activeToken),null,'Archive revokes a currently valid session')
 await assert.rejects(()=>updateMember(f.context,staff.member.id,{isActive:true}),{code:'MEMBER_ARCHIVED'})
 await assert.rejects(()=>prisma.organizationUser.update({where:{id:staff.member.id},data:{isActive:true}}))
 const historical=await prisma.sale.findUniqueOrThrow({where:{id:draft.id},include:{items:true,payments:true}})
 assert.equal(historical.cashierId,staff.user.id);assert.equal(historical.status,'completed')
 assert.equal(historical.totalAmount.toString(),'100');assert.equal(historical.payments.length,1);assert.equal(historical.items.length,1)
 assert.equal((await prisma.inventoryBalance.findUniqueOrThrow({where:{storeId_productId:{storeId:f.store.id,productId:f.product.id}}})).quantity.toString(),'9')
 const restored=await updateMember(f.context,staff.member.id,{action:'restore'})
 assert.equal(restored.archivedAt,null);assert.equal(restored.isActive,false);assert.equal(restored.role,'admin')
 assert.deepEqual(restored.userStores.map(item=>item.storeId),[f.store.id])
 await updateMember(f.context,staff.member.id,{isActive:true})
 assert.equal(await verifySession(staff.token),null,'Old sessions stay revoked after reactivation')
 assert.equal(await verifySession(activeToken),null)
 const auditRows=await prisma.auditLog.findMany({where:{entityId:staff.member.id,action:{in:['membership_archived','membership_restored']}}})
 assert.equal(auditRows.length,2)
})

test('Staff lifecycle denies foreign tenant, non-owner, last owner and ambiguous archive requests',async()=>{
 const {updateMember,memberSchema}=await import('@/server/users/service')
 const f=await fixture(),other=await fixture(),staff=await actor(f.org.id,f.store.id,'cashier')
 await assert.rejects(()=>updateMember(f.context,other.member.id,{action:'archive'}),{code:'NOT_FOUND'})
 await assert.rejects(()=>updateMember(staff.context,f.member.id,{action:'archive'}),{code:'FORBIDDEN'})
 await assert.rejects(()=>updateMember(f.context,f.member.id,{action:'archive'}),{code:'LAST_OWNER'})
 await assert.rejects(()=>updateMember(f.context,staff.member.id,{storeIds:[other.store.id]}),{code:'STORE_NOT_FOUND'})
 assert.equal(memberSchema.safeParse({action:'archive',isActive:true}).success,false)
 assert.equal(memberSchema.safeParse({action:'restore',role:'owner'}).success,false)
 await updateMember(f.context,staff.member.id,{isActive:false})
 assert.equal((await prisma.organizationUser.findUniqueOrThrow({where:{id:staff.member.id}})).archivedAt,null)
 await updateMember(f.context,staff.member.id,{isActive:true})
 assert.equal((await prisma.organizationUser.findUniqueOrThrow({where:{id:staff.member.id}})).isActive,true)
})
async function posted(f:Awaited<ReturnType<typeof fixture>>,when:Date,total=20,quantity=2,cost='3.333333',discount=0){
 const sale=await prisma.sale.create({data:{organizationId:f.org.id,storeId:f.store.id,registerId:f.register.id,shiftId:f.shift.id,cashierId:f.user.id,receiptNo:randomUUID(),subtotal:total+discount,discountAmount:discount,totalAmount:total,completedAt:when,items:{create:{productId:f.product.id,productName:'Frozen',sku:'FROZEN',unit:'dona',quantity,unitPrice:10,lineTotal:total+discount,receiptDiscount:discount,unitCost:cost}}},include:{items:true}})
 await prisma.sale.update({where:{id:sale.id},data:{status:'completed'}});return sale
}

test('1000 receipts: global totals, cash/debt separation, historical COGS and cutoff agree across table/dashboard/CSV',async()=>{
 const f=await fixture(),when=new Date('2026-10-05T12:00:00Z'),ids=Array.from({length:1000},()=>randomUUID())
 const customer=await prisma.customer.create({data:{organizationId:f.org.id,fullName:'Credit',phone:randomUUID(),creditLimit:20000}})
 await prisma.sale.createMany({data:ids.map(id=>({id,organizationId:f.org.id,storeId:f.store.id,registerId:f.register.id,shiftId:f.shift.id,cashierId:f.user.id,customerId:customer.id,receiptNo:id,subtotal:20,discountAmount:1,totalAmount:19,completedAt:when}))})
 await prisma.saleItem.createMany({data:ids.map(saleId=>({saleId,productId:f.product.id,productName:'Frozen',sku:'FROZEN',unit:'dona',quantity:2,unitPrice:10,lineTotal:20,receiptDiscount:1,unitCost:'3.333333'}))})
 await prisma.sale.updateMany({where:{id:{in:ids}},data:{status:'completed'}})
 await prisma.payment.createMany({data:ids.map((saleId,n)=>({organizationId:f.org.id,storeId:f.store.id,shiftId:f.shift.id,saleId,customerId:customer.id,paymentType:n<500?'cash':'credit',direction:'in',amount:19,receivedBy:f.user.id,paidAt:when}))})
 const item=await prisma.saleItem.findFirstOrThrow({where:{saleId:ids[0]}})
 await prisma.saleReturn.create({data:{saleId:ids[0],returnReceiptNo:randomUUID(),refundAmount:'9.50',processedBy:f.user.id,returnedAt:when,items:{create:{saleItemId:item.id,productId:f.product.id,quantity:1,unitPrice:10,lineTotal:'9.50'}}}})
 await prisma.payment.createMany({data:[{organizationId:f.org.id,storeId:f.store.id,shiftId:f.shift.id,saleId:ids[0],paymentType:'cash',direction:'out',amount:'9.50',note:'return:fixture',receivedBy:f.user.id,paidAt:when},{organizationId:f.org.id,storeId:f.store.id,shiftId:f.shift.id,saleId:ids[500],paymentType:'cash',direction:'in',amount:11,note:'debt_collection',receivedBy:f.user.id,paidAt:when}]})
 await prisma.product.update({where:{id:f.product.id},data:{costPrice:999,salePrice:888}})
 const query=`?organizationId=${f.org.id}&storeId=${f.store.id}&startDate=2026-10-05&endDate=2026-10-05`
 const response=await salesReport(req('/reports/sales'+query+'&limit=1',f.cookie),undefined);assert.equal(response.status,200)
 const body=await response.json();assert.equal(body.data.length,1);assert.equal(body.pagination.total,1000)
 for(const [route,handler] of [['sales',salesReport],['products',productReport]] as const)assert.equal((await handler(req('/reports/'+route+query+'&page=9007199254740991&limit=200',f.cookie),undefined)).status,400)
 assert.equal(body.summary.grossRevenue,'19000');assert.equal(body.summary.refundAmount,'9.5');assert.equal(body.summary.totalRevenue,'18990.5')
 assert.equal(body.summary.cashSales,'9500');assert.equal(body.summary.creditSales,'9500');assert.equal(body.summary.cashDebtCollections,'11');assert.equal(body.summary.cashRefunds,'9.5');assert.equal(body.summary.cashPayments,'9501.5')
 const frozen=query+'&asOf='+encodeURIComponent(body.meta.asOf)
 const second=await (await salesReport(req('/reports/sales'+frozen+'&page=1000&limit=1',f.cookie),undefined)).json();assert.deepEqual(second.summary,body.summary);assert.equal(second.pagination.total,1000)
 const dash=await (await dashboard(req('/reports/dashboard'+frozen,f.cookie),undefined)).json();assert.equal(dash.data.totalSales,1000);assert.equal(dash.data.totalRevenue,body.summary.totalRevenue);assert.equal(dash.data.cashPayments,body.summary.cashPayments)
 const products=await (await productReport(req('/reports/products'+frozen+'&limit=1',f.cookie),undefined)).json();assert.equal(products.summary.quantity,'1999');assert.equal(products.summary.revenue,'18990.5');assert.equal(products.summary.cost,'6663.332667')
 const exported=await (await salesReport(req('/reports/sales'+frozen+'&format=csv',f.cookie),undefined)).json();assert.deepEqual(exported.data.summary,body.summary);assert.equal((exported.data.content.match(/^"sale",/gm)??[]).length,1000);assert.ok(exported.data.content.includes('"Naqd qarz undirish","11.00"'))
 const productCsv=await (await productReport(req('/reports/products'+frozen+'&format=csv',f.cookie),undefined)).json();assert.equal(productCsv.data.summary.cost,products.summary.cost)
 await posted(f,when,20)
 const held=await (await salesReport(req('/reports/sales'+frozen,f.cookie),undefined)).json();assert.equal(held.pagination.total,1000)
 const fresh=await (await salesReport(req('/reports/sales'+query,f.cookie),undefined)).json();assert.equal(fresh.pagination.total,1001)
})

test('Report day boundaries include Tashkent first/last millisecond and reject malformed/future cutoffs',async()=>{
 const f=await fixture()
 for(const when of ['2026-10-04T18:59:59.999Z','2026-10-04T19:00:00.000Z','2026-10-05T18:59:59.999Z','2026-10-05T19:00:00.000Z'])await posted(f,new Date(when))
 const query=`?organizationId=${f.org.id}&startDate=2026-10-05&endDate=2026-10-05`
 for(const [route,path] of [[salesReport,'sales'],[dashboard,'dashboard'],[productReport,'products']] as const){
  const result=await route(req('/reports/'+path+query,f.cookie),undefined);assert.equal(result.status,200);const data=await result.json()
  if(path==='sales')assert.equal(data.pagination.total,2);else if(path==='dashboard')assert.equal(data.data.totalSales,2);else assert.equal(data.summary.quantity,'4')
  for(const cutoff of ['bad','2026-02-30T00:00:00Z','2999-01-01T00:00:00Z'])assert.equal((await route(req('/reports/'+path+query+'&asOf='+encodeURIComponent(cutoff),f.cookie),undefined)).status,400)
  assert.equal((await route(req('/reports/'+path+`?organizationId=${f.org.id}&startDate=2026-02-30`,f.cookie),undefined)).status,400)
 }
})

test('All reports and exports enforce A/B tenants and administrator branch allow/deny',async()=>{
 const f=await fixture(),other=await fixture(),admin=await actor(f.org.id,f.store.id,'admin')
 const hidden=await prisma.store.create({data:{organizationId:f.org.id,name:'Hidden'}})
 const register=await prisma.register.create({data:{storeId:hidden.id,name:'Hidden',code:randomUUID()}}),shift=await prisma.shift.create({data:{registerId:register.id,organizationUserId:f.member.id,openingCash:0}})
 await posted(f,new Date('2026-10-05T12:00:00Z'))
 await prisma.sale.create({data:{organizationId:f.org.id,storeId:hidden.id,registerId:register.id,shiftId:shift.id,cashierId:f.user.id,receiptNo:'HIDDEN',subtotal:99,totalAmount:99,status:'completed',completedAt:new Date('2026-10-05T12:00:00Z')}})
 const routes=[[salesReport,'sales'],[productReport,'products'],[dashboard,'dashboard'],[reconciliation,'reconciliation']] as const
 for(const [route,path] of routes){
  const suffix=path==='reconciliation'?'&kind=sales':''
  const query=`?organizationId=${f.org.id}&startDate=2026-10-05&endDate=2026-10-05${suffix}`
  assert.equal((await route(req('/reports/'+path+query,other.cookie),undefined)).status,403)
  assert.equal((await route(req('/reports/'+path+query+'&storeId='+hidden.id,admin.cookie),undefined)).status,404)
  assert.equal((await route(req('/reports/'+path+query+'&storeId='+other.store.id,f.cookie),undefined)).status,404)
  const own=await route(req('/reports/'+path+query,admin.cookie),undefined);assert.equal(own.status,200);const body=await own.json()
  if(path==='sales')assert.equal(body.pagination.total,1);if(path==='dashboard')assert.equal(body.data.totalSales,1)
  if(['sales','products'].includes(path)){const exported=await route(req('/reports/'+path+query+'&format=csv',admin.cookie),undefined);assert.equal(exported.status,200);assert.ok(!(await exported.json()).data.content.includes('HIDDEN'))}
 }
})

test('Cash sources and custody withdrawals are separate and close conserves opening plus net',async()=>{
 const {collectDebt}=await import('@/server/payments/collections'),{recordManualPayment}=await import('@/server/payments/manual')
 const f=await fixture(5,10),customer=await prisma.customer.create({data:{organizationId:f.org.id,fullName:'Debtor',phone:randomUUID(),creditLimit:500}})
 const draft=await createDraft(f.context,{...f.draft,customerId:customer.id,items:[{productId:f.product.id,quantity:2,discountAmount:0}]},randomUUID())
 const sale=await completeSale(f.context,draft.id,{payments:[{paymentType:'cash',amount:100},{paymentType:'credit',amount:100}]},draft.id)
 await collectDebt(f.context,{organizationId:f.org.id,storeId:f.store.id,shiftId:f.shift.id,customerId:customer.id,operationId:randomUUID(),paymentType:'cash',amount:30})
 await returnSale(f.context,sale.id,{operationId:randomUUID(),shiftId:f.shift.id,reason:'Partial return',items:[{saleItemId:sale.items[0].id,quantity:1,disposition:'sellable'}]})
 for(const [direction,amount] of [['in',5],['out',2]] as const)await recordManualPayment(f.context,{organizationId:f.org.id,storeId:f.store.id,shiftId:f.shift.id,operationId:randomUUID(),paymentType:'cash',direction,amount,note:'Manual cash'})
 for(const [movementType,amount] of [['cash_in',7],['cash_out',3],['bank_deposit',20],['collection',10]] as const){const input={operationId:randomUUID(),movementType,amount,reason:'Named source'};const a=await cashMovement(f.context,f.shift.id,input),b=await cashMovement(f.context,f.shift.id,input);assert.equal(a.id,b.id)}
 const payments=await prisma.payment.findMany({where:{shiftId:f.shift.id}}),movements=await prisma.cashMovement.findMany({where:{shiftId:f.shift.id}}),summary=shiftCashSummary(f.shift.openingCash,payments,movements)
 assert.equal(summary.saleReceipts.toString(),'100');assert.equal(summary.debtCollections.toString(),'30');assert.equal(summary.refunds.toString(),'65');assert.equal(summary.manualIn.toString(),'5');assert.equal(summary.manualOut.toString(),'2');assert.equal(summary.bankDeposits.toString(),'20');assert.equal(summary.collections.toString(),'10');assert.equal(summary.expectedCash.toString(),'52')
 const closed=await closeShift(f.context,f.shift.id,{countedCash:52});assert.equal(closed.expectedCash?.toString(),'52')
 const {GET:detail}=await import('@/app/api/shifts/[id]/route');const response=await detail(req('/shifts/'+f.shift.id,f.cookie),{params:Promise.resolve({id:f.shift.id})});assert.equal(response.status,200);assert.equal((await response.json()).data.cashSummary.expectedCash,'52')
 await assert.rejects(()=>prisma.cashMovement.update({where:{id:movements[0].id},data:{amount:1}}));await assert.rejects(()=>prisma.payment.delete({where:{id:payments[0].id}}))
})

test('Closed shift correction is linked, immutable, atomic, exactly once and contributes only to the posting shift',async()=>{
 const f=await fixture(),other=await fixture()
 const closed=await closeShift(f.context,f.shift.id,{countedCash:0})
 await assert.rejects(()=>prisma.shift.update({where:{id:f.shift.id},data:{countedCash:1}}));await assert.rejects(()=>prisma.shift.delete({where:{id:f.shift.id}}));await assert.rejects(()=>prisma.register.delete({where:{id:f.register.id}}))
 const posting=await openShift(f.context,{registerId:f.register.id,organizationUserId:f.member.id,openingCash:0,operationId:randomUUID()})
 const input={postingShiftId:posting.id,operationId:randomUUID(),amount:'3.50',direction:'cash_in' as const,reason:'Count correction'}
 const [a,b]=await Promise.all([correctShift(f.context,closed.id,input),correctShift(f.context,closed.id,input)]);assert.equal(a.id,b.id)
 assert.equal(a.originalShiftId,closed.id);assert.equal(a.postingShiftId,posting.id);assert.equal(a.amount.toString(),'3.5')
 await assert.rejects(()=>correctShift(f.context,closed.id,{...input,amount:'4.00'}),/kaliti/)
 await assert.rejects(()=>correctShift(other.context,closed.id,{...input,operationId:randomUUID()}))
 await assert.rejects(()=>correctShift(f.context,posting.id,{...input,operationId:randomUUID()}))
 await assert.rejects(()=>prisma.shiftCorrection.update({where:{id:a.id},data:{amount:2}}))
 await assert.rejects(()=>prisma.cashMovement.update({where:{id:a.cashMovementId},data:{amount:2}}))
 await assert.rejects(()=>prisma.cashMovement.create({data:{shiftId:posting.id,movementType:'correction_in',amount:1,reason:'Orphan correction',createdBy:f.user.id}}))
 assert.equal(await prisma.shiftCorrection.count({where:{originalShiftId:closed.id}}),1)
 assert.equal(await prisma.auditLog.count({where:{entityId:a.id,action:'posted'}}),1)
 assert.equal((await prisma.shift.findUniqueOrThrow({where:{id:closed.id}})).expectedCash?.toString(),'0')
 const final=await closeShift(f.context,posting.id,{countedCash:'3.50'});assert.equal(final.expectedCash?.toString(),'3.5')
 assert.equal((await correctShift(f.context,closed.id,input)).id,a.id)
 const {reconcile}=await import('@/server/reconciliation/service');assert.equal((await reconcile(f.context,'shifts')).pagination.total,0)
})

test('Parallel returns cannot exceed original quantity and manager approval/audit remain frozen',async()=>{
 const f=await fixture(2),other=await fixture(),draft=await createDraft(f.context,f.draft,randomUUID()),sale=await completeSale(f.context,draft.id,{payments:[{paymentType:'cash',amount:100}]},draft.id)
 const input={operationId:randomUUID(),shiftId:f.shift.id,reason:'Manager approved',items:[{saleItemId:sale.items[0].id,quantity:1,disposition:'sellable' as const}]}
 assert.equal(returnSchema.safeParse({...input,reason:'  '}).success,false)
 await assert.rejects(()=>returnSale(other.context,sale.id,{...input,operationId:randomUUID(),shiftId:other.shift.id}))
 const outcome=await Promise.allSettled([returnSale(f.context,sale.id,input),returnSale(f.context,sale.id,{...input,operationId:randomUUID()})]);assert.equal(outcome.filter(x=>x.status==='fulfilled').length,1)
 const returned=await prisma.saleReturn.findFirstOrThrow({where:{saleId:sale.id},include:{items:true}})
 assert.equal(returned.approvedBy,f.user.id);assert.equal(returned.approvedRole,'owner');assert.ok(returned.approvedAt);assert.equal(returned.reason,'Manager approved')
 const {items:approvalItems,...approvalDocument}=returned;void approvalItems
 await assert.rejects(()=>prisma.saleReturn.create({data:{...approvalDocument,id:randomUUID(),returnReceiptNo:randomUUID(),approvedRole:null}}),/SaleReturn_approval_check/)
 await assert.rejects(()=>prisma.saleReturn.update({where:{id:returned.id},data:{reason:'Hidden correction'}}));await assert.rejects(()=>prisma.saleReturn.delete({where:{id:returned.id}}));await assert.rejects(()=>prisma.saleReturnItem.update({where:{id:returned.items[0].id},data:{quantity:2}}))
 const {id:discard,...item}=returned.items[0];void discard;await assert.rejects(()=>prisma.saleReturnItem.create({data:item}))
 const audit=await prisma.auditLog.findFirstOrThrow({where:{entityId:returned.id,action:'returned'}});assert.equal((audit.afterData as {approvedBy:string}).approvedBy,f.user.id)
 assert.equal((await prisma.inventoryBalance.findUniqueOrThrow({where:{storeId_productId:{storeId:f.store.id,productId:f.product.id}}})).quantity.toString(),'2')
})

test('Sellable returns use original cost in weighted average; zero stock resets to original and replay cannot revalue twice',async()=>{
 const {confirmStockDocument}=await import('@/server/inventory/documents')
 const f=await fixture(1),draft=await createDraft(f.context,f.draft,randomUUID()),sale=await completeSale(f.context,draft.id,{payments:[{paymentType:'cash',amount:100}]},draft.id)
 const purchase=await prisma.stockDocument.create({data:{organizationId:f.org.id,storeId:f.store.id,documentNo:randomUUID(),documentType:'purchase',createdBy:f.user.id,items:{create:{productId:f.product.id,quantity:1,unitCost:150}}}})
 await confirmStockDocument(f.context,purchase.id);assert.equal((await prisma.product.findUniqueOrThrow({where:{id:f.product.id}})).costPrice.toString(),'150')
 const input={operationId:randomUUID(),shiftId:f.shift.id,reason:'Original cost',items:[{saleItemId:sale.items[0].id,quantity:1,disposition:'sellable' as const}]}
 await returnSale(f.context,sale.id,input);assert.equal((await prisma.product.findUniqueOrThrow({where:{id:f.product.id}})).costPrice.toString(),'100')
 await returnSale(f.context,sale.id,input);assert.equal((await prisma.product.findUniqueOrThrow({where:{id:f.product.id}})).costPrice.toString(),'100')
 const zero=await fixture(1),d=await createDraft(zero.context,zero.draft,randomUUID()),s=await completeSale(zero.context,d.id,{payments:[{paymentType:'cash',amount:100}]},d.id)
 await prisma.product.update({where:{id:zero.product.id},data:{costPrice:999}})
 await returnSale(zero.context,s.id,{operationId:randomUUID(),shiftId:zero.shift.id,reason:'Empty stock reset',items:[{saleItemId:s.items[0].id,quantity:1,disposition:'sellable'}]})
 assert.equal((await prisma.product.findUniqueOrThrow({where:{id:zero.product.id}})).costPrice.toString(),'50')
})

test('Cashier shift ownership, nested cost redaction and live membership revocation are enforced by HTTP and cached service contexts',async()=>{
 const {GET:products}=await import('@/app/api/products/route'),{GET:saleDetail}=await import('@/app/api/sales/[id]/route'),{POST:saleCreate}=await import('@/app/api/sales/route'),{POST:returns}=await import('@/app/api/sales/[id]/returns/route'),{POST:sync}=await import('@/app/api/sync/route')
 const {updateMember}=await import('@/server/users/service')
 const f=await fixture(5),cashier=await actor(f.org.id,f.store.id,'cashier')
 const register=await prisma.register.create({data:{storeId:f.store.id,name:'Cashier till',code:randomUUID()}}),shift=await prisma.shift.create({data:{registerId:register.id,organizationUserId:cashier.member.id,openingCash:0}})
 const input={...f.draft,registerId:register.id,shiftId:shift.id},draft=await createDraft(cashier.context,input,randomUUID()),sale=await completeSale(cashier.context,draft.id,{payments:[{paymentType:'cash',amount:100}]},draft.id)
 const catalog=await (await products(req(`/products?organizationId=${f.org.id}`,cashier.cookie),undefined)).json();assert.ok(!('costPrice' in catalog.data[0]))
 const own=await saleDetail(req('/sales/'+sale.id,cashier.cookie),{params:Promise.resolve({id:sale.id})});assert.equal(own.status,200);const detail=(await own.json()).data;assert.ok(!('unitCost' in detail.items[0]));assert.ok(!JSON.stringify(detail).includes('passwordHash'))
 assert.equal((await saleCreate(req('/sales',cashier.cookie,{...f.draft,operationId:randomUUID()}),undefined)).status,404)
 assert.equal((await sync(req('/sync',cashier.cookie,{commands:[{operationId:randomUUID(),type:'sale.create',payload:f.draft}]}),undefined)).status,404)
 assert.equal((await salesReport(req(`/reports/sales?organizationId=${f.org.id}`,cashier.cookie),undefined)).status,403)
 const returnInput={operationId:randomUUID(),shiftId:shift.id,reason:'No permission',items:[{saleItemId:sale.items[0].id,quantity:1}]}
 assert.equal((await returns(req('/sales/'+sale.id+'/returns',cashier.cookie,returnInput),{params:Promise.resolve({id:sale.id})})).status,403)
 await updateMember(f.context,cashier.member.id,{storeIds:[]})
 assert.equal(await verifySession(cashier.token),null)
 assert.equal((await saleCreate(req('/sales',cashier.cookie,{...input,operationId:randomUUID()}),undefined)).status,401)
 await assert.rejects(()=>createDraft(cashier.context,input,randomUUID()),/Sessiya/)
 assert.equal(await prisma.sale.count({where:{cashierId:cashier.user.id}}),1)
})

test('Correction references cannot cross tenant/branch and cashiers cannot deposit or approve',async()=>{
 const f=await fixture(),other=await fixture(),cashier=await actor(f.org.id,f.store.id,'cashier')
 await closeShift(f.context,f.shift.id,{countedCash:0})
 const hidden=await prisma.store.create({data:{organizationId:f.org.id,name:'Other branch'}}),register=await prisma.register.create({data:{storeId:hidden.id,name:'Other',code:randomUUID()}}),posting=await prisma.shift.create({data:{registerId:register.id,organizationUserId:f.member.id,openingCash:0}})
 const input={postingShiftId:posting.id,operationId:randomUUID(),amount:'1.00',direction:'cash_in' as const,reason:'Different branch'}
 await assert.rejects(()=>correctShift(f.context,f.shift.id,input))
 await assert.rejects(()=>correctShift(cashier.context,f.shift.id,input),/ruxsat/)
 await assert.rejects(()=>cashMovement(cashier.context,posting.id,{operationId:randomUUID(),movementType:'bank_deposit',amount:1,reason:'Unauthorized'}),/ruxsat/)
 const {POST:correction}=await import('@/app/api/shifts/[id]/corrections/route')
 assert.equal((await correction(req(`/shifts/${f.shift.id}/corrections`,other.cookie,input),{params:Promise.resolve({id:f.shift.id})})).status,404)
 assert.equal(await prisma.shiftCorrection.count({where:{organizationId:f.org.id}}),0)
 assert.equal(await prisma.cashMovement.count({where:{shiftId:posting.id}}),0)
})


test('Every checkout reference rejects foreign tenants atomically, including draft updates and direct payment writes',async()=>{
 const f=await fixture(),other=await fixture()
 const foreignCustomer=await prisma.customer.create({data:{organizationId:other.org.id,fullName:'Foreign',phone:randomUUID()}})
 for(const input of [{...f.draft,storeId:other.store.id},{...f.draft,registerId:other.register.id},{...f.draft,shiftId:other.shift.id},{...f.draft,items:[{...f.draft.items[0],productId:other.product.id}]},{...f.draft,customerId:foreignCustomer.id}]) await assert.rejects(()=>createDraft(f.context,input,randomUUID()))
 assert.equal(await prisma.sale.count({where:{organizationId:f.org.id}}),0);assert.equal(await prisma.operation.count({where:{organizationId:f.org.id}}),0);assert.equal(await prisma.auditLog.count({where:{organizationId:f.org.id}}),0)
 const draft=await createDraft(f.context,f.draft,randomUUID())
 const {PUT}=await import('@/app/api/sales/[id]/route')
 const updateRequest=new NextRequest('http://localhost:3000/api/sales/'+draft.id,{method:'PUT',headers:{cookie:f.cookie,origin:'http://localhost:3000','content-type':'application/json'},body:JSON.stringify({customerId:foreignCustomer.id,note:'Must roll back'})})
 assert.equal((await PUT(updateRequest,{params:Promise.resolve({id:draft.id})})).status,404)
 const unchanged=await prisma.sale.findUniqueOrThrow({where:{id:draft.id}});assert.equal(unchanged.customerId,null);assert.equal(unchanged.note,null)
 const payment={organizationId:f.org.id,storeId:f.store.id,shiftId:f.shift.id,saleId:draft.id,paymentType:'cash',direction:'in',amount:1,receivedBy:f.user.id}
 for(const data of [{...payment,storeId:other.store.id},{...payment,shiftId:other.shift.id},{...payment,customerId:foreignCustomer.id}])await assert.rejects(()=>prisma.payment.create({data}))
 assert.equal(await prisma.payment.count({where:{organizationId:f.org.id}}),0)
})

test('Tender and change snapshot conserves cash revenue and replay, while invalid tender rolls back',async()=>{
 const f=await fixture(4);await prisma.product.update({where:{id:f.product.id},data:{salePrice:100000}})
 const d=await createDraft(f.context,f.draft,randomUUID())
 await assert.rejects(()=>completeSale(f.context,d.id,{payments:[{paymentType:'cash',amount:100000}],cashTendered:'99999.99'},d.id),/naqd/)
 assert.equal(await prisma.payment.count({where:{saleId:d.id}}),0);assert.equal((await prisma.sale.findUniqueOrThrow({where:{id:d.id}})).status,'draft')
 const input={payments:[{paymentType:'cash' as const,amount:100000}],cashTendered:'120000'}
 const [a,b]=await Promise.all([completeSale(f.context,d.id,input,d.id),completeSale(f.context,d.id,input,d.id)])
 assert.equal(a.id,b.id);assert.equal(a.cashTendered?.toString(),'120000');assert.equal(a.cashChange?.toString(),'20000');assert.equal(a.payments[0].amount.toString(),'100000')
 await assert.rejects(()=>completeSale(f.context,d.id,{...input,cashTendered:'130000'},d.id))
 await assert.rejects(()=>prisma.sale.update({where:{id:d.id},data:{cashTendered:130000}}))
 const summary=shiftCashSummary(0,await prisma.payment.findMany({where:{shiftId:f.shift.id}}),[]);assert.equal(summary.expectedCash.toString(),'100000')
 const legacy=await createDraft(f.context,f.draft,randomUUID());const result=await completeSale(f.context,legacy.id,{payments:[{paymentType:'cash',amount:100000}]},legacy.id);assert.equal(result.cashTendered,null);assert.equal(result.cashChange,null)
})

test('Mixed cash/card and cash/debt keep applied cash, tender, customer and receipt note separate',async()=>{
 const f=await fixture(4);await prisma.product.update({where:{id:f.product.id},data:{salePrice:100000}})
 const card=await createDraft(f.context,{...f.draft,note:'Terminal receipt manually verified'},randomUUID())
 const a=await completeSale(f.context,card.id,{payments:[{paymentType:'cash',amount:60000},{paymentType:'card',amount:40000}],cashTendered:'80000'},card.id)
 assert.equal(a.cashChange?.toString(),'20000');assert.equal(a.payments.length,2);assert.equal(a.note,'Terminal receipt manually verified')
 const customer=await prisma.customer.create({data:{organizationId:f.org.id,fullName:'Partial debtor',phone:randomUUID(),creditLimit:50000}})
 const debt=await createDraft(f.context,{...f.draft,customerId:customer.id,sellerId:f.user.id,serviceType:'Delivery',note:'Delivery after 18:00'},randomUUID())
 const b=await completeSale(f.context,debt.id,{payments:[{paymentType:'cash',amount:60000},{paymentType:'credit',amount:40000}],cashTendered:'60000'},debt.id)
 assert.equal(b.sellerId,f.user.id);assert.equal(b.serviceType,'Delivery');assert.equal(b.customerId,customer.id);assert.equal(b.note,'Delivery after 18:00');assert.equal(b.cashChange?.toString(),'0')
 assert.equal((await prisma.debtEntry.aggregate({where:{customerId:customer.id},_sum:{amount:true}}))._sum.amount?.toString(),'40000')
 assert.equal(shiftCashSummary(0,await prisma.payment.findMany({where:{shiftId:f.shift.id}}),[]).expectedCash.toString(),'120000')
 const d=await createDraft(f.context,f.draft,randomUUID());await assert.rejects(()=>completeSale(f.context,d.id,{payments:[{paymentType:'card',amount:100000}],cashTendered:1},d.id))
})

test('Sync response loss and repeated/concurrent foreground sync produce one original posting and isolate actors',async()=>{
 const {POST:sync}=await import('@/app/api/sync/route')
 const f=await fixture(2),key=randomUUID(),draftInput={commands:[{operationId:key,type:'sale.create',payload:f.draft}]}
 const first=await sync(req('/sync',f.cookie,draftInput),undefined);assert.equal(first.status,200)
 const draft=(await first.json()).data[0].result
 const body={commands:[{operationId:draft.id,type:'sale.complete',payload:{saleId:draft.id,payments:[{paymentType:'cash',amount:100}],cashTendered:120}}]}
 const responses=await Promise.all([sync(req('/sync',f.cookie,body),undefined),sync(req('/sync',f.cookie,body),undefined)])
 for(const response of responses){const result=(await response.json()).data[0];assert.equal(result.state,'synced');assert.equal(result.result.id,draft.id);assert.equal(result.result.cashChange,'20')}
 assert.equal(await prisma.sale.count({where:{organizationId:f.org.id}}),1);assert.equal(await prisma.payment.count({where:{saleId:draft.id}}),1);assert.equal(await prisma.inventoryMovement.count({where:{sourceId:draft.id}}),1)
 const other=await fixture();const denied=(await (await sync(req('/sync',other.cookie,body),undefined)).json()).data[0];assert.equal(denied.state,'conflict');assert.equal(await prisma.payment.count({where:{organizationId:other.org.id}}),0)
 const expired=await actor(f.org.id,f.store.id,'cashier');await prisma.session.update({where:{id:expired.context.sessionId},data:{idleExpiresAt:new Date(0)}})
 assert.equal((await sync(req('/sync',expired.cookie,draftInput),undefined)).status,401)
})

test('Cookie session expiry, revoke and cross-origin CSRF reject mutation before any economic effect',async()=>{
 const {POST:sync}=await import('@/app/api/sync/route')
 const f=await fixture(),body={commands:[{operationId:randomUUID(),type:'sale.create',payload:f.draft}]}
 const cross=new NextRequest('http://localhost:3000/api/sync',{method:'POST',headers:{cookie:f.cookie,origin:'https://evil.invalid','content-type':'application/json'},body:JSON.stringify(body)})
 assert.equal((await sync(cross,undefined)).status,403);assert.equal(await prisma.sale.count({where:{organizationId:f.org.id}}),0)
 const idle=await actor(f.org.id,f.store.id);await prisma.session.update({where:{id:idle.context.sessionId},data:{idleExpiresAt:new Date(0)}});assert.equal(await verifySession(idle.token),null)
 const absolute=await actor(f.org.id,f.store.id);await prisma.session.update({where:{id:absolute.context.sessionId},data:{expiresAt:new Date(0)}});assert.equal(await verifySession(absolute.token),null)
 assert.ok(await verifySession(f.token));await prisma.session.update({where:{id:f.context.sessionId},data:{revokedAt:new Date()}});assert.equal((await sync(req('/sync',f.cookie,body),undefined)).status,401)
})


test('Optional sale metadata rejects foreign seller and blank service without creating a draft',async()=>{
 const f=await fixture(),other=await fixture()
 await assert.rejects(()=>createDraft(f.context,{...f.draft,sellerId:other.user.id},randomUUID()))
 assert.equal((await import('@/server/sales/service')).saleDraftSchema.safeParse({...f.draft,serviceType:'   '}).success,false)
 assert.equal(await prisma.sale.count({where:{organizationId:f.org.id}}),0)
 const cashier=await actor(f.org.id,f.store.id,'cashier');const shift=await prisma.shift.create({data:{registerId:(await prisma.register.create({data:{storeId:f.store.id,name:'Other till',code:randomUUID()}})).id,organizationUserId:cashier.member.id,openingCash:0}})
 await assert.rejects(()=>createDraft(cashier.context,{...f.draft,registerId:shift.registerId,shiftId:shift.id,sellerId:f.user.id},randomUUID()))
})

test('Opening and signed adjustments post once, require reasons, retain approval/source and reverse atomically',async()=>{
 const {POST}=await import('@/app/api/stock-documents/route')
 const {confirmStockDocument,reverseStockDocument}=await import('@/server/inventory/documents')
 const f=await fixture(0)
 const input=(documentType:string,quantity:number,note?:string)=>({organizationId:f.org.id,storeId:f.store.id,documentType,documentNo:randomUUID(),note,items:[{productId:f.product.id,quantity,unitCost:25}]})
 for(const type of ['opening','adjustment'])assert.equal((await POST(req('/stock-documents',f.cookie,input(type,2)),undefined)).status,400)
 const response=await POST(req('/stock-documents',f.cookie,input('opening',5,'Initial verified count')),undefined)
 assert.equal(response.status,200)
 const id=(await response.json()).data.id
 const results=await Promise.all([confirmStockDocument(f.context,id),confirmStockDocument(f.context,id)])
 assert.equal(results[0].id,results[1].id)
 assert.equal(await prisma.inventoryMovement.count({where:{sourceId:id}}),1)
 assert.equal((await prisma.inventoryBalance.findUniqueOrThrow({where:{storeId_productId:{storeId:f.store.id,productId:f.product.id}}})).quantity.toString(),'5')
 const doc=await prisma.stockDocument.findUniqueOrThrow({where:{id}})
 assert.equal(doc.confirmedBy,f.user.id);assert.ok(doc.confirmedAt)
 assert.equal((await prisma.product.findUniqueOrThrow({where:{id:f.product.id}})).costPrice.toString(),'25')
 const second=await (await POST(req('/stock-documents',f.cookie,input('opening',1,'Duplicate initial count')),undefined)).json()
 await assert.rejects(()=>confirmStockDocument(f.context,second.data.id),{code:'OPENING_ALREADY_EXISTS'})
 for(const quantity of [3,-2]){
  const adjust=await (await POST(req('/stock-documents',f.cookie,input('adjustment',quantity,'Verified discrepancy')),undefined)).json()
  await confirmStockDocument(f.context,adjust.data.id)
  const movement=await prisma.inventoryMovement.findFirstOrThrow({where:{sourceId:adjust.data.id}})
  assert.equal(movement.sourceType,'stock_document');assert.equal(movement.quantityDelta.toString(),String(quantity))
 }
 assert.equal((await prisma.inventoryBalance.findUniqueOrThrow({where:{storeId_productId:{storeId:f.store.id,productId:f.product.id}}})).quantity.toString(),'6')
 const negative=await (await POST(req('/stock-documents',f.cookie,input('adjustment',-100,'Invalid loss')),undefined)).json()
 await assert.rejects(()=>confirmStockDocument(f.context,negative.data.id),{code:'INSUFFICIENT_STOCK'})
 assert.equal(await prisma.inventoryMovement.count({where:{sourceId:negative.data.id}}),0)
 await reverseStockDocument(f.context,id,{operationId:randomUUID(),reason:'Opening quantity corrected'})
 assert.equal((await prisma.inventoryBalance.findUniqueOrThrow({where:{storeId_productId:{storeId:f.store.id,productId:f.product.id}}})).quantity.toString(),'1')
})

test('Barcode generation is actor-bound idempotent, labels are escaped and tenant-scoped',async()=>{
 const {POST}=await import('@/app/api/products/[id]/barcodes/generate/route')
 const {GET}=await import('@/app/api/products/[id]/barcodes/labels/route')
 const f=await fixture(),other=await fixture(),operationId=randomUUID(),params={params:Promise.resolve({id:f.product.id})}
 const make=()=>POST(req(`/products/${f.product.id}/barcodes/generate`,f.cookie,{operationId}),params)
 const responses=await Promise.all([make(),make()]);assert.ok(responses.every(x=>x.status===200))
 const barcode=(await responses[0].json()).data;assert.equal((await responses[1].json()).data.id,barcode.id)
 assert.equal(await prisma.productBarcode.count({where:{productId:f.product.id,value:barcode.value}}),1)
 await prisma.product.update({where:{id:f.product.id},data:{name:'<script>alert(1)</script>'}})
 const label=await GET(req(`/products/${f.product.id}/barcodes/labels?barcodeId=${barcode.id}&copies=2`,f.cookie),params)
 assert.equal(label.status,200);const html=(await label.json()).data.content
 assert.equal((html.match(/<article>/g)??[]).length,2);assert.ok(html.includes('&lt;script&gt;'));assert.ok(!html.includes('<script>'))
 assert.equal((await GET(req(`/products/${f.product.id}/barcodes/labels?barcodeId=${barcode.id}`,other.cookie),params)).status,404)
 assert.equal((await GET(req(`/products/${f.product.id}/barcodes/labels?barcodeId=${barcode.id}&copies=101`,f.cookie),params)).status,400)
 const cashier=await actor(f.org.id,f.store.id,'cashier')
 assert.equal((await POST(req(`/products/${f.product.id}/barcodes/generate`,cashier.cookie,{operationId:randomUUID()}),params)).status,403)
})

test('Ownership handover requires recipient acceptance, cancels safely, expires and revokes old sessions atomically',async()=>{
 const {transferOwnership,respondOwnership,updateMember}=await import('@/server/users/service')
 const {POST}=await import('@/app/api/ownership-transfers/[id]/route')
 const f=await fixture(),target=await actor(f.org.id,f.store.id,'cashier'),outsider=await actor(f.org.id,f.store.id,'admin')
 await assert.rejects(()=>updateMember(f.context,f.member.id,{isActive:false}),{code:'LAST_OWNER'})
 const request=await transferOwnership(f.context,target.member.id)
 assert.equal((await transferOwnership(f.context,target.member.id)).id,request.id)
 assert.equal((await prisma.organizationUser.findUniqueOrThrow({where:{id:target.member.id}})).role,'cashier')
 await assert.rejects(()=>respondOwnership(f.context,request.id,'accept'),{code:'RECIPIENT_REQUIRED'})
 await assert.rejects(()=>respondOwnership(outsider.context,request.id,'accept'),{code:'NOT_FOUND'})
 await respondOwnership(target.context,request.id,'cancel')
 await assert.rejects(()=>respondOwnership(target.context,request.id,'accept'),{code:'TRANSFER_EXPIRED'})
 const pending=await transferOwnership(f.context,target.member.id)
 const response=await POST(req('/ownership-transfers/'+pending.id,target.cookie,{action:'accept'}),{params:Promise.resolve({id:pending.id})})
 assert.equal(response.status,200)
 assert.ok(!JSON.stringify(await response.json()).includes('token'))
 assert.equal(await verifySession(f.token),null);assert.equal(await verifySession(target.token),null)
 const cookie=response.headers.get('set-cookie')??'',token=/pos_session=([^;]+)/.exec(cookie)?.[1]
 assert.ok(token);const fresh=await verifySession(token);assert.ok(fresh);assert.equal(fresh.role,'owner')
 const retry=await respondOwnership(fresh,pending.id,'accept');assert.equal(retry.request.id,pending.id);assert.equal(retry.token,null)
 assert.equal((await prisma.organizationUser.findUniqueOrThrow({where:{id:f.member.id}})).role,'admin')
 assert.equal(await prisma.auditLog.count({where:{entityId:pending.id,action:'ownership_transferred'}}),1)
})

test('Parallel owner removal keeps a live owner; inactive and foreign business switches preserve old session',async()=>{
 const {updateMember}=await import('@/server/users/service')
 const {POST}=await import('@/app/api/organizations/switch/route')
 const f=await fixture(),second=await actor(f.org.id,f.store.id,'owner'),other=await fixture()
 const results=await Promise.allSettled([updateMember(f.context,second.member.id,{isActive:false}),updateMember(second.context,f.member.id,{isActive:false})])
 assert.equal(results.filter(x=>x.status==='fulfilled').length,1)
 assert.equal(await prisma.organizationUser.count({where:{organizationId:f.org.id,role:'owner',isActive:true}}),1)
 const current=await fixture()
 assert.equal((await POST(req('/organizations/switch',current.cookie,{targetOrganizationId:other.org.id}),undefined)).status,403)
 assert.ok(await verifySession(current.token))
 const membership=await prisma.organizationUser.create({data:{userId:current.user.id,organizationId:other.org.id,role:'cashier',isActive:false}})
 assert.equal((await POST(req('/organizations/switch',current.cookie,{targetOrganizationId:other.org.id}),undefined)).status,403)
 await prisma.organizationUser.update({where:{id:membership.id},data:{isActive:true}})
 const switched=await POST(req('/organizations/switch',current.cookie,{targetOrganizationId:other.org.id}),undefined)
 assert.equal(switched.status,200);assert.equal(await verifySession(current.token),null)
 const token=/pos_session=([^;]+)/.exec(switched.headers.get('set-cookie')??'')?.[1];assert.ok(token)
 assert.equal((await verifySession(token))?.organizationId,other.org.id)
})


test('Stock journal rejects mutation, missing source and zero movements while preserving posted balance',async()=>{
 const {confirmStockDocument}=await import('@/server/inventory/documents')
 const f=await fixture(0)
 const doc=await prisma.stockDocument.create({data:{organizationId:f.org.id,storeId:f.store.id,documentType:'opening',documentNo:randomUUID(),note:'Verified opening',createdBy:f.user.id,items:{create:{productId:f.product.id,quantity:2,unitCost:10}}}})
 await confirmStockDocument(f.context,doc.id)
 const movement=await prisma.inventoryMovement.findFirstOrThrow({where:{sourceId:doc.id}})
 await assert.rejects(()=>prisma.inventoryMovement.update({where:{id:movement.id},data:{quantityDelta:999}}))
 await assert.rejects(()=>prisma.inventoryMovement.delete({where:{id:movement.id}}))
 const {id:unused,...data}=movement;void unused
 for(const invalid of [{sourceId:''},{sourceType:' '},{quantityDelta:0},{unitCost:-1}])await assert.rejects(()=>prisma.inventoryMovement.create({data:{...data,...invalid}}))
 assert.equal((await prisma.inventoryBalance.findUniqueOrThrow({where:{storeId_productId:{storeId:f.store.id,productId:f.product.id}}})).quantity.toString(),'2')
 assert.equal((await prisma.inventoryMovement.aggregate({where:{storeId:f.store.id,productId:f.product.id},_sum:{quantityDelta:true}}))._sum.quantityDelta?.toString(),'2')
})

test('Two opening documents cannot race into duplicate initial stock; stale ownership request cannot transfer',async()=>{
 const {confirmStockDocument}=await import('@/server/inventory/documents')
 const {transferOwnership,respondOwnership}=await import('@/server/users/service')
 const f=await fixture(0),target=await actor(f.org.id,f.store.id,'cashier')
 const docs=await Promise.all([1,2].map(()=>prisma.stockDocument.create({data:{organizationId:f.org.id,storeId:f.store.id,documentType:'opening',documentNo:randomUUID(),note:'Verified first count',createdBy:f.user.id,items:{create:{productId:f.product.id,quantity:2,unitCost:10}}}})))
 const results=await Promise.allSettled(docs.map(doc=>confirmStockDocument(f.context,doc.id)))
 assert.equal(results.filter(x=>x.status==='fulfilled').length,1)
 assert.equal((await prisma.inventoryBalance.findUniqueOrThrow({where:{storeId_productId:{storeId:f.store.id,productId:f.product.id}}})).quantity.toString(),'2')
 assert.equal(await prisma.inventoryMovement.count({where:{productId:f.product.id}}),1)
 const expired=await prisma.ownershipTransfer.create({data:{organizationId:f.org.id,fromMembershipId:f.member.id,toMembershipId:target.member.id,createdAt:new Date(Date.now()-3600000),expiresAt:new Date(Date.now()-1000)}})
 await assert.rejects(()=>respondOwnership(target.context,expired.id,'accept'),{code:'TRANSFER_EXPIRED'})
 const fresh=await transferOwnership(f.context,target.member.id)
 assert.notEqual(fresh.id,expired.id)
 assert.equal((await prisma.ownershipTransfer.findUniqueOrThrow({where:{id:expired.id}})).state,'expired')
 assert.equal((await prisma.organizationUser.findUniqueOrThrow({where:{id:f.member.id}})).role,'owner')
})

test('Cached catalog prices, stock and role never authorize posting; private API results bypass shared caches',async()=>{
 const {GET}=await import('@/app/api/products/route')
 const {updateMember}=await import('@/server/users/service')
 const priced=await fixture(1),draft=await createDraft(priced.context,priced.draft,randomUUID())
 const read=await GET(req('/products?organizationId='+priced.org.id,priced.cookie),undefined)
 assert.equal(read.headers.get('cache-control'),'private, no-store')
 await prisma.product.update({where:{id:priced.product.id},data:{salePrice:150}})
 await assert.rejects(()=>completeSale(priced.context,draft.id,{payments:[{paymentType:'cash',amount:100}]},randomUUID()),{code:'PRICE_CHANGED'})
 assert.equal(await prisma.payment.count({where:{saleId:draft.id}}),0)
 assert.equal(await prisma.inventoryMovement.count({where:{sourceId:draft.id}}),0)
 const stock=await fixture(1),one=await createDraft(stock.context,stock.draft,randomUUID()),two=await createDraft(stock.context,stock.draft,randomUUID())
 await completeSale(stock.context,one.id,{payments:[{paymentType:'cash',amount:100}]},randomUUID())
 await assert.rejects(()=>completeSale(stock.context,two.id,{payments:[{paymentType:'cash',amount:100}]},randomUUID()),{code:'INSUFFICIENT_STOCK'})
 assert.equal(await prisma.payment.count({where:{saleId:two.id}}),0)
 const revoked=await fixture(),staff=await actor(revoked.org.id,revoked.store.id,'admin')
 const staffRegister=await prisma.register.create({data:{storeId:revoked.store.id,name:'Staff terminal',code:randomUUID()}})
 const staffShift=await prisma.shift.create({data:{registerId:staffRegister.id,organizationUserId:staff.member.id,openingCash:0}})
 const attempt=await createDraft(staff.context,{...revoked.draft,registerId:staffRegister.id,shiftId:staffShift.id},randomUUID())
 await updateMember(revoked.context,staff.member.id,{isActive:false})
 await assert.rejects(()=>completeSale(staff.context,attempt.id,{payments:[{paymentType:'cash',amount:100}]},randomUUID()),{code:'SESSION_CHANGED'})
 const denied=await GET(req('/products?organizationId='+revoked.org.id,staff.cookie),undefined)
 assert.equal(denied.status,401);assert.equal(denied.headers.get('cache-control'),'private, no-store')
 assert.equal(await prisma.payment.count({where:{saleId:attempt.id}}),0)
})

test('Purchase price history compares original confirmed snapshots, signed reversals and scoped full exports',async()=>{
 const {GET}=await import('@/app/api/reports/purchases/route')
 const {confirmStockDocument,reverseStockDocument}=await import('@/server/inventory/documents')
 const f=await fixture(0),other=await fixture()
 const a=await prisma.supplier.create({data:{organizationId:f.org.id,name:'=Supplier A'}}),b=await prisma.supplier.create({data:{organizationId:f.org.id,name:'Supplier B'}})
 const buy=async(supplierId:string,quantity:number,unitCost:number,confirm=true)=>{
  const doc=await prisma.stockDocument.create({data:{organizationId:f.org.id,storeId:f.store.id,supplierId,documentNo:randomUUID(),documentType:'purchase',createdBy:f.user.id,createdAt:new Date('2020-01-01'),items:{create:{productId:f.product.id,quantity,unitCost}}}})
  if(confirm)await confirmStockDocument(f.context,doc.id);return doc
 }
 const original=await buy(a.id,2,10);await buy(a.id,3,20);await buy(b.id,1,30);await buy(a.id,99,999,false)
 await reverseStockDocument(f.context,original.id,{operationId:randomUUID(),reason:'Receipt correction'})
 await prisma.product.update({where:{id:f.product.id},data:{costPrice:999}})
 const base='/reports/purchases?productId='+f.product.id
 const history=await GET(req(base+'&limit=1',f.cookie),undefined);assert.equal(history.status,200)
 const result=await history.json();assert.equal(result.pagination.total,4);assert.equal(result.data.rows.length,1)
 assert.equal(result.data.summary.purchaseValue,'110');assert.equal(result.data.summary.reversalValue,'20');assert.equal(result.data.summary.netPurchaseValue,'90')
 const comparison=await (await GET(req(base+'&view=comparison',f.cookie),undefined)).json()
 assert.equal(comparison.pagination.total,2)
 const row=comparison.data.rows.find((x:{supplierId:string})=>x.supplierId===a.id)
 assert.equal(row.firstPrice,'10');assert.equal(row.latestPrice,'20');assert.equal(row.minPrice,'10');assert.equal(row.maxPrice,'20');assert.equal(row.averagePrice,'16');assert.equal(row.netQuantity,'3');assert.equal(row.netPurchaseValue,'60')
 const selected=await (await GET(req(base+'&supplierId='+a.id,f.cookie),undefined)).json();assert.equal(selected.data.summary.netPurchaseValue,'60')
 const empty=await (await GET(req(base+'&from=2020-01-01&to=2020-01-01',f.cookie),undefined)).json();assert.equal(empty.pagination.total,0)
 const exported=await (await GET(req(base+'&supplierId='+a.id+'&format=csv&limit=1&page=999',f.cookie),undefined)).json()
 assert.equal((exported.data.content.match(/^"[0-9a-f-]{36}",/gm)??[]).length,3)
 assert.ok(exported.data.content.includes("'="));assert.ok(exported.data.content.includes('10.000000'));assert.ok(!exported.data.content.includes('999.000000'))
 assert.equal((await GET(req(base,other.cookie),undefined)).status,404)
 const admin=await actor(f.org.id,f.store.id,'admin'),hidden=await prisma.store.create({data:{organizationId:f.org.id,name:'Hidden'}})
 const hiddenDoc=await prisma.stockDocument.create({data:{organizationId:f.org.id,storeId:hidden.id,supplierId:a.id,documentNo:randomUUID(),documentType:'purchase',createdBy:f.user.id,items:{create:{productId:f.product.id,quantity:1,unitCost:100}}}});await confirmStockDocument(f.context,hiddenDoc.id)
 const allowed=await (await GET(req(base,admin.cookie),undefined)).json();assert.equal(allowed.data.summary.netPurchaseValue,'90')
 assert.equal((await GET(req(base+'&storeId='+hidden.id,admin.cookie),undefined)).status,404)
 const cashier=await actor(f.org.id,f.store.id,'cashier');assert.equal((await GET(req(base,cashier.cookie),undefined)).status,403)
 await buy(a.id,2,50)
 const cutoff=await (await GET(req(base+'&asOf='+encodeURIComponent(result.data.meta.asOf),f.cookie),undefined)).json();assert.equal(cutoff.pagination.total,4);assert.equal(cutoff.data.summary.netPurchaseValue,'90')
 assert.equal((await GET(req(base+'&view=bad',f.cookie),undefined)).status,400)
})

test('Credit boundary rejects missing/inactive customer and over-limit without posting; 100000 debt adds no cash',async()=>{
 const f=await fixture(10),other=await fixture(),customer=await prisma.customer.create({data:{organizationId:f.org.id,fullName:'Credit acceptance',phone:randomUUID(),creditLimit:100000}})
 await prisma.product.update({where:{id:f.product.id},data:{salePrice:100000}})
 const noCustomer=await createDraft(f.context,f.draft,randomUUID())
 await assert.rejects(()=>completeSale(f.context,noCustomer.id,{payments:[{paymentType:'credit',amount:100000}]},randomUUID()),{code:'CUSTOMER_REQUIRED'})
 const inactive=await createDraft(f.context,{...f.draft,customerId:customer.id},randomUUID())
 await prisma.customer.update({where:{id:customer.id},data:{isActive:false}})
 await assert.rejects(()=>completeSale(f.context,inactive.id,{payments:[{paymentType:'credit',amount:100000}]},randomUUID()),{code:'CUSTOMER_NOT_FOUND'})
 await prisma.customer.update({where:{id:customer.id},data:{isActive:true,creditLimit:99999}})
 await assert.rejects(()=>completeSale(f.context,inactive.id,{payments:[{paymentType:'credit',amount:100000}]},randomUUID()),{code:'CREDIT_LIMIT'})
 for(const saleId of [noCustomer.id,inactive.id]){assert.equal(await prisma.payment.count({where:{saleId}}),0);assert.equal(await prisma.debtEntry.count({where:{saleId}}),0);assert.equal(await prisma.inventoryMovement.count({where:{sourceId:saleId}}),0)}
 await prisma.customer.update({where:{id:customer.id},data:{creditLimit:100000}})
 const sale=await completeSale(f.context,inactive.id,{payments:[{paymentType:'credit',amount:100000}]},randomUUID())
 await assert.rejects(()=>completeSale(other.context,sale.id,{payments:[{paymentType:'credit',amount:100000}]},randomUUID()),{code:'NOT_FOUND'})
 assert.equal((await prisma.debtEntry.aggregate({where:{customerId:customer.id},_sum:{amount:true}}))._sum.amount?.toString(),'100000')
 assert.equal(await prisma.payment.count({where:{saleId:sale.id,paymentType:'cash'}}),0)
 assert.equal((shiftCashSummary(f.shift.openingCash,await prisma.payment.findMany({where:{shiftId:f.shift.id}}),[])).expectedCash.toString(),'0')
 const report=await (await salesReport(req('/reports/sales?organizationId='+f.org.id,f.cookie),undefined)).json()
 assert.equal(report.summary.totalRevenue,'100000');assert.equal(report.summary.creditSales,'100000');assert.equal(report.summary.cashPayments,'0')
 const next=await createDraft(f.context,{...f.draft,customerId:customer.id},randomUUID())
 await assert.rejects(()=>completeSale(f.context,next.id,{payments:[{paymentType:'credit',amount:100000}]},randomUUID()),{code:'CREDIT_LIMIT'})
 assert.equal(await prisma.debtEntry.count({where:{customerId:customer.id}}),1)
})


test('Register receipt counter is atomic, actor-idempotent and separate from nullable fiscal reference',async()=>{
 const f=await fixture(20)
 const keys=[randomUUID(),randomUUID()]
 const drafts=await Promise.all(keys.map(key=>createDraft(f.context,f.draft,key)))
 assert.equal(new Set(drafts.map(sale=>sale.receiptNo)).size,2)
 assert.deepEqual(drafts.map(sale=>sale.receiptNo).sort(),['POS-1','POS-2'])
 assert.notEqual(drafts[0].id,drafts[0].receiptNo);assert.equal(drafts[0].fiscalReceiptNo,null)
 assert.equal((await createDraft(f.context,f.draft,keys[0])).receiptNo,drafts[0].receiptNo)
 assert.equal((await prisma.register.findUniqueOrThrow({where:{id:f.register.id}})).receiptSequence.toString(),'2')
 await assert.rejects(()=>createDraft(f.context,{...f.draft,items:[{...f.draft.items[0],expectedUnitPrice:99}]},randomUUID()),{code:'PRICE_CHANGED'})
 assert.equal((await prisma.register.findUniqueOrThrow({where:{id:f.register.id}})).receiptSequence.toString(),'2')
})

test('Checkout conflicts expose scoped old/new price and requested/available stock without any posting',async()=>{
 const {POST}=await import('@/app/api/sales/[id]/complete/route')
 const f=await fixture(2),draft=await createDraft(f.context,f.draft,randomUUID())
 await prisma.product.update({where:{id:f.product.id},data:{salePrice:120}})
 const input={payments:[{paymentType:'cash',amount:100}]}
 const price=await POST(req('/sales/'+draft.id+'/complete',f.cookie,input),{params:Promise.resolve({id:draft.id})})
 assert.equal(price.status,409);const priceError=(await price.json()).error
 assert.equal(priceError.code,'PRICE_CHANGED');assert.equal(priceError.details.previousPrice,'100');assert.equal(priceError.details.currentPrice,'120')
 assert.equal(JSON.stringify(priceError).includes('unitCost'),false)
 await prisma.product.update({where:{id:f.product.id},data:{salePrice:100}})
 await prisma.inventoryBalance.update({where:{storeId_productId:{storeId:f.store.id,productId:f.product.id}},data:{quantity:0}})
 const stock=await POST(req('/sales/'+draft.id+'/complete',f.cookie,input),{params:Promise.resolve({id:draft.id})})
 const stockError=(await stock.json()).error;assert.equal(stock.status,409);assert.equal(stockError.code,'INSUFFICIENT_STOCK');assert.equal(stockError.details.requestedQuantity,'1');assert.equal(stockError.details.availableQuantity,'0')
 assert.equal(await prisma.payment.count({where:{saleId:draft.id}}),0);assert.equal(await prisma.inventoryMovement.count({where:{sourceId:draft.id}}),0)
 assert.equal((await prisma.sale.findUniqueOrThrow({where:{id:draft.id}})).status,'draft')
})

test('Unconfigured integration boundary returns a distinct sanitized HTTP state without vendor calls',async()=>{
 const {withApi}=await import('@/server/api'),{IntegrationUnavailable}=await import('@/server/integrations/contracts')
 const f=await fixture()
 const handler=withApi(async()=>{throw new IntegrationUnavailable('payment')})
 const result=await handler(req('/operations/boundary',f.cookie,{}),undefined)
 assert.equal(result.status,503);assert.equal((await result.json()).error.code,'INTEGRATION_UNAVAILABLE')
 assert.equal(await prisma.sale.count({where:{organizationId:f.org.id}}),0)
 assert.equal(await prisma.payment.count({where:{organizationId:f.org.id}}),0)
})

test('Cashier counted difference needs immutable manager approval and blocks transactions until accepted',async()=>{
 const f=await fixture(),cashier=await actor(f.org.id,f.store.id,'cashier')
 const register=await prisma.register.create({data:{storeId:f.store.id,name:'Cashier',code:randomUUID()}})
 const shift=await openShift(cashier.context,{registerId:register.id,organizationUserId:cashier.member.id,openingCash:50,operationId:randomUUID()})
 await assert.rejects(()=>closeShift(cashier.context,shift.id,{countedCash:45}),{code:'CLOSE_REASON_REQUIRED'})
 const request=await closeShift(cashier.context,shift.id,{countedCash:45,note:'Counted shortage',operationId:randomUUID()})
 const pending=request.pendingClose as {id:string;countedCash:string;countedBy:string}
 assert.equal(request.status,'open');assert.equal(pending.countedBy,cashier.user.id);assert.equal(pending.countedCash,'45.00')
 await assert.rejects(()=>cashMovement(cashier.context,shift.id,{movementType:'cash_in',amount:1,reason:'Cannot change snapshot',operationId:randomUUID()}),{code:'SHIFT_CLOSE_PENDING'})
 await assert.rejects(()=>createDraft(cashier.context,{...f.draft,registerId:register.id,shiftId:shift.id},randomUUID()),{code:'SHIFT_CLOSE_PENDING'})
 await assert.rejects(()=>closeShift(f.context,shift.id,{countedCash:45,approvalRequestId:randomUUID()}),{code:'CLOSE_REQUEST_CHANGED'})
 const accepted=await closeShift(f.context,shift.id,{countedCash:45,approvalRequestId:pending.id})
 assert.equal(accepted.status,'closed');assert.equal(String(accepted.expectedCash),'50');assert.equal(String(accepted.cashDifference),'-5');assert.equal(accepted.approvedBy,f.user.id);assert.equal(accepted.countedBy,cashier.user.id);assert.equal(accepted.closeReason,'Counted shortage')
 assert.equal((await closeShift(f.context,shift.id,{countedCash:45,approvalRequestId:pending.id})).id,accepted.id)
 await assert.rejects(()=>closeShift(f.context,f.shift.id,{countedCash:45,approvalRequestId:pending.id}),{code:'OPERATION_PAYLOAD_CONFLICT'})
 await assert.rejects(()=>prisma.shift.update({where:{id:shift.id},data:{closeReason:'rewrite'}}))
 const next=await openShift(cashier.context,{registerId:register.id,organizationUserId:cashier.member.id,openingCash:45,handoverFromId:shift.id,operationId:randomUUID()})
 assert.equal(next.handoverFromId,shift.id);assert.equal(String(next.openingCash),'45')
 assert.equal(await prisma.auditLog.count({where:{organizationId:f.org.id,action:'handover_accepted'}}),1)
 await assert.rejects(()=>openShift(cashier.context,{registerId:f.register.id,organizationUserId:f.member.id,openingCash:45,handoverFromId:shift.id,operationId:randomUUID()}),{code:'FORBIDDEN'})
})

test('Zero shift difference closes without approval; pending payments and draft policies still block close',async()=>{
 const f=await fixture()
 const draft=await createDraft(f.context,f.draft,randomUUID())
 await assert.rejects(()=>closeShift(f.context,f.shift.id,{countedCash:0}),{code:'OPEN_DRAFTS'})
 const {POST:voidDraft}=await import('@/app/api/sales/[id]/void/route');assert.equal((await voidDraft(req('/sales/'+draft.id+'/void',f.cookie,{}),{params:Promise.resolve({id:draft.id})})).status,200)
 const pending=await prisma.payment.create({data:{organizationId:f.org.id,storeId:f.store.id,shiftId:f.shift.id,paymentType:'cash',direction:'in',amount:1,receivedBy:f.user.id,status:'pending'}})
 await assert.rejects(()=>closeShift(f.context,f.shift.id,{countedCash:0}),{code:'UNRESOLVED_PAYMENTS'})
 await prisma.payment.delete({where:{id:pending.id}})
 const closed=await closeShift(f.context,f.shift.id,{countedCash:0})
 assert.equal(String(closed.cashDifference),'0');assert.equal(closed.approvedBy,null);assert.equal(closed.countedBy,f.user.id)
})

test('Rejected close request resumes work; handover rejects wrong amount, stale or foreign origin',async()=>{
 const {rejectClose}=await import('@/server/finance/shifts')
 const f=await fixture(),cashier=await actor(f.org.id,f.store.id,'cashier'),other=await fixture()
 const register=await prisma.register.create({data:{storeId:f.store.id,name:'Review',code:randomUUID()}})
 const shift=await openShift(cashier.context,{registerId:register.id,organizationUserId:cashier.member.id,openingCash:10,operationId:randomUUID()})
 const waiting=await closeShift(cashier.context,shift.id,{countedCash:9,note:'Initial count error',operationId:randomUUID()})
 const pending=waiting.pendingClose as {id:string}
 const rejectInput={requestId:pending.id,reason:'Recount with supervisor',operationId:randomUUID()}
 await assert.rejects(()=>rejectClose(cashier.context,shift.id,rejectInput),{code:'MANAGER_REQUIRED'})
 await rejectClose(f.context,shift.id,rejectInput);assert.equal((await prisma.shift.findUniqueOrThrow({where:{id:shift.id}})).pendingClose,null)
 await cashMovement(cashier.context,shift.id,{movementType:'cash_in',amount:1,reason:'Received after recount',operationId:randomUUID()})
 await closeShift(cashier.context,shift.id,{countedCash:11,operationId:randomUUID()})
 await assert.rejects(()=>openShift(cashier.context,{registerId:register.id,organizationUserId:cashier.member.id,openingCash:10,handoverFromId:shift.id,operationId:randomUUID()}),{code:'INVALID_HANDOVER'})
 await assert.rejects(()=>openShift(cashier.context,{registerId:register.id,organizationUserId:cashier.member.id,openingCash:11,handoverFromId:other.shift.id,operationId:randomUUID()}),{code:'INVALID_HANDOVER'})
})

test('Opening document FIFO and explicit allocations conserve payment, due buckets and statement exports',async()=>{
 const {postDebtDocument,customerStatement}=await import('@/server/customers/ledger'),{collectDebt}=await import('@/server/payments/collections')
 const {GET:debt}=await import('@/app/api/customers/[id]/debt/route')
 const f=await fixture(),customer=await prisma.customer.create({data:{organizationId:f.org.id,fullName:'Opening customer',phone:randomUUID(),creditLimit:1000}})
 const first=await postDebtDocument(f.context,customer.id,{kind:'opening',amount:100,reason:'Old unpaid balance',effectiveAt:'2025-01-01T00:00:00Z',dueAt:'2025-02-01T00:00:00Z',operationId:randomUUID()})
 const second=await postDebtDocument(f.context,customer.id,{kind:'opening',amount:200,reason:'Future balance',effectiveAt:'2025-03-01T00:00:00Z',dueAt:'2030-01-01T00:00:00Z',operationId:randomUUID()})
 const input={organizationId:f.org.id,storeId:f.store.id,shiftId:f.shift.id,customerId:customer.id,paymentType:'cash' as const,amount:150,operationId:randomUUID()}
 const paid=await collectDebt(f.context,input);await collectDebt(f.context,input)
 const allocations=await prisma.debtEntry.findMany({where:{sourceType:'collection',sourceId:{startsWith:paid.id+':'}}})
 assert.equal(allocations.length,2);assert.equal(allocations.reduce((sum,row)=>sum-row.amount.toNumber(),0),150)
 assert.equal(allocations.find(row=>row.debtOriginId===first.id)?.amount.toString(),'-100');assert.equal(allocations.find(row=>row.debtOriginId===second.id)?.amount.toString(),'-50')
 const targets=await debt(req('/customers/'+customer.id+'/debt?targetsPage=1',f.cookie),{params:Promise.resolve({id:customer.id})})
 const targetRows=(await targets.json()).data.allocationTargets.items;assert.equal(targetRows.length,1);assert.equal(targetRows[0].debtOriginId,second.id);assert.equal(targetRows[0].balance,'150')
 await collectDebt(f.context,{...input,amount:50,operationId:randomUUID(),allocations:[{saleId:null,debtOriginId:second.id,amount:50}]})
 await assert.rejects(()=>collectDebt(f.context,{...input,amount:1,operationId:randomUUID(),allocations:[{saleId:null,debtOriginId:first.id,amount:1}]}),{code:'DEBT_TARGET_OVERPAYMENT'})
 await assert.rejects(()=>collectDebt(f.context,{...input,amount:1,operationId:randomUUID(),allocations:[{saleId:null,debtOriginId:second.id,amount:2}]}),{code:'DEBT_ALLOCATION_TOTAL_MISMATCH'})
 const statement=await customerStatement(f.context,customer.id,{limit:1})
 assert.equal(statement.summary.currentBalance.toString(),'100');assert.equal(statement.summary.closingBalance.toString(),'100');assert.equal(statement.aging.upcoming.toString(),'100');assert.equal(statement.aging.overdue.toString(),'0');assert.equal(statement.aging.unallocated.toString(),'0');assert.equal(statement.aging.requiresReconciliation,false)
 const {statementCsv}=await import('@/server/customers/export');const full=await customerStatement(f.context,customer.id,{exportAll:true});assert.equal(full.entries.length,5);assert.match(statementCsv(full,{from:null,to:null}),/100.00/)
 const customer2=await prisma.customer.create({data:{organizationId:f.org.id,fullName:'Foreign customer',phone:randomUUID(),creditLimit:0}})
 await assert.rejects(()=>prisma.debtEntry.create({data:{organizationId:f.org.id,customerId:customer2.id,sourceType:'collection',sourceId:randomUUID(),amount:-1,debtOriginId:first.id}}))
})
