import {Prisma} from '@prisma/client'
import {z} from 'zod'
import type {TokenPayload} from '@/lib/auth'
import {prisma} from '@/lib/prisma'
import {AccessError,tenantScope} from '../auth/policy'
import {runOperation,audit,assertLiveContext} from '../operations'
import {decimal} from '../sales/calculations'
import {batchDate,batchExpiryState,inventoryBusinessDate,selectFefo} from './batch-selection'

export const batchInputSchema=z.object({code:z.string().trim().min(1).max(100),receivedOn:batchDate,expiresOn:batchDate}).strict().refine(row=>row.receivedOn<=row.expiresOn,'Kirim kuni yaroqlilikdan keyin bo‘lmasin')
export const batchPolicySchema=z.object({operationId:z.string().uuid(),productId:z.string().uuid(),expiryAlertDays:z.number().int().min(0).max(3650),reason:z.string().trim().min(3).max(2000)}).strict()
export async function enableBatchTracking(context:TokenPayload,input:z.input<typeof batchPolicySchema>){
 if(context.role!=='owner')throw new AccessError(403,'OWNER_REQUIRED')
 const parsed=batchPolicySchema.parse(input)
 return runOperation(context,'inventory.batch.policy',parsed.operationId,parsed,async tx=>{
  await tx.$queryRaw`SELECT id FROM "Product" WHERE id=${parsed.productId} AND "organizationId"=${context.organizationId} FOR UPDATE`
  const product=await tx.product.findFirst({where:{id:parsed.productId,organizationId:context.organizationId}})
  if(!product)throw new AccessError(404,'NOT_FOUND')
  if(product.serialTracking)throw new AccessError(409,'SERIAL_INTEGER_UNIT_REQUIRED')
  if(!product.batchTracking&&(await tx.inventoryMovement.count({where:{productId:product.id}})||await tx.inventoryBalance.count({where:{productId:product.id,quantity:{not:0}}})||await tx.saleItem.count({where:{productId:product.id}})||await tx.stockTransferItem.count({where:{productId:product.id}})))throw new AccessError(409,'BATCH_REQUIRES_UNUSED_PRODUCT','Tarixi bor mahsulot uchun yangi alohida SKU yarating; partiya tarixi taxmin qilinmaydi')
  const result=await tx.product.update({where:{id:product.id},data:{batchTracking:true,expiryAlertDays:parsed.expiryAlertDays}})
  await audit(tx,context,'Product',product.id,'batch_tracking_enabled',{reason:parsed.reason,expiryAlertDays:parsed.expiryAlertDays})
  return {id:result.id,batchTracking:result.batchTracking,expiryAlertDays:result.expiryAlertDays}
 })
}
export async function batchPositions(tx:Prisma.TransactionClient,organizationId:string,storeId:string,productId:string){
 return tx.$queryRaw<{id:string;code:string;receivedOn:string;expiresOn:string;quantity:Prisma.Decimal}[]>`SELECT b.id,b.code,b."receivedOn",b."expiresOn",sum(e."quantityDelta") AS quantity FROM "InventoryBatch" b JOIN "InventoryBatchEntry" e ON e."batchId"=b.id WHERE b."organizationId"=${organizationId} AND b."productId"=${productId} AND e."storeId"=${storeId} GROUP BY b.id HAVING sum(e."quantityDelta")>0 ORDER BY b."expiresOn",b."receivedOn",b.id LIMIT 10001`
}
export const batchSelectionSchema=z.array(z.object({entryId:z.string().uuid(),quantity:z.string().regex(/^(?:0|[1-9]\d{0,13})(?:\.\d{1,6})?$/).refine(value=>decimal(value).gt(0))}).strict()).min(1).max(500)
export type BatchSource={sourceType:string;sourceId:string;storeId:string;selection?:{entryId:string;quantity:string}[]}
/** Only called within the transaction which creates the original stock movement. */
export async function postBatchMovement(tx:Prisma.TransactionClient,context:TokenPayload,movement:Prisma.InventoryMovementGetPayload<object>,source?:BatchSource){
 const product=await tx.product.findUniqueOrThrow({where:{id:movement.productId}})
 if(!product.batchTracking)return
 const org=await tx.organization.findUniqueOrThrow({where:{id:context.organizationId},select:{timezone:true}})
 const today=inventoryBusinessDate(new Date(),org.timezone),quantity=movement.quantityDelta
 if(quantity.gt(0)&&movement.sourceType==='stock_document'){
  const document=await tx.stockDocument.findFirst({where:{id:movement.sourceId,organizationId:context.organizationId},include:{items:{where:{productId:movement.productId}}}})
  const item=document?.items[0]
  if(!item||document!.items.length!==1||!item.quantity.eq(quantity))throw new AccessError(409,'BATCH_ORIGIN_REQUIRED')
  const metadata=batchInputSchema.safeParse(item.batchInput)
  if(!metadata.success)throw new AccessError(409,'BATCH_METADATA_REQUIRED','Partiya kodi, kirim kuni va yaroqlilik muddati kerak')
  if(metadata.data.receivedOn>today)throw new AccessError(409,'BATCH_RECEIPT_IN_FUTURE')
  const existing=await tx.inventoryBatch.findUnique({where:{productId_code:{productId:product.id,code:metadata.data.code}}})
  if(existing&&(existing.receivedOn!==metadata.data.receivedOn||existing.expiresOn!==metadata.data.expiresOn))throw new AccessError(409,'BATCH_METADATA_CONFLICT')
  const batch=existing??await tx.inventoryBatch.create({data:{organizationId:context.organizationId,productId:product.id,...metadata.data,originItemId:item.id,createdBy:context.userId}})
  await tx.inventoryBatchEntry.create({data:{organizationId:context.organizationId,batchId:batch.id,storeId:movement.storeId,movementId:movement.id,quantityDelta:quantity}})
  return
 }
 if(quantity.gt(0)){
  if(!source)throw new AccessError(409,'BATCH_RESTORE_SOURCE_REQUIRED','Original partiya manbasini tekshiring')
  const entries=await tx.inventoryBatchEntry.findMany({where:{organizationId:context.organizationId,storeId:source.storeId,quantityDelta:{lt:0},movement:{sourceType:source.sourceType,sourceId:source.sourceId,productId:product.id}},include:{restorations:true,dispositions:true,batch:true},orderBy:{id:'asc'}})
  if(!entries.length)throw new AccessError(409,'BATCH_RESTORE_SOURCE_REQUIRED')
  const available=entries.map(entry=>({entry,remaining:entry.quantityDelta.negated().sub(entry.restorations.reduce((sum,row)=>sum.add(row.quantityDelta),decimal(0)).add(entry.dispositions.reduce((sum,row)=>sum.add(row.quantity),decimal(0))))})).filter(row=>row.remaining.gt(0))
  if(available.length>1&&!source.selection&&!available.reduce((sum,row)=>sum.add(row.remaining),decimal(0)).eq(quantity))throw new AccessError(409,'BATCH_SELECTION_REQUIRED','Qisman qaytarma/qabulda original partiyalarni tanlang')
  let remaining=quantity
  const selected=source.selection
  if(selected&&(new Set(selected.map(row=>row.entryId)).size!==selected.length||!selected.reduce((sum,row)=>sum.add(row.quantity),decimal(0)).eq(quantity)))throw new AccessError(409,'INVALID_BATCH_SELECTION')
  for(const row of available){
   const requested=selected?.find(item=>item.entryId===row.entry.id)
   const take=selected?(requested?decimal(requested.quantity):decimal(0)):Prisma.Decimal.min(row.remaining,remaining)
   if(take.lt(0)||take.gt(row.remaining))throw new AccessError(409,'INVALID_BATCH_SELECTION')
   if(take.gt(0)){await tx.inventoryBatchEntry.create({data:{organizationId:context.organizationId,batchId:row.entry.batchId,storeId:movement.storeId,movementId:movement.id,sourceEntryId:row.entry.id,quantityDelta:take}});remaining=remaining.sub(take)}
  }
  if(!remaining.eq(0)||selected?.some(row=>!available.some(item=>item.entry.id===row.entryId)))throw new AccessError(409,'BATCH_RESTORE_QUANTITY_EXCEEDED')
  return
 }
 let targetCode:string|undefined
 if(['stock_document','stock_reversal','supplier_return'].includes(movement.sourceType)){
  let documentId=movement.sourceId
  if(movement.sourceType==='stock_reversal'){
   const reversal=await tx.stockDocument.findFirst({where:{id:movement.sourceId,organizationId:context.organizationId}})
   if(!reversal?.reversalOfId)throw new AccessError(409,'BATCH_ORIGIN_REQUIRED')
   documentId=reversal.reversalOfId
  }else if(movement.sourceType==='supplier_return'){
   const credit=await tx.supplierCredit.findFirst({where:{id:movement.sourceId,invoice:{organizationId:context.organizationId}},include:{invoice:true}})
   if(!credit)throw new AccessError(409,'BATCH_ORIGIN_REQUIRED')
   documentId=credit.invoice.stockDocumentId
  }
  const original=await tx.stockDocumentItem.findFirst({where:{stockDocumentId:documentId,productId:product.id,stockDocument:{organizationId:context.organizationId}}})
  const metadata=batchInputSchema.safeParse(original?.batchInput)
  if(!metadata.success)throw new AccessError(409,'BATCH_METADATA_REQUIRED','Tuzatish/qaytarma original partiyani ko‘rsatishi kerak')
  targetCode=metadata.data.code
 }
 const positions=(await batchPositions(tx,context.organizationId,movement.storeId,product.id)).filter(row=>!targetCode||row.code===targetCode)
 if(positions.length>10000)throw new AccessError(413,'BATCH_HISTORY_TOO_LARGE')
 const policyValid=['sale','transfer_out'].includes(movement.sourceType)
 const selection=selectFefo({quantity:quantity.negated().toFixed(),today,expiryRequired:true,batches:positions.map(row=>({id:row.id,receivedOn:policyValid?row.receivedOn:'0001-01-01',expiresOn:policyValid?row.expiresOn:'9999-12-31',availableQuantity:row.quantity.toFixed()}))})
 for(const row of selection.allocations)await tx.inventoryBatchEntry.create({data:{organizationId:context.organizationId,batchId:row.batchId,storeId:movement.storeId,movementId:movement.id,quantityDelta:decimal(row.quantity).negated()}})
}
export const batchQuerySchema=z.object({storeId:z.string().uuid(),productId:z.string().uuid().optional(),state:z.enum(['all','expired','due_soon','valid']).default('all'),search:z.string().trim().max(200).default(''),page:z.coerce.number().int().min(1).max(100000).default(1)}).strict()
export async function queryBatches(context:TokenPayload,input:z.input<typeof batchQuerySchema>,all=false){
 const parsed=batchQuerySchema.parse(input)
 return prisma.$transaction(async tx=>{
  await assertLiveContext(tx,context)
  if(!await tx.store.findFirst({where:{id:parsed.storeId,AND:tenantScope('Store',context)}}))throw new AccessError(404,'STORE_NOT_FOUND')
  const org=await tx.organization.findUniqueOrThrow({where:{id:context.organizationId},select:{timezone:true}}),today=inventoryBusinessDate(new Date(),org.timezone)
  const scope=Prisma.sql`FROM "InventoryBatch" b JOIN "Product" p ON p.id=b."productId" JOIN "InventoryBatchEntry" e ON e."batchId"=b.id WHERE b."organizationId"=${context.organizationId} AND e."storeId"=${parsed.storeId} AND (${parsed.productId??null}::text IS NULL OR b."productId"=${parsed.productId??null}) AND (strpos(lower(b.code),lower(${parsed.search}))>0 OR strpos(lower(p.name),lower(${parsed.search}))>0) AND (${parsed.state}='all' OR (${parsed.state}='expired' AND b."expiresOn"<${today}) OR (${parsed.state}='due_soon' AND b."expiresOn">=${today} AND b."expiresOn"<=to_char(${today}::date+p."expiryAlertDays",'YYYY-MM-DD')) OR (${parsed.state}='valid' AND b."expiresOn">to_char(${today}::date+p."expiryAlertDays",'YYYY-MM-DD'))) GROUP BY b.id,p.id HAVING sum(e."quantityDelta")>0`
  const counts=await tx.$queryRaw<{count:bigint}[]>(Prisma.sql`SELECT count(*) FROM (SELECT b.id ${scope}) counted`)
  const total=Number(counts[0].count)
  if(all&&total>10000)throw new AccessError(413,'BATCH_REPORT_TOO_LARGE','Eksport uchun filtrni toraytiring')
  const rows=await tx.$queryRaw<{id:string;productId:string;productName:string;unit:string;code:string;receivedOn:string;expiresOn:string;alertDays:number;quantity:Prisma.Decimal}[]>(Prisma.sql`SELECT b.id,b."productId",p.name AS "productName",p.unit,b.code,b."receivedOn",b."expiresOn",p."expiryAlertDays" AS "alertDays",sum(e."quantityDelta") AS quantity ${scope} ORDER BY b."expiresOn",b.id ${all?Prisma.empty:Prisma.sql`LIMIT 50 OFFSET ${(parsed.page-1)*50}`}`)
  return {today,rows:rows.map(row=>({...row,quantity:row.quantity.toFixed(6),state:batchExpiryState(row.expiresOn,today,row.alertDays)})),total,page:parsed.page}
 },{isolationLevel:'RepeatableRead'})
}

