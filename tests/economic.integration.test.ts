import { test, after } from 'node:test'
import assert from 'node:assert/strict'
import { randomUUID } from 'node:crypto'
import { prisma } from '@/lib/prisma'
import { createDraft, completeSale } from '@/server/sales/service'
import { returnSale } from '@/server/returns/service'
import { collectDebt } from '@/server/payments/collections'
import type { TokenPayload } from '@/lib/auth'

const connection=new URL(process.env.DATABASE_URL??'')
if (connection.pathname!=='/pos_test' || connection.hostname!=='127.0.0.1') throw new Error('Isolated test DB required')
const orgs:string[]=[],users:string[]=[]
after(async()=>{
 await prisma.debtEntry.deleteMany({where:{organizationId:{in:orgs}}})
 await prisma.organization.deleteMany({where:{id:{in:orgs}}})
 await prisma.user.deleteMany({where:{id:{in:users}}});await prisma.$disconnect()
})
async function fixture(quantity=10) {
 const org=await prisma.organization.create({data:{name:'Economic test',phone:randomUUID()}});orgs.push(org.id)
 const user=await prisma.user.create({data:{fullName:'Owner',phone:randomUUID(),passwordHash:'not-a-login'}});users.push(user.id)
 const member=await prisma.organizationUser.create({data:{organizationId:org.id,userId:user.id,role:'owner'}})
 const store=await prisma.store.create({data:{organizationId:org.id,name:'Main'}})
 const register=await prisma.register.create({data:{storeId:store.id,name:'Till',code:'1'}})
 const shift=await prisma.shift.create({data:{registerId:register.id,organizationUserId:member.id,openingCash:0}})
 const product=await prisma.product.create({data:{organizationId:org.id,name:'P',sku:'P',barcode:'P',unit:'dona',salePrice:100,costPrice:50}})
 await prisma.inventoryBalance.create({data:{storeId:store.id,productId:product.id,quantity}})
 const session=await prisma.session.create({data:{userId:user.id,organizationId:org.id,tokenHash:randomUUID(),expiresAt:new Date(Date.now()+3600000),idleExpiresAt:new Date(Date.now()+3600000)}})
 const context:TokenPayload={userId:user.id,organizationId:org.id,organizationUserId:member.id,role:'owner',storeIds:[store.id],sessionId:session.id}
 const draft={organizationId:org.id,storeId:store.id,registerId:register.id,shiftId:shift.id,discountAmount:0,items:[{productId:product.id,quantity:1,discountAmount:0}]}
 return {org,user,store,shift,product,context,draft}
}
test('Create/complete retries are exactly one business effect, conflicts reject, stock atomic',async()=>{
 const f=await fixture(1),key=randomUUID()
 const drafts=await Promise.all([createDraft(f.context,f.draft,key),createDraft(f.context,f.draft,key)])
 assert.equal(drafts[0].id,drafts[1].id)
 await assert.rejects(()=>createDraft(f.context,{...f.draft,note:'different'},key),/kaliti/)
 const s=drafts[0],input={payments:[{paymentType:'cash' as const,amount:100}]}
 const completed=await Promise.all([completeSale(f.context,s.id,input,s.id),completeSale(f.context,s.id,input,s.id)])
 assert.equal(completed[0].id,completed[1].id)
 assert.equal(await prisma.payment.count({where:{saleId:s.id}}),1)
 assert.equal(await prisma.inventoryMovement.count({where:{sourceId:s.id}}),1)
 assert.equal((await prisma.inventoryBalance.findUniqueOrThrow({where:{storeId_productId:{storeId:f.store.id,productId:f.product.id}}})).quantity.toString(),'0')
 const another=await createDraft(f.context,f.draft,randomUUID())
 await assert.rejects(()=>completeSale(f.context,another.id,input,another.id),/qoldiq/)
 assert.equal((await prisma.sale.findUniqueOrThrow({where:{id:another.id}})).status,'draft')
 assert.equal(await prisma.payment.count({where:{saleId:another.id}}),0)
})
test('Two tills competing for last unit cannot oversell',async()=>{
 const f=await fixture(1)
 const a=await createDraft(f.context,f.draft,randomUUID()),b=await createDraft(f.context,f.draft,randomUUID())
 const outcome=await Promise.allSettled([completeSale(f.context,a.id,{payments:[{paymentType:'cash',amount:100}]},a.id),completeSale(f.context,b.id,{payments:[{paymentType:'cash',amount:100}]},b.id)])
 assert.equal(outcome.filter(x=>x.status==='fulfilled').length,1)
 assert.equal(await prisma.sale.count({where:{organizationId:f.org.id,status:'completed'}}),1)
})
test('Mixed cash/debt, partial collection, partial/full return conserve balances and replay',async()=>{
 const f=await fixture(5)
 const customer=await prisma.customer.create({data:{organizationId:f.org.id,fullName:'Customer',phone:'test',creditLimit:1000}})
 const draft=await createDraft(f.context,{...f.draft,customerId:customer.id,items:[{productId:f.product.id,quantity:2,discountAmount:0}],discountAmount:20},randomUUID())
 const sale=await completeSale(f.context,draft.id,{payments:[{paymentType:'cash',amount:80},{paymentType:'credit',amount:100}]},draft.id)
 const collection={organizationId:f.org.id,storeId:f.store.id,customerId:customer.id,shiftId:f.shift.id,operationId:randomUUID(),amount:30,paymentType:'cash' as const}
 const payments=await Promise.all([collectDebt(f.context,collection),collectDebt(f.context,collection)])
 assert.equal(payments[0].id,payments[1].id)
 const firstInput={operationId:randomUUID(),shiftId:f.shift.id,reason:'Returned',items:[{saleItemId:sale.items[0].id,quantity:1,disposition:'sellable' as const}]}
 const returned=await returnSale(f.context,sale.id,firstInput)
 assert.equal(returned.refundAmount.toString(),'90')
 const replay=await returnSale(f.context,sale.id,firstInput);assert.equal(replay.id,returned.id)
 const second=await returnSale(f.context,sale.id,{...firstInput,operationId:randomUUID()})
 assert.equal(second.refundAmount.toString(),'90')
 const debt=await prisma.debtEntry.aggregate({where:{customerId:customer.id},_sum:{amount:true}})
 assert.equal(debt._sum.amount?.toString(),'0')
 const cash=await prisma.payment.findMany({where:{organizationId:f.org.id,paymentType:'cash'}})
 const net=cash.reduce((sum,x)=>sum.add(x.direction==='in'?x.amount:x.amount.negated()),new (await import('@prisma/client')).Prisma.Decimal(0))
 assert.equal(net.toString(),'0')
 assert.equal((await prisma.inventoryBalance.findUniqueOrThrow({where:{storeId_productId:{storeId:f.store.id,productId:f.product.id}}})).quantity.toString(),'5')
 await assert.rejects(()=>returnSale(f.context,sale.id,{...firstInput,operationId:randomUUID()}))
})

