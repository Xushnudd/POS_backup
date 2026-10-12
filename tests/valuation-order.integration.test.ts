import {test,after} from 'node:test'
import assert from 'node:assert/strict'
import {randomUUID} from 'node:crypto'
import {prisma} from '@/lib/prisma'
import type {TokenPayload} from '@/lib/auth'
import {moveStock} from '@/server/inventory/movements'
import {readProductValuationHistory} from '@/server/inventory/valuation-history'
import {tenantExport} from '@/server/jobs/tenant-export'
import {runOperation} from '@/server/operations'
import {createPurchaseOrder,receivePurchaseOrder} from '@/server/purchases/orders'
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
test('actual receipt captures cost change and movement in one transaction, replay adds no valuation event',async()=>{
 const f=await fixture(),supplier=await prisma.supplier.create({data:{organizationId:f.org.id,name:'Valuation supplier'}})
 const order=await createPurchaseOrder(f.context,{operationId:randomUUID(),storeId:f.store.id,supplierId:supplier.id,referenceNo:randomUUID(),reason:'Ordered receipt test',items:[{productId:f.product.id,quantity:'2',unitCost:'5'}]})
 const input={operationId:randomUUID(),referenceNo:randomUUID(),reason:'Receive actual stock',items:[{orderItemId:order.items[0].id,quantity:'2'}]}
 const received=await receivePurchaseOrder(f.context,order.id,input)
 const events=await prisma.inventoryValuationEvent.findMany({where:{productId:f.product.id},orderBy:{sequence:'asc'}})
 assert.equal(events.length,2);assert.equal(events[0].kind,'cost_change');assert.equal(events[0].beforeUnitCost?.toFixed(),'3');assert.equal(events[0].afterUnitCost?.toFixed(),'5')
 assert.equal(events[1].kind,'movement');assert.equal(events[1].sourceId,received.stockDocument.id);assert.equal(events[1].quantityDelta?.toFixed(),'2');assert.equal(events[1].unitCost?.toFixed(),'5')
 assert.equal(events[0].transactionId,events[1].transactionId);assert.deepEqual(events.map(row=>row.sequence.toString()),['1','2'])
 await receivePurchaseOrder(f.context,order.id,input)
 assert.equal(await prisma.inventoryValuationEvent.count({where:{productId:f.product.id}}),2)
 const sequence=await prisma.inventoryValuationSequence.findUniqueOrThrow({where:{productId:f.product.id}});assert.equal(sequence.legacyMovementCount,BigInt(0));assert.equal(sequence.lastSequence,BigInt(2));assert.equal(sequence.baselineQuantity?.toFixed(),'0');assert.equal(sequence.baselineUnitCost?.toFixed(),'3')
 const history=await prisma.$transaction(tx=>readProductValuationHistory(tx,f.context,f.product.id),{isolationLevel:'RepeatableRead'});assert.equal(history.events.length,2)
 await assert.rejects(prisma.$transaction(tx=>readProductValuationHistory(tx,{...f.context,role:'admin'},f.product.id)),{code:'OWNER_REQUIRED'})
 const archive=JSON.parse((await tenantExport(f.org.id)).data.toString());assert.equal(archive.datasets.InventoryValuationEvent.length,2);assert.equal(typeof archive.datasets.InventoryValuationEvent[0].sequence,'string');assert.equal(archive.datasets.InventoryValuationSequence[0].baselineQuantity,'0')
 await assert.rejects(prisma.inventoryValuationEvent.update({where:{id:events[0].id},data:{afterUnitCost:'99'}}))
 await assert.rejects(prisma.inventoryValuationEvent.delete({where:{id:events[1].id}}))
 await assert.rejects(prisma.inventoryValuationSequence.update({where:{productId:f.product.id},data:{lastSequence:BigInt(0)}}))
 await assert.rejects(prisma.inventoryValuationSequence.update({where:{productId:f.product.id},data:{lastSequence:BigInt(3)}}))
 await assert.rejects(prisma.inventoryValuationEvent.create({data:{organizationId:f.org.id,productId:f.product.id,sequence:BigInt(3),transactionId:BigInt(1),kind:'cost_change',beforeUnitCost:'5',afterUnitCost:'9'}}))
})
test('parallel branches receive unique committed product order, sequence does not use timestamp sorting, rollback adds no event',async()=>{
 const f=await fixture()
 const writes=[f.store,f.other].map(store=>runOperation(f.context,'stock.valuation.fixture',randomUUID(),{storeId:store.id},async tx=>{await moveStock(tx,f.context,{storeId:store.id,productId:f.product.id,delta:'1',unitCost:'3',sourceType:'adjustment',sourceId:randomUUID()});return {ok:true}}))
 await Promise.all(writes)
 const events=await prisma.inventoryValuationEvent.findMany({where:{productId:f.product.id},orderBy:{sequence:'asc'}})
 assert.deepEqual(events.map(row=>row.sequence.toString()),['1','2']);assert.equal(new Set(events.map(row=>row.movementId)).size,2)
 assert.equal((await prisma.inventoryValuationSequence.findUniqueOrThrow({where:{productId:f.product.id}})).lastSequence,BigInt(2))
 await assert.rejects(runOperation(f.context,'stock.valuation.fixture',randomUUID(),{rollback:true},async tx=>{await moveStock(tx,f.context,{storeId:f.store.id,productId:f.product.id,delta:'1',unitCost:'3',sourceType:'adjustment',sourceId:randomUUID()});throw Error('rollback fixture')}))
 assert.equal(await prisma.inventoryValuationEvent.count({where:{productId:f.product.id}}),2)
 assert.equal((await prisma.inventoryBalance.findUniqueOrThrow({where:{storeId_productId:{storeId:f.store.id,productId:f.product.id}}})).quantity.toFixed(),'1')
})

test('legacy unjournaled balance is recorded as an unproven boundary, never silently capitalised',async()=>{
 const f=await fixture();await prisma.inventoryBalance.create({data:{storeId:f.store.id,productId:f.product.id,quantity:'4'}})
 await prisma.product.update({where:{id:f.product.id},data:{costPrice:'7'}})
 const state=await prisma.inventoryValuationSequence.findUniqueOrThrow({where:{productId:f.product.id}})
 assert.equal(state.legacyMovementCount,BigInt(0));assert.equal(state.baselineQuantity?.toFixed(),'4');assert.equal(state.baselineUnitCost?.toFixed(),'3')
 await assert.rejects(prisma.$transaction(tx=>readProductValuationHistory(tx,f.context,f.product.id)),{code:'COST_HISTORY_INCOMPLETE'})
 assert.equal((await prisma.inventoryBalance.findUniqueOrThrow({where:{storeId_productId:{storeId:f.store.id,productId:f.product.id}}})).quantity.toFixed(),'4')
 await assert.rejects(prisma.inventoryValuationSequence.create({data:{productId:(await fixture()).product.id,organizationId:f.org.id,legacyMovementCount:BigInt(0),baselineQuantity:'0',baselineUnitCost:'0'}}))
})
