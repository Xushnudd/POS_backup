import { z } from 'zod'
import type { TokenPayload } from '@/lib/auth'
import { AccessError, tenantScope } from '../auth/policy'
import { runOperation, audit } from '../operations'
import { decimal } from '../sales/calculations'
import { moveStock } from './movements'
import { quantitySchema } from '../sales/service'

export async function confirmStockDocument(context:TokenPayload,id:string) {
 if (!['owner','admin'].includes(context.role)) throw new AccessError(403,'MANAGER_REQUIRED')
 return runOperation(context,'stock.confirm',id,{id},async tx=>{
  await tx.$queryRaw`SELECT id FROM "StockDocument" WHERE id=${id} FOR UPDATE`
  const doc=await tx.stockDocument.findFirst({where:{id,AND:tenantScope('StockDocument',context)},include:{items:true,organization:true}})
  if (!doc) throw new AccessError(404,'NOT_FOUND')
  if (doc.status!=='draft') throw new AccessError(409,'INVALID_STATUS')
  if (!doc.items.length || !['purchase','adjustment','return_in'].includes(doc.documentType)) throw new AccessError(400,'INVALID_DOCUMENT','Transfer uchun transfer oqimidan foydalaning')
  for (const item of [...doc.items].sort((a,b)=>a.productId.localeCompare(b.productId))) {
   if (item.quantity.isZero() || (doc.documentType!=='adjustment' && item.quantity.lt(0))) throw new AccessError(400,'INVALID_QUANTITY')
   if (doc.documentType==='purchase') {
    await tx.$queryRaw`SELECT id FROM "Product" WHERE id=${item.productId} FOR UPDATE`
    const product=await tx.product.findFirstOrThrow({where:{id:item.productId,organizationId:context.organizationId}})
    const stock=await tx.inventoryBalance.aggregate({where:{productId:product.id},_sum:{quantity:true}})
    const oldQty=decimal(stock._sum.quantity??0)
    if (oldQty.lt(0)) throw new AccessError(409,'COST_RECONCILIATION_REQUIRED')
    const average=oldQty.mul(product.costPrice).add(item.quantity.mul(item.unitCost)).div(oldQty.add(item.quantity)).toDecimalPlaces(6)
    await tx.product.update({where:{id:product.id},data:{costPrice:average}})
   }
   await moveStock(tx,context,{storeId:doc.storeId,productId:item.productId,delta:item.quantity,unitCost:item.unitCost,sourceType:'stock_document',sourceId:doc.id,allowNegative:doc.organization.allowNegativeStock})
  }
  const result=await tx.stockDocument.update({where:{id},data:{status:'confirmed',confirmedBy:context.userId,confirmedAt:new Date()},include:{items:true}})
  await audit(tx,context,'StockDocument',id,'confirmed',{type:doc.documentType})
  return result
 })
}
export async function sendTransfer(context:TokenPayload,id:string) {
 return runOperation(context,'transfer.send',id,{id},async tx=>{
  await tx.$queryRaw`SELECT id FROM "StockTransfer" WHERE id=${id} FOR UPDATE`
  const doc=await tx.stockTransfer.findFirst({where:{id,AND:tenantScope('StockTransfer',context)},include:{items:true}})
  if (!doc) throw new AccessError(404,'NOT_FOUND')
  if (doc.status!=='draft' || !doc.items.length) throw new AccessError(409,'INVALID_STATUS')
  for (const item of [...doc.items].sort((a,b)=>a.productId.localeCompare(b.productId))) await moveStock(tx,context,{storeId:doc.fromStoreId,productId:item.productId,delta:item.quantity.negated(),unitCost:item.unitCost,sourceType:'transfer_out',sourceId:doc.id})
  const result=await tx.stockTransfer.update({where:{id},data:{status:'sent',sentAt:new Date()},include:{items:true}})
  await audit(tx,context,'StockTransfer',id,'sent')
  return result
 })
}
export const receiveSchema=z.object({operationId:z.string().uuid().optional(),items:z.array(z.object({itemId:z.string().uuid(),quantity:quantitySchema})).min(1).optional()})
export async function receiveTransfer(context:TokenPayload,id:string,input:z.infer<typeof receiveSchema>) {
 const key=input.operationId??id+':all'
 return runOperation(context,'transfer.receive',key,{id,items:input.items??'all'},async tx=>{
  await tx.$queryRaw`SELECT id FROM "StockTransfer" WHERE id=${id} FOR UPDATE`
  const doc=await tx.stockTransfer.findFirst({where:{id,AND:tenantScope('StockTransfer',context)},include:{items:true}})
  if (!doc) throw new AccessError(404,'NOT_FOUND')
  if (doc.status!=='sent') throw new AccessError(409,'INVALID_STATUS')
  const rows=input.items??doc.items.filter(x=>x.receivedQuantity.add(x.returnedQuantity).lt(x.quantity)).map(x=>({itemId:x.id,quantity:x.quantity.sub(x.receivedQuantity).sub(x.returnedQuantity).toString()}))
  if (new Set(rows.map(x=>x.itemId)).size!==rows.length || !rows.length) throw new AccessError(400,'INVALID_ITEMS')
  for (const row of [...rows].sort((a,b)=>a.itemId.localeCompare(b.itemId))) {
   const original=doc.items.find(x=>x.id===row.itemId)
   if (!original || decimal(row.quantity).gt(original.quantity.sub(original.receivedQuantity).sub(original.returnedQuantity))) throw new AccessError(409,'RECEIVE_QUANTITY_EXCEEDED')
   await moveStock(tx,context,{storeId:doc.toStoreId,productId:original.productId,delta:row.quantity,unitCost:original.unitCost,sourceType:'transfer_in',sourceId:key})
   await tx.stockTransferItem.update({where:{id:original.id},data:{receivedQuantity:{increment:decimal(row.quantity)}}})
  }
  const remaining=await tx.stockTransferItem.findMany({where:{stockTransferId:doc.id}})
  const done=remaining.every(x=>x.receivedQuantity.add(x.returnedQuantity).eq(x.quantity))
  const result=await tx.stockTransfer.update({where:{id},data:{status:done?(remaining.some(x=>x.returnedQuantity.gt(0))?'closed':'received'):'sent',...(done&&{receivedAt:new Date()})},include:{items:true}})
  await audit(tx,context,'StockTransfer',id,'received',{items:rows,complete:done})
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
  if (!original.items.length || original.status!=='confirmed' || original.reversalOfId || !['purchase','adjustment','return_in'].includes(original.documentType)) throw new AccessError(409,'INVALID_STATUS')
  if (original.reversal) throw new AccessError(409,'ALREADY_REVERSED')
  const reversal=await tx.stockDocument.create({data:{organizationId:original.organizationId,storeId:original.storeId,supplierId:original.supplierId,
   documentType:'reversal',documentNo:'REV-'+input.operationId,reversalOfId:id,createdBy:context.userId,note:input.reason,
   items:{create:original.items.map(item=>({productId:item.productId,quantity:item.quantity.negated(),unitCost:item.unitCost,note:item.note}))}}})
  for (const item of [...original.items].sort((a,b)=>a.productId.localeCompare(b.productId))) {
   if (original.documentType==='purchase') {
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
   await moveStock(tx,context,{storeId:original.storeId,productId:item.productId,delta:item.quantity.negated(),unitCost:item.unitCost,sourceType:'stock_reversal',sourceId:reversal.id})
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

export const returnTransferSchema=z.object({operationId:z.string().uuid(),reason:z.string().trim().min(3).max(2000),items:z.array(z.object({itemId:z.string().uuid(),quantity:quantitySchema})).min(1).max(500).optional()}).strict()
export async function returnTransfer(context:TokenPayload,id:string,input:z.infer<typeof returnTransferSchema>) {
 if (!['owner','admin'].includes(context.role)) throw new AccessError(403,'MANAGER_REQUIRED')
 return runOperation(context,'transfer.return',input.operationId,{id,reason:input.reason,items:input.items??'all'},async tx=>{
  await tx.$queryRaw`SELECT id FROM "StockTransfer" WHERE id=${id} FOR UPDATE`
  const doc=await tx.stockTransfer.findFirst({where:{id,AND:tenantScope('StockTransfer',context)},include:{items:true}})
  if (!doc) throw new AccessError(404,'NOT_FOUND')
  if (doc.status!=='sent') throw new AccessError(409,'INVALID_STATUS')
  const rows=input.items??doc.items.filter(x=>x.receivedQuantity.add(x.returnedQuantity).lt(x.quantity)).map(x=>({itemId:x.id,quantity:x.quantity.sub(x.receivedQuantity).sub(x.returnedQuantity).toString()}))
  if (!rows.length || new Set(rows.map(x=>x.itemId)).size!==rows.length) throw new AccessError(400,'INVALID_ITEMS')
  for (const row of [...rows].sort((a,b)=>a.itemId.localeCompare(b.itemId))) {
   const item=doc.items.find(x=>x.id===row.itemId)
   if(!item || decimal(row.quantity).gt(item.quantity.sub(item.receivedQuantity).sub(item.returnedQuantity))) throw new AccessError(409,'RETURN_QUANTITY_EXCEEDED','Faqat hali qabul qilinmagan miqdorni qaytarish mumkin')
   await moveStock(tx,context,{storeId:doc.fromStoreId,productId:item.productId,delta:row.quantity,unitCost:item.unitCost,sourceType:'transfer_return',sourceId:input.operationId})
   await tx.stockTransferItem.update({where:{id:item.id},data:{returnedQuantity:{increment:decimal(row.quantity)}}})
  }
  const remaining=await tx.stockTransferItem.findMany({where:{stockTransferId:id}})
  const done=remaining.every(item=>item.receivedQuantity.add(item.returnedQuantity).eq(item.quantity))
  const result=await tx.stockTransfer.update({where:{id},data:{status:done?'closed':'sent'},include:{items:true}})
  await audit(tx,context,'StockTransfer',id,'transit_returned',{items:rows,reason:input.reason,complete:done})
  return result
 })
}
