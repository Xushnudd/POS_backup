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
 const draft={discountReason:'Test customer discount approved by scenario owner',organizationId:org.id,storeId:store.id,registerId:register.id,shiftId:shift.id,discountAmount:0,items:[{productId:product.id,quantity:1,discountAmount:0}]}
 return {org,store,register,shift,product,draft,...owner}
}

test('Mixed manual cash/card/debt refunds preview exact channels, require proof and conserve repeated partial/full refunds',async()=>{
 const f=await fixture(3),customer=await prisma.customer.create({data:{organizationId:f.org.id,fullName:'Mixed customer',phone:randomUUID(),creditLimit:1000}});
 const draft=await createDraft(f.context,{...f.draft,customerId:customer.id,items:[{productId:f.product.id,quantity:3,discountAmount:0}]},randomUUID());
 await completeSale(f.context,draft.id,{payments:[{paymentType:'cash',amount:90},{paymentType:'card',amount:60},{paymentType:'credit',amount:150}]},randomUUID());
 const input=returnSchema.parse({operationId:randomUUID(),shiftId:f.shift.id,reason:'One unit returned',items:[{saleItemId:draft.items[0].id,quantity:1}]});
 const before=await prisma.operation.count({where:{organizationId:f.org.id}});
 const preview=await returnSale(f.context,draft.id,input,true);
 assert.deepEqual(Object.fromEntries(Object.entries(preview.settlement).map(([key,value])=>[key,value.toString()])),{cash:'30',card:'20',transfer:'0',debt:'50',waived:'0'});
 assert.equal(await prisma.operation.count({where:{organizationId:f.org.id}}),before);assert.equal(await prisma.saleReturn.count({where:{saleId:draft.id}}),0);
 await assert.rejects(()=>returnSale(f.context,draft.id,input),error=>error instanceof Error&&'code' in error&&error.code==='EXTERNAL_REFUND_REQUIRED');
 assert.equal(await prisma.payment.count({where:{saleId:draft.id,direction:'out'}}),0);
 const stringify=(value:typeof preview.settlement)=>Object.fromEntries(Object.entries(value).map(([key,amount])=>[key,amount.toString()])) as Record<'cash'|'card'|'transfer'|'debt'|'waived',string>;
 const confirmed={...input,manualNonCash:{confirmed:true as const,referenceNo:'BANK-REFUND-20',expectedSettlement:stringify(preview.settlement)}};
 const first=await returnSale(f.context,draft.id,confirmed);await returnSale(f.context,draft.id,confirmed);
 assert.equal(first.settlement.card.toString(),'20');assert.equal(await prisma.saleReturn.count({where:{saleId:draft.id}}),1);
 const remaining={...input,operationId:randomUUID(),items:[{...input.items[0],quantity:2}]};
 await assert.rejects(()=>returnSale(f.context,draft.id,{...remaining,manualNonCash:confirmed.manualNonCash}),error=>error instanceof Error&&'code' in error&&error.code==='REFUND_ALLOCATION_CHANGED');
 const finalPreview=await returnSale(f.context,draft.id,remaining,true);
 await assert.rejects(()=>returnSale(f.context,draft.id,{...remaining,operationId:randomUUID(),manualNonCash:{confirmed:true,referenceNo:'BANK-REFUND-20',expectedSettlement:stringify(finalPreview.settlement)}}));
 assert.equal(await prisma.saleReturn.count({where:{saleId:draft.id}}),1);
 await returnSale(f.context,draft.id,{...remaining,manualNonCash:{confirmed:true,referenceNo:'BANK-REFUND-40',expectedSettlement:stringify(finalPreview.settlement)}});
 const out=await prisma.payment.findMany({where:{saleId:draft.id,direction:'out'}});
 assert.equal(out.filter(p=>p.paymentType==='cash').reduce((sum,p)=>sum.add(p.amount),new (await import('@prisma/client')).Prisma.Decimal(0)).toString(),'90');
 assert.equal(out.filter(p=>p.paymentType==='card').reduce((sum,p)=>sum.add(p.amount),new (await import('@prisma/client')).Prisma.Decimal(0)).toString(),'60');
 assert.ok(out.filter(p=>p.paymentType==='card').every(p=>p.status==='recorded'&&p.referenceNo?.startsWith('BANK-REFUND-')));
 assert.equal((await prisma.debtEntry.aggregate({where:{customerId:customer.id},_sum:{amount:true}}))._sum.amount?.toString(),'0');
 assert.equal((await prisma.inventoryBalance.findUniqueOrThrow({where:{storeId_productId:{storeId:f.store.id,productId:f.product.id}}})).quantity.toString(),'3');
});

