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
import {readReplayableProductHistory} from '@/server/inventory/valuation-sources'
import {planReceiptCostCorrection} from '@/server/inventory/cost-replay'
import {createDraft,completeSale} from '@/server/sales/service'
import {returnSale} from '@/server/returns/service'
import {previewReceiptCostCorrection} from '@/server/purchases/receipt-cost-correction-preview'
import {changePrices} from '@/server/catalog/prices'
import {readManualCostApproval} from '@/server/inventory/manual-cost-approval'
import {readProductValuationFacts} from '@/server/inventory/valuation-facts'
import {planValuationFactCorrection} from '@/server/inventory/valuation-replay'
import {sendTransfer,receiveTransfer,confirmStockDocument,reverseStockDocument} from '@/server/inventory/documents'
import {creditSupplierInvoice} from '@/server/purchases/credits'
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
 const fresh=await fixture()
 await assert.rejects(prisma.inventoryValuationSequence.create({data:{productId:fresh.product.id,organizationId:fresh.org.id,legacyMovementCount:BigInt(0),baselineQuantity:'0',baselineUnitCost:'0'}}))
})

test('actual two receipts, branch sales and linked return replay into separate stock and COGS corrections without writes',async()=>{
 const f=await fixture(),supplier=await prisma.supplier.create({data:{organizationId:f.org.id,name:'Replay supplier'}})
 const receive=async(quantity:string,unitCost:string)=>{
  const order=await createPurchaseOrder(f.context,{operationId:randomUUID(),storeId:f.store.id,supplierId:supplier.id,referenceNo:randomUUID(),reason:'Authoritative ordered receipt',items:[{productId:f.product.id,quantity,unitCost}]})
  return receivePurchaseOrder(f.context,order.id,{operationId:randomUUID(),referenceNo:randomUUID(),reason:'Authoritative receipt',items:[{orderItemId:order.items[0].id,quantity}]})
 }
 const register=await prisma.register.create({data:{storeId:f.store.id,name:'Replay register',code:randomUUID()}})
 const shift=await prisma.shift.create({data:{registerId:register.id,organizationUserId:f.context.organizationUserId,openingCash:0}})
 const sell=async(quantity:string)=>{
  const draft=await createDraft(f.context,{organizationId:f.org.id,storeId:f.store.id,registerId:register.id,shiftId:shift.id,items:[{productId:f.product.id,quantity,discountAmount:0}],discountAmount:0},randomUUID())
  return completeSale(f.context,draft.id,{payments:[{paymentType:'cash',amount:String(draft.totalAmount)}]},draft.id)
 }
 const receipt=await receive('10','10'),sale=await sell('4');await receive('6','20');await sell('6')
 const returned=await returnSale(f.context,sale.id,{operationId:randomUUID(),shiftId:shift.id,reason:'Original linked return',items:[{saleItemId:sale.items[0].id,quantity:'1',disposition:'sellable'}]})
 const count=await prisma.inventoryValuationEvent.count({where:{productId:f.product.id}})
 const rich=await prisma.$transaction(tx=>readProductValuationFacts(tx,f.context,f.product.id))
 const receiptFact=rich.links.find(row=>row.sourceType==='stock_document'&&row.sourceId===receipt.stockDocument.id)!
 const richCorrection=planValuationFactCorrection(rich.facts,rich.baselineUnitCost,receiptFact.eventId,'20',rich.dispositions)
 assert.equal(richCorrection.cogsCorrection,'12');assert.equal(richCorrection.inventoryCorrection,'7.999999');assert.equal(richCorrection.varianceCorrection,'0')
 const history=await prisma.$transaction(tx=>readReplayableProductHistory(tx,f.context,f.product.id),{isolationLevel:'RepeatableRead'})
 assert.equal(history.events.length,5);assert.equal(history.replay.cogsValue,'120');assert.equal(history.replay.averageCost,'14.285714')
 const target=history.links.find(row=>row.sourceId===receipt.stockDocument.id)!
 const plan=planReceiptCostCorrection(history.events,target.eventId,'20')
 assert.equal(plan.inventoryCorrection,'7.999999');assert.equal(plan.cogsCorrection,'12');assert.equal(plan.roundingCorrection,'0.000001')
 const returnLink=history.links.find(row=>row.sourceId===returned.id)!
 assert.equal(returnLink.itemId,returned.items[0].id);assert.equal(plan.cogsEntries.find(row=>row.eventId===returnLink.eventId)?.amount,'-2')
 assert.equal(await prisma.inventoryValuationEvent.count({where:{productId:f.product.id}}),count)
 assert.equal((await prisma.saleItem.findUniqueOrThrow({where:{id:sale.items[0].id}})).unitCost.toFixed(),'10')
 assert.equal((await prisma.stockDocumentItem.findUniqueOrThrow({where:{id:target.itemId}})).unitCost.toFixed(),'10')
 const preview=await previewReceiptCostCorrection(f.context,receipt.stockDocument.id,{amount:'20',method:'value'})
 assert.equal(preview.previewOnly,true);assert.equal(preview.financialPosting,false);assert.equal(preview.products.length,1)
 assert.equal(preview.products[0].cogsCorrection,'12');assert.equal(preview.products[0].inventoryCorrection,'7.999999')
 assert.equal(preview.products[0].lastSequence,history.lastSequence)
 assert.deepEqual(preview.products[0].cogsEntries.map(row=>row.itemId),history.links.filter(row=>row.sourceType==='sale'||row.sourceType==='return').map(row=>row.itemId))
 assert.equal(await prisma.inventoryValuationEvent.count({where:{productId:f.product.id}}),count)
 await assert.rejects(previewReceiptCostCorrection({...f.context,role:'admin'},receipt.stockDocument.id,{amount:'20',method:'value'}),{code:'OWNER_REQUIRED'})
 const foreign=await fixture()
 await assert.rejects(previewReceiptCostCorrection(foreign.context,receipt.stockDocument.id,{amount:'20',method:'value'}),{code:'NOT_FOUND'})
 await assert.rejects(previewReceiptCostCorrection(f.context,receipt.stockDocument.id,{amount:'0',method:'value'}))
 // A real manual cost override remains recorded, but cannot masquerade as a receipt.
 await prisma.product.update({where:{id:f.product.id},data:{costPrice:'99'}})
 await assert.rejects(prisma.$transaction(tx=>readReplayableProductHistory(tx,f.context,f.product.id)),{code:'COST_SOURCE_RECONCILIATION_REQUIRED'})
})
test('native capture alone cannot authorize an invented source or an unimplemented adjustment adapter',async()=>{
 for(const sourceType of ['stock_document','adjustment']){
  const f=await fixture()
  await runOperation(f.context,'stock.valuation.fixture',randomUUID(),{sourceType},async tx=>{
   await moveStock(tx,f.context,{storeId:f.store.id,productId:f.product.id,delta:'1',unitCost:'3',sourceType,sourceId:randomUUID()});return {ok:true}
  })
  await assert.rejects(prisma.$transaction(tx=>readReplayableProductHistory(tx,f.context,f.product.id)),{code:sourceType==='stock_document'?'COST_SOURCE_RECONCILIATION_REQUIRED':'COST_SOURCE_UNSUPPORTED'})
 }
})
test('organization-wide baseline preserves exact sum beyond one branch decimal capacity without breaking original cost update',async()=>{
 const f=await fixture()
 for(const store of [f.store,f.other])await prisma.inventoryBalance.create({data:{storeId:store.id,productId:f.product.id,quantity:'99999999999999.999999'}})
 await prisma.product.update({where:{id:f.product.id},data:{costPrice:'7'}})
 const state=await prisma.inventoryValuationSequence.findUniqueOrThrow({where:{productId:f.product.id}})
 assert.equal(state.baselineQuantity?.toFixed(),'199999999999999.999998')
 assert.equal(state.baselineUnitCost?.toFixed(),'3');assert.equal(state.lastSequence.toString(),'1')
 await assert.rejects(prisma.$transaction(tx=>readReplayableProductHistory(tx,f.context,f.product.id)),{code:'COST_HISTORY_INCOMPLETE'})
 assert.equal((await prisma.inventoryBalance.aggregate({where:{productId:f.product.id},_sum:{quantity:true}}))._sum.quantity?.toFixed(),'199999999999999.999998')
})