export async function postBatchDisposition(tx:Prisma.TransactionClient,context:TokenPayload,input:{productId:string;quantity:Prisma.Decimal;transferDispositionId?:string;returnDispositionId?:string;source:BatchSource}){
 const product=await tx.product.findUniqueOrThrow({where:{id:input.productId}})
 if(!product.batchTracking)return
 const entries=await tx.inventoryBatchEntry.findMany({where:{organizationId:context.organizationId,storeId:input.source.storeId,quantityDelta:{lt:0},movement:{sourceType:input.source.sourceType,sourceId:input.source.sourceId,productId:product.id}},include:{restorations:true,dispositions:true},orderBy:{id:'asc'}})
 const available=entries.map(entry=>({entry,remaining:entry.quantityDelta.negated().sub(entry.restorations.reduce((sum,row)=>sum.add(row.quantityDelta),decimal(0))).sub(entry.dispositions.reduce((sum,row)=>sum.add(row.quantity),decimal(0)))})).filter(row=>row.remaining.gt(0))
 const selected=input.source.selection
 if(selected&&(new Set(selected.map(row=>row.entryId)).size!==selected.length||!selected.reduce((sum,row)=>sum.add(row.quantity),decimal(0)).eq(input.quantity)))throw new AccessError(409,'INVALID_BATCH_SELECTION')
 if(available.length>1&&!selected&&!available.reduce((sum,row)=>sum.add(row.remaining),decimal(0)).eq(input.quantity))throw new AccessError(409,'BATCH_SELECTION_REQUIRED')
 let remaining=input.quantity
 for(const row of available){
  const request=selected?.find(item=>item.entryId===row.entry.id),take=selected?(request?decimal(request.quantity):decimal(0)):Prisma.Decimal.min(row.remaining,remaining)
  if(take.lt(0)||take.gt(row.remaining))throw new AccessError(409,'INVALID_BATCH_SELECTION')
  if(take.gt(0)){await tx.inventoryBatchDisposition.create({data:{organizationId:context.organizationId,sourceEntryId:row.entry.id,quantity:take,...(input.transferDispositionId?{transferDispositionId:input.transferDispositionId}:{returnDispositionId:input.returnDispositionId!})}});remaining=remaining.sub(take)}
 }
 if(!remaining.eq(0)||selected?.some(row=>!available.some(item=>item.entry.id===row.entryId)))throw new AccessError(409,'BATCH_RESTORE_QUANTITY_EXCEEDED')
}

