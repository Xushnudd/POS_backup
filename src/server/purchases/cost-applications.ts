import {Prisma} from '@prisma/client'
import {z} from 'zod'
import type {TokenPayload} from '@/lib/auth'
import {prisma} from '@/lib/prisma'
import {AccessError,tenantScope} from '../auth/policy'
import {assertLiveContext,audit,payloadHash,runOperation} from '../operations'
import {readProductValuationFacts} from '../inventory/valuation-facts'
import {planValuationFactCorrection} from '../inventory/valuation-replay'
import {applicationSnapshotSchema,type ApplicationProduct} from './cost-application-contract'
const Exact=Prisma.Decimal.clone({precision:60,rounding:Prisma.Decimal.ROUND_HALF_UP})
export const applyCostSchema=z.object({operationId:z.string().uuid(),expectedHash:z.string().regex(/^[a-f0-9]{64}$/),reason:z.string().trim().min(3).max(2000)}).strict()
function reject():never{throw new AccessError(409,'COST_SOURCE_RECONCILIATION_REQUIRED')}
async function calculate(tx:Prisma.TransactionClient,context:TokenPayload,planId:string,reverseId?:string){
 const plan=await tx.receiptCostPlan.findFirst({where:{id:planId,AND:tenantScope('ReceiptCostPlan',context)},include:{stockDocument:{include:{items:true,reversal:true}},expenseDocument:{include:{reversal:true,category:true}},applications:true}})
 if(!plan)throw new AccessError(404,'NOT_FOUND')
 if(plan.status!=='prepared'||plan.stockDocument.status!=='confirmed'||plan.stockDocument.reversal||plan.expenseDocument.reversal||plan.expenseDocument.category?.treatment!=='capitalised'||!plan.expenseDocument.amount.eq(plan.amount))throw new AccessError(409,'INVALID_STATUS')
 if(plan.stockDocument.items.length>200)throw new AccessError(413,'COST_HISTORY_TOO_LARGE')
 const original=plan.applications.find(row=>row.reversalOfId===null)
 if(reverseId){if(!original||original.id!==reverseId||plan.applications.some(row=>row.reversalOfId===reverseId))throw new AccessError(409,'INVALID_STATUS')}
 else if(original)throw new AccessError(409,'COST_ALREADY_APPLIED')
 const lines=z.object({lines:z.array(z.object({id:z.string().uuid(),allocatedAmount:z.string()}))}).parse(plan.snapshot).lines
 const products:ApplicationProduct[]=[];let count=0
 for(const item of [...plan.stockDocument.items].sort((a,b)=>a.productId.localeCompare(b.productId))){
  const line=lines.find(row=>row.id===item.id);if(!line)reject()
  const offline=await tx.$queryRaw<{id:string}[]>`SELECT i.id FROM "ReservationItem" i JOIN "StockReservation" r ON r.id=i."reservationId" WHERE i."organizationId"=${context.organizationId} AND i."productId"=${item.productId} AND r.kind='cash_ticket' AND r.status='active' AND i."remainingQuantity">0 LIMIT 1`
  if(offline.length)throw new AccessError(409,'UNRESOLVED_OFFLINE_STOCK','Avval offline tovar/pul natijalarini hal qiling')
  const history=await readProductValuationFacts(tx,context,item.productId);count+=history.facts.length;if(count>10000)throw new AccessError(413,'COST_HISTORY_TOO_LARGE')
  const source=history.links.find(row=>row.itemId===item.id&&row.sourceType==='stock_document'&&row.sourceId===plan.stockDocumentId);if(!source)reject()
  const allocated=new Exact(line.allocatedAmount).mul(reverseId?-1:1),change=allocated.eq(0)?{before:history.financialReplay,after:history.financialReplay,inventoryCorrection:'0',cogsCorrection:'0',varianceCorrection:'0',roundingCorrection:'0'}:planValuationFactCorrection(history.financialFacts,history.baselineUnitCost,source.eventId,allocated.toFixed(2),history.financialDispositions)
  if(!new Exact(change.before.averageCost).eq(history.replay.averageCost))throw new AccessError(409,'COST_CONTINUATION_REQUIRED','Amaldagi tannarx va oldingi application qiymatlarini solishtiring')
  const difference=(before:string,after:string)=>new Exact(after).sub(before)
  const entry=(id:string,amount:Prisma.Decimal)=>{const link=history.links.find(row=>row.eventId===id);if(!link||!link.storeId||!['sale','return','nonstock_return'].includes(link.sourceType))reject();return {itemId:link.itemId,sourceId:link.sourceId,sourceType:link.sourceType as 'sale'|'return'|'nonstock_return',storeId:link.storeId,amount:amount.toFixed()}}
  const cogsEntries=[...change.after.rows.flatMap((row,index)=>['sale','return'].includes(row.kind)?[entry(row.id,difference(change.before.rows[index].entryValue,row.entryValue).mul(row.kind==='return'?-1:1))]:[]),...change.after.dispositionRows.flatMap((row,index)=>row.kind==='nonstock_return'?[entry(row.id,difference(change.before.dispositionRows[index].entryValue,row.entryValue).negated())]:[])].filter(row=>!new Exact(row.amount).eq(0))
  if(!cogsEntries.reduce((sum,row)=>sum.add(row.amount),new Exact(0)).eq(change.cogsCorrection))reject()
  const issueCosts=change.after.rows.filter(row=>row.kind==='sale').map(row=>{const link=history.links.find(link=>link.eventId===row.id);if(!link)reject();return {itemId:link.itemId,unitCost:row.averageCost}})
  const transferCosts=change.after.transit.map(row=>({itemId:row.transferItemId,unitCost:row.unitCost}))
  const storeCorrections=change.after.stores.map(row=>({storeId:row.storeId,quantity:row.quantity,amount:difference(change.before.stores.find(store=>store.storeId===row.storeId)?.value??'0',row.value).toFixed()}))
  products.push({productId:item.productId,stockDocumentItemId:item.id,receiptEventId:source.eventId,lastSequence:history.lastSequence,afterSequence:history.lastSequence,costChangeEventId:null,allocatedAmount:allocated.toFixed(2),beforeAverageCost:history.replay.averageCost,afterAverageCost:change.after.averageCost,inventoryCorrection:change.inventoryCorrection,cogsCorrection:change.cogsCorrection,varianceCorrection:change.varianceCorrection,roundingCorrection:change.roundingCorrection,cogsEntries,issueCosts,transferCosts,storeCorrections,transitCorrection:difference(change.before.transitValue,change.after.transitValue).toFixed()})
 }
 const amount=new Exact(plan.amount.toString()).mul(reverseId?-1:1).toFixed(2)
 const state={planId,reverseId:reverseId??null,amount,storeId:plan.storeId,products}
 return {...state,expectedHash:payloadHash(state)}
}
export async function previewCostApplication(context:TokenPayload,planId:string,reverseId?:string){
 if(context.role!=='owner')throw new AccessError(403,'OWNER_REQUIRED')
 return prisma.$transaction(async tx=>{await assertLiveContext(tx,context);return calculate(tx,context,planId,reverseId)},{isolationLevel:'RepeatableRead',timeout:30000})
}
export async function applyReceiptCost(context:TokenPayload,planId:string,input:z.input<typeof applyCostSchema>,reverseId?:string){
 if(context.role!=='owner')throw new AccessError(403,'OWNER_REQUIRED')
 const parsed=applyCostSchema.parse(input)
 return runOperation(context,reverseId?'receipt.cost.reverse':'receipt.cost.apply',parsed.operationId,{planId,reverseId:reverseId??null,...parsed},async tx=>{
  const plan=await tx.receiptCostPlan.findFirst({where:{id:planId,organizationId:context.organizationId}});if(!plan)throw new AccessError(404,'NOT_FOUND')
  await tx.$queryRaw`SELECT id FROM "FinancialDocument" WHERE id=${plan.expenseDocumentId} FOR UPDATE`
  await tx.$queryRaw`SELECT id FROM "StockDocument" WHERE id=${plan.stockDocumentId} FOR UPDATE`
  await tx.$queryRaw`SELECT id FROM "ReceiptCostPlan" WHERE id=${planId} FOR UPDATE`
  await tx.$queryRaw`SELECT p.id FROM "Product" p JOIN "StockDocumentItem" item ON item."productId"=p.id WHERE item."stockDocumentId"=${plan.stockDocumentId} ORDER BY p.id FOR UPDATE OF p`
  const current=await calculate(tx,context,planId,reverseId)
  if(current.expectedHash!==parsed.expectedHash)throw new AccessError(409,'COST_PREVIEW_CHANGED','Manba o‘zgardi; applicationni qayta ko‘rib tasdiqlang')
  const [transaction]=await tx.$queryRaw<{id:bigint;createdAt:Date}[]>`SELECT txid_current() AS id,CURRENT_TIMESTAMP::timestamp(3) AS "createdAt"`
  for(const product of current.products){
   if(product.beforeAverageCost!==product.afterAverageCost){
    await tx.product.update({where:{id:product.productId},data:{costPrice:product.afterAverageCost}})
    const event=await tx.inventoryValuationEvent.findFirstOrThrow({where:{productId:product.productId,transactionId:transaction.id,kind:'cost_change'},orderBy:{sequence:'desc'}})
    product.costChangeEventId=event.id;product.afterSequence=event.sequence.toString()
   }
  }
  const snapshot=applicationSnapshotSchema.parse({version:1,products:current.products})
  if(Buffer.byteLength(JSON.stringify(snapshot))>8388608)throw new AccessError(413,'COST_HISTORY_TOO_LARGE')
  const result=await tx.receiptCostApplication.create({data:{organizationId:context.organizationId,storeId:plan.storeId,planId,actorId:context.userId,sessionId:context.sessionId,transactionId:transaction.id,createdAt:transaction.createdAt,amount:current.amount,snapshot:snapshot as Prisma.InputJsonValue,reason:parsed.reason,reversalOfId:reverseId??null}})
  await audit(tx,context,'ReceiptCostApplication',result.id,reverseId?'cost_reversed':'cost_applied',{planId,amount:current.amount,products:current.products.map(row=>({productId:row.productId,inventoryCorrection:row.inventoryCorrection,cogsCorrection:row.cogsCorrection,varianceCorrection:row.varianceCorrection,roundingCorrection:row.roundingCorrection})),expectedHash:parsed.expectedHash})
  return {id:result.id,planId,amount:current.amount,ordinal:result.ordinal.toString(),createdAt:result.createdAt,financialPosting:true,products:current.products.map(({productId,inventoryCorrection,cogsCorrection,varianceCorrection,roundingCorrection})=>({productId,inventoryCorrection,cogsCorrection,varianceCorrection,roundingCorrection}))}
 })
}