test('future manual owner cost approval binds the exact native event; replay adds no reference and raw changes remain unproven',async()=>{
 const f=await fixture(),input={operationId:randomUUID(),field:'costPrice' as const,reason:'Approved absolute cost revalue',items:[{productId:f.product.id,expected:'3',value:'4'}]}
 const preview=await changePrices(f.context,{...input,preview:true})
 const confirmed={...input,preview:false,confirmationHash:preview.confirmationHash}
 await changePrices(f.context,confirmed);await changePrices(f.context,confirmed)
 const first=await prisma.inventoryValuationEvent.findFirstOrThrow({where:{productId:f.product.id,kind:'cost_change'}})
 const event={id:first.id,productId:first.productId,beforeUnitCost:first.beforeUnitCost!.toFixed(),afterUnitCost:first.afterUnitCost!.toFixed()}
 const approved=await prisma.$transaction(tx=>readManualCostApproval(tx,f.context,event))
 assert.equal(approved.actorId,f.context.userId);assert.equal(approved.beforeUnitCost,'3.000000');assert.equal(approved.afterUnitCost,'4.000000')
 assert.equal(await prisma.auditLog.count({where:{organizationId:f.org.id,action:'prices_changed'}}),1)
 assert.equal(await prisma.inventoryValuationEvent.count({where:{productId:f.product.id}}),1)
 const facts=await prisma.$transaction(tx=>readProductValuationFacts(tx,f.context,f.product.id))
 assert.equal(facts.facts.length,1);assert.equal(facts.facts[0].kind,'revalue');assert.equal(facts.replay.averageCost,'4.000000')
 await prisma.product.update({where:{id:f.product.id},data:{costPrice:'5'}})
 const second=await prisma.inventoryValuationEvent.findFirstOrThrow({where:{productId:f.product.id,afterUnitCost:'5'}})
 await assert.rejects(prisma.$transaction(tx=>readManualCostApproval(tx,f.context,{id:second.id,productId:second.productId,beforeUnitCost:'4',afterUnitCost:'5'})),{code:'COST_MANUAL_APPROVAL_UNPROVEN'})
 const foreign=await fixture();await assert.rejects(prisma.$transaction(tx=>readManualCostApproval(tx,foreign.context,event)),{code:'COST_MANUAL_APPROVAL_UNPROVEN'})
 await assert.rejects(prisma.$transaction(tx=>readManualCostApproval(tx,f.context,{...event,beforeUnitCost:'2'})),{code:'COST_MANUAL_APPROVAL_UNPROVEN'})
})

