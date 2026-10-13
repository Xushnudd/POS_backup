import {applicationSnapshotSchema} from '../purchases/cost-application-contract'
import {Prisma} from '@prisma/client'
import {z} from 'zod'
import type {TokenPayload} from '@/lib/auth'
import {AccessError} from '../auth/policy'
import {readProductValuationHistory,AUTOMATIC_COST_PROJECTION} from './valuation-history'
import {readManualCostApproval} from './manual-cost-approval'
import {replayValuationFacts,type ValuationFact} from './valuation-replay'
const equal=(left:string|Prisma.Decimal|null,right:string|Prisma.Decimal|null)=>left!==null&&right!==null&&new Prisma.Decimal(left).eq(right)
function reject():never{throw new AccessError(409,'COST_SOURCE_RECONCILIATION_REQUIRED','Original tannarx manbasi yoki miqdori joriy jurnalga mos emas')}
/** Read-only source adapter for a complete zero-stock native history. It does
 * not apply charges, invent an old ordering or authorize a financial posting. */
export async function readProductValuationFacts(tx:Prisma.TransactionClient,context:TokenPayload,productId:string,capability?:typeof AUTOMATIC_COST_PROJECTION){
 const history=await readProductValuationHistory(tx,context,productId,capability)
 if(history.events.length>10000)throw new AccessError(413,'COST_HISTORY_TOO_LARGE')
 const applications=await tx.receiptCostApplication.findMany({where:{organizationId:context.organizationId,snapshot:{path:['products'],array_contains:[{productId}]}},orderBy:{ordinal:'asc'},take:10001})
 if(applications.length>10000)throw new AccessError(413,'COST_HISTORY_TOO_LARGE')
 const continuations=await tx.receiptCostContinuation.findMany({where:{organizationId:context.organizationId,productId},take:10001})
 if(continuations.length>10000)throw new AccessError(413,'COST_HISTORY_TOO_LARGE')
 const continuationEvents=new Map(continuations.flatMap(row=>{const data=row.snapshot as Prisma.JsonObject;return typeof data.costChangeEventId==='string'?[[data.costChangeEventId,{row,data}] as const]:[]}))
 const applied=applications.map(application=>({application,product:applicationSnapshotSchema.parse(application.snapshot).products.find(row=>row.productId===productId)!}))
 if(applied.some(row=>!row.product))reject()
 const applicationEvents=new Map(applied.filter(row=>row.product.costChangeEventId).map(row=>[row.product.costChangeEventId!,row]))
 const applicationsById=new Map(applied.map(row=>[row.application.id,row]))
 const movements=history.events.filter(row=>row.kind==='movement')
 const ids=(types:string[])=>[...new Set(movements.filter(row=>types.includes(row.sourceType??'')).map(row=>row.sourceId!).filter(Boolean))]
 // Receive/return movements reference the durable operation key, not the
 // transfer document ID. Resolve the immutable acknowledged source explicitly.
 const operationRows=await tx.operation.findMany({where:{organizationId:context.organizationId,type:{in:['transfer.receive','transfer.return']},key:{in:ids(['transfer_in','transfer_return'])}}})
 const operationTransfers=new Map<string,{id:string;items:{productId:string;unitCost:string;issueUnitCostSnapshot?:string|null;receivedQuantity:string;returnedQuantity:string}[]}>()
 const transferDecimal=z.string().regex(/^(?:0|[1-9]\d{0,13})(?:\.\d{1,6})?$/)
 const snapshot=z.object({id:z.string().uuid(),items:z.array(z.object({productId:z.string().uuid(),unitCost:transferDecimal,issueUnitCostSnapshot:transferDecimal.nullish(),receivedQuantity:transferDecimal,returnedQuantity:transferDecimal}))})
 for(const operation of operationRows){const parsed=snapshot.safeParse(operation.result);if(!parsed.success)reject();operationTransfers.set(operation.type+':'+operation.key,parsed.data)}
 const transferIds=[...new Set([...ids(['transfer_out']),...[...operationTransfers.values()].map(row=>row.id)])]
 const [documents,sales,returns,transfers,credits,balances]=await Promise.all([
  tx.stockDocument.findMany({where:{organizationId:context.organizationId,id:{in:ids(['stock_document','stock_reversal'])}},include:{items:{where:{productId}},reversalOf:{include:{items:{where:{productId}}}}}}),
  tx.sale.findMany({where:{organizationId:context.organizationId,id:{in:ids(['sale'])}},include:{items:{where:{productId}}}}),
  tx.saleReturn.findMany({where:{sale:{organizationId:context.organizationId},status:'completed',items:{some:{productId}}},include:{sale:true,items:{where:{productId},include:{saleItem:true,dispositionEntry:true}}}}),
  tx.stockTransfer.findMany({where:{organizationId:context.organizationId,id:{in:transferIds}},include:{items:{where:{productId},include:{dispositions:true}}}}),
  tx.supplierCredit.findMany({where:{id:{in:ids(['supplier_return'])},invoice:{organizationId:context.organizationId}},include:{invoice:true,items:{where:{stockDocumentItem:{productId}},include:{stockDocumentItem:true}}}}),
  tx.inventoryBalance.findMany({where:{productId,store:{organizationId:context.organizationId}}}),
 ])
 const documentById=new Map(documents.map(row=>[row.id,row])),saleById=new Map(sales.map(row=>[row.id,row])),returnById=new Map(returns.map(row=>[row.id,row])),transferById=new Map(transfers.map(row=>[row.id,row])),creditById=new Map(credits.map(row=>[row.id,row]))
 const facts:ValuationFact[]=[],links:{eventId:string;sourceType:string;sourceId:string;itemId:string;storeId:string|null}[]=[]
 const issues=new Map<string,string>(),outgoing=new Set<string>()
 const receivedCumulative=new Map<string,Prisma.Decimal>(),returnedCumulative=new Map<string,Prisma.Decimal>()
 const dispositions:{transferLosses:{id:string;transferItemId:string;quantity:string}[];nonStockReturns:{id:string;issueId:string;storeId:string;quantity:string;recordedUnitCost?:string}[]}={transferLosses:[],nonStockReturns:[]}
 let catalogueCost=history.boundary.baselineUnitCost!,pending:(typeof history.events)[number]|undefined
 for(let index=0;index<history.events.length;index++){
  const row=history.events[index]
  if(row.kind==='cost_change'){
   if(pending||!equal(row.beforeUnitCost,catalogueCost)||row.afterUnitCost===null)reject()
   const continuation=continuationEvents.get(row.id)
   if(continuation){
    if(continuation.row.transactionId.toString()!==row.transactionId||continuation.row.lastSequence.toString()!==row.sequence||!equal(typeof continuation.data.currentAverageCost==='string'?continuation.data.currentAverageCost:null,row.beforeUnitCost)||!equal(typeof continuation.data.financialAverageCost==='string'?continuation.data.financialAverageCost:null,row.afterUnitCost))reject()
    facts.push({sequence:row.sequence,id:row.id,kind:'revalue',unitCost:row.afterUnitCost,applicationId:'continuation:'+continuation.row.id,expectedAverageCost:row.afterUnitCost});catalogueCost=row.afterUnitCost;continue
   }
   const fee=applicationEvents.get(row.id)
   if(fee){
    if(fee.application.transactionId.toString()!==row.transactionId||fee.product.afterSequence!==row.sequence||!equal(fee.product.beforeAverageCost,row.beforeUnitCost)||!equal(fee.product.afterAverageCost,row.afterUnitCost))reject()
    facts.push({sequence:row.sequence,id:row.id,kind:'revalue',unitCost:row.afterUnitCost,applicationId:fee.application.id,expectedAverageCost:row.afterUnitCost});catalogueCost=row.afterUnitCost;continue
   }
   const next=history.events[index+1]
   const derived=next?.kind==='movement'&&next.transactionId===row.transactionId&&['stock_document','stock_reversal','return','supplier_return'].includes(next.sourceType??'')
   if(derived){pending=row;continue}
   const approved=await readManualCostApproval(tx,context,{id:row.id,productId,beforeUnitCost:row.beforeUnitCost,afterUnitCost:row.afterUnitCost})
   facts.push({sequence:row.sequence,id:row.id,kind:'revalue',unitCost:row.afterUnitCost,expectedAverageCost:row.afterUnitCost})
   links.push({eventId:row.id,sourceType:'manual_cost',sourceId:approved.auditId,itemId:productId,storeId:null});catalogueCost=row.afterUnitCost;continue
  }
  if(row.kind!=='movement'||!row.movementId||!row.sourceId||!row.storeId||row.quantityDelta===null||row.unitCost===null)reject()
  const delta=new Prisma.Decimal(row.quantityDelta),common={sequence:row.sequence,id:row.movementId,storeId:row.storeId},sourceType=row.sourceType??''
  let fact:ValuationFact,itemId:string
  if(sourceType==='stock_document'||sourceType==='stock_reversal'){
   const doc=documentById.get(row.sourceId);if(!doc||doc.storeId!==row.storeId||doc.status!=='confirmed'||doc.items.length!==1)reject()
   const item=doc.items[0];if(!equal(item.quantity,delta)||!equal(item.unitCost,row.unitCost))reject();itemId=item.id
   if(sourceType==='stock_reversal'){
    const original=doc.reversalOf;if(!original||original.status!=='confirmed'||original.items.length!==1||original.storeId!==row.storeId||!equal(original.items[0].quantity.negated(),delta)||!equal(original.items[0].unitCost,row.unitCost))reject()
    if(['purchase','opening'].includes(original.documentType)){
     if(!delta.lt(0))reject();fact={...common,kind:'receipt_reversal',quantity:delta.negated().toFixed(),unitCost:row.unitCost}
    }else if(['adjustment','return_in'].includes(original.documentType)){fact={...common,kind:'adjustment',quantityDelta:delta.toFixed()}}
    else reject()
   }else if(['purchase','opening'].includes(doc.documentType)){
    if(!delta.gt(0)||doc.reversalOfId)reject();fact={...common,kind:'receipt',quantity:delta.toFixed(),unitCost:row.unitCost}
   }else if(['adjustment','return_in'].includes(doc.documentType)&&!doc.reversalOfId){fact={...common,kind:'adjustment',quantityDelta:delta.toFixed()}}
   else reject()
  }else if(sourceType==='sale'){
   const sale=saleById.get(row.sourceId);if(!sale||sale.storeId!==row.storeId||sale.items.length!==1||!['completed','partially_returned','returned'].includes(sale.status))reject()
   const item=sale.items[0];if(!delta.lt(0)||!equal(item.quantity,delta.negated())||!equal(item.unitCost,row.unitCost)||!equal(row.unitCost,catalogueCost)||pending||issues.has(item.id))reject()
   itemId=item.id;issues.set(item.id,row.movementId);fact={...common,kind:'sale',quantity:delta.negated().toFixed()}
  }else if(sourceType==='return'){
   const returned=returnById.get(row.sourceId);if(!returned||returned.sale.storeId!==row.storeId||returned.items.length!==1)reject()
   const item=returned.items[0],issueId=issues.get(item.saleItemId)
   if(!issueId||item.saleItem.saleId!==returned.saleId||item.disposition!=='sellable'||!delta.gt(0)||!equal(item.quantity,delta)||!equal(item.unitCostSnapshot??item.saleItem.unitCost,row.unitCost))reject()
   if(item.costApplicationId&&!equal(applicationsById.get(item.costApplicationId)?.product.issueCosts.find(issue=>issue.itemId===item.saleItemId)?.unitCost??null,row.unitCost))reject()
   itemId=item.id;fact={...common,kind:'return',quantity:delta.toFixed(),issueId,...(item.unitCostSnapshot?{recordedUnitCost:item.unitCostSnapshot.toFixed()}:{} )}
  }else if(sourceType==='supplier_return'){
   const credit=creditById.get(row.sourceId);if(!credit||credit.kind!=='goods_return'||credit.invoice.storeId!==row.storeId||credit.items.length!==1)reject()
   const item=credit.items[0];if(!delta.lt(0)||!equal(item.quantity,delta.negated())||item.stockDocumentItem.stockDocumentId!==credit.invoice.stockDocumentId||!equal(item.stockDocumentItem.unitCost,row.unitCost))reject()
   itemId=item.id;fact={...common,kind:'supplier_return',quantity:delta.negated().toFixed(),unitCost:row.unitCost}
  }else if(['transfer_out','transfer_in','transfer_return'].includes(sourceType)){
   const acknowledged=sourceType==='transfer_out'?undefined:operationTransfers.get((sourceType==='transfer_in'?'transfer.receive:':'transfer.return:')+row.sourceId)
   if(sourceType!=='transfer_out'&&!acknowledged)reject()
   const transfer=transferById.get(acknowledged?.id??row.sourceId);if(!transfer||!['sent','received','closed'].includes(transfer.status)||transfer.items.length!==1)reject()
   const item=transfer.items[0];if(!equal(item.issueUnitCostSnapshot??item.unitCost,row.unitCost)||pending)reject();itemId=item.id
   if(sourceType==='transfer_out'){
    if(transfer.fromStoreId!==row.storeId||!delta.lt(0)||!equal(item.quantity,delta.negated())||outgoing.has(item.id))reject()
    outgoing.add(item.id);fact={...common,kind:'transfer_out',quantity:delta.negated().toFixed(),transferItemId:item.id,recordedUnitCost:row.unitCost,originalCatalogueCost:catalogueCost}
   }else{
    if(!delta.gt(0)||!outgoing.has(item.id)||(sourceType==='transfer_in'?transfer.toStoreId:transfer.fromStoreId)!==row.storeId)reject()
    const original=acknowledged!.items.filter(item=>item.productId===productId)
    if(original.length!==1||!equal(original[0].issueUnitCostSnapshot??original[0].unitCost,row.unitCost))reject()
    const cumulative=sourceType==='transfer_in'?original[0].receivedQuantity:original[0].returnedQuantity
    const counters=sourceType==='transfer_in'?receivedCumulative:returnedCumulative,next=(counters.get(item.id)??new Prisma.Decimal(0)).add(delta)
    if(!equal(cumulative,next))reject();counters.set(item.id,next)
    fact={...common,kind:sourceType==='transfer_in'?'transfer_in':'transfer_return',quantity:delta.toFixed(),transferItemId:item.id}
   }
  }else reject()
  if(pending){if(pending.transactionId!==row.transactionId||fact.kind==='sale'||fact.kind.startsWith('transfer')||fact.kind==='adjustment')reject();catalogueCost=pending.afterUnitCost!;pending=undefined}
  fact.expectedAverageCost=catalogueCost;facts.push(fact);links.push({eventId:row.movementId,sourceType,sourceId:row.sourceId,itemId,storeId:row.storeId})
 }
 if(pending||!equal(catalogueCost,history.averageCost))reject()
 for(const transfer of transfers){
  const item=transfer.items[0];if(!item||!outgoing.has(item.id))reject()
  const total=(kind:string)=>movements.filter(row=>row.sourceType===kind&&operationTransfers.get((kind==='transfer_in'?'transfer.receive:':'transfer.return:')+row.sourceId)?.id===transfer.id).reduce((sum,row)=>sum.add(row.quantityDelta??0),new Prisma.Decimal(0))
  if(!equal(total('transfer_in'),item.receivedQuantity)||!equal(total('transfer_return'),item.returnedQuantity))reject()
  const damaged=item.dispositions.filter(row=>row.disposition==='damaged').reduce((sum,row)=>sum.add(row.quantity),new Prisma.Decimal(0)),shortage=item.dispositions.filter(row=>row.disposition==='shortage').reduce((sum,row)=>sum.add(row.quantity),new Prisma.Decimal(0))
  if(!equal(damaged,item.damagedQuantity)||!equal(shortage,item.shortageQuantity))reject()
  for(const entry of item.dispositions){if(!['damaged','shortage'].includes(entry.disposition)||entry.organizationId!==context.organizationId||entry.productId!==productId||entry.storeId!==transfer.toStoreId||!equal(entry.unitCost,item.issueUnitCostSnapshot??item.unitCost))reject();dispositions.transferLosses!.push({id:entry.id,transferItemId:item.id,quantity:entry.quantity.toFixed()})}
 }
 for(const returned of returns)for(const item of returned.items){
  if(item.disposition==='sellable'){
   if(!movements.some(row=>row.sourceType==='return'&&row.sourceId===returned.id))reject();continue
  }
  const issueId=issues.get(item.saleItemId),entry=item.dispositionEntry
  if(!issueId||item.saleItem.saleId!==returned.saleId||!entry||!equal(entry.quantity,item.quantity)||entry.productId!==productId||entry.organizationId!==context.organizationId||entry.storeId!==returned.sale.storeId||entry.disposition!==item.disposition||!equal(entry.unitCost,item.unitCostSnapshot??item.saleItem.unitCost))reject()
  dispositions.nonStockReturns!.push({id:entry.id,issueId,storeId:returned.sale.storeId,quantity:item.quantity.toFixed(),...(item.unitCostSnapshot?{recordedUnitCost:item.unitCostSnapshot.toFixed()}:{} )})
  links.push({eventId:entry.id,sourceType:'nonstock_return',sourceId:returned.id,itemId:item.id,storeId:returned.sale.storeId})
 }
 const replay=replayValuationFacts(facts,history.boundary.baselineUnitCost!,dispositions)
 for(const balance of balances)if(!equal(balance.quantity,replay.stores.find(row=>row.storeId===balance.storeId)?.quantity??'0'))reject()
 for(const store of replay.stores)if(!equal(store.quantity,balances.find(row=>row.storeId===store.storeId)?.quantity??'0'))reject()
 if(!equal(replay.averageCost,history.averageCost))reject()
 const charges=new Map<string,Prisma.Decimal>()
 for(const row of applied)charges.set(row.product.stockDocumentItemId,(charges.get(row.product.stockDocumentItemId)??new Prisma.Decimal(0)).add(row.product.allocatedAmount))
 for(const itemId of charges.keys())if(!links.some(link=>link.itemId===itemId&&facts.some(fact=>fact.id===link.eventId&&fact.kind==='receipt')))reject()
 const financialFacts=facts.filter(fact=>!(fact.kind==='revalue'&&fact.applicationId)).map(fact=>{
  const clean={...fact};delete clean.expectedAverageCost
  if(clean.kind==='return')delete clean.recordedUnitCost
  if(clean.kind==='receipt'){const source=links.find(link=>link.eventId===clean.id),charge=source?charges.get(source.itemId):undefined;if(charge?.lt(0))reject();if(charge?.gt(0))clean.additionalValue=charge.toFixed(2)}
  return clean
 })
 const financialDispositions={...dispositions,nonStockReturns:dispositions.nonStockReturns.map(row=>({id:row.id,issueId:row.issueId,storeId:row.storeId,quantity:row.quantity}))}
 const writeOffs=returns.flatMap(returned=>returned.items.filter(item=>item.disposition==='write_off').map(item=>({dispositionId:item.dispositionEntry!.id,saleItemId:item.saleItemId,quantity:item.quantity.toFixed(),unitCost:(item.unitCostSnapshot??item.saleItem.unitCost).toFixed(),applicationId:item.costApplicationId})))
 const financialReplay=replayValuationFacts(financialFacts,history.boundary.baselineUnitCost!,financialDispositions)
 return {productId,lastSequence:history.boundary.lastSequence,baselineUnitCost:history.boundary.baselineUnitCost!,facts,dispositions,links,replay,financialFacts,financialDispositions,financialReplay,applications:applied,writeOffs}

}
