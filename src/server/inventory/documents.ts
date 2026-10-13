import {serialIdsSchema,postSerialDisposition} from './serials'
import {batchSelectionSchema,postBatchDisposition} from './batches'
import type {ConversionSnapshot} from '../catalog/conversion-math'
import {assertCurrentConversion} from '../catalog/conversions'
import { z } from 'zod'
import {Prisma} from '@prisma/client'
import type { TokenPayload } from '@/lib/auth'
import { AccessError, tenantScope } from '../auth/policy'
import { runOperation, audit } from '../operations'
import { decimal } from '../sales/calculations'
import { moveStock } from './movements'
import { quantitySchema } from '../sales/service'
import { weightedAverage } from './valuation'
import {nonnegativeQuantitySchema,validateUnitQuantity} from '../catalog/service'
const transitRemaining=(item:{quantity:Prisma.Decimal;receivedQuantity:Prisma.Decimal;returnedQuantity:Prisma.Decimal;damagedQuantity:Prisma.Decimal;shortageQuantity:Prisma.Decimal})=>item.quantity.sub(item.receivedQuantity).sub(item.returnedQuantity).sub(item.damagedQuantity).sub(item.shortageQuantity);

export async function confirmStockDocument(context:TokenPayload,id:string) {
 if (!['owner','admin'].includes(context.role)) throw new AccessError(403,'MANAGER_REQUIRED')
 return runOperation(context,'stock.confirm',id,{id},tx=>confirmStockDocumentTx(tx,context,id))
}
export async function confirmStockDocumentTx(tx:Prisma.TransactionClient,context:TokenPayload,id:string) {
 if (!['owner','admin'].includes(context.role)) throw new AccessError(403,'MANAGER_REQUIRED')
  await tx.$queryRaw`SELECT id FROM "StockDocument" WHERE id=${id} FOR UPDATE`
  const doc=await tx.stockDocument.findFirst({where:{id,AND:tenantScope('StockDocument',context)},include:{items:true,organization:true}})
  if (!doc) throw new AccessError(404,'NOT_FOUND')
  if (doc.status!=='draft') throw new AccessError(409,'INVALID_STATUS')
  if (!doc.items.length || !['purchase','opening','adjustment','return_in'].includes(doc.documentType)) throw new AccessError(400,'INVALID_DOCUMENT','Transfer uchun transfer oqimidan foydalaning')
  for (const item of [...doc.items].sort((a,b)=>a.productId.localeCompare(b.productId))) {
   const conversionProduct=await tx.product.findFirstOrThrow({where:{id:item.productId,organizationId:context.organizationId}});await assertCurrentConversion(tx,context.organizationId,conversionProduct,item.quantity,item.conversionSnapshot);
   if (item.quantity.isZero() || (doc.documentType!=='adjustment' && item.quantity.lt(0))) throw new AccessError(400,'INVALID_QUANTITY')
   if(doc.documentType==='opening'){
    if(!doc.note||doc.note.trim().length<3)throw new AccessError(400,'REASON_REQUIRED')
    const balance=await tx.inventoryBalance.findUnique({where:{storeId_productId:{storeId:doc.storeId,productId:item.productId}}})
    if((balance&&!balance.quantity.isZero())||await tx.inventoryMovement.count({where:{storeId:doc.storeId,productId:item.productId}}))throw new AccessError(409,'OPENING_ALREADY_EXISTS','Boshlang‘ich qoldiq faqat harakatsiz mahsulotga kiritiladi; keyin tuzatish hujjatidan foydalaning')
   }
   if (['purchase','opening'].includes(doc.documentType)) {
    await tx.$queryRaw`SELECT id FROM "Product" WHERE id=${item.productId} FOR UPDATE`
    const product=await tx.product.findFirstOrThrow({where:{id:item.productId,organizationId:context.organizationId}})
    const stock=await tx.inventoryBalance.aggregate({where:{productId:product.id},_sum:{quantity:true}})
    const oldQty=decimal(stock._sum.quantity??0)
    if (oldQty.lt(0)) throw new AccessError(409,'COST_RECONCILIATION_REQUIRED')
    const average=weightedAverage(oldQty,product.costPrice,item.quantity,item.unitCost)
    await tx.product.update({where:{id:product.id},data:{costPrice:average}})
   }
   await moveStock(tx,context,{storeId:doc.storeId,productId:item.productId,delta:item.quantity,unitCost:item.unitCost,sourceType:'stock_document',sourceId:doc.id})
  }
  const result=await tx.stockDocument.update({where:{id},data:{status:'confirmed',confirmedBy:context.userId,confirmedAt:new Date()},include:{items:true}})
  await audit(tx,context,'StockDocument',id,'confirmed',{type:doc.documentType})
  return result
}
export async function sendTransfer(context:TokenPayload,id:string) {
 if(!['owner','admin'].includes(context.role))throw new AccessError(403,'MANAGER_REQUIRED');
 return runOperation(context,'transfer.send',id,{id},async tx=>{
  await tx.$queryRaw`SELECT id FROM "StockTransfer" WHERE id=${id} FOR UPDATE`
  const doc=await tx.stockTransfer.findFirst({where:{id,AND:tenantScope('StockTransfer',context)},include:{items:true}})
  if (!doc) throw new AccessError(404,'NOT_FOUND')
  if (doc.status!=='draft' || !doc.items.length) throw new AccessError(409,'INVALID_STATUS')
  for (const item of [...doc.items].sort((a,b)=>a.productId.localeCompare(b.productId))){
   await tx.$queryRaw`SELECT id FROM "Product" WHERE id=${item.productId} AND "organizationId"=${context.organizationId} FOR UPDATE`
   const [fees]=await tx.$queryRaw<{amount:Prisma.Decimal}[]>`SELECT COALESCE(sum((product->>'allocatedAmount')::numeric),0) AS amount FROM "ReceiptCostApplication" a CROSS JOIN LATERAL jsonb_array_elements(a.snapshot->'products') product WHERE a."organizationId"=${context.organizationId} AND product->>'productId'=${item.productId}`
   let issueCost=item.unitCost
   if(fees.amount.gt(0)){const product=await tx.product.findUniqueOrThrow({where:{id:item.productId}});issueCost=product.costPrice;await tx.stockTransferItem.update({where:{id:item.id},data:{issueUnitCostSnapshot:issueCost}})}
   await moveStock(tx,context,{storeId:doc.fromStoreId,productId:item.productId,delta:item.quantity.negated(),unitCost:issueCost,sourceType:'transfer_out',sourceId:doc.id})
  }
  const result=await tx.stockTransfer.update({where:{id},data:{status:'sent',sentAt:new Date()},include:{items:true}})
  await audit(tx,context,'StockTransfer',id,'sent')
  return result
 })
}
export const receiveSchema=z.object({operationId:z.string().uuid().optional(),reason:z.string().trim().min(3).max(2000).optional(),items:z.array(z.object({itemId:z.string().uuid(),quantity:nonnegativeQuantitySchema,damagedQuantity:nonnegativeQuantitySchema.optional(),shortageQuantity:nonnegativeQuantitySchema.optional(),receivedSerials:serialIdsSchema.optional(),damagedSerials:serialIdsSchema.optional(),shortageSerials:serialIdsSchema.optional(),receivedBatches:batchSelectionSchema.optional(),damagedBatches:batchSelectionSchema.optional(),shortageBatches:batchSelectionSchema.optional()}).strict()).min(1).max(500).optional()}).strict()
export async function receiveTransfer(context:TokenPayload,id:string,input:z.infer<typeof receiveSchema>) {
 if(!['owner','admin'].includes(context.role))throw new AccessError(403,'MANAGER_REQUIRED');
 const key=input.operationId??id+':all'
 return runOperation(context,'transfer.receive',key,{id,items:input.items??'all',...(input.reason?{reason:input.reason}:{})},async tx=>{
  await tx.$queryRaw`SELECT id FROM "StockTransfer" WHERE id=${id} FOR UPDATE`
  const doc=await tx.stockTransfer.findFirst({where:{id,AND:tenantScope('StockTransfer',context)},include:{items:true}})
  if (!doc) throw new AccessError(404,'NOT_FOUND')
  if (doc.status!=='sent') throw new AccessError(409,'INVALID_STATUS')
  const rows=input.items??doc.items.filter(x=>transitRemaining(x).gt(0)).map(x=>({itemId:x.id,quantity:transitRemaining(x).toString(),damagedQuantity:undefined,shortageQuantity:undefined,receivedSerials:undefined,damagedSerials:undefined,shortageSerials:undefined,receivedBatches:undefined,damagedBatches:undefined,shortageBatches:undefined}))
  if (new Set(rows.map(x=>x.itemId)).size!==rows.length || !rows.length) throw new AccessError(400,'INVALID_ITEMS')
  for (const row of [...rows].sort((a,b)=>a.itemId.localeCompare(b.itemId))) {
   const original=doc.items.find(x=>x.id===row.itemId)
   const received=decimal(row.quantity),damaged=decimal(row.damagedQuantity??0),shortage=decimal(row.shortageQuantity??0),settled=received.add(damaged).add(shortage);
   if (!original||received.lt(0)||damaged.lt(0)||shortage.lt(0)||settled.lte(0)||settled.gt(transitRemaining(original))) throw new AccessError(409,'RECEIVE_QUANTITY_EXCEEDED');
   const product=await tx.product.findFirstOrThrow({where:{id:original.productId,organizationId:context.organizationId}});
   for(const quantity of [received,damaged,shortage])if(quantity.gt(0))await validateUnitQuantity(tx,context.organizationId,product.unit,quantity);
   if(damaged.add(shortage).gt(0)&&(!input.reason||input.reason.trim().length<3))throw new AccessError(400,'REASON_REQUIRED','Brak/kamomad tasdig‘iga sabab kerak');
   if(received.gt(0))await moveStock(tx,context,{storeId:doc.toStoreId,productId:original.productId,delta:received,unitCost:original.issueUnitCostSnapshot??original.unitCost,sourceType:'transfer_in',sourceId:key,serialSource:{ids:row.receivedSerials,originalId:doc.id},batchSource:{sourceType:'transfer_out',sourceId:doc.id,storeId:doc.fromStoreId,selection:row.receivedBatches}});
   for(const [disposition,quantity] of [['damaged',damaged],['shortage',shortage]] as const)if(quantity.gt(0)){const entry=await tx.transferDispositionEntry.create({data:{organizationId:context.organizationId,storeId:doc.toStoreId,productId:product.id,itemId:original.id,operationId:key,disposition,quantity,unitCost:original.issueUnitCostSnapshot??original.unitCost,productName:product.name,sku:product.sku,unit:product.unit,reason:input.reason!,actorId:context.userId}});await postSerialDisposition(tx,context,{productId:product.id,storeId:doc.toStoreId,quantity,kind:disposition==='damaged'?'damaged':'retired',sourceId:key,transferDispositionId:entry.id,originalTransferId:doc.id,ids:disposition==='damaged'?row.damagedSerials:row.shortageSerials});await postBatchDisposition(tx,context,{productId:product.id,quantity,transferDispositionId:entry.id,source:{sourceType:'transfer_out',sourceId:doc.id,storeId:doc.fromStoreId,selection:disposition==='damaged'?row.damagedBatches:row.shortageBatches}})}
   await tx.stockTransferItem.update({where:{id:original.id},data:{receivedQuantity:{increment:received},damagedQuantity:{increment:damaged},shortageQuantity:{increment:shortage}}})
  }
  const remaining=await tx.stockTransferItem.findMany({where:{stockTransferId:doc.id}})
  const done=remaining.every(x=>transitRemaining(x).eq(0))
  const result=await tx.stockTransfer.update({where:{id},data:{status:done?(remaining.some(x=>x.returnedQuantity.add(x.damagedQuantity).add(x.shortageQuantity).gt(0))?'closed':'received'):'sent',...(done&&{receivedAt:new Date()})},include:{items:{include:{dispositions:true}}}})
  await audit(tx,context,'StockTransfer',id,'received',{items:rows,complete:done,reason:input.reason,approvedBy:context.userId,approvedRole:context.role})
  return result
 })
}