test('Manual ledger requires a scoped open shift and replays once; closed shifts reject payments',async()=>{
 const {recordManualPayment,manualPaymentSchema}=await import('@/server/payments/manual')
 const {cashMovement,closeShift}=await import('@/server/finance/shifts')
 const f=await fixture()
 assert.equal(manualPaymentSchema.safeParse({organizationId:f.org.id,storeId:f.store.id,shiftId:f.shift.id,operationId:randomUUID(),paymentType:'credit',direction:'in',amount:10,note:'Invalid debt'}).success,false)
 const input={organizationId:f.org.id,storeId:f.store.id,shiftId:f.shift.id,operationId:randomUUID(),paymentType:'cash' as const,direction:'in' as const,amount:'12.35',note:'Manual receipt'}
 const records=await Promise.all([recordManualPayment(f.context,input),recordManualPayment(f.context,input)])
 assert.equal(records[0].id,records[1].id)
 const movement={operationId:randomUUID(),movementType:'cash_out' as const,amount:'2.10',reason:'Expense'}
 await cashMovement(f.context,f.shift.id,movement)
 await cashMovement(f.context,f.shift.id,movement)
 const closed=await closeShift(f.context,f.shift.id,{countedCash:'10.25'})
 assert.equal(closed.expectedCash?.toString(),'10.25')
 assert.equal(closed.cashDifference?.toString(),'0')
 assert.equal((await closeShift(f.context,f.shift.id,{countedCash:'10.25'})).id,closed.id)
 await assert.rejects(()=>recordManualPayment(f.context,{...input,operationId:randomUUID()}))
 assert.equal(await prisma.payment.count({where:{shiftId:f.shift.id}}),1)
})

