import { z } from 'zod'
import type { TokenPayload } from '@/lib/auth'
import { AccessError, tenantScope } from '../auth/policy'
import { runOperation, audit } from '../operations'
import { decimal } from '../sales/calculations'
import { moveStock } from './movements'
import { quantitySchema } from '../sales/service'

export async function confirmStockDocument(context:TokenPayload,id:string) {
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
  const rows=input.items??doc.items.filter(x=>x.receivedQuantity.lt(x.quantity)).map(x=>({itemId:x.id,quantity:x.quantity.sub(x.receivedQuantity).toString()}))
  if (new Set(rows.map(x=>x.itemId)).size!==rows.length || !rows.length) throw new AccessError(400,'INVALID_ITEMS')
  for (const row of [...rows].sort((a,b)=>a.itemId.localeCompare(b.itemId))) {
   const original=doc.items.find(x=>x.id===row.itemId)
   if (!original || decimal(row.quantity).gt(original.quantity.sub(original.receivedQuantity))) throw new AccessError(409,'RECEIVE_QUANTITY_EXCEEDED')
   await moveStock(tx,context,{storeId:doc.toStoreId,productId:original.productId,delta:row.quantity,unitCost:original.unitCost,sourceType:'transfer_in',sourceId:key})
   await tx.stockTransferItem.update({where:{id:original.id},data:{receivedQuantity:{increment:decimal(row.quantity)}}})
  }
  const remaining=await tx.stockTransferItem.findMany({where:{stockTransferId:doc.id}})
  const done=remaining.every(x=>x.receivedQuantity.eq(x.quantity))
  const result=await tx.stockTransfer.update({where:{id},data:{status:done?'received':'sent',...(done&&{receivedAt:new Date()})},include:{items:true}})
  await audit(tx,context,'StockTransfer',id,'received',{items:rows,complete:done})
  return result
 })
}
