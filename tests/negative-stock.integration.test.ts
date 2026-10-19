import {test,after} from 'node:test'
import assert from 'node:assert/strict'
import {randomUUID,randomBytes} from 'node:crypto'
import {NextRequest} from 'next/server'
import {sessionHash} from '@/server/auth/session'
import {prisma} from '@/lib/prisma'
import type {TokenPayload} from '@/lib/auth'
import {moveStock} from '@/server/inventory/movements'
import {createDraft,completeSale} from '@/server/sales/service'
const connection=new URL(process.env.DATABASE_URL??'')
if(connection.hostname!=='127.0.0.1'||connection.port!=='55439'||connection.pathname!=='/pos_test'||connection.username!=='pos_test')throw Error('Isolated test DB only')
const orgs:string[]=[],users:string[]=[]
after(async()=>{await prisma.organization.deleteMany({where:{id:{in:orgs}}});await prisma.user.deleteMany({where:{id:{in:users}}});await prisma.$disconnect()})
async function fixture(){
 const org=await prisma.organization.create({data:{name:'Valuation order',phone:randomUUID()}});orgs.push(org.id)
 const user=await prisma.user.create({data:{fullName:'Valuation owner',phone:randomUUID(),passwordHash:'not-a-login'}});users.push(user.id)
 const member=await prisma.organizationUser.create({data:{organizationId:org.id,userId:user.id,role:'owner'}})
 const store=await prisma.store.create({data:{organizationId:org.id,name:'Main'}}),other=await prisma.store.create({data:{organizationId:org.id,name:'Other'}})
 const product=await prisma.product.create({data:{organizationId:org.id,name:'Valuation product',sku:randomUUID(),barcode:randomUUID(),unit:'dona',salePrice:'10',costPrice:'3'}})
 const session=await prisma.session.create({data:{userId:user.id,organizationId:org.id,tokenHash:randomUUID(),expiresAt:new Date(Date.now()+3600000),idleExpiresAt:new Date(Date.now()+3600000)}})
 const context:TokenPayload={userId:user.id,organizationId:org.id,organizationUserId:member.id,role:'owner',storeIds:[store.id,other.id],sessionId:session.id}
 return {org,user,product,store,other,context}
}
test('negative policy cannot be enabled, forged override cannot overdraw and competing sales conserve stock',async()=>{
 const f=await fixture()
 await assert.rejects(prisma.organization.update({where:{id:f.org.id},data:{allowNegativeStock:true}}))
 await assert.rejects(prisma.inventoryBalance.create({data:{storeId:f.store.id,productId:f.product.id,quantity:'-1'}}))
 await prisma.$transaction(tx=>moveStock(tx,f.context,{storeId:f.store.id,productId:f.product.id,delta:'1',unitCost:'3',sourceType:'test',sourceId:randomUUID()}))
 await assert.rejects(prisma.$transaction(tx=>moveStock(tx,f.context,{storeId:f.store.id,productId:f.product.id,delta:'-2',unitCost:'3',sourceType:'test',sourceId:randomUUID(),allowNegative:true})),{code:'INSUFFICIENT_STOCK'})
 await assert.rejects(prisma.inventoryBalance.update({where:{storeId_productId:{storeId:f.store.id,productId:f.product.id}},data:{quantity:'-1'}}))
 const register=await prisma.register.create({data:{storeId:f.store.id,name:'Policy register',code:randomUUID()}})
 const shift=await prisma.shift.create({data:{registerId:register.id,organizationUserId:f.context.organizationUserId,openingCash:0}})
 const drafts=await Promise.all([1,2].map(()=>createDraft(f.context,{organizationId:f.org.id,storeId:f.store.id,registerId:register.id,shiftId:shift.id,items:[{productId:f.product.id,quantity:'1',discountAmount:0}],discountAmount:0},randomUUID())))
 const outcomes=await Promise.allSettled(drafts.map(draft=>completeSale(f.context,draft.id,{payments:[{paymentType:'cash',amount:String(draft.totalAmount)}]},draft.id)))
 assert.equal(outcomes.filter(result=>result.status==='fulfilled').length,1)
 const winner=outcomes.findIndex(result=>result.status==='fulfilled'),sale=drafts[winner]
 await completeSale(f.context,sale.id,{payments:[{paymentType:'cash',amount:String(sale.totalAmount)}]},sale.id)
 assert.equal((await prisma.inventoryBalance.findUniqueOrThrow({where:{storeId_productId:{storeId:f.store.id,productId:f.product.id}}})).quantity.toFixed(),'0')
 assert.equal(await prisma.payment.count({where:{sale:{organizationId:f.org.id}}}),1)
 assert.equal(await prisma.inventoryMovement.count({where:{organizationId:f.org.id,sourceType:'sale'}}),1)
 assert.equal(await prisma.sale.count({where:{organizationId:f.org.id,status:'completed'}}),1)
})

