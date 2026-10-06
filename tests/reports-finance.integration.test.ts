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