/** Internal warnings only: no SMS/email provider or invented delivery result. */
export async function createBatchExpiryAlerts(organizationId?:string){
 let cursorBatch='',cursorStore='',created=0,scanned=0
 for(let page=0;page<100;page++){
  const candidates=await prisma.$queryRaw<{organizationId:string;storeId:string;batchId:string;code:string;productId:string;expiresOn:string;alertDays:number;today:string;quantity:Prisma.Decimal}[]>`SELECT b."organizationId",e."storeId",b.id AS "batchId",b.code,b."productId",b."expiresOn",p."expiryAlertDays" AS "alertDays",to_char(CURRENT_TIMESTAMP AT TIME ZONE o.timezone,'YYYY-MM-DD') AS today,sum(e."quantityDelta") AS quantity FROM "InventoryBatch" b JOIN "InventoryBatchEntry" e ON e."batchId"=b.id JOIN "Product" p ON p.id=b."productId" JOIN "Organization" o ON o.id=b."organizationId" WHERE (b.id,e."storeId")>(${cursorBatch},${cursorStore}) AND (${organizationId??null}::text IS NULL OR b."organizationId"=${organizationId??null}) GROUP BY b.id,e."storeId",p.id,o.id HAVING sum(e."quantityDelta")>0 ORDER BY b.id,e."storeId" LIMIT 1000`
  for(const row of candidates){
   scanned++
   const state=batchExpiryState(row.expiresOn,row.today,row.alertDays)
   if(state==='valid')continue
   const identity=`batch-expiry:${row.organizationId}:${row.batchId}:${row.storeId}:${row.today}:${state}`
   await prisma.$transaction(async tx=>{
    await tx.$queryRaw`SELECT pg_advisory_xact_lock(hashtextextended(${identity},0))::text`
    const existing=await tx.auditLog.findFirst({where:{organizationId:row.organizationId,entityType:'InventoryBatch',entityId:row.batchId,action:'batch_expiry_warning',requestId:identity}})
    if(existing)return
    // Recheck current branch quantity. A sale between scan and write must not
    // produce a warning for a now-empty batch.
    const total=await tx.inventoryBatchEntry.aggregate({where:{batchId:row.batchId,storeId:row.storeId},_sum:{quantityDelta:true}})
    if(!total._sum.quantityDelta?.gt(0))return
    await tx.auditLog.create({data:{organizationId:row.organizationId,entityType:'InventoryBatch',entityId:row.batchId,action:'batch_expiry_warning',requestId:identity,afterData:{storeId:row.storeId,code:row.code,productId:row.productId,today:row.today,expiresOn:row.expiresOn,state,quantity:total._sum.quantityDelta.toFixed(6),delivery:'internal_only'}}})
    created++
   })
  }
  if(candidates.length<1000)return {scanned,created}
  cursorBatch=candidates.at(-1)!.batchId;cursorStore=candidates.at(-1)!.storeId
 }
 throw new AccessError(413,'BATCH_ALERT_SCAN_TOO_LARGE','Katta dataset uchun worker shard kerak; warning scan tugallandi deb hisoblanmaydi')
}
export async function readBatchSource(context:TokenPayload,kind:'sale'|'transfer_out',id:string,productId:string){
 if(!['owner','admin'].includes(context.role))throw new AccessError(403,'MANAGER_REQUIRED')
 return prisma.$transaction(async tx=>{
  await assertLiveContext(tx,context)
  const original=kind==='sale'?await tx.sale.findFirst({where:{id,AND:tenantScope('Sale',context)}}):await tx.stockTransfer.findFirst({where:{id,AND:tenantScope('StockTransfer',context)}})
  if(!original)throw new AccessError(404,'NOT_FOUND')
  const rows=await tx.inventoryBatchEntry.findMany({where:{organizationId:context.organizationId,quantityDelta:{lt:0},movement:{sourceType:kind,sourceId:id,productId}},include:{batch:true,restorations:true,dispositions:true},orderBy:{id:'asc'}})
  return rows.map(row=>({entryId:row.id,batchId:row.batchId,code:row.batch.code,receivedOn:row.batch.receivedOn,expiresOn:row.batch.expiresOn,remainingQuantity:row.quantityDelta.negated().sub(row.restorations.reduce((sum,entry)=>sum.add(entry.quantityDelta),decimal(0))).sub(row.dispositions.reduce((sum,entry)=>sum.add(entry.quantity),decimal(0))).toFixed(6)}))
 },{isolationLevel:'RepeatableRead'})
}