test('Checkout snapshots current weighted cost; completed history does not follow catalog edits',async()=>{
 const f=await fixture()
 const draft=await createDraft(f.context,f.draft,randomUUID())
 await prisma.product.update({where:{id:f.product.id},data:{costPrice:'60.123456'}})
 const sale=await completeSale(f.context,draft.id,{payments:[{paymentType:'cash',amount:100}]},draft.id)
 assert.equal(sale.items[0].unitCost.toString(),'60.123456')
 await prisma.product.update({where:{id:f.product.id},data:{costPrice:80}})
 assert.equal((await prisma.saleItem.findUniqueOrThrow({where:{id:sale.items[0].id}})).unitCost.toString(),'60.123456')
})

test('Purchase weighted cost and partial transfer preserve stock through retry and excess rejection',async()=>{
 const {confirmStockDocument,sendTransfer,receiveTransfer}=await import('@/server/inventory/documents')
 const f=await fixture(10)
 const purchase=await prisma.stockDocument.create({data:{organizationId:f.org.id,storeId:f.store.id,documentType:'purchase',documentNo:randomUUID(),createdBy:f.user.id,items:{create:[{productId:f.product.id,quantity:10,unitCost:70}]}}})
 await confirmStockDocument(f.context,purchase.id)
 await confirmStockDocument(f.context,purchase.id)
 assert.equal((await prisma.product.findUniqueOrThrow({where:{id:f.product.id}})).costPrice.toString(),'60')
 const destination=await prisma.store.create({data:{organizationId:f.org.id,name:'Second'}})
 const transfer=await prisma.stockTransfer.create({data:{organizationId:f.org.id,fromStoreId:f.store.id,toStoreId:destination.id,createdBy:f.user.id,items:{create:[{productId:f.product.id,quantity:4,unitCost:60}]}},include:{items:true}})
 await sendTransfer(f.context,transfer.id)
 await sendTransfer(f.context,transfer.id)
 const partial={operationId:randomUUID(),items:[{itemId:transfer.items[0].id,quantity:1}]}
 assert.equal((await receiveTransfer(f.context,transfer.id,partial)).status,'sent')
 await receiveTransfer(f.context,transfer.id,partial)
 await assert.rejects(()=>receiveTransfer(f.context,transfer.id,{operationId:randomUUID(),items:[{itemId:transfer.items[0].id,quantity:4}]}))
 assert.equal((await receiveTransfer(f.context,transfer.id,{})).status,'received')
 await receiveTransfer(f.context,transfer.id,{})
 const balances=await prisma.inventoryBalance.findMany({where:{productId:f.product.id}})
 assert.equal(balances.find(x=>x.storeId===f.store.id)?.quantity.toString(),'16')
 assert.equal(balances.find(x=>x.storeId===destination.id)?.quantity.toString(),'4')
 assert.equal(await prisma.inventoryMovement.count({where:{sourceId:transfer.id}}),1)
})

test('Revoked sessions cannot create economic effects even with a previously verified context',async()=>{
 const f=await fixture()
 await prisma.session.update({where:{id:f.context.sessionId},data:{revokedAt:new Date()}})
 await assert.rejects(()=>createDraft(f.context,f.draft,randomUUID()),/Sessiya/)
 assert.equal(await prisma.sale.count({where:{organizationId:f.org.id}}),0)
})

test('DB rejects return items linked to a different sale and debt linked to a different customer',async()=>{
 const f=await fixture()
 const customer=await prisma.customer.create({data:{organizationId:f.org.id,fullName:'A',creditLimit:1000}})
 const other=await prisma.customer.create({data:{organizationId:f.org.id,fullName:'B',creditLimit:1000}})
 const first=await createDraft(f.context,{...f.draft,customerId:customer.id},randomUUID())
 const second=await createDraft(f.context,f.draft,randomUUID())
 const ret=await prisma.saleReturn.create({data:{saleId:second.id,returnReceiptNo:randomUUID(),refundAmount:0,reason:'Constraint test',processedBy:f.user.id}})
 await assert.rejects(()=>prisma.saleReturnItem.create({data:{saleReturnId:ret.id,saleItemId:first.items[0].id,productId:f.product.id,quantity:1,unitPrice:100,lineTotal:100,disposition:'sellable'}}))
 await assert.rejects(()=>prisma.debtEntry.create({data:{organizationId:f.org.id,customerId:other.id,saleId:first.id,sourceType:'test',sourceId:randomUUID(),amount:100}}))
 assert.equal(await prisma.saleReturnItem.count({where:{saleReturnId:ret.id}}),0)
 assert.equal(await prisma.debtEntry.count({where:{organizationId:f.org.id}}),0)
})
