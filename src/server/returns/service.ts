import {validateUnitQuantity} from '../catalog/service'
import { randomUUID } from 'node:crypto'
import { z } from 'zod'
import type { TokenPayload } from '@/lib/auth'
import { AccessError, tenantScope } from '../auth/policy'
import { audit, runOperation } from '../operations'
import { moveStock } from '../inventory/movements'
import { allocateMoney, decimal, money } from '../sales/calculations'
import { quantitySchema, requireOpenShift } from '../sales/service'

export const returnSchema=z.object({operationId:z.string().uuid(),shiftId:z.string().uuid(),reason:z.string().min(2).max(2000),
 items:z.array(z.object({saleItemId:z.string().uuid(),quantity:quantitySchema,disposition:z.enum(['sellable','damaged','write_off']).default('sellable')})).min(1).max(500)})
export async function returnSale(context:TokenPayload,saleId:string,input:z.infer<typeof returnSchema>) {
 if (context.role==='cashier') throw new AccessError(403,'MANAGER_REQUIRED')
 return runOperation(context,'sale.return',input.operationId,{saleId,...input},async tx=>{
  await tx.$queryRaw`SELECT id FROM "Sale" WHERE id=${saleId} FOR UPDATE`
  const sale=await tx.sale.findFirst({where:{id:saleId,AND:tenantScope('Sale',context)},include:{items:{include:{saleReturnItems:true}},payments:true,saleReturns:true}})
  if (!sale) throw new AccessError(404,'NOT_FOUND')
  if (!['completed','partially_returned'].includes(sale.status)) throw new AccessError(409,'INVALID_STATUS')
  const shift=await requireOpenShift(tx,context,input.shiftId)
  if (shift.register.storeId!==sale.storeId) throw new AccessError(409,'INVALID_SHIFT')
  if (new Set(input.items.map(x=>x.saleItemId)).size!==input.items.length) throw new AccessError(400,'DUPLICATE_ITEM')
  const rows=input.items.map(requested=>{
   const original=sale.items.find(x=>x.id===requested.saleItemId)
   if (!original) throw new AccessError(404,'ITEM_NOT_FOUND')
   const returned=original.saleReturnItems.reduce((sum,x)=>sum.add(x.quantity),decimal(0))
   const oldAmount=original.saleReturnItems.reduce((sum,x)=>sum.add(x.lineTotal),decimal(0))
   const qty=decimal(requested.quantity),remaining=original.quantity.sub(returned)
   if (qty.gt(remaining)) throw new AccessError(409,'RETURN_QUANTITY_EXCEEDED')
   const net=original.lineTotal.sub(original.receiptDiscount)
   const amount=qty.eq(remaining)?net.sub(oldAmount):money(net.mul(qty).div(original.quantity))
   return {saleItemId:original.id,productId:original.productId,quantity:qty,unitPrice:original.unitPrice,lineTotal:amount,disposition:requested.disposition,unitCost:original.unitCost}
  })
  for (const row of rows) { const unit=sale.items.find(item=>item.id===row.saleItemId)?.unit; if(unit) await validateUnitQuantity(tx,context.organizationId,unit,row.quantity) }
  const refund=rows.reduce((sum,x)=>sum.add(x.lineTotal),decimal(0))
  const totalReturned=sale.saleReturns.reduce((sum,x)=>sum.add(x.refundAmount),decimal(0))
  if (refund.add(totalReturned).gt(sale.totalAmount)) throw new AccessError(409,'REFUND_EXCEEDED')
  const originalPayments=sale.payments.filter(x=>x.direction==='in' && x.note!=='debt_collection')
  const credit=originalPayments.filter(x=>x.paymentType==='credit').reduce((sum,x)=>sum.add(x.amount),decimal(0))
  const cash=originalPayments.filter(x=>x.paymentType==='cash').reduce((sum,x)=>sum.add(x.amount),decimal(0))
  const other=sale.totalAmount.sub(credit).sub(cash)
  // Vendor refunds are deliberately out of scope. Never pretend card/Click was refunded.
  if (other.gt(0)) throw new AccessError(409,'EXTERNAL_REFUND_REQUIRED','Bu savdoning tashqi to‘lovi qaytarilishi integratsiya tayyor bo‘lgach bajariladi')
  let outstandingCredit=decimal(0),waivedCredit=decimal(0)
  if (sale.customerId) {
   await tx.$queryRaw`SELECT id FROM "Customer" WHERE id=${sale.customerId} FOR UPDATE`
   const debt=await tx.debtEntry.aggregate({where:{organizationId:context.organizationId,customerId:sale.customerId,saleId:sale.id},_sum:{amount:true}})
   outstandingCredit=PrismaMinZero(debt._sum.amount)
   const waived=await tx.debtEntry.aggregate({where:{organizationId:context.organizationId,customerId:sale.customerId,saleId:sale.id,sourceType:{in:['write_off','write_off_reversal']}},_sum:{amount:true}})
   waivedCredit=decimal(waived._sum.amount??0).negated()
   if(waivedCredit.lt(0))throw new AccessError(409,'DEBT_RECONCILIATION_REQUIRED')
   // Cash cannot refund a debt repayment received through a bank/other channel.
   // Preserve its actual channel until an explicit refund settlement flow is available.
   const allocations=await tx.debtEntry.findMany({where:{organizationId:context.organizationId,saleId:sale.id,sourceType:'collection'}})
   const paymentIds=[...new Set(allocations.map(entry=>entry.sourceId.split(':')[0]))]
   if (paymentIds.length && await tx.payment.count({where:{id:{in:paymentIds},organizationId:context.organizationId,paymentType:{not:'cash'}}})) throw new AccessError(409,'EXTERNAL_REFUND_REQUIRED','Nasiya bank orqali to‘langan; uni avtomatik naqd qaytarish mumkin emas')
   if (credit.gt(0) && await tx.debtEntry.count({where:{organizationId:context.organizationId,customerId:sale.customerId,saleId:null,sourceType:'legacy_payment',amount:{lt:0}}})) throw new AccessError(409,'DEBT_ALLOCATION_REQUIRED','Eski qarz to‘lovlarini original savdolarga taqsimlash kerak')

  }
  const remainingLiability=sale.totalAmount.sub(totalReturned)
  if (outstandingCredit.add(waivedCredit).gt(remainingLiability)) throw new AccessError(409,'DEBT_RECONCILIATION_REQUIRED')
  const split=allocateMoney(refund,[{id:'cash',weight:remainingLiability.sub(outstandingCredit).sub(waivedCredit)},{id:'credit',weight:outstandingCredit},{id:'waived',weight:waivedCredit}])
  const debtReduction=split.credit.add(split.waived)
  const cashRefund=split.cash
  const ret=await tx.saleReturn.create({data:{saleId:sale.id,returnReceiptNo:'RET-'+randomUUID(),refundAmount:refund,reason:input.reason,processedBy:context.userId,
    items:{create:rows.map(({unitCost,...row})=>{void unitCost;return row})}},include:{items:true}})
  if (debtReduction.gt(0) && sale.customerId) await tx.debtEntry.create({data:{organizationId:context.organizationId,customerId:sale.customerId,sourceType:'return',sourceId:ret.id,saleId:sale.id,amount:debtReduction.negated(),actorId:context.userId}})
  if (split.waived.gt(0) && sale.customerId) await tx.debtEntry.create({data:{organizationId:context.organizationId,customerId:sale.customerId,sourceType:'write_off_reversal',sourceId:ret.id,saleId:sale.id,amount:split.waived,actorId:context.userId,note:'Written-off liability returned'}})
  if (cashRefund.gt(0)) await tx.payment.create({data:{organizationId:context.organizationId,storeId:sale.storeId,shiftId:input.shiftId,saleId:sale.id,customerId:sale.customerId,paymentType:'cash',direction:'out',amount:cashRefund,receivedBy:context.userId,note:'return:'+ret.id}})
  for (const row of rows) if (row.disposition==='sellable') await moveStock(tx,context,{storeId:sale.storeId,productId:row.productId,delta:row.quantity,unitCost:row.unitCost,sourceType:'return',sourceId:ret.id})
  const allReturned=sale.items.every(x=>{
   const previous=x.saleReturnItems.reduce((sum,r)=>sum.add(r.quantity),decimal(0))
   const current=rows.find(r=>r.saleItemId===x.id)?.quantity??decimal(0)
   return previous.add(current).eq(x.quantity)
  })
  await tx.sale.update({where:{id:sale.id},data:{status:allReturned?'returned':'partially_returned'}})
  await audit(tx,context,'SaleReturn',ret.id,'returned',{saleId,refundAmount:refund,debtReduction,cashRefund,waiverReversal:split.waived,reason:input.reason})
  return ret
 })
}
function PrismaMinZero(value: Parameters<typeof decimal>[0] | null) { const v=decimal(value??0);return v.lt(0)?decimal(0):v }
