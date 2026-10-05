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
 const context:TokenPayload={userId:user.id,organizationId:org.id,organizationUserId:member.id,role:'owner',storeIds:[store.id],sessionId:'test'}
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