test('real branch transit, damage, nonstock return, approved override, adjustment and supplier withdrawal replay from original sources',async()=>{
 const f=await fixture(),supplier=await prisma.supplier.create({data:{organizationId:f.org.id,name:'Actual movement adapter supplier'}})
 const receive=async(storeId:string,quantity:string,unitCost:string)=>{
  const order=await createPurchaseOrder(f.context,{operationId:randomUUID(),storeId,supplierId:supplier.id,referenceNo:randomUUID(),reason:'Actual purchase source',items:[{productId:f.product.id,quantity,unitCost}]})
  return receivePurchaseOrder(f.context,order.id,{operationId:randomUUID(),referenceNo:randomUUID(),reason:'Actual ordered receipt',items:[{orderItemId:order.items[0].id,quantity}]})
 }
 const receipt=await receive(f.store.id,'10','2')
 const transfer=await prisma.stockTransfer.create({data:{organizationId:f.org.id,fromStoreId:f.store.id,toStoreId:f.other.id,createdBy:f.user.id,items:{create:{productId:f.product.id,quantity:4,unitCost:2}}},include:{items:true}})
 await sendTransfer(f.context,transfer.id);await receive(f.other.id,'6','4')
 const register=await prisma.register.create({data:{storeId:f.other.id,name:'Actual adapter register',code:randomUUID()}}),shift=await prisma.shift.create({data:{registerId:register.id,organizationUserId:f.context.organizationUserId,openingCash:0}})
 const draft=await createDraft(f.context,{organizationId:f.org.id,storeId:f.other.id,registerId:register.id,shiftId:shift.id,discountAmount:0,items:[{productId:f.product.id,quantity:3,discountAmount:0}]},randomUUID())
 const sale=await completeSale(f.context,draft.id,{payments:[{paymentType:'cash',amount:String(draft.totalAmount)}]},draft.id)
 await receiveTransfer(f.context,transfer.id,{operationId:randomUUID(),reason:'Two received one damaged one transit',items:[{itemId:transfer.items[0].id,quantity:'2',damagedQuantity:'1'}]})
 const read=()=>prisma.$transaction(tx=>readProductValuationFacts(tx,f.context,f.product.id))
 const first=await read(),origin=first.links.find(row=>row.sourceType==='stock_document'&&row.sourceId===receipt.stockDocument.id)!
 const calculate=(value:typeof first)=>planValuationFactCorrection(value.facts,value.baselineUnitCost,origin.eventId,'10',value.dispositions)
 const correction=calculate(first);assert.equal(correction.inventoryCorrection,'6.5');assert.equal(correction.cogsCorrection,'1.5');assert.equal(correction.varianceCorrection,'2');assert.equal(first.replay.transitValue,'2')
 const endpointPreview=await previewReceiptCostCorrection(f.context,receipt.stockDocument.id,{amount:'10',method:'value'})
 assert.equal(endpointPreview.financialPosting,false);assert.equal(endpointPreview.products[0].varianceCorrection,'2');assert.equal(endpointPreview.products[0].inventoryCorrection,'6.5')
 await returnSale(f.context,sale.id,{operationId:randomUUID(),shiftId:shift.id,reason:'Actual damaged customer return',items:[{saleItemId:sale.items[0].id,quantity:'1',disposition:'write_off'}]})
 const damaged=await read();assert.equal(damaged.dispositions.nonStockReturns.length,1)
 const next=calculate(damaged);assert.equal(next.inventoryCorrection,'6.5');assert.equal(next.cogsCorrection,'1');assert.equal(next.varianceCorrection,'2.5')
 const damagedPreview=await previewReceiptCostCorrection(f.context,receipt.stockDocument.id,{amount:'10',method:'value'})
 assert.equal(damagedPreview.products[0].varianceCorrection,'2.5');assert.equal(damagedPreview.products[0].cogsEntries.filter(row=>row.sourceType==='nonstock_return').length,1)
 const input={operationId:randomUUID(),field:'costPrice' as const,reason:'Approved fixed cost override',items:[{productId:f.product.id,expected:'3',value:'1'}]}
 const preview=await changePrices(f.context,{...input,preview:true});await changePrices(f.context,{...input,preview:false,confirmationHash:preview.confirmationHash})
 const overridden=calculate(await read());assert.equal(overridden.inventoryCorrection,'1');assert.equal(overridden.cogsCorrection,'1');assert.equal(overridden.varianceCorrection,'8')
 const adjustment=await prisma.stockDocument.create({data:{organizationId:f.org.id,storeId:f.store.id,documentType:'adjustment',documentNo:randomUUID(),createdBy:f.user.id,note:'Actual shrinkage adjustment',items:{create:{productId:f.product.id,quantity:'-1',unitCost:'1'}}}})
 await confirmStockDocument(f.context,adjustment.id)
 assert.equal((await read()).replay.physicalQuantity,'10')
 const invoice=await prisma.supplierInvoice.findUniqueOrThrow({where:{stockDocumentId:receipt.stockDocument.id}})
 await creditSupplierInvoice(f.context,invoice.id,{operationId:randomUUID(),kind:'goods_return',reason:'Actual original supplier withdrawal',expectedAmount:'2',expectedInvoiceNet:'20',items:[{stockDocumentItemId:receipt.stockDocument.items[0].id,quantity:'1'}]})
 const withdrawn=await read();assert.equal(withdrawn.replay.physicalQuantity,'9');assert.equal(withdrawn.replay.averageCost,'0.888889');assert.equal(withdrawn.facts.at(-1)!.kind,'supplier_return')
 assert.equal(calculate(withdrawn).inventoryCorrection,'1')
 const before=await prisma.inventoryValuationEvent.count({where:{productId:f.product.id}});await read();assert.equal(await prisma.inventoryValuationEvent.count({where:{productId:f.product.id}}),before)
})

test('real receipt reversal has source proof and no imaginary terminal stock',async()=>{
 const f=await fixture()
 const receipt=await prisma.stockDocument.create({data:{organizationId:f.org.id,storeId:f.store.id,documentType:'purchase',documentNo:randomUUID(),createdBy:f.user.id,items:{create:{productId:f.product.id,quantity:'4',unitCost:'3'}}}})
 await confirmStockDocument(f.context,receipt.id);await reverseStockDocument(f.context,receipt.id,{operationId:randomUUID(),reason:'Actual full receipt reversal'})
 const history=await prisma.$transaction(tx=>readProductValuationFacts(tx,f.context,f.product.id))
 assert.deepEqual(history.facts.map(fact=>fact.kind),['receipt','receipt_reversal'])
 const result=planValuationFactCorrection(history.facts,history.baselineUnitCost,history.facts[0].id,'5',history.dispositions)
 assert.equal(result.inventoryCorrection,'0');assert.equal(result.cogsCorrection,'0');assert.equal(result.varianceCorrection,'5')
})