test('legacy negative balance can recover but cannot deepen or move to another branch',async()=>{
 const f=await fixture()
 // Simulate a pre-policy row only inside an exclusive, rolled-back pos_test transaction.
 const sentinel=new Error('rollback synthetic legacy fixture')
 await assert.rejects(prisma.$transaction(async tx=>{
  await tx.$executeRawUnsafe('ALTER TABLE "InventoryBalance" DISABLE TRIGGER "InventoryBalance_negative_disabled"')
  await tx.inventoryBalance.create({data:{storeId:f.store.id,productId:f.product.id,quantity:'-3'}})
  await tx.$executeRawUnsafe('SET CONSTRAINTS ALL IMMEDIATE')
  await tx.$executeRawUnsafe('ALTER TABLE "InventoryBalance" ENABLE TRIGGER "InventoryBalance_negative_disabled"')
  await tx.inventoryBalance.update({where:{storeId_productId:{storeId:f.store.id,productId:f.product.id}},data:{quantity:'-2'}})
  assert.equal((await tx.inventoryBalance.findUniqueOrThrow({where:{storeId_productId:{storeId:f.store.id,productId:f.product.id}}})).quantity.toFixed(),'-2')
  await tx.$executeRawUnsafe('SAVEPOINT reject_deepening')
  await assert.rejects(tx.inventoryBalance.update({where:{storeId_productId:{storeId:f.store.id,productId:f.product.id}},data:{quantity:'-4'}}))
  await tx.$executeRawUnsafe('ROLLBACK TO SAVEPOINT reject_deepening')
  await tx.$executeRawUnsafe('SAVEPOINT reject_rekey')
  await assert.rejects(tx.inventoryBalance.update({where:{storeId_productId:{storeId:f.store.id,productId:f.product.id}},data:{storeId:f.other.id}}))
  await tx.$executeRawUnsafe('ROLLBACK TO SAVEPOINT reject_rekey')
  await tx.inventoryBalance.update({where:{storeId_productId:{storeId:f.store.id,productId:f.product.id}},data:{quantity:'0'}})
  throw sentinel
 }),error=>error===sentinel)
 assert.equal(await prisma.inventoryBalance.count({where:{productId:f.product.id}}),0)
})

test('owner HTTP create and update reject enabling, ordinary settings remain editable',async()=>{
 const f=await fixture(),token=randomBytes(32).toString('base64url')
 await prisma.session.update({where:{id:f.context.sessionId},data:{tokenHash:sessionHash(token)}})
 const {PUT}=await import('@/app/api/organizations/[id]/route')
 const {POST}=await import('@/app/api/organizations/route')
 const req=(path:string,method:string,body:unknown)=>new NextRequest('http://localhost:3000'+path,{method,headers:{cookie:'pos_session='+token,origin:'http://localhost:3000','content-type':'application/json'},body:JSON.stringify(body)})
 assert.equal((await PUT(req('/api/organizations/'+f.org.id,'PUT',{allowNegativeStock:true}),{params:Promise.resolve({id:f.org.id})})).status,400)
 assert.equal((await POST(req('/api/organizations','POST',{name:'Rejected negative organization',phone:'998901234567',allowNegativeStock:true}),undefined)).status,400)
 assert.equal((await PUT(req('/api/organizations/'+f.org.id,'PUT',{name:'Policy settings updated',allowNegativeStock:false}),{params:Promise.resolve({id:f.org.id})})).status,200)
 assert.equal((await prisma.organization.findUniqueOrThrow({where:{id:f.org.id}})).allowNegativeStock,false)
})