export async function batchCountSnapshotTx(tx:Prisma.TransactionClient,context:TokenPayload,storeId:string,productId:string){
 if(!['owner','admin'].includes(context.role))throw new AccessError(403,'MANAGER_REQUIRED')
 if(!await tx.store.findFirst({where:{id:storeId,AND:tenantScope('Store',context)}}))throw new AccessError(404,'STORE_NOT_FOUND')
 const product=await tx.product.findFirst({where:{id:productId,organizationId:context.organizationId,batchTracking:true}})
 if(!product)throw new AccessError(404,'NOT_FOUND')
 const rows=await tx.$queryRaw<{id:string;code:string;receivedOn:string;expiresOn:string;quantity:Prisma.Decimal}[]>`SELECT b.id,b.code,b."receivedOn",b."expiresOn",COALESCE(sum(e."quantityDelta"),0) AS quantity FROM "InventoryBatch" b LEFT JOIN "InventoryBatchEntry" e ON e."batchId"=b.id AND e."storeId"=${storeId} WHERE b."organizationId"=${context.organizationId} AND b."productId"=${productId} GROUP BY b.id ORDER BY b.id LIMIT 501`
 if(rows.length>500)throw new AccessError(413,'BATCH_COUNT_TOO_LARGE','500 dan ko‘p partiyani alohida review jarayonida sanang')
 const view=rows.map(row=>({...row,quantity:row.quantity.toFixed(6)}))
 const {payloadHash}=await import('../operations')
 return {storeId,productId,productName:product.name,unit:product.unit,unitCost:product.costPrice.toFixed(6),rows:view,expectedHash:payloadHash({storeId,productId,unitCost:product.costPrice.toFixed(6),rows:view.map(row=>({id:row.id,quantity:row.quantity}))})}
}
export async function readBatchCount(context:TokenPayload,storeId:string,productId:string){return prisma.$transaction(async tx=>{await assertLiveContext(tx,context);return batchCountSnapshotTx(tx,context,storeId,productId)},{isolationLevel:'RepeatableRead'})}
export const batchCountSchema=z.object({operationId:z.string().uuid(),storeId:z.string().uuid(),expectedHash:z.string().regex(/^[a-f0-9]{64}$/),reason:z.string().trim().min(3).max(2000),counts:z.array(z.object({batchId:z.string().uuid(),quantity:z.string().regex(/^(?:0|[1-9]\d{0,13})(?:\.\d{1,6})?$/)}).strict()).min(1).max(500)}).strict()
export async function reconcileBatchCount(context:TokenPayload,productId:string,input:z.input<typeof batchCountSchema>){
 if(!['owner','admin'].includes(context.role))throw new AccessError(403,'MANAGER_REQUIRED')
 const parsed=batchCountSchema.parse(input)
 return runOperation(context,'inventory.batch.count',parsed.operationId,{productId,...parsed},async tx=>{
  await tx.$queryRaw`SELECT id FROM "Product" WHERE id=${productId} AND "organizationId"=${context.organizationId} FOR UPDATE`
  await tx.$queryRaw`SELECT pg_advisory_xact_lock(hashtextextended(${'stock:'+parsed.storeId+':'+productId},0))::text`
  const snapshot=await batchCountSnapshotTx(tx,context,parsed.storeId,productId)
  if(snapshot.expectedHash!==parsed.expectedHash)throw new AccessError(409,'BATCH_COUNT_CHANGED','Partiya qoldig‘i o‘zgardi; sanashni qayta solishtiring')
  if(new Set(parsed.counts.map(row=>row.batchId)).size!==parsed.counts.length||parsed.counts.length!==snapshot.rows.length||parsed.counts.some(row=>!snapshot.rows.some(batch=>batch.id===row.batchId)))throw new AccessError(400,'INVALID_BATCH_COUNT')
  const {validateUnitQuantity}=await import('../catalog/service'),{confirmStockDocumentTx}=await import('./documents')
  const product=await tx.product.findUniqueOrThrow({where:{id:productId}});const documents:string[]=[]
  for(const batch of snapshot.rows){
   const actual=decimal(parsed.counts.find(row=>row.batchId===batch.id)!.quantity);await validateUnitQuantity(tx,context.organizationId,product.unit,actual)
   const delta=actual.sub(batch.quantity);if(delta.eq(0))continue
   const doc:Prisma.StockDocumentGetPayload<object>=await tx.stockDocument.create({data:{organizationId:context.organizationId,storeId:parsed.storeId,documentType:'adjustment',documentNo:'BATCH-COUNT-'+parsed.operationId+'-'+documents.length,note:parsed.reason,createdBy:context.userId,items:{create:{productId,quantity:delta,unitCost:product.costPrice,batchInput:{code:batch.code,receivedOn:batch.receivedOn,expiresOn:batch.expiresOn}}}}})
   await confirmStockDocumentTx(tx,context,doc.id);documents.push(doc.id)
  }
  await audit(tx,context,'Product',productId,'batch_count_reconciled',{storeId:parsed.storeId,reason:parsed.reason,expectedHash:parsed.expectedHash,counts:parsed.counts,documents,before:snapshot.rows.map(row=>({batchId:row.id,quantity:row.quantity}))})
  return {productId,storeId:parsed.storeId,documents,counts:parsed.counts}
 })
}
export async function validateBatchReturn(tx:Prisma.TransactionClient,context:TokenPayload,productId:string,quantity:Prisma.Decimal,source:BatchSource){
 const product=await tx.product.findUniqueOrThrow({where:{id:productId}});if(!product.batchTracking)return
 const entries=await tx.inventoryBatchEntry.findMany({where:{organizationId:context.organizationId,storeId:source.storeId,quantityDelta:{lt:0},movement:{sourceType:source.sourceType,sourceId:source.sourceId,productId}},include:{restorations:true,dispositions:true}})
 const available=entries.map(row=>({id:row.id,quantity:row.quantityDelta.negated().sub(row.restorations.reduce((sum,item)=>sum.add(item.quantityDelta),decimal(0))).sub(row.dispositions.reduce((sum,item)=>sum.add(item.quantity),decimal(0)))})).filter(row=>row.quantity.gt(0))
 if(available.length>1&&!source.selection&&!available.reduce((sum,row)=>sum.add(row.quantity),decimal(0)).eq(quantity))throw new AccessError(409,'BATCH_SELECTION_REQUIRED')
 if(source.selection){
  const selected=batchSelectionSchema.parse(source.selection)
  if(new Set(selected.map(row=>row.entryId)).size!==selected.length||!selected.reduce((sum,row)=>sum.add(row.quantity),decimal(0)).eq(quantity)||selected.some(row=>!available.some(item=>item.id===row.entryId&&item.quantity.gte(row.quantity))))throw new AccessError(409,'INVALID_BATCH_SELECTION')
 }else if(available.reduce((sum,row)=>sum.add(row.quantity),decimal(0)).lt(quantity))throw new AccessError(409,'BATCH_RESTORE_QUANTITY_EXCEEDED')
}
type BatchSaleReader={
 warranty:{findMany(args:{where:{organizationId:string;saleItemId:{in:string[]}};include:{serial:true}}):Promise<Prisma.WarrantyGetPayload<{include:{serial:true}}>[]>};
 product:{findMany(args:{where:{organizationId:string;id:{in:string[]}};select:{id:true;batchTracking:true;serialTracking:true}}):Promise<{id:string;batchTracking:boolean;serialTracking:boolean}[]>};
 inventoryBatchEntry:{findMany(args:{where:{organizationId:string;movement:{sourceType:string;sourceId:string}};include:{batch:true};orderBy:{id:'asc'}}):Promise<Prisma.InventoryBatchEntryGetPayload<{include:{batch:true}}>[]>};
}
export async function attachSaleBatches<T extends {id:string;status:string;items:{id:string;productId:string}[]}>(tx:BatchSaleReader,context:TokenPayload,sale:T){
 const products=await tx.product.findMany({where:{organizationId:context.organizationId,id:{in:sale.items.map(item=>item.productId)}},select:{id:true,batchTracking:true,serialTracking:true}})
 const warranties=await tx.warranty.findMany({where:{organizationId:context.organizationId,saleItemId:{in:sale.items.map(item=>item.id)}},include:{serial:true}})
 const flags=new Map(products.map(product=>[product.id,product.batchTracking]))
 const entries=['completed','partially_returned','returned'].includes(sale.status)?await tx.inventoryBatchEntry.findMany({where:{organizationId:context.organizationId,movement:{sourceType:'sale',sourceId:sale.id}},include:{batch:true},orderBy:{id:'asc'}}):[]
 type Allocation={batchId:string;code:string;quantity:string;expiresOn:string}
 const items=sale.items.map(item=>({...item,serialTracking:products.find(product=>product.id===item.productId)?.serialTracking??false,serialAssignments:warranties.filter(w=>w.saleItemId===item.id).map(w=>({id:w.serialId,code:w.serial.code,warrantyId:w.id,startedAt:w.startedAt,endsAt:w.endsAt,terms:w.terms})),batchTracking:flags.get(item.productId)??false,batchAllocations:entries.filter(entry=>entry.batch.productId===item.productId).map(entry=>({batchId:entry.batchId,code:entry.batch.code,quantity:entry.quantityDelta.negated().toFixed(6),expiresOn:entry.batch.expiresOn}))})) as (T['items'][number]&{batchTracking:boolean;batchAllocations:Allocation[]})[]
 return {...sale,items}
}