export const reverseStockSchema=z.object({operationId:z.string().uuid(),reason:z.string().trim().min(3).max(2000)}).strict()
export async function reverseStockDocument(context:TokenPayload,id:string,input:z.infer<typeof reverseStockSchema>) {
 if (!['owner','admin'].includes(context.role)) throw new AccessError(403,'MANAGER_REQUIRED')
 return runOperation(context,'stock.reverse',input.operationId,{id,reason:input.reason},async tx=>{
  await tx.$queryRaw`SELECT id FROM "StockDocument" WHERE id=${id} FOR UPDATE`
  const original=await tx.stockDocument.findFirst({where:{id,AND:tenantScope('StockDocument',context)},include:{items:true,reversal:true}})
  if (!original) throw new AccessError(404,'NOT_FOUND')
  if (!original.items.length || original.status!=='confirmed' || original.reversalOfId || !['purchase','opening','adjustment','return_in'].includes(original.documentType)) throw new AccessError(409,'INVALID_STATUS')
  if (original.reversal) throw new AccessError(409,'ALREADY_REVERSED')
  if(await tx.supplierInvoice.findUnique({where:{stockDocumentId:id}}))throw new AccessError(409,'SUPPLIER_INVOICE_TRACKED','Qarzga bog‘langan xarid uchun yetkazib beruvchiga qaytarish oqimidan foydalaning')
  const reversal=await tx.stockDocument.create({data:{organizationId:original.organizationId,storeId:original.storeId,supplierId:original.supplierId,
   documentType:'reversal',documentNo:'REV-'+input.operationId,reversalOfId:id,createdBy:context.userId,note:input.reason,
   items:{create:original.items.map(item=>({productId:item.productId,quantity:item.quantity.negated(),unitCost:item.unitCost,note:item.note,conversionSnapshot:item.conversionSnapshot?{...(item.conversionSnapshot as unknown as ConversionSnapshot),tradeQuantity:decimal((item.conversionSnapshot as unknown as ConversionSnapshot).tradeQuantity).negated().toFixed()}:Prisma.DbNull}))}}})
  for (const item of [...original.items].sort((a,b)=>a.productId.localeCompare(b.productId))) {
   if (['purchase','opening'].includes(original.documentType)) {
    await tx.$queryRaw`SELECT id FROM "Product" WHERE id=${item.productId} FOR UPDATE`
    const product=await tx.product.findFirstOrThrow({where:{id:item.productId,organizationId:context.organizationId}})
    const stock=await tx.inventoryBalance.aggregate({where:{productId:product.id},_sum:{quantity:true}})
    const quantity=decimal(stock._sum.quantity??0),remaining=quantity.sub(item.quantity)
    const remainingValue=quantity.mul(product.costPrice).sub(item.quantity.mul(item.unitCost))
    if (remaining.lt(0) || remainingValue.lt('-0.000001')) throw new AccessError(409,'COST_RECONCILIATION_REQUIRED','Xaridni qaytarish uchun qoldiq va tannarxni solishtiring')
    // Moving-average inverse; sold units keep their checkout cost snapshot.
    // With no units left, retain the last known cost as the future catalog default.
    if (remaining.gt(0)) await tx.product.update({where:{id:product.id},data:{costPrice:remainingValue.lt(0)?0:remainingValue.div(remaining).toDecimalPlaces(6)}})
   }
   // Reversals never create a new shortage, even when negative-stock policy is on.
   await moveStock(tx,context,{storeId:original.storeId,productId:item.productId,delta:item.quantity.negated(),unitCost:item.unitCost,sourceType:'stock_reversal',sourceId:reversal.id,batchSource:{sourceType:'stock_document',sourceId:original.id,storeId:original.storeId}})
  }
  const result=await tx.stockDocument.update({where:{id:reversal.id},data:{status:'confirmed',confirmedBy:context.userId,confirmedAt:new Date()},include:{items:true}})
  await audit(tx,context,'StockDocument',id,'reversed',{reversalId:result.id,reason:input.reason})
  return result
 })
}