test('Supplier terms and bank requisites validate, survive archive/restore, export safely and remain tenant/role scoped',async()=>{
 const f=await fixture(),foreign=await fixture(),cashier=await actor(f.org.id,f.store.id,'cashier');
 const {POST,GET}=await import('@/app/api/suppliers/route'),{PUT,GET:detail}=await import('@/app/api/suppliers/[id]/route');
 const data={organizationId:f.org.id,name:'Terms supplier',phone:'998900000000',tin:'operator-supplied',bankName:'Test bank',bankAccount:'opaque-test-account',paymentTerms:'=30 days after acceptance'};
 const created=await POST(req('/suppliers',f.cookie,data),undefined);assert.equal(created.status,200);const supplier=(await created.json()).data,params={params:Promise.resolve({id:supplier.id})};
 assert.equal(supplier.paymentTerms,data.paymentTerms);assert.equal(supplier.bankAccount,data.bankAccount);
 assert.equal((await POST(req('/suppliers',f.cookie,{...data,bankAccount:'x'.repeat(129)}),undefined)).status,400);
 assert.equal((await POST(req('/suppliers',cashier.cookie,data),undefined)).status,403);
 assert.equal((await detail(req('/suppliers/'+supplier.id,foreign.cookie),params)).status,404);
 const put=(body:unknown)=>new NextRequest('http://localhost:3000/api/suppliers/'+supplier.id,{method:'PUT',headers:{cookie:f.cookie,origin:'http://localhost:3000','content-type':'application/json'},body:JSON.stringify(body)});
 assert.equal((await PUT(put({isActive:false}),params)).status,200);assert.equal((await PUT(put({isActive:true}),params)).status,200);
 assert.equal((await prisma.supplier.findUniqueOrThrow({where:{id:supplier.id}})).paymentTerms,data.paymentTerms);
 const exported=await GET(req('/suppliers?organizationId='+f.org.id+'&format=csv',f.cookie),undefined),csv=(await exported.json()).data.content;
 assert.match(csv,/Bank hisob raqami/);assert.match(csv,/opaque-test-account/);assert.match(csv,/'=30 days after acceptance/);
 await assert.rejects(()=>prisma.supplier.update({where:{id:supplier.id},data:{paymentTerms:'x'.repeat(2001)}}));
});

test('Provider provenance cannot pass the manual refund boundary even when its journal is recorded',async()=>{
 const f=await fixture(0),sale=await posted(f,new Date());
 await prisma.payment.create({data:{organizationId:f.org.id,storeId:f.store.id,shiftId:f.shift.id,saleId:sale.id,paymentType:'card',direction:'in',amount:'20',receivedBy:f.user.id,status:'recorded',sourceType:'provider'}});
 const input=returnSchema.parse({operationId:randomUUID(),shiftId:f.shift.id,reason:'Provider journal is not manual',items:[{saleItemId:sale.items[0].id,quantity:2}]});
 await assert.rejects(()=>returnSale(f.context,sale.id,input,true),error=>error instanceof Error&&'code' in error&&error.code==='EXTERNAL_REFUND_REQUIRED');
 await assert.rejects(()=>returnSale(f.context,sale.id,{...input,manualNonCash:{confirmed:true,referenceNo:'Operator-proof-is-not-provider-confirmation',expectedSettlement:{cash:'0',card:'20',transfer:'0',debt:'0',waived:'0'}}}),error=>error instanceof Error&&'code' in error&&error.code==='EXTERNAL_REFUND_REQUIRED');
 assert.equal(await prisma.saleReturn.count({where:{saleId:sale.id}}),0);assert.equal(await prisma.payment.count({where:{saleId:sale.id,direction:'out'}}),0);assert.equal(await prisma.inventoryMovement.count({where:{organizationId:f.org.id}}),0);
});

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
 // Exercise error mapping on an admitted operation, not an unreviewed URL.
 const result=await handler(req('/operations/cancel',f.cookie,{}),undefined)
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

test('Persistent reconciliation detects drift without repair; resolution rechecks source and is audited',async()=>{
 const {scan,resolveIncident}=await import('@/server/monitoring/service'),{confirmStockDocument}=await import('@/server/inventory/documents')
 const f=await fixture(0)
 const doc=await prisma.stockDocument.create({data:{organizationId:f.org.id,storeId:f.store.id,documentType:'opening',documentNo:randomUUID(),createdBy:f.user.id,note:'Verified opening',items:{create:{productId:f.product.id,quantity:5,unitCost:50}}}})
 await confirmStockDocument(f.context,doc.id)
 assert.deepEqual(await scan(f.context,randomUUID()),{inventory:0,sales:0,returns:0,shifts:0})
 await prisma.inventoryBalance.update({where:{storeId_productId:{storeId:f.store.id,productId:f.product.id}},data:{quantity:7}})
 const key=randomUUID(),first=await scan(f.context,key);assert.equal(first.inventory,1)
 await scan(f.context,key);await scan(f.context,randomUUID());assert.equal(await prisma.incident.count({where:{organizationId:f.org.id}}),1)
 const incident=await prisma.incident.findFirstOrThrow({where:{organizationId:f.org.id}}),evidence=incident.evidence as {expected:string;actual:string;difference:string}
 assert.equal(evidence.expected,'5.000000');assert.equal(evidence.actual,'7.000000');assert.equal(evidence.difference,'2.000000')
 assert.equal((await prisma.inventoryBalance.findUniqueOrThrow({where:{storeId_productId:{storeId:f.store.id,productId:f.product.id}}})).quantity.toString(),'7','Scanner never repairs')
 await assert.rejects(()=>resolveIncident(f.context,incident.id,{operationId:randomUUID(),reason:'Check remains'}),{code:'DISCREPANCY_REMAINS'})
 const other=await fixture();await assert.rejects(()=>prisma.incident.update({where:{id:incident.id},data:{resolvedBy:other.user.id}}));await assert.rejects(()=>resolveIncident(other.context,incident.id,{operationId:randomUUID(),reason:'Foreign'}),{code:'NOT_FOUND'})
 const cashier=await actor(f.org.id,f.store.id,'cashier');await assert.rejects(()=>scan(cashier.context,randomUUID()),{code:'FORBIDDEN'})
 await prisma.inventoryBalance.update({where:{storeId_productId:{storeId:f.store.id,productId:f.product.id}},data:{quantity:5}})
 const resolved=await resolveIncident(f.context,incident.id,{operationId:randomUUID(),reason:'Test fixture returned to journal'});assert.equal(resolved.state,'resolved');assert.equal(resolved.resolvedBy,f.user.id)
 assert.equal(await prisma.auditLog.count({where:{entityId:incident.id,action:'resolved'}}),1)
})

test('Automatic system scan detects sale-payment mismatch and preserves evidence for the responsible owner',async()=>{
 const {scanOrganization}=await import('@/server/monitoring/service')
 const f=await fixture(0),sale=await posted(f,new Date(),20,2,'10')
 const counts=await prisma.$transaction(tx=>scanOrganization(tx,f.org.id));assert.equal(counts.sales,1)
 const incident=await prisma.incident.findFirstOrThrow({where:{organizationId:f.org.id,kind:'sales'}})
 assert.equal(incident.entityKey,sale.id);assert.equal(incident.severity,'critical');assert.equal((incident.evidence as {paymentAmount:string}).paymentAmount,'0')
 assert.equal((await prisma.sale.findUniqueOrThrow({where:{id:sale.id}})).totalAmount.toString(),'20')
 assert.equal(await prisma.payment.count({where:{saleId:sale.id}}),0)
})

test('Branch min/max recommendations include missing balances, stay exact and deny cross-store settings',async()=>{
 const {setThreshold}=await import('@/server/monitoring/service'),{GET}=await import('@/app/api/reports/replenishment/route')
 const f=await fixture(2),foreign=await fixture()
 await setThreshold(f.context,{storeId:f.store.id,productId:f.product.id,minimum:'3',maximum:'10',operationId:randomUUID()})
 let response=await GET(req('/reports/replenishment?page=1&limit=1',f.cookie),undefined);assert.equal(response.status,200)
 let body=await response.json();assert.equal(body.data[0].quantity,'2');assert.equal(body.data[0].suggestedQuantity,'8');assert.equal(body.data[0].minimumOnly,false)
 await prisma.inventoryBalance.deleteMany({where:{productId:f.product.id}})
 response=await GET(req('/reports/replenishment',f.cookie),undefined);body=await response.json();assert.equal(body.data[0].quantity,'0');assert.equal(body.data[0].suggestedQuantity,'10')
 await assert.rejects(()=>setThreshold(f.context,{storeId:foreign.store.id,productId:f.product.id,minimum:'1',maximum:'5',operationId:randomUUID()}),{code:'NOT_FOUND'})
 await assert.rejects(()=>prisma.stockThreshold.create({data:{organizationId:f.org.id,storeId:foreign.store.id,productId:f.product.id,minimum:1,maximum:2}}))
 await assert.rejects(()=>prisma.stockThreshold.update({where:{storeId_productId:{storeId:f.store.id,productId:f.product.id}},data:{maximum:-1}}))
 const cashier=await actor(f.org.id,f.store.id,'cashier');assert.equal((await GET(req('/reports/replenishment',cashier.cookie),undefined)).status,403)
})

test('Sync review keeps immutable source; manager resolution requires terminal proof and cannot repost',async()=>{
 const {recordConflict,resolveReview}=await import('@/server/sync/reviews'),{POST:voidSale}=await import('@/app/api/sales/[id]/void/route')
 const f=await fixture(),draft=await createDraft(f.context,f.draft,randomUUID()),key=randomUUID(),command={operationId:key,type:'sale.complete',payload:{saleId:draft.id,payments:[{paymentType:'cash',amount:'100'}],secret:'test-only-redaction'}}
 const review=await recordConflict(f.context,command,'PRICE_CHANGED'),again=await recordConflict(f.context,command,'PRICE_CHANGED');assert.equal(review.id,again.id)
 assert.doesNotMatch(JSON.stringify(review.payload),/test-only-redaction/)
 await assert.rejects(()=>prisma.syncReview.update({where:{id:review.id},data:{payload:{saleId:randomUUID()}}}))
 await assert.rejects(()=>resolveReview(f.context,review.id,{operationId:randomUUID(),reason:'No terminal state'}),{code:'RESULT_UNKNOWN'})
 const other=await fixture();await assert.rejects(()=>prisma.syncReview.create({data:{organizationId:f.org.id,actorId:other.user.id,operationId:randomUUID(),commandType:'sale.create',payload:{},payloadHash:'hash',code:'TEST'}}));await assert.rejects(()=>resolveReview(other.context,review.id,{operationId:randomUUID(),reason:'Foreign'}),{code:'NOT_FOUND'})
 const cashier=await actor(f.org.id,f.store.id,'cashier');await assert.rejects(()=>resolveReview(cashier.context,review.id,{operationId:randomUUID(),reason:'Cashier'}),{code:'MANAGER_REQUIRED'})
 assert.equal((await voidSale(req('/sales/'+draft.id+'/void',f.cookie,{}),{params:Promise.resolve({id:draft.id})})).status,200)
 const op=randomUUID(),resolved=await resolveReview(f.context,review.id,{operationId:op,reason:'Original draft voided by owner'});assert.equal(resolved.state,'resolved')
 await resolveReview(f.context,review.id,{operationId:op,reason:'Original draft voided by owner'})
 assert.equal(await prisma.auditLog.count({where:{entityId:review.id,action:'sync_review_resolved'}}),1)
 assert.equal(await prisma.payment.count({where:{saleId:draft.id}}),0);assert.equal(await prisma.inventoryMovement.count({where:{sourceId:draft.id}}),0)
})

test('Server saved draft survives a second device session and completes the same sale exactly once',async()=>{
 const {GET}=await import('@/app/api/sales/[id]/route'),{PUT}=await import('@/app/api/sales/[id]/route')
 const f=await fixture(),draft=await createDraft(f.context,{...f.draft,note:'Held order'},randomUUID())
 const token=randomBytes(32).toString('base64url'),session=await prisma.session.create({data:{tokenHash:sessionHash(token),organizationId:f.org.id,userId:f.user.id,expiresAt:new Date(Date.now()+3600000),idleExpiresAt:new Date(Date.now()+3600000)}}),second={...f.context,sessionId:session.id}
 const response=await GET(req('/sales/'+draft.id,'pos_session='+token),{params:Promise.resolve({id:draft.id})});assert.equal(response.status,200);assert.equal((await response.json()).data.note,'Held order')
 const first=await completeSale(second,draft.id,{payments:[{paymentType:'cash',amount:'100'}]},draft.id),again=await completeSale(f.context,draft.id,{payments:[{paymentType:'cash',amount:'100'}]},draft.id)
 assert.equal(first.id,again.id);assert.equal(await prisma.sale.count({where:{organizationId:f.org.id}}),1);assert.equal(await prisma.payment.count({where:{saleId:draft.id}}),1);assert.equal(await prisma.inventoryMovement.count({where:{sourceId:draft.id}}),1)
 const foreign=await fixture();assert.equal((await GET(req('/sales/'+draft.id,foreign.cookie),{params:Promise.resolve({id:draft.id})})).status,404)
 const updateRequest=new NextRequest('http://localhost:3000/api/sales/'+draft.id,{method:'PUT',headers:{cookie:f.cookie,origin:'http://localhost:3000','content-type':'application/json'},body:JSON.stringify({note:'Cannot edit posted'})})
 assert.equal((await PUT(updateRequest,{params:Promise.resolve({id:draft.id})})).status,400)
})

test('Audit insert failure rolls back sale, stock and payment; source actor and request correlation stay atomic',async()=>{
 const {requestTrace}=await import('@/server/observability/context'),{audit,runOperation}=await import('@/server/operations')
 const f=await fixture(),draft=await createDraft(f.context,f.draft,randomUUID())
 await prisma.$executeRawUnsafe(`CREATE OR REPLACE FUNCTION pos_test_audit_failure() RETURNS trigger LANGUAGE plpgsql AS $$ BEGIN IF NEW."organizationId"='${f.org.id}' THEN RAISE EXCEPTION 'isolated audit fault'; END IF; RETURN NEW; END $$`)
 await prisma.$executeRawUnsafe('CREATE TRIGGER pos_test_audit_failure BEFORE INSERT ON "AuditLog" FOR EACH ROW EXECUTE FUNCTION pos_test_audit_failure()')
 try{
  await assert.rejects(()=>completeSale(f.context,draft.id,{payments:[{paymentType:'cash',amount:'100'}]},randomUUID()))
  assert.equal((await prisma.sale.findUniqueOrThrow({where:{id:draft.id}})).status,'draft');assert.equal(await prisma.payment.count({where:{saleId:draft.id}}),0);assert.equal(await prisma.inventoryMovement.count({where:{sourceId:draft.id}}),0)
  assert.equal((await prisma.inventoryBalance.findUniqueOrThrow({where:{storeId_productId:{storeId:f.store.id,productId:f.product.id}}})).quantity.toString(),'10')
 }finally{await prisma.$executeRawUnsafe('DROP TRIGGER pos_test_audit_failure ON "AuditLog"');await prisma.$executeRawUnsafe('DROP FUNCTION pos_test_audit_failure()')}
 const requestId=randomUUID()
 await requestTrace.run({requestId,organizationId:f.org.id},()=>runOperation(f.context,'test.audit',randomUUID(),{},async tx=>{await audit(tx,f.context,'Sale',draft.id,'correlated',{amount:'1.01',password:'test-canary'});return {ok:true}}))
 const logged=await prisma.auditLog.findFirstOrThrow({where:{entityId:draft.id,action:'correlated'}});assert.equal(logged.actorId,f.user.id);assert.equal(logged.requestId,requestId);assert.deepEqual(logged.afterData,{amount:'1.01'})
})

test('Standard API envelopes keep decimal strings, request ID, errors, pagination and body limits consistent',async()=>{
 const {POST}=await import('@/app/api/sales/route'),{GET}=await import('@/app/api/sales/route')
 const f=await fixture();await prisma.product.update({where:{id:f.product.id},data:{salePrice:'1.01'}})
 const success=await POST(req('/sales',f.cookie,{...f.draft,operationId:randomUUID()}),undefined),body=await success.json();assert.equal(success.status,200);assert.equal(typeof body.data.totalAmount,'string');assert.equal(body.data.totalAmount,'1.01');assert.ok(success.headers.get('x-request-id'));assert.equal(success.headers.get('cache-control'),'private, no-store')
 const invalid=await GET(req('/sales?organizationId='+f.org.id+'&page=0',f.cookie),undefined),error=await invalid.json();assert.equal(invalid.status,400);assert.equal(error.requestId,invalid.headers.get('x-request-id'));assert.ok(error.error.nextAction)
 const foreign=await fixture();assert.equal((await GET(req('/sales?organizationId='+foreign.org.id,f.cookie),undefined)).status,403)
 const large=new NextRequest('http://localhost:3000/api/sales',{method:'POST',headers:{cookie:f.cookie,origin:'http://localhost:3000','content-type':'application/json','content-length':'1048577'},body:'{}'});assert.equal((await POST(large,undefined)).status,413)
 const bad=new NextRequest('http://localhost:3000/api/sales',{method:'POST',headers:{cookie:f.cookie,origin:'https://foreign.example.invalid','content-type':'application/json'},body:'{}'});assert.equal((await POST(bad,undefined)).status,403)
})

test('Session expiry, revoke and cookie transport enforce the browser boundary without bearer fallback',async()=>{
 const {GET}=await import('@/app/api/sales/route'),{setSessionCookie}=await import('@/server/auth/session'),{NextResponse}=await import('next/server')
 const f=await fixture(),response=NextResponse.json({success:true});setSessionCookie(response,f.token);const cookie=response.headers.get('set-cookie')??'';assert.match(cookie,/HttpOnly/i);assert.match(cookie,/SameSite=lax/i);assert.match(cookie,/Max-Age=86400/i)
 await prisma.session.update({where:{id:f.context.sessionId},data:{expiresAt:new Date(Date.now()-1000)}});assert.equal(await verifySession(f.token),null);assert.equal((await GET(req('/sales?organizationId='+f.org.id,f.cookie),undefined)).status,401)
 const bearer=new NextRequest('http://localhost:3000/api/sales?organizationId='+f.org.id,{headers:{authorization:'Bearer '+f.token}});assert.equal((await GET(bearer,undefined)).status,401)
 const live=await fixture();await prisma.session.update({where:{id:live.context.sessionId},data:{revokedAt:new Date()}});assert.equal(await verifySession(live.token),null)
})

test('Price batches preview atomically, preserve receipts, replay once and protect cost history/export',async()=>{
 const f=await fixture(),foreign=await fixture(),admin=await actor(f.org.id,f.store.id,'admin'),cashier=await actor(f.org.id,f.store.id,'cashier');
 const {changePrices,priceBatchSchema}=await import('@/server/catalog/prices');
 const {GET,POST}=await import('@/app/api/products/prices/route');
 const sale=await createDraft(f.context,f.draft,randomUUID());await completeSale(f.context,sale.id,{payments:[{paymentType:'cash',amount:100}]},randomUUID());
 const second=await prisma.product.create({data:{organizationId:f.org.id,name:'Second',sku:randomUUID(),barcode:randomUUID(),unit:'dona',salePrice:200,costPrice:20}});
 const input=priceBatchSchema.parse({operationId:randomUUID(),field:'salePrice',reason:'Reviewed market prices',preview:true,items:[{productId:f.product.id,expected:'100',value:'125.50'},{productId:second.id,expected:'200',value:'210'}]});
 const before=await prisma.productPriceHistory.count({where:{organizationId:f.org.id}});
 const previewResponse=await POST(req('/products/prices',f.cookie,input),undefined);assert.equal(previewResponse.status,200);const preview=(await previewResponse.json()).data;
 assert.equal(await prisma.productPriceHistory.count({where:{organizationId:f.org.id}}),before);
 await assert.rejects(()=>changePrices(f.context,{...input,preview:false}),e=>e instanceof Error&&'code'in e&&e.code==='PRICE_PREVIEW_REQUIRED');
 await prisma.product.update({where:{id:second.id},data:{salePrice:201}});
 await assert.rejects(()=>changePrices(f.context,{...input,preview:false,confirmationHash:preview.confirmationHash}));
 assert.equal((await prisma.product.findUniqueOrThrow({where:{id:f.product.id}})).salePrice.toString(),'100');
 const next={...input,operationId:randomUUID(),items:[input.items[0],{...input.items[1],expected:'201'}]};const reviewed=await changePrices(f.context,next);
 const posted={...next,preview:false,confirmationHash:reviewed.confirmationHash};await Promise.all([changePrices(f.context,posted),changePrices(f.context,posted)]);
 assert.equal((await prisma.product.findUniqueOrThrow({where:{id:f.product.id}})).salePrice.toString(),'125.5');
 assert.equal((await prisma.saleItem.findUniqueOrThrow({where:{id:sale.items[0].id}})).unitPrice.toString(),'100');
 const history=await prisma.productPriceHistory.findMany({where:{organizationId:f.org.id,source:'catalog.bulk'}});assert.equal(history.length,2);assert.ok(history.every(h=>h.actorId===f.user.id));
 assert.equal(await prisma.auditLog.count({where:{organizationId:f.org.id,entityId:posted.operationId,action:'prices_changed'}}),1);
 await assert.rejects(()=>changePrices(f.context,{...posted,reason:'Changed payload'}));
 const cost=priceBatchSchema.parse({operationId:randomUUID(),field:'costPrice',reason:'Cost review',preview:true,items:[{productId:f.product.id,expected:'50',value:'60.123456'}]});
 assert.equal((await POST(req('/products/prices',admin.cookie,cost),undefined)).status,403);
 assert.equal((await GET(req('/products/prices?field=costPrice&format=csv',admin.cookie),undefined)).status,403);
 assert.equal((await GET(req('/products/prices',cashier.cookie),undefined)).status,403);
 assert.equal((await GET(req('/products/prices?productId='+foreign.product.id,f.cookie),undefined)).status,404);
 assert.equal((await POST(req('/products/prices',f.cookie,{...input,items:[{...input.items[0],value:'1.001'}]}),undefined)).status,400);
 assert.equal((await POST(req('/products/prices',f.cookie,{...input,items:Array.from({length:101},()=>input.items[0])}),undefined)).status,400);
 assert.equal((await POST(req('/products/prices',f.cookie,{...input,items:[input.items[0],input.items[0]]}),undefined)).status,400);
 const {PUT:editProduct}=await import('@/app/api/products/[id]/route');
 const edit=(cookie:string,data:unknown)=>new NextRequest('http://localhost:3000/api/products/'+f.product.id,{method:'PUT',headers:{cookie,origin:'http://localhost:3000','content-type':'application/json'},body:JSON.stringify(data)});
 assert.equal((await editProduct(edit(admin.cookie,{costPrice:'55'}),{params:Promise.resolve({id:f.product.id})})).status,403);
 assert.equal((await editProduct(edit(admin.cookie,{salePrice:'126'}),{params:Promise.resolve({id:f.product.id})})).status,200);
 assert.equal(await prisma.productPriceHistory.count({where:{productId:f.product.id,source:'catalog.edit',actorId:admin.user.id}}),1);
 const cv=await changePrices(f.context,cost);await changePrices(f.context,{...cost,preview:false,confirmationHash:cv.confirmationHash});
 assert.equal((await prisma.product.findUniqueOrThrow({where:{id:f.product.id}})).costPrice.toString(),'60.123456');
 const exported=await GET(req('/products/prices?field=costPrice&format=csv',f.cookie),undefined);assert.equal(exported.status,200);assert.match((await exported.json()).data.content,/60.123456/);
 const {GET:catalog}=await import('@/app/api/products/route');const adminCsv=await catalog(req('/products?format=csv&organizationId='+f.org.id,admin.cookie),undefined);assert.equal(adminCsv.status,200);assert.doesNotMatch((await adminCsv.json()).data.content,/Tannarx|60.123456/);
 await assert.rejects(()=>prisma.productPriceHistory.update({where:{id:history[0].id},data:{newValue:999}}));
 await assert.rejects(()=>prisma.productPriceHistory.delete({where:{id:history[0].id}}));
});

test('Damaged return locations and write-off journals are atomic, frozen, immutable and branch scoped',async()=>{
 const f=await fixture(6),admin=await actor(f.org.id,f.store.id,'admin'),cashier=await actor(f.org.id,f.store.id,'cashier'),foreign=await fixture();
 const sale=await createDraft(f.context,{...f.draft,items:[{productId:f.product.id,quantity:6,discountAmount:0}]},randomUUID());await completeSale(f.context,sale.id,{payments:[{paymentType:'cash',amount:600}]},randomUUID());
 await prisma.product.update({where:{id:f.product.id},data:{name:'Renamed',costPrice:999}});
 const damaged=returnSchema.parse({operationId:randomUUID(),shiftId:f.shift.id,reason:'Damaged goods inspected',items:[{saleItemId:sale.items[0].id,quantity:2,disposition:'damaged'}]});
 await returnSale(f.context,sale.id,damaged,true);assert.equal(await prisma.damageLocation.count({where:{organizationId:f.org.id}}),0);
 await Promise.all([returnSale(f.context,sale.id,damaged),returnSale(f.context,sale.id,damaged)]);
 await returnSale(f.context,sale.id,{...damaged,operationId:randomUUID(),items:[{...damaged.items[0],quantity:1,disposition:'damaged'}]});
 await returnSale(f.context,sale.id,{...damaged,operationId:randomUUID(),items:[{...damaged.items[0],quantity:1,disposition:'write_off'}]});
 await returnSale(f.context,sale.id,{...damaged,operationId:randomUUID(),items:[{...damaged.items[0],quantity:1,disposition:'sellable'}]});
 const entries=await prisma.returnDispositionEntry.findMany({where:{organizationId:f.org.id}});assert.equal(entries.length,3);assert.ok(entries.every(e=>e.unitCost.toString()==='50'&&e.productName==='Frozen'));assert.equal(entries.filter(e=>e.locationId===null).length,1);
 assert.equal(await prisma.damageLocation.count({where:{organizationId:f.org.id}}),1);
 assert.equal((await prisma.inventoryBalance.findUniqueOrThrow({where:{storeId_productId:{storeId:f.store.id,productId:f.product.id}}})).quantity.toString(),'1');
 const {GET}=await import('@/app/api/inventory/dispositions/route');
 const response=await GET(req('/inventory/dispositions',admin.cookie),undefined);assert.equal(response.status,200);const body=await response.json();assert.equal(body.data.length,3);assert.equal(body.summary.find((b:{disposition:string})=>b.disposition==='damaged')._sum.quantity,'3');
 assert.equal((await GET(req('/inventory/dispositions',cashier.cookie),undefined)).status,403);
 assert.equal((await GET(req('/inventory/dispositions?storeId='+foreign.store.id,admin.cookie),undefined)).status,404);
 const otherStore=await prisma.store.create({data:{organizationId:f.org.id,name:'Unassigned'}});const unassigned=await actor(f.org.id,otherStore.id,'admin');assert.equal((await (await GET(req('/inventory/dispositions',unassigned.cookie),undefined)).json()).data.length,0);
 const csv=await GET(req('/inventory/dispositions?format=csv',f.cookie),undefined);assert.equal(csv.status,200);assert.match((await csv.json()).data.content,/Brak qaytarmalari/);
 await assert.rejects(()=>prisma.returnDispositionEntry.update({where:{id:entries[0].id},data:{quantity:100}}));await assert.rejects(()=>prisma.returnDispositionEntry.delete({where:{id:entries[0].id}}));
 const location=await prisma.damageLocation.findFirstOrThrow({where:{organizationId:f.org.id}});await assert.rejects(()=>prisma.damageLocation.update({where:{id:location.id},data:{storeId:otherStore.id}}));
 const old=await prisma.returnDispositionEntry.count({where:{organizationId:f.org.id}});
 await assert.rejects(()=>prisma.$transaction(async tx=>{await tx.returnDispositionEntry.create({data:{...entries[0],id:randomUUID(),returnItemId:entries[1].returnItemId,unitCost:999}});}));assert.equal(await prisma.returnDispositionEntry.count({where:{organizationId:f.org.id}}),old);
});

test('Late audit failure rolls back a reviewed price batch and the entire damaged-return location/refund',async()=>{
 const f=await fixture(1);const {changePrices,priceBatchSchema}=await import('@/server/catalog/prices');
 const sale=await createDraft(f.context,f.draft,randomUUID());await completeSale(f.context,sale.id,{payments:[{paymentType:'cash',amount:100}]},randomUUID());
 const input=priceBatchSchema.parse({operationId:randomUUID(),field:'salePrice',reason:'Rollback price review',preview:true,items:[{productId:f.product.id,expected:'100',value:'120'}]});const preview=await changePrices(f.context,input);
 const baseline=await prisma.productPriceHistory.count({where:{organizationId:f.org.id}});
 const trigger='plus2_audit_'+randomUUID().replaceAll('-','');
 await prisma.$executeRawUnsafe(`CREATE FUNCTION ${trigger}() RETURNS trigger LANGUAGE plpgsql AS $$ BEGIN IF NEW."organizationId"='${f.org.id}' THEN RAISE EXCEPTION 'test-only audit failure'; END IF; RETURN NEW; END $$`);
 await prisma.$executeRawUnsafe(`CREATE TRIGGER ${trigger} BEFORE INSERT ON "AuditLog" FOR EACH ROW EXECUTE FUNCTION ${trigger}()`);
 try{
  await assert.rejects(()=>changePrices(f.context,{...input,preview:false,confirmationHash:preview.confirmationHash}));
  assert.equal((await prisma.product.findUniqueOrThrow({where:{id:f.product.id}})).salePrice.toString(),'100');assert.equal(await prisma.productPriceHistory.count({where:{organizationId:f.org.id}}),baseline);
  const ret=returnSchema.parse({operationId:randomUUID(),shiftId:f.shift.id,reason:'Rollback damaged return',items:[{saleItemId:sale.items[0].id,quantity:1,disposition:'damaged'}]});await assert.rejects(()=>returnSale(f.context,sale.id,ret));
  assert.equal(await prisma.damageLocation.count({where:{organizationId:f.org.id}}),0);assert.equal(await prisma.returnDispositionEntry.count({where:{organizationId:f.org.id}}),0);assert.equal(await prisma.saleReturn.count({where:{saleId:sale.id}}),0);assert.equal(await prisma.payment.count({where:{saleId:sale.id,direction:'out'}}),0);assert.equal(await prisma.operation.count({where:{organizationId:f.org.id,key:{in:[input.operationId,ret.operationId]}}}),0);
 }finally{await prisma.$executeRawUnsafe(`DROP TRIGGER ${trigger} ON "AuditLog"`);await prisma.$executeRawUnsafe(`DROP FUNCTION ${trigger}()`);}
});

test('Financial accounts transfer atomically without revenue, expense categories/reversals and gross/operating profit reconcile',async()=>{
 const f=await fixture(2,1000),other=await fixture(),admin=await actor(f.org.id,f.store.id,'admin'),cashier=await actor(f.org.id,f.store.id,'cashier');
 const finance=await import('@/server/finance/accounts'),{GET:accounts,POST:create}=await import('@/app/api/finance/accounts/route');
 const cash=await finance.createAccount(f.context,finance.accountSchema.parse({operationId:randomUUID(),storeId:f.store.id,registerId:f.register.id,name:'Till book',kind:'cash',reason:'Use existing shift cash'}));
 const bank=await finance.createAccount(f.context,finance.accountSchema.parse({operationId:randomUUID(),storeId:f.store.id,name:'Manual bank book',kind:'bank',openingBalance:'100',reason:'Verified statement opening'}));
 const category=await finance.createExpenseCategory(f.context,finance.categorySchema.parse({operationId:randomUUID(),name:'Rent',treatment:'operating'})),capital=await finance.createExpenseCategory(f.context,finance.categorySchema.parse({operationId:randomUUID(),name:'Inventory cost paid',treatment:'capitalised'}));
 const transfer=finance.transferSchema.parse({operationId:randomUUID(),fromAccountId:cash.id,toAccountId:bank.id,fromShiftId:f.shift.id,amount:'200',reason:'Actual cash deposited manually'});
 const paymentBefore=await prisma.payment.count({where:{organizationId:f.org.id}});await Promise.all([finance.transferAccounts(f.context,transfer),finance.transferAccounts(f.context,transfer)]);
 const book=await finance.listAccounts(f.context);assert.equal(book.find(a=>a.id===cash.id)?.balance.toString(),'800');assert.equal(book.find(a=>a.id===bank.id)?.balance.toString(),'300');assert.equal(await prisma.payment.count({where:{organizationId:f.org.id}}),paymentBefore);const mirror=await prisma.accountEntry.findFirstOrThrow({where:{organizationId:f.org.id,cashMovementId:{not:null}}});await assert.rejects(()=>prisma.cashMovement.update({where:{id:mirror.cashMovementId!},data:{amount:999}}));await assert.rejects(()=>prisma.cashMovement.delete({where:{id:mirror.cashMovementId!}}));
 assert.equal((await prisma.accountEntry.aggregate({where:{document:{organizationId:f.org.id,kind:'transfer'}},_sum:{amount:true}}))._sum.amount?.toString(),'0');
 const sale=await createDraft(f.context,f.draft,randomUUID());await completeSale(f.context,sale.id,{payments:[{paymentType:'cash',amount:100}]},randomUUID());
 const expenseInput=finance.expenseSchema.parse({operationId:randomUUID(),accountId:cash.id,expenseCategoryId:category.id,shiftId:f.shift.id,amount:'10',reason:'Office rent paid'});const expense=await finance.postExpense(f.context,expenseInput);await finance.postExpense(f.context,expenseInput);
 await finance.postExpense(f.context,finance.expenseSchema.parse({...expenseInput,operationId:randomUUID(),accountId:bank.id,expenseCategoryId:capital.id,shiftId:undefined,amount:'20',reason:'Capitalised cost payment'}));
 const {GET:profit}=await import('@/app/api/reports/profit/route');let response=await profit(req('/reports/profit',f.cookie),undefined);assert.equal(response.status,200);let summary=(await response.json()).data.summary;assert.equal(summary.netSales,'100');assert.equal(summary.cogs,'50');assert.equal(summary.grossProfit,'50');assert.equal(summary.operatingProfit,'40');assert.equal(summary.capitalisedPayments,'20');
 const reversal=finance.reversalSchema.parse({operationId:randomUUID(),reason:'Rent payment corrected',shifts:{[cash.id]:f.shift.id}});await Promise.all([finance.reverseFinancialDocument(f.context,expense.id,reversal),finance.reverseFinancialDocument(f.context,expense.id,reversal)]);
 response=await profit(req('/reports/profit',f.cookie),undefined);summary=(await response.json()).data.summary;assert.equal(summary.operatingProfit,'50');assert.equal((await finance.listAccounts(f.context)).find(a=>a.id===cash.id)?.balance.toString(),'900');
 await assert.rejects(()=>finance.reverseFinancialDocument(f.context,expense.id,{...reversal,operationId:randomUUID()}));
 const race=finance.expenseSchema.parse({...expenseInput,accountId:bank.id,shiftId:undefined,amount:'200',reason:'Bank amount race'});const raceResults=await Promise.allSettled([finance.postExpense(f.context,{...race,operationId:randomUUID()}),finance.postExpense(f.context,{...race,operationId:randomUUID()})]);assert.equal(raceResults.filter(r=>r.status==='fulfilled').length,1);assert.equal((await finance.listAccounts(f.context)).find(a=>a.id===bank.id)?.balance.toString(),'80');
 assert.equal((await accounts(req('/finance/accounts',cashier.cookie),undefined)).status,403);
 assert.equal((await create(req('/finance/accounts',admin.cookie,{operationId:randomUUID(),storeId:f.store.id,kind:'bank',name:'Unauthorized',reason:'No owner approval'}),undefined)).status,403);
 const foreignAccount=await finance.createAccount(other.context,finance.accountSchema.parse({operationId:randomUUID(),storeId:other.store.id,name:'Foreign bank',kind:'bank',reason:'Foreign opening'}));await assert.rejects(()=>finance.transferAccounts(admin.context,{...transfer,operationId:randomUUID(),toAccountId:foreignAccount.id}));
 await assert.rejects(()=>prisma.financialDocument.update({where:{id:expense.id},data:{amount:999}}));await assert.rejects(()=>prisma.accountEntry.deleteMany({where:{documentId:expense.id}}));await assert.rejects(()=>prisma.expenseCategory.update({where:{id:category.id},data:{treatment:'capitalised'}}));
});

test('Financial transfer late audit failure rolls back both accounts, cash and operation key',async()=>{
 const f=await fixture(1,1000),finance=await import('@/server/finance/accounts');
 const cash=await finance.createAccount(f.context,finance.accountSchema.parse({operationId:randomUUID(),storeId:f.store.id,registerId:f.register.id,name:'Rollback till',kind:'cash',reason:'Existing shift opening'}));
 const bank=await finance.createAccount(f.context,finance.accountSchema.parse({operationId:randomUUID(),storeId:f.store.id,name:'Rollback bank',kind:'bank',reason:'Empty manual bank book'}));
 const input=finance.transferSchema.parse({operationId:randomUUID(),fromAccountId:cash.id,toAccountId:bank.id,fromShiftId:f.shift.id,amount:'100',reason:'Rollback transfer test'});
 const trigger='finance_audit_'+randomUUID().replaceAll('-','');
 await prisma.$executeRawUnsafe(`CREATE FUNCTION ${trigger}() RETURNS trigger LANGUAGE plpgsql AS $$ BEGIN IF NEW."organizationId"='${f.org.id}' THEN RAISE EXCEPTION 'test-only late audit failure'; END IF; RETURN NEW; END $$`);
 await prisma.$executeRawUnsafe(`CREATE TRIGGER ${trigger} BEFORE INSERT ON "AuditLog" FOR EACH ROW EXECUTE FUNCTION ${trigger}()`);
 try{
  await assert.rejects(()=>finance.transferAccounts(f.context,input));
  assert.equal(await prisma.financialDocument.count({where:{organizationId:f.org.id}}),0);
  assert.equal(await prisma.accountEntry.count({where:{organizationId:f.org.id}}),0);
  assert.equal(await prisma.cashMovement.count({where:{shiftId:f.shift.id}}),0);
  assert.equal(await prisma.operation.count({where:{organizationId:f.org.id,key:input.operationId}}),0);
  const accounts=await finance.listAccounts(f.context);assert.equal(accounts.find(a=>a.id===cash.id)?.balance.toString(),'1000');assert.equal(accounts.find(a=>a.id===bank.id)?.balance.toString(),'0');
 }finally{await prisma.$executeRawUnsafe(`DROP TRIGGER ${trigger} ON "AuditLog"`);await prisma.$executeRawUnsafe(`DROP FUNCTION ${trigger}()`);}
 await finance.transferAccounts(f.context,input);assert.equal(await prisma.financialDocument.count({where:{organizationId:f.org.id,kind:'transfer'}}),1);
});

test('Cross-branch transfer details require access to both accounts',async()=>{
 const f=await fixture(),finance=await import('@/server/finance/accounts'),branch=await prisma.store.create({data:{organizationId:f.org.id,name:'Private branch'}}),admin=await actor(f.org.id,f.store.id,'admin');
 const from=await finance.createAccount(f.context,finance.accountSchema.parse({operationId:randomUUID(),storeId:f.store.id,name:'Allowed book',kind:'bank',openingBalance:'100',reason:'Verified starting statement'})),to=await finance.createAccount(f.context,finance.accountSchema.parse({operationId:randomUUID(),storeId:branch.id,name:'Private branch bank',kind:'bank',reason:'Empty verified bank book'}));
 const transfer=await finance.transferAccounts(f.context,finance.transferSchema.parse({operationId:randomUUID(),fromAccountId:from.id,toAccountId:to.id,amount:'20',reason:'Actual cross branch transfer'}));
 const {GET}=await import('@/app/api/finance/documents/route');let response=await GET(req('/finance/documents',admin.cookie),undefined);assert.equal(response.status,200);let body=await response.json();assert.ok(!body.data.some((d:{id:string})=>d.id===transfer.id));assert.doesNotMatch(JSON.stringify(body),/Private branch bank/);
 response=await GET(req('/finance/documents?format=csv',admin.cookie),undefined);assert.equal(response.status,200);assert.doesNotMatch((await response.json()).data.content,/Actual cross branch transfer/);
 await assert.rejects(()=>finance.reverseFinancialDocument(admin.context,transfer.id,finance.reversalSchema.parse({operationId:randomUUID(),reason:'Not authorized for destination'})));
 response=await GET(req('/finance/documents',f.cookie),undefined);body=await response.json();assert.ok(body.data.some((d:{id:string})=>d.id===transfer.id));
});

test('All five sales breakdown dimensions reconcile original discounts, mixed tender, returns, scope and full CSV',async()=>{
 const f=await fixture(6),category=await prisma.category.create({data:{organizationId:f.org.id,name:'Category grouped'}}),cashier=await actor(f.org.id,f.store.id,'cashier'),foreign=await fixture();
 await prisma.product.update({where:{id:f.product.id},data:{categoryId:category.id}});
 const customer=await prisma.customer.create({data:{organizationId:f.org.id,fullName:'Credit grouped',phone:randomUUID(),creditLimit:1000}});
 const sale=await createDraft(f.context,{...f.draft,customerId:customer.id,discountAmount:10,items:[{productId:f.product.id,quantity:2,discountAmount:0}]},randomUUID());await completeSale(f.context,sale.id,{payments:[{paymentType:'cash',amount:90},{paymentType:'credit',amount:100}]},randomUUID());
 await returnSale(f.context,sale.id,returnSchema.parse({operationId:randomUUID(),shiftId:f.shift.id,reason:'Grouped partial return',items:[{saleItemId:sale.items[0].id,quantity:1,disposition:'sellable'}]}));
 const otherStore=await prisma.store.create({data:{organizationId:f.org.id,name:'Second branch grouped'}}),operator=await actor(f.org.id,otherStore.id,'cashier'),otherRegister=await prisma.register.create({data:{storeId:otherStore.id,name:'Second grouped till',code:randomUUID()}}),otherShift=await prisma.shift.create({data:{registerId:otherRegister.id,organizationUserId:operator.member.id,openingCash:0}}),otherProduct=await prisma.product.create({data:{organizationId:f.org.id,name:'Uncategorised grouped',sku:randomUUID(),barcode:randomUUID(),unit:'dona',salePrice:120,costPrice:30}});
 await prisma.inventoryBalance.create({data:{storeId:otherStore.id,productId:otherProduct.id,quantity:2}});
 const secondSale=await createDraft(operator.context,{organizationId:f.org.id,storeId:otherStore.id,registerId:otherRegister.id,shiftId:otherShift.id,discountAmount:0,items:[{productId:otherProduct.id,quantity:1,discountAmount:0}]},randomUUID());await completeSale(operator.context,secondSale.id,{payments:[{paymentType:'cash',amount:120}]},randomUUID());
 const {collectDebt,collectionSchema}=await import('@/server/payments/collections');await collectDebt(f.context,collectionSchema.parse({operationId:randomUUID(),organizationId:f.org.id,storeId:f.store.id,customerId:customer.id,shiftId:f.shift.id,amount:'10'}));
 const {GET}=await import('@/app/api/reports/breakdowns/route');
 for(const dimension of ['product','category','cashier','store','payment']){
  const response=await GET(req('/reports/breakdowns?dimension='+dimension+'&limit=1',f.cookie),undefined);assert.equal(response.status,200);const body=await response.json();assert.equal(body.summary.netSales,'215');assert.equal(body.pagination.total,2);assert.equal(body.data.length,1);if(dimension!=='product')assert.equal(body.summary.quantity,null);
  if(dimension!=='payment'){assert.equal(body.summary.cogs,'80');assert.equal(body.summary.grossProfit,'135');}
  const csv=await GET(req('/reports/breakdowns?dimension='+dimension+'&format=csv&limit=1',f.cookie),undefined);assert.equal(csv.status,200);const exported=(await csv.json()).data.content as string;assert.match(exported,/215/);assert.equal(exported.trim().split('\r\n').length,6);
 }
 const filtered=await GET(req('/reports/breakdowns?storeId='+f.store.id,f.cookie),undefined);assert.equal((await filtered.json()).summary.netSales,'95');
 assert.equal((await GET(req('/reports/breakdowns',cashier.cookie),undefined)).status,403);
 assert.equal((await GET(req('/reports/breakdowns?storeId='+foreign.store.id,f.cookie),undefined)).status,404);
 assert.equal((await GET(req('/reports/breakdowns?dimension=unsafe',f.cookie),undefined)).status,400);
 const second=await prisma.store.create({data:{organizationId:f.org.id,name:'No access'}}),admin=await actor(f.org.id,second.id,'admin');assert.equal((await (await GET(req('/reports/breakdowns',admin.cookie),undefined)).json()).summary.netSales,'0');
});

test('Supplier invoices, advances and partial allocations conserve cash and debt through replay, races and scope guards',async()=>{
 const f=await fixture(2,1000),finance=await import('@/server/finance/accounts'),supplier=await prisma.supplier.create({data:{organizationId:f.org.id,name:'Tracked supplier'}}),service=await import('@/server/purchases/suppliers');
 const cash=await finance.createAccount(f.context,finance.accountSchema.parse({operationId:randomUUID(),storeId:f.store.id,registerId:f.register.id,name:'Supplier till',kind:'cash',reason:'Existing verified shift'}));
 const advanceInput=service.supplierPaymentSchema.parse({operationId:randomUUID(),supplierId:supplier.id,accountId:cash.id,shiftId:f.shift.id,amount:'30',reason:'Agreed supplier advance'});const advance=await service.paySupplier(f.context,advanceInput);await service.paySupplier(f.context,advanceInput);
 let summary=await prisma.$transaction(tx=>service.supplierBalances(tx,f.context,supplier.id));assert.equal(summary.advance.toString(),'30');assert.equal(summary.unpaid.toString(),'0');
 const doc=await prisma.stockDocument.create({data:{organizationId:f.org.id,storeId:f.store.id,supplierId:supplier.id,documentType:'purchase',documentNo:randomUUID(),createdBy:f.user.id,items:{create:{productId:f.product.id,quantity:2,unitCost:40}}}});const {confirmStockDocument,reverseStockDocument}=await import('@/server/inventory/documents');await confirmStockDocument(f.context,doc.id);
 const input=service.invoiceSchema.parse({operationId:randomUUID(),supplierId:supplier.id,stockDocumentId:doc.id,referenceNo:'INVOICE-'+randomUUID(),reason:'New invoice verified unpaid'});const invoice=await service.registerSupplierInvoice(f.context,input);await service.registerSupplierInvoice(f.context,input);assert.equal(invoice.amount.toString(),'80');
 const allocation=service.supplierAllocateSchema.parse({operationId:randomUUID(),reason:'Apply agreed advance to invoice',allocations:[{invoiceId:invoice.id,amount:'30'}]});await Promise.all([service.allocateSupplierAdvance(f.context,advance.id,allocation),service.allocateSupplierAdvance(f.context,advance.id,allocation)]);
 summary=await prisma.$transaction(tx=>service.supplierBalances(tx,f.context,supplier.id));assert.equal(summary.unpaid.toString(),'50');assert.equal(summary.advance.toString(),'0');
 await service.paySupplier(f.context,service.supplierPaymentSchema.parse({...advanceInput,operationId:randomUUID(),amount:'20',allocations:[{invoiceId:invoice.id,amount:'20'}]}));
 const before=await prisma.financialDocument.count({where:{organizationId:f.org.id}});await assert.rejects(()=>service.paySupplier(f.context,service.supplierPaymentSchema.parse({...advanceInput,operationId:randomUUID(),amount:'31',allocations:[{invoiceId:invoice.id,amount:'31'}]})));assert.equal(await prisma.financialDocument.count({where:{organizationId:f.org.id}}),before);
 const race=service.supplierPaymentSchema.parse({...advanceInput,amount:'30',allocations:[{invoiceId:invoice.id,amount:'30'}]});const results=await Promise.allSettled([service.paySupplier(f.context,{...race,operationId:randomUUID()}),service.paySupplier(f.context,{...race,operationId:randomUUID()})]);assert.equal(results.filter(r=>r.status==='fulfilled').length,1);
 summary=await prisma.$transaction(tx=>service.supplierBalances(tx,f.context,supplier.id));assert.equal(summary.unpaid.toString(),'0');assert.equal(summary.advance.toString(),'0');assert.equal(summary.paid.toString(),'80');assert.equal((await finance.listAccounts(f.context)).find(a=>a.id===cash.id)?.balance.toString(),'920');
 await assert.rejects(()=>reverseStockDocument(f.context,doc.id,{operationId:randomUUID(),reason:'Cannot orphan supplier invoice'}),{code:'SUPPLIER_INVOICE_TRACKED'});
 await assert.rejects(()=>prisma.supplierInvoice.update({where:{id:invoice.id},data:{amount:999}}));await assert.rejects(()=>prisma.supplierAllocation.updateMany({where:{invoiceId:invoice.id},data:{amount:0}}));
 const {GET}=await import('@/app/api/suppliers/[id]/ledger/route'),cashier=await actor(f.org.id,f.store.id,'cashier');assert.equal((await GET(req('/suppliers/'+supplier.id+'/ledger',cashier.cookie),{params:Promise.resolve({id:supplier.id})})).status,403);
 const response=await GET(req('/suppliers/'+supplier.id+'/ledger',f.cookie),{params:Promise.resolve({id:supplier.id})});assert.equal(response.status,200);assert.equal((await response.json()).data.payments.length,3);
 const foreign=await fixture();assert.equal((await GET(req('/suppliers/'+supplier.id+'/ledger',foreign.cookie),{params:Promise.resolve({id:supplier.id})})).status,404);
 const bank=await finance.createAccount(f.context,finance.accountSchema.parse({operationId:randomUUID(),storeId:f.store.id,name:'Manual supplier bank',kind:'bank',openingBalance:'100',reason:'Verified bank statement'}));await assert.rejects(()=>service.paySupplier(f.context,service.supplierPaymentSchema.parse({...advanceInput,operationId:randomUUID(),accountId:bank.id,shiftId:undefined})),{code:'MANUAL_SUPPLIER_PROOF_REQUIRED'});
 const bankInput=service.supplierPaymentSchema.parse({...advanceInput,operationId:randomUUID(),accountId:bank.id,shiftId:undefined,referenceNo:'BANK-'+randomUUID(),manualConfirmed:true});await service.paySupplier(f.context,bankInput);await service.paySupplier(f.context,bankInput);summary=await prisma.$transaction(tx=>service.supplierBalances(tx,f.context,supplier.id));assert.equal(summary.advance.toString(),'30');
 const {PUT}=await import('@/app/api/suppliers/[id]/route');const archive=new NextRequest('http://localhost:3000/api/suppliers/'+supplier.id,{method:'PUT',headers:{cookie:f.cookie,origin:'http://localhost:3000','content-type':'application/json'},body:JSON.stringify({isActive:false})});assert.equal((await PUT(archive,{params:Promise.resolve({id:supplier.id})})).status,409);
 const extraDoc=await prisma.stockDocument.create({data:{organizationId:f.org.id,storeId:f.store.id,supplierId:supplier.id,documentType:'purchase',documentNo:randomUUID(),createdBy:f.user.id,items:{create:{productId:f.product.id,quantity:3,unitCost:10}}}});await confirmStockDocument(f.context,extraDoc.id);const extraInvoice=await service.registerSupplierInvoice(f.context,service.invoiceSchema.parse({...input,operationId:randomUUID(),stockDocumentId:extraDoc.id,referenceNo:'MORE-'+randomUUID()}));
 const bankPayment=await prisma.supplierPayment.findFirstOrThrow({where:{supplierId:supplier.id,referenceNo:bankInput.referenceNo}});for(let i=0;i<3;i++)await service.allocateSupplierAdvance(f.context,bankPayment.id,service.supplierAllocateSchema.parse({operationId:randomUUID(),reason:'Apply bank advance in partial steps',allocations:[{invoiceId:extraInvoice.id,amount:'10'}]}));
 const {GET:allocations}=await import('@/app/api/supplier-payments/[id]/allocations/route');const detail=await allocations(req('/supplier-payments/'+bankPayment.id+'/allocations?limit=1',f.cookie),{params:Promise.resolve({id:bankPayment.id})});assert.equal(detail.status,200);const detailBody=await detail.json();assert.equal(detailBody.data.length,1);assert.equal(detailBody.pagination.total,3);
 const freshLedger=await GET(req('/suppliers/'+supplier.id+'/ledger',f.cookie),{params:Promise.resolve({id:supplier.id})});const fresh=(await freshLedger.json()).data;assert.equal(fresh.summary.advance,'0');assert.equal(fresh.summary.unpaid,'0');assert.equal(fresh.payments.find((p:{id:string})=>p.id===bankPayment.id).allocatedAmount,'30');
 const archiveSettled=new NextRequest('http://localhost:3000/api/suppliers/'+supplier.id,{method:'PUT',headers:{cookie:f.cookie,origin:'http://localhost:3000','content-type':'application/json'},body:JSON.stringify({isActive:false})});assert.equal((await PUT(archiveSettled,{params:Promise.resolve({id:supplier.id})})).status,200);
 assert.equal((await GET(req('/suppliers/'+supplier.id+'/ledger',f.cookie),{params:Promise.resolve({id:supplier.id})})).status,200);

});

test('Supplier cash payment late audit failure leaves neither advance nor cash debit and retries original key once',async()=>{
 const f=await fixture(1,1000),finance=await import('@/server/finance/accounts'),service=await import('@/server/purchases/suppliers'),supplier=await prisma.supplier.create({data:{organizationId:f.org.id,name:'Rollback supplier'}});
 const account=await finance.createAccount(f.context,finance.accountSchema.parse({operationId:randomUUID(),storeId:f.store.id,registerId:f.register.id,name:'Rollback supplier cash',kind:'cash',reason:'Existing cash opening'}));const input=service.supplierPaymentSchema.parse({operationId:randomUUID(),supplierId:supplier.id,accountId:account.id,shiftId:f.shift.id,amount:'10.25',reason:'Supplier rollback payment'});
 const trigger='supplier_audit_'+randomUUID().replaceAll('-','');await prisma.$executeRawUnsafe(`CREATE FUNCTION ${trigger}() RETURNS trigger LANGUAGE plpgsql AS $$ BEGIN IF NEW."organizationId"='${f.org.id}' THEN RAISE EXCEPTION 'test-only late supplier audit'; END IF; RETURN NEW; END $$`);await prisma.$executeRawUnsafe(`CREATE TRIGGER ${trigger} BEFORE INSERT ON "AuditLog" FOR EACH ROW EXECUTE FUNCTION ${trigger}()`);
 try{await assert.rejects(()=>service.paySupplier(f.context,input));assert.equal(await prisma.supplierPayment.count({where:{supplierId:supplier.id}}),0);assert.equal(await prisma.cashMovement.count({where:{shiftId:f.shift.id}}),0);assert.equal(await prisma.financialDocument.count({where:{organizationId:f.org.id}}),0);assert.equal(await prisma.operation.count({where:{organizationId:f.org.id,key:input.operationId}}),0);}finally{await prisma.$executeRawUnsafe(`DROP TRIGGER ${trigger} ON "AuditLog"`);await prisma.$executeRawUnsafe(`DROP FUNCTION ${trigger}()`);}
 await service.paySupplier(f.context,input);await service.paySupplier(f.context,input);assert.equal(await prisma.supplierPayment.count({where:{supplierId:supplier.id}}),1);assert.equal((await finance.listAccounts(f.context)).find(a=>a.id===account.id)?.balance.toString(),'989.75');
 const foreign=await fixture(),bank=await finance.createAccount(foreign.context,finance.accountSchema.parse({operationId:randomUUID(),storeId:foreign.store.id,name:'Foreign supplier cash',kind:'bank',reason:'Foreign isolated book'}));await assert.rejects(()=>service.paySupplier(f.context,{...input,operationId:randomUUID(),accountId:bank.id}),{code:'ACCOUNT_NOT_FOUND'});
 const other=await prisma.store.create({data:{organizationId:f.org.id,name:'Unassigned supplier branch'}}),admin=await actor(f.org.id,other.id,'admin'),{GET}=await import('@/app/api/suppliers/[id]/ledger/route');const response=await GET(req('/suppliers/'+supplier.id+'/ledger',admin.cookie),{params:Promise.resolve({id:supplier.id})});assert.equal(response.status,200);const body=await response.json();assert.equal(body.data.summary.advance,'0');assert.equal(body.data.payments.length,0);
});

test('Purchase order two partial receipts atomically reconcile original stock, supplier invoice and payment with overreceive and replay guards',async()=>{
 const f=await fixture(0,1000),s=await import('@/server/purchases/orders'),sup=await import('@/server/purchases/suppliers'),fin=await import('@/server/finance/accounts'),supplier=await prisma.supplier.create({data:{organizationId:f.org.id,name:'Ordered supplier'}});
 const input=s.orderSchema.parse({operationId:randomUUID(),storeId:f.store.id,supplierId:supplier.id,referenceNo:'ORDER-5',reason:'Verified order for five units',items:[{productId:f.product.id,quantity:'5',unitCost:'10.25'}]});const order=await s.createPurchaseOrder(f.context,input);await s.createPurchaseOrder(f.context,input);
 assert.equal(await prisma.purchaseOrder.count({where:{organizationId:f.org.id}}),1);assert.equal((await prisma.inventoryBalance.findUniqueOrThrow({where:{storeId_productId:{storeId:f.store.id,productId:f.product.id}}})).quantity.toString(),'0');assert.equal(await prisma.supplierInvoice.count({where:{supplierId:supplier.id}}),0);
 const receipt=s.receiptSchema.parse({operationId:randomUUID(),referenceNo:'RECEIVE-2',reason:'First actual two units',dueAt:'2026-10-20T00:00:00Z',items:[{orderItemId:order.items[0].id,quantity:'2'}]});const first=await s.receivePurchaseOrder(f.context,order.id,receipt);await s.receivePurchaseOrder(f.context,order.id,receipt);assert.equal(first.invoice.amount.toString(),'20.5');let details=await s.readPurchaseOrder(f.context,order.id);assert.equal(details.status,'partial');assert.equal(details.items[0].remainingQuantity.toString(),'3');
 await assert.rejects(()=>s.receivePurchaseOrder(f.context,order.id,{...receipt,operationId:randomUUID(),referenceNo:'TOO-MUCH',items:[{orderItemId:order.items[0].id,quantity:'4'}]}),{code:'ORDER_QUANTITY_EXCEEDED'});assert.equal(await prisma.stockDocument.count({where:{organizationId:f.org.id}}),1);
 const rest=s.receiptSchema.parse({...receipt,operationId:randomUUID(),referenceNo:'RECEIVE-3',reason:'Last actual three units',items:[{orderItemId:order.items[0].id,quantity:'3'}]});const races=await Promise.allSettled([s.receivePurchaseOrder(f.context,order.id,rest),s.receivePurchaseOrder(f.context,order.id,{...rest,operationId:randomUUID(),referenceNo:'RACE-EXCESS'})]);assert.equal(races.filter(r=>r.status==='fulfilled').length,1);const final=races.find(r=>r.status==='fulfilled');assert.ok(final?.status==='fulfilled');assert.equal(final.value.invoice.amount.toString(),'30.75');
 details=await s.readPurchaseOrder(f.context,order.id);assert.equal(details.status,'received');assert.equal(details.items[0].receivedQuantity.toString(),'5');assert.equal(details.items[0].remainingQuantity.toString(),'0');assert.equal((await prisma.inventoryBalance.findUniqueOrThrow({where:{storeId_productId:{storeId:f.store.id,productId:f.product.id}}})).quantity.toString(),'5');assert.equal(await prisma.purchaseReceipt.count({where:{orderId:order.id}}),2);assert.equal(await prisma.inventoryMovement.count({where:{organizationId:f.org.id,sourceType:'stock_document'}}),2);
 const bank=await fin.createAccount(f.context,fin.accountSchema.parse({operationId:randomUUID(),storeId:f.store.id,name:'Order settlement account',kind:'bank',openingBalance:'100',reason:'Actual statement opening'}));const pay=sup.supplierPaymentSchema.parse({operationId:randomUUID(),supplierId:supplier.id,accountId:bank.id,amount:'51.25',reason:'Actual supplier settlement',manualConfirmed:true,referenceNo:'BANK-ORDER-51.25',allocations:[{invoiceId:first.invoice.id,amount:'20.5'},{invoiceId:final.value.invoice.id,amount:'30.75'}]});await sup.paySupplier(f.context,pay);await sup.paySupplier(f.context,pay);const balances=await prisma.$transaction(tx=>sup.supplierBalances(tx,f.context,supplier.id));assert.equal(balances.invoiced.toString(),'51.25');assert.equal(balances.paid.toString(),'51.25');assert.equal(balances.unpaid.toString(),'0');assert.equal(balances.advance.toString(),'0');
 const foreign=await fixture(),cashier=await actor(f.org.id,f.store.id,'cashier'),hidden=await prisma.store.create({data:{organizationId:f.org.id,name:'Order hidden'}}),admin=await actor(f.org.id,hidden.id,'admin');await assert.rejects(()=>s.readPurchaseOrder(foreign.context,order.id),{code:'ORDER_NOT_FOUND'});await assert.rejects(()=>s.readPurchaseOrder(admin.context,order.id),{code:'ORDER_NOT_FOUND'});await assert.rejects(()=>s.readPurchaseOrder(cashier.context,order.id),{code:'MANAGER_REQUIRED'});
 const {GET}=await import('@/app/api/purchase-orders/[id]/receipts/route');const history=await GET(req('/purchase-orders/'+order.id+'/receipts?limit=1',f.cookie),{params:Promise.resolve({id:order.id})});assert.equal(history.status,200);const body=await history.json();assert.equal(body.data.length,1);assert.equal(body.pagination.total,2);
 await assert.rejects(()=>prisma.purchaseOrder.update({where:{id:order.id},data:{referenceNo:'MUTATED'}}));await assert.rejects(()=>prisma.purchaseReceiptLine.updateMany({where:{receiptId:first.receipt.id},data:{orderItemId:randomUUID()}}));
});

test('Purchase order receipt late failure rolls back stock, weighted cost, invoice, original links and operation before exact retry',async()=>{
 const f=await fixture(0),s=await import('@/server/purchases/orders'),supplier=await prisma.supplier.create({data:{organizationId:f.org.id,name:'Receipt atomic supplier'}});const order=await s.createPurchaseOrder(f.context,s.orderSchema.parse({operationId:randomUUID(),storeId:f.store.id,supplierId:supplier.id,referenceNo:'ORDER-ROLLBACK',reason:'Receipt atomic order',items:[{productId:f.product.id,quantity:'2',unitCost:'10.25'}]}));const input=s.receiptSchema.parse({operationId:randomUUID(),referenceNo:'RECEIPT-ROLLBACK',reason:'Receipt original retry',items:[{orderItemId:order.items[0].id,quantity:'2'}]});
 const trigger='receipt_fail_'+randomUUID().replaceAll('-','');await prisma.$executeRawUnsafe(`CREATE FUNCTION ${trigger}() RETURNS trigger LANGUAGE plpgsql AS $$ BEGIN IF NEW."organizationId"='${f.org.id}' AND NEW."entityType"='PurchaseReceipt' THEN RAISE EXCEPTION 'test-only late receipt audit'; END IF; RETURN NEW; END $$`);await prisma.$executeRawUnsafe(`CREATE TRIGGER ${trigger} BEFORE INSERT ON "AuditLog" FOR EACH ROW EXECUTE FUNCTION ${trigger}()`);
 try{await assert.rejects(()=>s.receivePurchaseOrder(f.context,order.id,input));assert.equal(await prisma.stockDocument.count({where:{organizationId:f.org.id}}),0);assert.equal(await prisma.supplierInvoice.count({where:{supplierId:supplier.id}}),0);assert.equal(await prisma.purchaseReceipt.count({where:{orderId:order.id}}),0);assert.equal(await prisma.inventoryMovement.count({where:{organizationId:f.org.id}}),0);assert.equal(await prisma.operation.count({where:{organizationId:f.org.id,key:input.operationId}}),0);assert.equal((await prisma.product.findUniqueOrThrow({where:{id:f.product.id}})).costPrice.toString(),'50');}finally{await prisma.$executeRawUnsafe(`DROP TRIGGER ${trigger} ON "AuditLog"`);await prisma.$executeRawUnsafe(`DROP FUNCTION ${trigger}()`);}
 await s.receivePurchaseOrder(f.context,order.id,input);await s.receivePurchaseOrder(f.context,order.id,input);assert.equal(await prisma.purchaseReceipt.count({where:{orderId:order.id}}),1);assert.equal((await prisma.product.findUniqueOrThrow({where:{id:f.product.id}})).costPrice.toString(),'10.25');
});

test('Supplier balance aging report reconciles invoice allocation, purchase report, customer due and frozen shift cash with cutoff and scope',async()=>{
 const f=await fixture(0,1000),orderService=await import('@/server/purchases/orders'),supplierService=await import('@/server/purchases/suppliers'),fin=await import('@/server/finance/accounts'),supplier=await prisma.supplier.create({data:{organizationId:f.org.id,name:'=Reconciled supplier'}}),past=new Date(Date.now()-86400000).toISOString(),future=new Date(Date.now()+86400000).toISOString();
 const order=await orderService.createPurchaseOrder(f.context,orderService.orderSchema.parse({operationId:randomUUID(),storeId:f.store.id,supplierId:supplier.id,referenceNo:'REPORT-ORDER',reason:'Actual reconciled order',items:[{productId:f.product.id,quantity:'5',unitCost:'10.25'}]}));const invoices=[];for(const [index,quantity,dueAt] of [[1,'2',past],[2,'2',future],[3,'1',undefined]] as const){const receipt=await orderService.receivePurchaseOrder(f.context,order.id,orderService.receiptSchema.parse({operationId:randomUUID(),referenceNo:'REPORT-RECEIPT-'+index,reason:'Actual received units',dueAt,items:[{orderItemId:order.items[0].id,quantity}]}));invoices.push(receipt.invoice);}
 const {GET}=await import('@/app/api/reports/supplier-balances/route'),cutoff=new Date().toISOString();const before=await GET(req('/reports/supplier-balances?asOf='+encodeURIComponent(cutoff),f.cookie),undefined);assert.equal(before.status,200);assert.equal((await before.json()).data.summary.unpaid,'51.25');
 const cash=await fin.createAccount(f.context,fin.accountSchema.parse({operationId:randomUUID(),storeId:f.store.id,registerId:f.register.id,name:'Reconciled supplier cash',kind:'cash',reason:'Existing counted cash'}));await supplierService.paySupplier(f.context,supplierService.supplierPaymentSchema.parse({operationId:randomUUID(),supplierId:supplier.id,accountId:cash.id,shiftId:f.shift.id,amount:'15',reason:'Ten invoice and five advance',allocations:[{invoiceId:invoices[0].id,amount:'10'}]}));
 const current=await GET(req('/reports/supplier-balances?limit=1',f.cookie),undefined);assert.equal(current.status,200);const body=await current.json();assert.equal(body.data.rows.length,1);assert.deepEqual(body.data.summary,{invoiced:'51.25',allocated:'10',unpaid:'41.25',overdue:'10.5',upcoming:'20.5',noDueDate:'10.25',paid:'15',advance:'5'});const ledger=await prisma.$transaction(tx=>supplierService.supplierBalances(tx,f.context,supplier.id));for(const key of ['invoiced','allocated','unpaid','paid','advance'] as const)assert.equal(body.data.summary[key],ledger[key].toString());const old=await GET(req('/reports/supplier-balances?asOf='+encodeURIComponent(cutoff),f.cookie),undefined);assert.equal((await old.json()).data.summary.unpaid,'51.25');
 const {GET:purchaseReport}=await import('@/app/api/reports/purchases/route');const purchases=await purchaseReport(req('/reports/purchases?supplierId='+supplier.id,f.cookie),undefined);assert.equal((await purchases.json()).data.summary.purchaseValue,'51.25');
 const customer=await prisma.customer.create({data:{organizationId:f.org.id,fullName:'Report customer',phone:randomUUID(),creditLimit:'1000'}}),sale=await createDraft(f.context,{...f.draft,customerId:customer.id},randomUUID());await completeSale(f.context,sale.id,{payments:[{paymentType:'credit',amount:'100'}],creditDueAt:future},randomUUID());const {customerStatement}=await import('@/server/customers/ledger');const statement=await customerStatement(f.context,customer.id);assert.equal(statement.summary.currentBalance.toString(),'100');assert.equal(statement.aging.upcoming.toString(),'100');assert.equal(statement.aging.debtTotal.toString(),'100');
 const closed=await closeShift(f.context,f.shift.id,{operationId:randomUUID(),countedCash:'980',note:'Actual counted cash five less'});assert.equal(closed.expectedCash?.toString(),'985');assert.equal(closed.cashDifference?.toString(),'-5');assert.equal(closed.countedCash?.toString(),'980');const {GET:shiftDetail}=await import('@/app/api/shifts/[id]/route');const shift=await shiftDetail(req('/shifts/'+f.shift.id,f.cookie),{params:Promise.resolve({id:f.shift.id})});const shiftBody=await shift.json();assert.equal(shiftBody.data.cashDifference,'-5');
 const csvResponse=await GET(req('/reports/supplier-balances?format=csv',f.cookie),undefined);assert.match((await csvResponse.json()).data.content,/'=Reconciled supplier/);
 const foreign=await fixture(),cashier=await actor(f.org.id,f.store.id,'cashier'),other=await prisma.store.create({data:{organizationId:f.org.id,name:'No supplier scope'}}),admin=await actor(f.org.id,other.id,'admin');assert.equal((await GET(req('/reports/supplier-balances',cashier.cookie),undefined)).status,403);assert.equal((await GET(req('/reports/supplier-balances?storeId='+f.store.id,foreign.cookie),undefined)).status,404);const hidden=await GET(req('/reports/supplier-balances',admin.cookie),undefined);assert.equal((await hidden.json()).data.summary.unpaid,'0');assert.equal((await GET(req('/reports/supplier-balances?asOf='+encodeURIComponent(future),f.cookie),undefined)).status,400);
});

test('Zero-value purchase receipt conserves original quantity without inventing supplier payable or cash and rejects changed unit',async()=>{
 const f=await fixture(0),s=await import('@/server/purchases/orders'),supplier=await prisma.supplier.create({data:{organizationId:f.org.id,name:'Complimentary supplier'}});const order=await s.createPurchaseOrder(f.context,s.orderSchema.parse({operationId:randomUUID(),storeId:f.store.id,supplierId:supplier.id,referenceNo:'FREE-GOODS',reason:'Actual complimentary goods',items:[{productId:f.product.id,quantity:'2',unitCost:'0'}]}));const input=s.receiptSchema.parse({operationId:randomUUID(),referenceNo:'FREE-RECEIPT',reason:'Complimentary original receipt',items:[{orderItemId:order.items[0].id,quantity:'2'}]});await prisma.product.update({where:{id:f.product.id},data:{unit:'kg'}});await assert.rejects(()=>s.receivePurchaseOrder(f.context,order.id,input),{code:'ORDER_UNIT_CHANGED'});assert.equal(await prisma.purchaseReceipt.count({where:{orderId:order.id}}),0);await prisma.product.update({where:{id:f.product.id},data:{unit:'dona'}});const receipt=await s.receivePurchaseOrder(f.context,order.id,input);assert.equal(receipt.invoice.amount.toString(),'0');assert.equal(await prisma.supplierPayment.count({where:{supplierId:supplier.id}}),0);assert.equal((await prisma.inventoryBalance.findUniqueOrThrow({where:{storeId_productId:{storeId:f.store.id,productId:f.product.id}}})).quantity.toString(),'2');
});

test('Supplier paid returns and price credits conserve original quantity, payable and released advance without inventing cash refund',async()=>{
 const f=await fixture(0,1000),orders=await import('@/server/purchases/orders'),sup=await import('@/server/purchases/suppliers'),credits=await import('@/server/purchases/credits'),fin=await import('@/server/finance/accounts'),supplier=await prisma.supplier.create({data:{organizationId:f.org.id,name:'Return supplier'}});const order=await orders.createPurchaseOrder(f.context,orders.orderSchema.parse({operationId:randomUUID(),storeId:f.store.id,supplierId:supplier.id,referenceNo:'RETURN-ORDER',reason:'Original supplier purchase',items:[{productId:f.product.id,quantity:'5',unitCost:'10.25'}]}));const receipt=await orders.receivePurchaseOrder(f.context,order.id,orders.receiptSchema.parse({operationId:randomUUID(),referenceNo:'RETURN-RECEIPT',reason:'Actual original receipt',items:[{orderItemId:order.items[0].id,quantity:'5'}]}));const account=await fin.createAccount(f.context,fin.accountSchema.parse({operationId:randomUUID(),storeId:f.store.id,registerId:f.register.id,name:'Return till',kind:'cash',reason:'Existing counted cash'}));await sup.paySupplier(f.context,sup.supplierPaymentSchema.parse({operationId:randomUUID(),supplierId:supplier.id,accountId:account.id,shiftId:f.shift.id,amount:'51.25',reason:'Original full payment',allocations:[{invoiceId:receipt.invoice.id,amount:'51.25'}]}));const cutoff=new Date().toISOString();
 const input=credits.creditSchema.parse({operationId:randomUUID(),kind:'goods_return',reason:'Two original units returned',items:[{stockDocumentItemId:receipt.stockDocument.items[0].id,quantity:'2'}]});const preview=await credits.creditSupplierInvoice(f.context,receipt.invoice.id,input,true);assert.ok('invoiceNet' in preview);assert.equal(preview.amount.toString(),'20.5');const confirmed={...input,expectedAmount:preview.amount.toString(),expectedInvoiceNet:preview.invoiceNet.toString()};await Promise.all([credits.creditSupplierInvoice(f.context,receipt.invoice.id,confirmed),credits.creditSupplierInvoice(f.context,receipt.invoice.id,confirmed)]);assert.equal(await prisma.supplierCredit.count({where:{invoiceId:receipt.invoice.id}}),1);let balance=await prisma.$transaction(tx=>sup.supplierBalances(tx,f.context,supplier.id));assert.equal(balance.invoiced.toString(),'30.75');assert.equal(balance.unpaid.toString(),'0');assert.equal(balance.advance.toString(),'20.5');assert.equal((await fin.listAccounts(f.context)).find(a=>a.id===account.id)?.balance.toString(),'948.75');assert.equal((await prisma.inventoryBalance.findUniqueOrThrow({where:{storeId_productId:{storeId:f.store.id,productId:f.product.id}}})).quantity.toString(),'3');
 await assert.rejects(()=>credits.creditSupplierInvoice(f.context,receipt.invoice.id,{...input,operationId:randomUUID(),items:[{stockDocumentItemId:input.items[0].stockDocumentItemId,quantity:'4'}]},true),{code:'SUPPLIER_RETURN_QUANTITY_EXCEEDED'});
 const adjust=credits.creditSchema.parse({operationId:randomUUID(),kind:'price_correction',reason:'Verified price credit on remaining goods',items:[{stockDocumentItemId:input.items[0].stockDocumentItemId,amount:'5'}]});const quote=await credits.creditSupplierInvoice(f.context,receipt.invoice.id,adjust,true);assert.ok('invoiceNet' in quote);await credits.creditSupplierInvoice(f.context,receipt.invoice.id,{...adjust,expectedAmount:'5',expectedInvoiceNet:quote.invoiceNet.toString()});balance=await prisma.$transaction(tx=>sup.supplierBalances(tx,f.context,supplier.id));assert.equal(balance.invoiced.toString(),'25.75');assert.equal(balance.advance.toString(),'25.5');assert.equal(await prisma.inventoryMovement.count({where:{organizationId:f.org.id,sourceType:'supplier_return'}}),1);
 const rest={...input,operationId:randomUUID(),items:[{stockDocumentItemId:input.items[0].stockDocumentItemId,quantity:'3'}]},last=await credits.creditSupplierInvoice(f.context,receipt.invoice.id,rest,true);assert.ok('invoiceNet' in last);assert.equal(last.amount.toString(),'25.75');await assert.rejects(()=>credits.creditSupplierInvoice(f.context,receipt.invoice.id,{...rest,expectedAmount:'30.75',expectedInvoiceNet:'30.75'}),{code:'SUPPLIER_CREDIT_PREVIEW_CHANGED'});await credits.creditSupplierInvoice(f.context,receipt.invoice.id,{...rest,expectedAmount:last.amount.toString(),expectedInvoiceNet:last.invoiceNet.toString()});balance=await prisma.$transaction(tx=>sup.supplierBalances(tx,f.context,supplier.id));assert.equal(balance.invoiced.toString(),'0');assert.equal(balance.unpaid.toString(),'0');assert.equal(balance.advance.toString(),'51.25');assert.equal((await prisma.inventoryBalance.findUniqueOrThrow({where:{storeId_productId:{storeId:f.store.id,productId:f.product.id}}})).quantity.toString(),'0');assert.equal(await prisma.cashMovement.count({where:{shiftId:f.shift.id}}),1);
 const {GET:report}=await import('@/app/api/reports/supplier-balances/route');const current=await report(req('/reports/supplier-balances',f.cookie),undefined);assert.equal(current.status,200);assert.equal((await current.json()).data.summary.advance,'51.25');const previous=await report(req('/reports/supplier-balances?asOf='+encodeURIComponent(cutoff),f.cookie),undefined);assert.equal((await previous.json()).data.summary.invoiced,'51.25');const {GET:purchases}=await import('@/app/api/reports/purchases/route');const purchase=await purchases(req('/reports/purchases?supplierId='+supplier.id,f.cookie),undefined);assert.equal(purchase.status,200);const totals=(await purchase.json()).data.summary;assert.equal(totals.purchaseValue,'51.25');assert.equal(totals.reversalValue,'51.25');assert.equal(totals.netPurchaseValue,'0');
 const foreign=await fixture(),cashier=await actor(f.org.id,f.store.id,'cashier');await assert.rejects(()=>credits.supplierInvoiceDetail(foreign.context,receipt.invoice.id),{code:'INVOICE_NOT_FOUND'});await assert.rejects(()=>credits.supplierInvoiceDetail(cashier.context,receipt.invoice.id),{code:'MANAGER_REQUIRED'});await assert.rejects(()=>prisma.supplierCredit.updateMany({where:{invoiceId:receipt.invoice.id},data:{reason:'Rewrite history'}}));await assert.rejects(()=>prisma.supplierAllocationRelease.deleteMany({where:{credit:{invoiceId:receipt.invoice.id}}}));
 // Freed money can settle a new invoice exactly once, still without a new cash movement.
 const second=await orders.createPurchaseOrder(f.context,orders.orderSchema.parse({operationId:randomUUID(),storeId:f.store.id,supplierId:supplier.id,referenceNo:'REPLACEMENT-ORDER',reason:'Independent new supplier order',items:[{productId:f.product.id,quantity:'1',unitCost:'10'}]}));const replacement=await orders.receivePurchaseOrder(f.context,second.id,orders.receiptSchema.parse({operationId:randomUUID(),referenceNo:'REPLACEMENT-RECEIPT',reason:'Independent actual receipt',items:[{orderItemId:second.items[0].id,quantity:'1'}]}));const payment=await prisma.supplierPayment.findFirstOrThrow({where:{supplierId:supplier.id}});await sup.allocateSupplierAdvance(f.context,payment.id,sup.supplierAllocateSchema.parse({operationId:randomUUID(),reason:'Apply released original payment',allocations:[{invoiceId:replacement.invoice.id,amount:'10'}]}));assert.equal((await prisma.$transaction(tx=>sup.supplierBalances(tx,f.context,supplier.id))).advance.toString(),'41.25');assert.equal(await prisma.cashMovement.count({where:{shiftId:f.shift.id}}),1);
});

test('Supplier credit late audit failure rolls back original credit, freed allocation, stock and cost before one original retry',async()=>{
 const f=await fixture(0,1000),o=await import('@/server/purchases/orders'),s=await import('@/server/purchases/suppliers'),c=await import('@/server/purchases/credits'),fin=await import('@/server/finance/accounts'),supplier=await prisma.supplier.create({data:{organizationId:f.org.id,name:'Atomic return supplier'}}),order=await o.createPurchaseOrder(f.context,o.orderSchema.parse({operationId:randomUUID(),storeId:f.store.id,supplierId:supplier.id,referenceNo:'ATOMIC-RETURN',reason:'Original paid receipt',items:[{productId:f.product.id,quantity:'2',unitCost:'10'}]})),receipt=await o.receivePurchaseOrder(f.context,order.id,o.receiptSchema.parse({operationId:randomUUID(),referenceNo:'ATOMIC-RECEIPT',reason:'Actual received goods',items:[{orderItemId:order.items[0].id,quantity:'2'}]}));const account=await fin.createAccount(f.context,fin.accountSchema.parse({operationId:randomUUID(),storeId:f.store.id,registerId:f.register.id,name:'Atomic return till',kind:'cash',reason:'Existing till cash'}));await s.paySupplier(f.context,s.supplierPaymentSchema.parse({operationId:randomUUID(),supplierId:supplier.id,accountId:account.id,shiftId:f.shift.id,amount:'20',reason:'Original paid purchase',allocations:[{invoiceId:receipt.invoice.id,amount:'20'}]}));const input=c.creditSchema.parse({operationId:randomUUID(),kind:'goods_return',reason:'Actual original unit returned',expectedAmount:'10',expectedInvoiceNet:'20',items:[{stockDocumentItemId:receipt.stockDocument.items[0].id,quantity:'1'}]});
 const trigger='credit_fail_'+randomUUID().replaceAll('-','');await prisma.$executeRawUnsafe(`CREATE FUNCTION ${trigger}() RETURNS trigger LANGUAGE plpgsql AS $$ BEGIN IF NEW."organizationId"='${f.org.id}' AND NEW."entityType"='SupplierCredit' THEN RAISE EXCEPTION 'test-only late supplier credit audit'; END IF; RETURN NEW; END $$`);await prisma.$executeRawUnsafe(`CREATE TRIGGER ${trigger} BEFORE INSERT ON "AuditLog" FOR EACH ROW EXECUTE FUNCTION ${trigger}()`);
 try{await assert.rejects(()=>c.creditSupplierInvoice(f.context,receipt.invoice.id,input));assert.equal(await prisma.supplierCredit.count({where:{invoiceId:receipt.invoice.id}}),0);assert.equal(await prisma.supplierAllocationRelease.count({where:{allocation:{invoiceId:receipt.invoice.id}}}),0);assert.equal(await prisma.inventoryMovement.count({where:{organizationId:f.org.id,sourceType:'supplier_return'}}),0);assert.equal(await prisma.operation.count({where:{organizationId:f.org.id,key:input.operationId}}),0);assert.equal((await prisma.inventoryBalance.findUniqueOrThrow({where:{storeId_productId:{storeId:f.store.id,productId:f.product.id}}})).quantity.toString(),'2');assert.equal((await s.supplierBalances(prisma,f.context,supplier.id)).advance.toString(),'0');}finally{await prisma.$executeRawUnsafe(`DROP TRIGGER ${trigger} ON "AuditLog"`);await prisma.$executeRawUnsafe(`DROP FUNCTION ${trigger}()`);}
 await c.creditSupplierInvoice(f.context,receipt.invoice.id,input);await c.creditSupplierInvoice(f.context,receipt.invoice.id,input);assert.equal(await prisma.supplierCredit.count({where:{invoiceId:receipt.invoice.id}}),1);assert.equal((await s.supplierBalances(prisma,f.context,supplier.id)).advance.toString(),'10');
 const {runOperation}=await import('@/server/operations'),badKey=randomUUID();await assert.rejects(()=>runOperation(f.context,'test.invalid.credit',badKey,{invoiceId:receipt.invoice.id},async tx=>tx.supplierCredit.create({data:{invoiceId:receipt.invoice.id,kind:'goods_return',amount:'10',reason:'Missing actual movement rejected',createdBy:f.user.id,items:{create:{stockDocumentItemId:receipt.stockDocument.items[0].id,quantity:'1',amount:'10'}}}})));assert.equal(await prisma.operation.count({where:{organizationId:f.org.id,key:badKey}}),0);assert.equal(await prisma.supplierCredit.count({where:{invoiceId:receipt.invoice.id}}),1);
});

test('Supplier fractional partial returns conserve last cent and parallel commands cannot consume the same original quantity',async()=>{
 const f=await fixture(0),o=await import('@/server/purchases/orders'),c=await import('@/server/purchases/credits');await prisma.product.update({where:{id:f.product.id},data:{unit:'kg'}});const supplier=await prisma.supplier.create({data:{organizationId:f.org.id,name:'Fractional return supplier'}}),order=await o.createPurchaseOrder(f.context,o.orderSchema.parse({operationId:randomUUID(),storeId:f.store.id,supplierId:supplier.id,referenceNo:'FRACTION-ORDER',reason:'Original fractional purchase',items:[{productId:f.product.id,quantity:'1',unitCost:'0.01'}]})),receipt=await o.receivePurchaseOrder(f.context,order.id,o.receiptSchema.parse({operationId:randomUUID(),referenceNo:'FRACTION-RECEIPT',reason:'Fractional actual receipt',items:[{orderItemId:order.items[0].id,quantity:'1'}]}));for(const quantity of ['0.333333','0.333333','0.333334']){const input=c.creditSchema.parse({operationId:randomUUID(),kind:'goods_return',reason:'Fractional actual supplier return',items:[{stockDocumentItemId:receipt.stockDocument.items[0].id,quantity}]}),preview=await c.creditSupplierInvoice(f.context,receipt.invoice.id,input,true);assert.ok('invoiceNet' in preview);await c.creditSupplierInvoice(f.context,receipt.invoice.id,{...input,expectedAmount:preview.amount.toString(),expectedInvoiceNet:preview.invoiceNet.toString()});}assert.equal((await prisma.supplierCredit.aggregate({where:{invoiceId:receipt.invoice.id},_sum:{amount:true}}))._sum.amount?.toString(),'0.01');assert.equal((await prisma.inventoryBalance.findUniqueOrThrow({where:{storeId_productId:{storeId:f.store.id,productId:f.product.id}}})).quantity.toString(),'0');
 const next=await o.createPurchaseOrder(f.context,o.orderSchema.parse({operationId:randomUUID(),storeId:f.store.id,supplierId:supplier.id,referenceNo:'RACE-RETURN-ORDER',reason:'Race original purchase',items:[{productId:f.product.id,quantity:'1',unitCost:'10'}]})),second=await o.receivePurchaseOrder(f.context,next.id,o.receiptSchema.parse({operationId:randomUUID(),referenceNo:'RACE-RETURN-RECEIPT',reason:'Race actual receipt',items:[{orderItemId:next.items[0].id,quantity:'1'}]}));const input=c.creditSchema.parse({operationId:randomUUID(),kind:'goods_return',reason:'Parallel original quantity',expectedAmount:'7.5',expectedInvoiceNet:'10',items:[{stockDocumentItemId:second.stockDocument.items[0].id,quantity:'0.75'}]});const results=await Promise.allSettled([c.creditSupplierInvoice(f.context,second.invoice.id,input),c.creditSupplierInvoice(f.context,second.invoice.id,{...input,operationId:randomUUID()})]);assert.equal(results.filter(r=>r.status==='fulfilled').length,1);assert.equal((await prisma.inventoryBalance.findUniqueOrThrow({where:{storeId_productId:{storeId:f.store.id,productId:f.product.id}}})).quantity.toString(),'0.25');
});


test('Supplier price correction after a partial return distributes only the remaining payable across remaining goods',async()=>{
 const f=await fixture(0),o=await import('@/server/purchases/orders'),c=await import('@/server/purchases/credits');await prisma.product.update({where:{id:f.product.id},data:{unit:'kg'}});
 const supplier=await prisma.supplier.create({data:{organizationId:f.org.id,name:'Remaining value supplier'}}),order=await o.createPurchaseOrder(f.context,o.orderSchema.parse({operationId:randomUUID(),storeId:f.store.id,supplierId:supplier.id,referenceNo:'REMAINING-VALUE',reason:'Original goods receipt',items:[{productId:f.product.id,quantity:'1',unitCost:'10'}]})),receipt=await o.receivePurchaseOrder(f.context,order.id,o.receiptSchema.parse({operationId:randomUUID(),referenceNo:'REMAINING-RECEIPT',reason:'Original actual receipt',items:[{orderItemId:order.items[0].id,quantity:'1'}]}));
 for(const [kind,value,expected] of [['goods_return','0.5','5'],['price_correction','4','4'],['goods_return','0.25','0.5'],['goods_return','0.25','0.5']] as const){const input=c.creditSchema.parse({operationId:randomUUID(),kind,reason:'Verified remaining goods credit',items:[{stockDocumentItemId:receipt.stockDocument.items[0].id,...(kind==='goods_return'?{quantity:value}:{amount:value})}]}),preview=await c.creditSupplierInvoice(f.context,receipt.invoice.id,input,true);assert.ok('invoiceNet' in preview);assert.equal(preview.amount.toString(),expected);await c.creditSupplierInvoice(f.context,receipt.invoice.id,{...input,expectedAmount:expected,expectedInvoiceNet:preview.invoiceNet.toString()});}
 assert.equal((await prisma.supplierCredit.aggregate({where:{invoiceId:receipt.invoice.id},_sum:{amount:true}}))._sum.amount?.toString(),'10');assert.equal((await prisma.inventoryBalance.findUniqueOrThrow({where:{storeId_productId:{storeId:f.store.id,productId:f.product.id}}})).quantity.toString(),'0');
});


test('Product variants keep barcode, stock, sale and return independent and preserve the original default SKU',async()=>{
 const f=await fixture(10),v=await import('@/server/catalog/variants');
 const input=v.variantSchema.parse({operationId:randomUUID(),name:'Shirt red M',sku:randomUUID(),barcode:randomUUID(),salePrice:'125.5',reason:'Independent apparel variant',options:[{name:'Color',value:'Red'},{name:'Size',value:'M'}]});
 const red=await v.createVariant(f.context,f.product.id,input);assert.equal((await v.createVariant(f.context,f.product.id,input)).id,red.id);
 const blue=await v.createVariant(f.context,red.id,{...input,operationId:randomUUID(),name:'Shirt blue L',sku:randomUUID(),barcode:randomUUID(),options:[{name:'size',value:'L'},{name:'color',value:'Blue'}]});
 assert.equal(await prisma.inventoryMovement.count({where:{productId:{in:[red.id,blue.id]}}}),0);assert.equal(await prisma.payment.count({where:{organizationId:f.org.id}}),0);
 await prisma.inventoryBalance.createMany({data:[{storeId:f.store.id,productId:red.id,quantity:3},{storeId:f.store.id,productId:blue.id,quantity:4}]});
 const page=await v.listVariants(f.context,blue.id,new URLSearchParams('limit=1'));assert.equal(page.pagination.total,3);assert.equal(page.data.length,1);assert.equal(page.root.id,f.product.id);
 const all=await v.listVariants(f.context,f.product.id,new URLSearchParams());assert.deepEqual(Object.fromEntries(all.data.map(r=>[r.id,r.quantity.toString()])),{[f.product.id]:'10',[red.id]:'3',[blue.id]:'4'});assert.ok(all.data.every(r=>!('costPrice' in r)));
 const {GET:products}=await import('@/app/api/products/route');const scanned=await products(req('/products?organizationId='+f.org.id+'&barcode='+red.barcode,f.cookie),undefined);assert.equal(scanned.status,200);assert.equal((await scanned.json()).data.id,red.id);
 const sale=await createDraft(f.context,{...f.draft,items:[{productId:red.id,quantity:1,discountAmount:0}]},randomUUID());await completeSale(f.context,sale.id,{payments:[{paymentType:'cash',amount:'125.5'}]},randomUUID());
 assert.equal((await prisma.inventoryBalance.findUniqueOrThrow({where:{storeId_productId:{storeId:f.store.id,productId:red.id}}})).quantity.toString(),'2');assert.equal((await prisma.inventoryBalance.findUniqueOrThrow({where:{storeId_productId:{storeId:f.store.id,productId:blue.id}}})).quantity.toString(),'4');assert.equal((await prisma.inventoryBalance.findUniqueOrThrow({where:{storeId_productId:{storeId:f.store.id,productId:f.product.id}}})).quantity.toString(),'10');
 await returnSale(f.context,sale.id,returnSchema.parse({operationId:randomUUID(),shiftId:f.shift.id,reason:'Original red variant returned',items:[{saleItemId:sale.items[0].id,quantity:1}]}));assert.equal((await prisma.inventoryBalance.findUniqueOrThrow({where:{storeId_productId:{storeId:f.store.id,productId:red.id}}})).quantity.toString(),'3');
 assert.deepEqual((await prisma.productVariant.findUniqueOrThrow({where:{productId:f.product.id}})).options,{});assert.equal((await prisma.product.findUniqueOrThrow({where:{id:f.product.id}})).barcode,f.product.barcode);
});

test('Variant combination uniqueness, tenant scope, cashier rights and immutable family identity are enforced',async()=>{
 const f=await fixture(),foreign=await fixture(),cashier=await actor(f.org.id,f.store.id,'cashier'),v=await import('@/server/catalog/variants'),routes=await import('@/app/api/products/[id]/variants/route');
 const input=v.variantSchema.parse({operationId:randomUUID(),name:'Unique option',sku:randomUUID(),barcode:randomUUID(),salePrice:'1',reason:'Verified variant combination',options:[{name:'Color',value:' RED '},{name:'Size',value:'M'}]});
 const outcomes=await Promise.allSettled([v.createVariant(f.context,f.product.id,input),v.createVariant(f.context,f.product.id,{...input,operationId:randomUUID(),sku:randomUUID(),barcode:randomUUID(),options:[{name:'size',value:'m'},{name:'color',value:'red'}]})]);assert.equal(outcomes.filter(r=>r.status==='fulfilled').length,1);const variant=(await v.listVariants(f.context,f.product.id,new URLSearchParams())).data.find(r=>!r.isDefault)!;
 assert.equal((await routes.POST(req('/products/'+f.product.id+'/variants',cashier.cookie,{...input,operationId:randomUUID()}),{params:Promise.resolve({id:f.product.id})})).status,403);assert.equal((await routes.GET(req('/products/'+f.product.id+'/variants',foreign.cookie),{params:Promise.resolve({id:f.product.id})})).status,404);
 const hiddenStore=await prisma.store.create({data:{organizationId:f.org.id,name:'Unassigned variant stock'}});await prisma.inventoryBalance.createMany({data:[{storeId:f.store.id,productId:variant.id,quantity:5},{storeId:hiddenStore.id,productId:variant.id,quantity:99}]});
 const ownRead=await routes.GET(req('/products/'+f.product.id+'/variants',cashier.cookie),{params:Promise.resolve({id:f.product.id})});assert.equal(ownRead.status,200);const visible=await ownRead.json();assert.ok(!JSON.stringify(visible).includes('costPrice'));assert.equal(visible.data.find((row:{id:string})=>row.id===variant.id).quantity,'5');
 await assert.rejects(()=>prisma.productVariant.update({where:{productId:variant.id},data:{organizationId:foreign.org.id}}));
 await assert.rejects(()=>v.createVariant(f.context,f.product.id,{...input,operationId:randomUUID(),sku:f.product.sku,options:[{name:'color',value:'yellow'}]}));
 await assert.rejects(()=>prisma.productVariant.update({where:{productId:variant.id},data:{options:{color:'blue'}}}));await assert.rejects(()=>prisma.productVariant.update({where:{productId:foreign.product.id},data:{rootProductId:f.product.id,options:{color:'green'}}}));await assert.rejects(()=>prisma.product.update({where:{id:variant.id},data:{unit:'kg'}}));
 await prisma.product.update({where:{id:variant.id},data:{isActive:false}});const history=await v.listVariants(f.context,f.product.id,new URLSearchParams());assert.equal(history.pagination.total,2);assert.equal(history.data.find(r=>r.id===variant.id)?.isActive,false);
 assert.equal(v.variantSchema.safeParse({...input,options:[{name:'COLOR',value:'a'},{name:'color',value:'b'}]}).success,false);
});


test('Variant creation rolls back product, barcode, price history and operation on late audit failure',async()=>{
 const f=await fixture(),v=await import('@/server/catalog/variants'),input=v.variantSchema.parse({operationId:randomUUID(),name:'Atomic variant',sku:randomUUID(),barcode:randomUUID(),salePrice:'2.5',reason:'Verified variant creation',options:[{name:'color',value:'green'}]});
 const trigger='variant_fail_'+randomUUID().replaceAll('-','');await prisma.$executeRawUnsafe(`CREATE FUNCTION ${trigger}() RETURNS trigger LANGUAGE plpgsql AS $$ BEGIN IF NEW."organizationId"='${f.org.id}' AND NEW.action='variant_created' THEN RAISE EXCEPTION 'test-only late variant audit'; END IF; RETURN NEW; END $$`);await prisma.$executeRawUnsafe(`CREATE TRIGGER ${trigger} BEFORE INSERT ON "AuditLog" FOR EACH ROW EXECUTE FUNCTION ${trigger}()`);
 try{await assert.rejects(()=>v.createVariant(f.context,f.product.id,input));assert.equal(await prisma.product.count({where:{organizationId:f.org.id,sku:input.sku}}),0);assert.equal(await prisma.productBarcode.count({where:{organizationId:f.org.id,value:input.barcode}}),0);assert.equal(await prisma.productVariant.count({where:{rootProductId:f.product.id}}),1);assert.equal(await prisma.operation.count({where:{organizationId:f.org.id,key:input.operationId}}),0);assert.equal(await prisma.productPriceHistory.count({where:{organizationId:f.org.id,source:'catalog.variant'}}),0);}finally{await prisma.$executeRawUnsafe(`DROP TRIGGER ${trigger} ON "AuditLog"`);await prisma.$executeRawUnsafe(`DROP FUNCTION ${trigger}()`);}
 const first=await v.createVariant(f.context,f.product.id,input);assert.equal((await v.createVariant(f.context,f.product.id,input)).id,first.id);assert.equal(await prisma.productVariant.count({where:{rootProductId:f.product.id}}),2);
});
test('Internal reconciliation worker explicitly isolates tenant/store scope and never creates a financial posting',async()=>{
 const a=await fixture(),b=await fixture();const {scanOrganization,scan}=await import('@/server/monitoring/service');const before=await Promise.all([prisma.sale.count(),prisma.payment.count(),prisma.inventoryMovement.count(),prisma.debtEntry.count()]);
 const foreignScope=await prisma.$transaction(tx=>scanOrganization(tx,a.org.id,[b.store.id]));assert.equal(Object.values(foreignScope).reduce((n,x)=>n+x,0),0);assert.equal(await prisma.incident.count({where:{organizationId:a.org.id}}),0);
 const own=await prisma.$transaction(tx=>scanOrganization(tx,a.org.id));assert.equal(own.inventory,1);const records=await prisma.incident.findMany({where:{organizationId:a.org.id}});assert.ok(records.length>0);assert.ok(records.every(x=>x.storeId===a.store.id));assert.equal(await prisma.incident.count({where:{organizationId:b.org.id}}),0);
 const other=await prisma.$transaction(tx=>scanOrganization(tx,b.org.id));assert.equal(other.inventory,1);await assert.rejects(()=>scan({...a.context,role:'cashier'},randomUUID()),{code:'FORBIDDEN'});assert.deepEqual(await Promise.all([prisma.sale.count(),prisma.payment.count(),prisma.inventoryMovement.count(),prisma.debtEntry.count()]),before);
});


test('Replenishment and incident pages reject unbounded pagination and keep explicit branch filters scoped',async()=>{
 const f=await fixture(0),foreign=await fixture(0),cashier=await actor(f.org.id,f.store.id,'cashier'),admin=await actor(f.org.id,f.store.id,'admin')
 const hidden=await prisma.store.create({data:{organizationId:f.org.id,name:'Hidden branch'}})
 const {GET:replenishment}=await import('@/app/api/reports/replenishment/route')
 const {GET:incidents}=await import('@/app/api/incidents/route')
 for(const query of ['page=0','page=-1','page=1.5','page=NaN','page=999999999999','limit=0','limit=-1','limit=201','limit=Infinity']){
  assert.equal((await replenishment(req('/reports/replenishment?'+query,f.cookie),undefined)).status,400,query)
  assert.equal((await incidents(req('/incidents?'+query,f.cookie),undefined)).status,400,query)
 }
 const response=await replenishment(req('/reports/replenishment?storeId='+f.store.id+'&limit=1',admin.cookie),undefined)
 assert.equal(response.status,200);const body=await response.json();assert.equal(body.pagination.total,1);assert.equal(body.data[0].storeId,f.store.id);assert.equal(body.data[0].quantity,'0')
 for(const storeId of [foreign.store.id,hidden.id])assert.equal((await replenishment(req('/reports/replenishment?storeId='+storeId,admin.cookie),undefined)).status,404)
 assert.equal((await replenishment(req('/reports/replenishment?storeId=invalid',f.cookie),undefined)).status,400)
 assert.equal((await replenishment(req('/reports/replenishment',cashier.cookie),undefined)).status,403)
 const owner=await replenishment(req('/reports/replenishment?storeId='+hidden.id,f.cookie),undefined);assert.equal(owner.status,200);assert.ok((await owner.json()).data.every((row:{storeId:string})=>row.storeId===hidden.id))
 await prisma.incident.createMany({data:[
  {organizationId:f.org.id,storeId:f.store.id,kind:'inventory',entityKey:randomUUID(),evidence:{synthetic:true}},
  {organizationId:f.org.id,storeId:f.store.id,kind:'inventory',entityKey:randomUUID(),evidence:{synthetic:true}},
  {organizationId:f.org.id,storeId:hidden.id,kind:'inventory',entityKey:randomUUID(),evidence:{synthetic:true}},
 ]})
 const firstPage=await incidents(req('/incidents?page=1&limit=1',admin.cookie),undefined),secondPage=await incidents(req('/incidents?page=2&limit=1',admin.cookie),undefined)
 assert.equal(firstPage.status,200);assert.equal(secondPage.status,200)
 const firstBody=await firstPage.json(),secondBody=await secondPage.json()
 assert.deepEqual(firstBody.pagination,{page:1,limit:1,total:2,totalPages:2});assert.equal(firstBody.data.length,1);assert.equal(secondBody.data.length,1);assert.notEqual(firstBody.data[0].id,secondBody.data[0].id)
 await prisma.session.update({where:{id:admin.context.sessionId},data:{revokedAt:new Date()}})
 assert.equal((await replenishment(req('/reports/replenishment?storeId='+f.store.id,admin.cookie),undefined)).status,401)
 assert.equal((await incidents(req('/incidents',admin.cookie),undefined)).status,401)
})


test('Inactive stock report uses positive branch stock and completed-sale activity, keeps draft/other-branch activity separate and exports all filtered rows',async()=>{
 const f=await fixture(10),foreign=await fixture(10),admin=await actor(f.org.id,f.store.id,'admin')
 const {GET:balances}=await import('@/app/api/inventory/balances/route')
 const product=async(name:string,quantity:number)=>{const value=await prisma.product.create({data:{organizationId:f.org.id,name,sku:randomUUID(),barcode:randomUUID(),unit:'dona',salePrice:100,costPrice:'0.123456'}});await prisma.inventoryBalance.create({data:{storeId:f.store.id,productId:value.id,quantity}});return value}
 const never=await product('=Never sold',2),recent=await product('Recent returned activity',3),zero=await product('Zero stock',0)
 await posted(f,new Date(Date.now()-31*86400000))
 const recentSale=await posted({...f,product:recent},new Date(Date.now()-86400000))
 await prisma.payment.create({data:{organizationId:f.org.id,storeId:f.store.id,shiftId:f.shift.id,saleId:recentSale.id,paymentType:'cash',direction:'in',amount:20,receivedBy:f.user.id}})
 await returnSale(f.context,recentSale.id,returnSchema.parse({operationId:randomUUID(),shiftId:f.shift.id,reason:'Actual full return stays sales activity',items:[{saleItemId:recentSale.items[0].id,quantity:2}]}))
 await createDraft(f.context,{...f.draft,items:[{productId:never.id,quantity:1,discountAmount:0}]},randomUUID())
 const hidden=await prisma.store.create({data:{organizationId:f.org.id,name:'Other branch'}}),register=await prisma.register.create({data:{storeId:hidden.id,name:'Other till',code:randomUUID()}}),shift=await prisma.shift.create({data:{registerId:register.id,organizationUserId:f.member.id,openingCash:0}})
 await prisma.inventoryBalance.create({data:{storeId:hidden.id,productId:never.id,quantity:4}})
 await posted({...f,store:hidden,register,shift,product:never},new Date())
 const result=await balances(req('/inventory/balances?inactiveDays=30&storeId='+f.store.id+'&limit=1',admin.cookie),undefined)
 assert.equal(result.status,200);const body=await result.json();assert.equal(body.pagination.total,2);assert.equal(body.data.length,1);assert.equal(body.meta.inactiveDays,30);assert.equal(new Date(body.meta.observedAt).getTime()-new Date(body.meta.inactiveSince).getTime(),30*86400000)
 const all=await balances(req('/inventory/balances?inactiveDays=30&storeId='+f.store.id,f.cookie),undefined),rows=(await all.json()).data
 assert.deepEqual(new Set(rows.map((row:{productId:string})=>row.productId)),new Set([f.product.id,never.id]));assert.ok(!rows.some((row:{productId:string})=>[recent.id,zero.id,foreign.product.id].includes(row.productId)))
 const csv=await balances(req('/inventory/balances?inactiveDays=30&storeId='+f.store.id+'&format=csv&limit=1&page=2',f.cookie),undefined);assert.equal(csv.status,200);const content=(await csv.json()).data.content;assert.match(content,/'=Never sold/);assert.match(content,/Frozen/);assert.doesNotMatch(content,/Recent returned activity|Zero stock/)
 const ordinary=await balances(req('/inventory/balances?storeId='+f.store.id,f.cookie),undefined),ordinaryBody=await ordinary.json();assert.equal(ordinaryBody.pagination.total,4);assert.equal(ordinaryBody.meta.definition,'current_stock_snapshot')
 const sixty=await balances(req('/inventory/balances?inactiveDays=60&storeId='+f.store.id,f.cookie),undefined);assert.deepEqual((await sixty.json()).data.map((row:{productId:string})=>row.productId),[never.id])
 const hiddenResult=await balances(req('/inventory/balances?inactiveDays=30&storeId='+hidden.id,admin.cookie),undefined);assert.equal(hiddenResult.status,404)
 for(const value of ['0','-1','1.5','3651','NaN','Infinity',''])assert.equal((await balances(req('/inventory/balances?inactiveDays='+value,f.cookie),undefined)).status,400)
})

test('Release ledger acceptance: purchase, split cash/credit sale, partial return, debt collection and closed shift reconcile with no unexplained difference',async()=>{
 const f=await fixture(0,500),finance=await import('@/server/finance/accounts'),purchases=await import('@/server/purchases/suppliers'),orders=await import('@/server/purchases/orders'),collections=await import('@/server/payments/collections')
 const cash=await finance.createAccount(f.context,finance.accountSchema.parse({operationId:randomUUID(),storeId:f.store.id,registerId:f.register.id,name:'Release ledger till',kind:'cash',reason:'Verified synthetic opening cash'}))
 const supplier=await prisma.supplier.create({data:{organizationId:f.org.id,name:'Release ledger supplier'}})
 const order=await orders.createPurchaseOrder(f.context,orders.orderSchema.parse({operationId:randomUUID(),storeId:f.store.id,supplierId:supplier.id,referenceNo:'RELEASE-ORDER',reason:'Cross ledger actual receipt scenario',items:[{productId:f.product.id,quantity:'4',unitCost:'50'}]}))
 const receipt=await orders.receivePurchaseOrder(f.context,order.id,orders.receiptSchema.parse({operationId:randomUUID(),referenceNo:'RELEASE-RECEIPT',reason:'Four units received',items:[{orderItemId:order.items[0].id,quantity:'4'}]}))
 assert.equal(receipt.invoice.amount.toString(),'200')
 const payment=purchases.supplierPaymentSchema.parse({operationId:randomUUID(),supplierId:supplier.id,accountId:cash.id,shiftId:f.shift.id,amount:'200',reason:'Verified supplier cash payment',allocations:[{invoiceId:receipt.invoice.id,amount:'200'}]})
 await purchases.paySupplier(f.context,payment);await purchases.paySupplier(f.context,payment)
 const customer=await prisma.customer.create({data:{organizationId:f.org.id,fullName:'Release ledger customer',phone:randomUUID(),creditLimit:1000}})
 const sale=await createDraft(f.context,{...f.draft,customerId:customer.id,items:[{productId:f.product.id,quantity:3,discountAmount:0}]},randomUUID()),saleKey=randomUUID(),tenders={payments:[{paymentType:'cash' as const,amount:90},{paymentType:'credit' as const,amount:210}]}
 await completeSale(f.context,sale.id,tenders,saleKey);await completeSale(f.context,sale.id,tenders,saleKey)
 const refund=returnSchema.parse({operationId:randomUUID(),shiftId:f.shift.id,reason:'One original sellable unit returned',items:[{saleItemId:sale.items[0].id,quantity:1,disposition:'sellable'}]})
 const returned=await returnSale(f.context,sale.id,refund);await returnSale(f.context,sale.id,refund)
 assert.equal(returned.settlement.cash.toString(),'30');assert.equal(returned.settlement.debt.toString(),'70')
 const collect=collections.collectionSchema.parse({operationId:randomUUID(),organizationId:f.org.id,storeId:f.store.id,shiftId:f.shift.id,customerId:customer.id,paymentType:'cash',amount:'140'})
 await collections.collectDebt(f.context,collect);await collections.collectDebt(f.context,collect)
 const debt=await prisma.debtEntry.aggregate({where:{organizationId:f.org.id,customerId:customer.id},_sum:{amount:true}});assert.equal(debt._sum.amount?.toString(),'0')
 const supplierBalance=await prisma.$transaction(tx=>purchases.supplierBalances(tx,f.context,supplier.id));assert.equal(supplierBalance.unpaid.toString(),'0');assert.equal(supplierBalance.paid.toString(),'200');assert.equal(supplierBalance.advance.toString(),'0')
 assert.equal((await prisma.inventoryBalance.findUniqueOrThrow({where:{storeId_productId:{storeId:f.store.id,productId:f.product.id}}})).quantity.toString(),'2')
 const cashBook=await prisma.shift.findUniqueOrThrow({where:{id:f.shift.id},include:{payments:true,cashMovements:true}});const beforeClose=shiftCashSummary(cashBook.openingCash,cashBook.payments,cashBook.cashMovements);assert.equal(beforeClose.expectedCash.toString(),'500')
 const close=await closeShift(f.context,f.shift.id,{countedCash:500});assert.equal(close.expectedCash?.toString(),'500');assert.equal(close.cashDifference?.toString(),'0')
 assert.equal((await finance.listAccounts(f.context)).find(account=>account.id===cash.id)?.balance.toString(),'500')
 const {GET:breakdowns}=await import('@/app/api/reports/breakdowns/route')
 for(const dimension of ['product','category','cashier','store','payment']){const response=await breakdowns(req('/reports/breakdowns?dimension='+dimension+'&storeId='+f.store.id,f.cookie),undefined);assert.equal(response.status,200);const body=await response.json();assert.equal(body.summary.netSales,'200');if(dimension!=='payment'){assert.equal(body.summary.cogs,'100');assert.equal(body.summary.grossProfit,'100')}}
 for(const kind of ['inventory','sales','returns','shifts']){const response=await reconciliation(req('/reports/reconciliation?kind='+kind+'&storeId='+f.store.id,f.cookie),undefined);assert.equal(response.status,200);const body=await response.json();assert.deepEqual(body.data,[]);assert.equal(body.pagination.total,0)}
})
