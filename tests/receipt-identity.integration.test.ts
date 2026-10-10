import { test, after } from 'node:test'
import assert from 'node:assert/strict'
import { randomBytes, randomUUID } from 'node:crypto'
import { prisma } from '@/lib/prisma'
import { sessionHash, verifySession } from '@/server/auth/session'
import { createDraft, completeSale } from '@/server/sales/service'

const connection=new URL(process.env.DATABASE_URL??'')
if(connection.hostname!=='127.0.0.1'||connection.port!=='55439'||connection.pathname!=='/pos_test'||connection.username!=='pos_test')throw new Error('Isolated receipt test database required')
const orgs:string[]=[],users:string[]=[]
after(async()=>{await prisma.organization.deleteMany({where:{id:{in:orgs}}});await prisma.user.deleteMany({where:{id:{in:users}}});await prisma.$disconnect()})
async function fixture(){
 const org=await prisma.organization.create({data:{name:'Original business',phone:randomUUID(),receiptFooter:'Original footer',timezone:'Asia/Tashkent'}});orgs.push(org.id)
 const user=await prisma.user.create({data:{fullName:'Original cashier',phone:randomUUID(),passwordHash:'not-a-login'}});users.push(user.id)
 const member=await prisma.organizationUser.create({data:{organizationId:org.id,userId:user.id,role:'owner'}})
 const store=await prisma.store.create({data:{organizationId:org.id,name:'Original branch',address:'Original address'}})
 const register=await prisma.register.create({data:{storeId:store.id,name:'Original till',code:'O1'}})
 const shift=await prisma.shift.create({data:{registerId:register.id,organizationUserId:member.id,openingCash:0}})
 const product=await prisma.product.create({data:{organizationId:org.id,name:'Snapshot item',sku:randomUUID(),barcode:randomUUID(),unit:'dona',salePrice:'23.50',costPrice:'1.00'}})
 await prisma.inventoryBalance.create({data:{storeId:store.id,productId:product.id,quantity:3}})
 const token=randomBytes(32).toString('base64url');await prisma.session.create({data:{organizationId:org.id,userId:user.id,tokenHash:sessionHash(token),expiresAt:new Date(Date.now()+3600000),idleExpiresAt:new Date(Date.now()+3600000)}})
 const ctx=(await verifySession(token))!;
 const draft=await createDraft(ctx,{organizationId:org.id,storeId:store.id,registerId:register.id,shiftId:shift.id,discountAmount:0,items:[{productId:product.id,quantity:1,discountAmount:0}]},randomUUID())
 return {org,user,store,register,product,ctx,draft}
}
test('Receipt identity is derived at atomic completion, survives later identity changes, replay and direct-write attacks',async()=>{
 const f=await fixture();assert.equal(f.draft.receiptSnapshot,null)
 await prisma.sale.update({where:{id:f.draft.id},data:{receiptSnapshot:{organizationName:'Forged identity'}}})
 assert.equal((await prisma.sale.findUniqueOrThrow({where:{id:f.draft.id}})).receiptSnapshot,null)
 const key=randomUUID(),payment={payments:[{paymentType:'cash' as const,amount:'23.50'}]}
 const result=await completeSale(f.ctx,f.draft.id,payment,key)
 const snapshot=result.receiptSnapshot as Record<string,unknown>
 assert.equal(snapshot.version,1);assert.equal(snapshot.organizationName,'Original business');assert.equal(snapshot.cashierName,'Original cashier');assert.equal(snapshot.storeName,'Original branch');assert.equal(snapshot.receiptFooter,'Original footer');assert.equal(snapshot.currencyCode,'UZS');assert.ok(Number.isFinite(Date.parse(String(snapshot.capturedAt))))
 await prisma.organization.update({where:{id:f.org.id},data:{name:'Changed business',receiptFooter:'Changed footer',timezone:'UTC'}})
 await prisma.store.update({where:{id:f.store.id},data:{name:'Changed branch',address:'Changed address'}})
 await prisma.register.update({where:{id:f.register.id},data:{name:'Changed till'}})
 await prisma.user.update({where:{id:f.user.id},data:{fullName:'Changed cashier'}})
 const original=await prisma.sale.findUniqueOrThrow({where:{id:f.draft.id}})
 assert.deepEqual(original.receiptSnapshot,snapshot)
 const replay=await completeSale(f.ctx,f.draft.id,payment,key);assert.deepEqual(replay.receiptSnapshot,snapshot)
 await assert.rejects(prisma.sale.update({where:{id:f.draft.id},data:{receiptSnapshot:{organizationName:'Forged posted identity'}}}))
 await assert.rejects(prisma.sale.update({where:{id:f.draft.id},data:{receiptSnapshot:undefined,receiptNo:'Forged receipt'}}))
 assert.equal(await prisma.sale.count({where:{organizationId:f.org.id,status:'completed'}}),1)
 assert.equal(await prisma.payment.count({where:{organizationId:f.org.id}}),1)
 assert.equal((await prisma.inventoryBalance.findUniqueOrThrow({where:{storeId_productId:{storeId:f.store.id,productId:f.product.id}}})).quantity.toString(),'2')
})
test('Rolled-back checkout does not retain a snapshot, payment or stock mutation',async()=>{
 const f=await fixture();await assert.rejects(completeSale(f.ctx,f.draft.id,{payments:[{paymentType:'cash',amount:'23.49'}]},randomUUID()))
 const sale=await prisma.sale.findUniqueOrThrow({where:{id:f.draft.id}});assert.equal(sale.status,'draft');assert.equal(sale.receiptSnapshot,null)
 assert.equal(await prisma.payment.count({where:{organizationId:f.org.id}}),0)
 assert.equal((await prisma.inventoryBalance.findUniqueOrThrow({where:{storeId_productId:{storeId:f.store.id,productId:f.product.id}}})).quantity.toString(),'3')
})