export const cancelTransferSchema=z.object({reason:z.string().trim().min(3).max(2000)}).strict()
export async function cancelTransfer(context:TokenPayload,id:string,input:z.infer<typeof cancelTransferSchema>) {
 if (!['owner','admin'].includes(context.role)) throw new AccessError(403,'MANAGER_REQUIRED')
 return runOperation(context,'transfer.cancel',id,{id,reason:input.reason},async tx=>{
  await tx.$queryRaw`SELECT id FROM "StockTransfer" WHERE id=${id} FOR UPDATE`
  const transfer=await tx.stockTransfer.findFirst({where:{id,AND:tenantScope('StockTransfer',context)},include:{items:true}})
  if (!transfer) throw new AccessError(404,'NOT_FOUND')
  if (transfer.status!=='draft') throw new AccessError(409,'INVALID_STATUS','Faqat jo‘natilmagan transferni bekor qilish mumkin')
  const result=await tx.stockTransfer.update({where:{id},data:{status:'cancelled'},include:{items:true}})
  await audit(tx,context,'StockTransfer',id,'cancelled',{reason:input.reason})
  return result
 })
}

export const returnTransferSchema=z.object({operationId:z.string().uuid(),reason:z.string().trim().min(3).max(2000),items:z.array(z.object({itemId:z.string().uuid(),quantity:quantitySchema,serialIds:serialIdsSchema.optional(),batchSelection:batchSelectionSchema.optional()})).min(1).max(500).optional()}).strict()
export async function returnTransfer(context:TokenPayload,id:string,input:z.infer<typeof returnTransferSchema>) {
 if (!['owner','admin'].includes(context.role)) throw new AccessError(403,'MANAGER_REQUIRED')
 return runOperation(context,'transfer.return',input.operationId,{id,reason:input.reason,items:input.items??'all'},async tx=>{
  await tx.$queryRaw`SELECT id FROM "StockTransfer" WHERE id=${id} FOR UPDATE`
  const doc=await tx.stockTransfer.findFirst({where:{id,AND:tenantScope('StockTransfer',context)},include:{items:true}})
  if (!doc) throw new AccessError(404,'NOT_FOUND')
  if (doc.status!=='sent') throw new AccessError(409,'INVALID_STATUS')
  const rows=input.items??doc.items.filter(x=>transitRemaining(x).gt(0)).map(x=>({itemId:x.id,quantity:transitRemaining(x).toString(),serialIds:undefined,batchSelection:undefined}))
  if (!rows.length || new Set(rows.map(x=>x.itemId)).size!==rows.length) throw new AccessError(400,'INVALID_ITEMS')
  for (const row of [...rows].sort((a,b)=>a.itemId.localeCompare(b.itemId))) {
   const item=doc.items.find(x=>x.id===row.itemId)
   if(!item || decimal(row.quantity).gt(transitRemaining(item))) throw new AccessError(409,'RETURN_QUANTITY_EXCEEDED','Faqat hali qabul qilinmagan miqdorni qaytarish mumkin')
   await moveStock(tx,context,{storeId:doc.fromStoreId,productId:item.productId,delta:row.quantity,unitCost:item.issueUnitCostSnapshot??item.unitCost,sourceType:'transfer_return',sourceId:input.operationId,serialSource:{ids:row.serialIds,originalId:doc.id},batchSource:{sourceType:'transfer_out',sourceId:doc.id,storeId:doc.fromStoreId,selection:row.batchSelection}})
   await tx.stockTransferItem.update({where:{id:item.id},data:{returnedQuantity:{increment:decimal(row.quantity)}}})
  }
  const remaining=await tx.stockTransferItem.findMany({where:{stockTransferId:id}})
  const done=remaining.every(item=>transitRemaining(item).eq(0))
  const result=await tx.stockTransfer.update({where:{id},data:{status:done?'closed':'sent'},include:{items:true}})
  await audit(tx,context,'StockTransfer',id,'transit_returned',{items:rows,reason:input.reason,complete:done})
  return result
 })
}
