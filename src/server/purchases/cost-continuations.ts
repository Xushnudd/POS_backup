import {randomUUID} from 'node:crypto'
import {Prisma} from '@prisma/client'
import type {TokenPayload} from '@/lib/auth'
import {AccessError} from '../auth/policy'
import {AUTOMATIC_COST_PROJECTION} from '../inventory/valuation-history'
import {readProductValuationFacts} from '../inventory/valuation-facts'
import {calculateCostContinuations} from './cost-continuation-calculation'
const types=new Set(['stock.confirm','stock.reverse','transfer.send','transfer.receive','transfer.return','supplier.credit','sale.return','catalog.prices','receipt.cost.apply','receipt.cost.reverse','purchase.receive','count.approve','inventory.batch.count'])
/** Internal post-write accounting projection. The original transaction has
 * already authorized its real actor; the capability only permits reading this
 * tenant's cost sources and never returns those records to a retail client. */
export async function postCostContinuations(tx:Prisma.TransactionClient,context:TokenPayload,source:{operationId:string;type:string;key:string}|{auditId:string;productId:string}){
 if('type' in source&&!types.has(source.type))return
 if(!await tx.receiptCostApplication.findFirst({where:{organizationId:context.organizationId},select:{id:true}}))return
 const [transaction]=await tx.$queryRaw<{id:bigint;createdAt:Date}[]>`SELECT txid_current() AS id,CURRENT_TIMESTAMP::timestamp(3) AS "createdAt"`
 const products='auditId' in source?[source.productId]:[...new Set((await tx.inventoryValuationEvent.findMany({where:{organizationId:context.organizationId,transactionId:transaction.id},select:{productId:true}})).map(row=>row.productId))]
 if('key' in source&&source.type==='transfer.receive'){
  const rows=await tx.transferDispositionEntry.findMany({where:{organizationId:context.organizationId,operationId:source.key},select:{productId:true}});for(const row of rows)if(!products.includes(row.productId))products.push(row.productId)
 }
 if('key' in source&&source.type==='sale.return'){
  const operation=await tx.operation.findUniqueOrThrow({where:{id:source.operationId}})
  const result=operation.result as Prisma.JsonObject
  if(typeof result.id==='string'){const rows=await tx.saleReturnItem.findMany({where:{saleReturnId:result.id},select:{productId:true}});for(const row of rows)if(!products.includes(row.productId))products.push(row.productId)}
 }
 if(products.length>1000)throw new AccessError(413,'COST_HISTORY_TOO_LARGE')
 let facts=0,tracked=0
 for(const productId of products.sort()){
  if(!await tx.receiptCostApplication.findFirst({where:{organizationId:context.organizationId,snapshot:{path:['products'],array_contains:[{productId}]}},select:{id:true}}))continue
  if(++tracked>200)throw new AccessError(413,'COST_HISTORY_TOO_LARGE')
  await tx.$queryRaw`SELECT id FROM "Product" WHERE id=${productId} AND "organizationId"=${context.organizationId} FOR UPDATE`
  const history=await readProductValuationFacts(tx,context,productId,AUTOMATIC_COST_PROJECTION)
  facts+=history.facts.length;if(facts>10000)throw new AccessError(413,'COST_HISTORY_TOO_LARGE')
  const previous=await tx.receiptCostContinuation.findMany({where:{organizationId:context.organizationId,productId},take:10001})
  if(previous.length>10000)throw new AccessError(413,'COST_HISTORY_TOO_LARGE')
  const corrections=calculateCostContinuations(history,previous)
  let lastSequence=history.lastSequence,costChangeEventId:string|null=null
  if(!new Prisma.Decimal(history.replay.averageCost).eq(history.financialReplay.averageCost)){
   await tx.product.update({where:{id:productId},data:{costPrice:history.financialReplay.averageCost}})
   const event=await tx.inventoryValuationEvent.findFirstOrThrow({where:{organizationId:context.organizationId,productId,transactionId:transaction.id,kind:'cost_change'},orderBy:{sequence:'desc'}})
   lastSequence=event.sequence.toString();costChangeEventId=event.id
   if(!corrections.length){const original=history.applications.find(row=>row.application.reversalOfId===null)!;corrections.push({planId:original.application.planId,storeId:original.application.storeId,varianceCorrection:'0',roundingCorrection:'0',cogsEntries:[],snapshot:{version:1,applicationId:original.application.id,lastSequence,currentAverageCost:history.replay.averageCost,financialAverageCost:history.financialReplay.averageCost,ownedValue:history.financialReplay.inventoryValue,cogsValue:history.financialReplay.cogsValue,recognizedWriteOffFreight:'0',desiredVariance:'0',desiredRounding:'0'}})}
  }
  for(const [index,correction] of corrections.entries()){
   const snapshot=JSON.stringify({...correction.snapshot,lastSequence,beforeSequence:history.lastSequence,costChangeEventId:index===0?costChangeEventId:null}),entries=JSON.stringify(correction.cogsEntries)
   await tx.$executeRaw`INSERT INTO "ReceiptCostContinuation"(id,"organizationId","storeId","productId","planId","actorId","sessionId","transactionId","lastSequence","sourceOperationId","sourceAuditId","varianceCorrection","roundingCorrection","cogsEntries",snapshot,"createdAt") VALUES(${randomUUID()},${context.organizationId},${correction.storeId},${productId},${correction.planId},${context.userId},${context.sessionId},${transaction.id},${BigInt(lastSequence)},${'operationId' in source?source.operationId:null},${'auditId' in source?source.auditId:null},${new Prisma.Decimal(correction.varianceCorrection)},${new Prisma.Decimal(correction.roundingCorrection)},${entries}::jsonb,${snapshot}::jsonb,${transaction.createdAt})`
  }
 }
}
