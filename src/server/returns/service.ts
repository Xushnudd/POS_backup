import {cumulativeRefundComponent} from '../taxes/calculations'
import {money} from '../sales/calculations'
import {validateUnitQuantity} from '../catalog/service'
import { randomUUID } from 'node:crypto'
import {Prisma} from '@prisma/client'
import {prisma} from '@/lib/prisma'
import { z } from 'zod'
import type { TokenPayload } from '@/lib/auth'
import { AccessError, tenantScope } from '../auth/policy'
import { assertLiveContext, audit, runOperation } from '../operations'
import { moveStock } from '../inventory/movements'
import { weightedAverage } from '../inventory/valuation'
import { allocateMoney, decimal, partialReturnAmount } from '../sales/calculations'
import { amountSchema, quantitySchema, requireOpenShift } from '../sales/service'

export const returnSchema=z.object({operationId:z.string().uuid(),shiftId:z.string().uuid(),reason:z.string().trim().min(2).max(2000),
 manualNonCash:z.object({confirmed:z.literal(true),referenceNo:z.string().trim().min(3).max(200),expectedSettlement:z.object({cash:amountSchema,card:amountSchema,transfer:amountSchema,debt:amountSchema,waived:amountSchema}).strict()}).strict().optional(),
 items:z.array(z.object({saleItemId:z.string().uuid(),quantity:quantitySchema,disposition:z.enum(['sellable','damaged','write_off']).default('sellable')})).min(1).max(500)})
export type RefundPreview={refundAmount:Prisma.Decimal;settlement:Record<'cash'|'card'|'transfer'|'debt'|'waived',Prisma.Decimal>};
export type PostedReturn=Prisma.SaleReturnGetPayload<{include:{items:true}}>&RefundPreview;
export function returnSale(context:TokenPayload,saleId:string,input:z.infer<typeof returnSchema>,preview?:false):Promise<PostedReturn>;
export function returnSale(context:TokenPayload,saleId:string,input:z.infer<typeof returnSchema>,preview:true):Promise<RefundPreview>;
export async function returnSale(context:TokenPayload,saleId:string,input:z.infer<typeof returnSchema>,preview=false) {
 if (!['owner','admin'].includes(context.role)) throw new AccessError(403,'MANAGER_REQUIRED')
 return preview?prisma.$transaction(tx=>returnSaleTx(tx,context,saleId,input,true),{isolationLevel:'RepeatableRead'}):runOperation(context,'sale.return',input.operationId,{saleId,...input},tx=>returnSaleTx(tx,context,saleId,input))
}
export function returnSaleTx(tx:Prisma.TransactionClient,context:TokenPayload,saleId:string,input:z.infer<typeof returnSchema>,preview?:false):Promise<PostedReturn>;
export function returnSaleTx(tx:Prisma.TransactionClient,context:TokenPayload,saleId:string,input:z.infer<typeof returnSchema>,preview:true):Promise<RefundPreview>;
export async function returnSaleTx(tx:Prisma.TransactionClient,context:TokenPayload,saleId:string,input:z.infer<typeof returnSchema>,preview=false) {
 if (!['owner','admin'].includes(context.role)) throw new AccessError(403,'MANAGER_REQUIRED')
  if(preview)await assertLiveContext(tx,context);
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
   const net=original.payableAmount??original.lineTotal.sub(original.receiptDiscount)
   const amount=partialReturnAmount(net,original.quantity,returned,oldAmount,qty)
   const oldTax=original.saleReturnItems.reduce((n,r)=>n.add(r.taxAmount),decimal(0)),oldDiscount=original.saleReturnItems.reduce((n,r)=>n.add(r.discountAmount),decimal(0))
   const taxAmount=original.taxBase===null?decimal(0):cumulativeRefundComponent(original.taxAmount,net,oldAmount,oldTax,amount)
   const originalDiscount=original.discountAmount.add(original.receiptDiscount),discountTarget=qty.eq(remaining)?originalDiscount:money(originalDiscount.mul(returned.add(qty)).div(original.quantity)),discountAmount=discountTarget.sub(oldDiscount)
   if(discountAmount.lt(0))throw new AccessError(409,'RETURN_DISCOUNT_RECONCILIATION')
   return {saleItemId:original.id,productId:original.productId,quantity:qty,unitPrice:original.unitPrice,lineTotal:amount,taxAmount,taxBase:original.taxBase===null?null:amount.sub(taxAmount),discountAmount,disposition:requested.disposition,unitCost:original.unitCost}
  })
  for (const row of rows) { const unit=sale.items.find(item=>item.id===row.saleItemId)?.unit; if(unit) await validateUnitQuantity(tx,context.organizationId,unit,row.quantity) }
  const refund=rows.reduce((sum,x)=>sum.add(x.lineTotal),decimal(0))
  const totalReturned=sale.saleReturns.reduce((sum,x)=>sum.add(x.refundAmount),decimal(0))
  if (refund.add(totalReturned).gt(sale.totalAmount)) throw new AccessError(409,'REFUND_EXCEEDED')
  const originalPayments=sale.payments.filter(x=>x.direction==='in' && x.note!=='debt_collection')
  const credit=originalPayments.filter(x=>x.paymentType==='credit').reduce((sum,x)=>sum.add(x.amount),decimal(0))
  const cash=originalPayments.filter(x=>x.paymentType==='cash').reduce((sum,x)=>sum.add(x.amount),decimal(0))
  const paid={cash,card:originalPayments.filter(x=>x.paymentType==='card').reduce((sum,x)=>sum.add(x.amount),decimal(0)),transfer:originalPayments.filter(x=>x.paymentType==='transfer').reduce((sum,x)=>sum.add(x.amount),decimal(0))}
  // Only internally recorded manual payments are eligible. A provider result is
  // never inferred from an operator's confirmation or from this local journal.
  if(originalPayments.some(payment=>payment.sourceType!=='manual'||(payment.paymentType!=='credit'&&payment.status!=='recorded')))throw new AccessError(409,'EXTERNAL_REFUND_REQUIRED')
  let outstandingCredit=decimal(0),waivedCredit=decimal(0)
  if (sale.customerId) {
   await tx.$queryRaw`SELECT id FROM "Customer" WHERE id=${sale.customerId} FOR UPDATE`
   const debt=await tx.debtEntry.aggregate({where:{organizationId:context.organizationId,customerId:sale.customerId,saleId:sale.id},_sum:{amount:true}})
   outstandingCredit=PrismaMinZero(debt._sum.amount)
   const waived=await tx.debtEntry.aggregate({where:{organizationId:context.organizationId,customerId:sale.customerId,saleId:sale.id,sourceType:{in:['write_off','write_off_reversal']}},_sum:{amount:true}})
   waivedCredit=decimal(waived._sum.amount??0).negated()
   if(waivedCredit.lt(0))throw new AccessError(409,'DEBT_RECONCILIATION_REQUIRED')
   const allocations=await tx.debtEntry.findMany({where:{organizationId:context.organizationId,saleId:sale.id,sourceType:'collection'}})
   const paymentIds=[...new Set(allocations.map(entry=>entry.sourceId.split(':')[0]))]
   const collected=await tx.payment.findMany({where:{id:{in:paymentIds},organizationId:context.organizationId}})
   for(const allocation of allocations){
    const payment=collected.find(row=>row.id===allocation.sourceId.split(':')[0]);
    if(!payment||payment.sourceType!=='manual'||payment.status!=='recorded'||!['cash','card','transfer'].includes(payment.paymentType))throw new AccessError(409,'EXTERNAL_REFUND_REQUIRED')
    const channel=payment.paymentType as keyof typeof paid;
    paid[channel]=paid[channel].sub(allocation.amount);
   }
   if (credit.gt(0) && await tx.debtEntry.count({where:{organizationId:context.organizationId,customerId:sale.customerId,saleId:null,sourceType:'legacy_payment',amount:{lt:0}}})) throw new AccessError(409,'DEBT_ALLOCATION_REQUIRED','Eski qarz to‘lovlarini original savdolarga taqsimlash kerak')

  }
  const remainingLiability=sale.totalAmount.sub(totalReturned)
  for(const payment of sale.payments.filter(row=>row.direction==='out'&&row.note?.startsWith('return:'))){
   if(!['cash','card','transfer'].includes(payment.paymentType))throw new AccessError(409,'DEBT_RECONCILIATION_REQUIRED')
   const channel=payment.paymentType as keyof typeof paid;paid[channel]=paid[channel].sub(payment.amount);
  }
  if(Object.values(paid).some(amount=>amount.lt(0))||!paid.cash.add(paid.card).add(paid.transfer).add(outstandingCredit).add(waivedCredit).eq(remainingLiability))throw new AccessError(409,'DEBT_RECONCILIATION_REQUIRED')
  if (outstandingCredit.add(waivedCredit).gt(remainingLiability)) throw new AccessError(409,'DEBT_RECONCILIATION_REQUIRED')
  const split=allocateMoney(refund,[{id:'cash',weight:paid.cash},{id:'card',weight:paid.card},{id:'transfer',weight:paid.transfer},{id:'credit',weight:outstandingCredit},{id:'waived',weight:waivedCredit}])
  if(preview)return {refundAmount:refund,settlement:{cash:split.cash,card:split.card,transfer:split.transfer,debt:split.credit,waived:split.waived}};
  if(split.card.add(split.transfer).gt(0)&&!input.manualNonCash)throw new AccessError(409,'EXTERNAL_REFUND_REQUIRED','Bank/karta qismi avtomatik naqd qaytarilmaydi. Faqat haqiqatan tashqarida qaytarilgan qo‘lda to‘lovni tasdiq va hujjat raqami bilan qayd eting.')
  if(input.manualNonCash){const expected=input.manualNonCash.expectedSettlement;const actual={cash:split.cash,card:split.card,transfer:split.transfer,debt:split.credit,waived:split.waived};for(const key of Object.keys(actual) as (keyof typeof actual)[])if(!actual[key].eq(expected[key]))throw new AccessError(409,'REFUND_ALLOCATION_CHANGED','Qaytarma taqsimoti o‘zgardi. Bank amalini takrorlamang; haqiqiy hujjat va yangi hisobni manager bilan solishtiring.')}
  const debtReduction=split.credit.add(split.waived)
  const cashRefund=split.cash
  const ret=await tx.saleReturn.create({data:{saleId:sale.id,returnReceiptNo:'RET-'+randomUUID(),refundAmount:refund,reason:input.reason,processedBy:context.userId,
    approvedBy:context.userId,approvedRole:context.role,approvedAt:new Date(),
    items:{create:rows.map(({unitCost,...row})=>{void unitCost;return row})}},include:{items:true}})
  for(const row of rows.filter(item=>item.disposition!=='sellable')){
   const original=sale.items.find(item=>item.id===row.saleItemId)!;
   const returnedItem=ret.items.find(item=>item.saleItemId===row.saleItemId)!;
   const location=row.disposition==='damaged'?await tx.damageLocation.upsert({where:{storeId:sale.storeId},create:{organizationId:context.organizationId,storeId:sale.storeId},update:{}}):null;
   await tx.returnDispositionEntry.create({data:{organizationId:context.organizationId,storeId:sale.storeId,productId:row.productId,returnItemId:returnedItem.id,locationId:location?.id,disposition:row.disposition,quantity:row.quantity,unitCost:row.unitCost,productName:original.productName,sku:original.sku,unit:original.unit,actorId:context.userId}});
  }
  if (debtReduction.gt(0) && sale.customerId) await tx.debtEntry.create({data:{organizationId:context.organizationId,customerId:sale.customerId,sourceType:'return',sourceId:ret.id,saleId:sale.id,amount:debtReduction.negated(),actorId:context.userId}})
  if (split.waived.gt(0) && sale.customerId) await tx.debtEntry.create({data:{organizationId:context.organizationId,customerId:sale.customerId,sourceType:'write_off_reversal',sourceId:ret.id,saleId:sale.id,amount:split.waived,actorId:context.userId,note:'Written-off liability returned'}})
  for(const channel of ['cash','card','transfer'] as const)if(split[channel].gt(0))await tx.payment.create({data:{sourceType:'manual',organizationId:context.organizationId,storeId:sale.storeId,shiftId:input.shiftId,saleId:sale.id,customerId:sale.customerId,paymentType:channel,direction:'out',amount:split[channel],receivedBy:context.userId,note:'return:'+ret.id,...(channel!=='cash'?{referenceNo:input.manualNonCash!.referenceNo}:{})}})
  for (const row of [...rows].sort((a,b)=>a.productId.localeCompare(b.productId))) if (row.disposition==='sellable') {
   await tx.$queryRaw`SELECT id FROM "Product" WHERE id=${row.productId} FOR UPDATE`
   const product=await tx.product.findFirstOrThrow({where:{id:row.productId,organizationId:context.organizationId}})
   const stock=await tx.inventoryBalance.aggregate({where:{productId:row.productId},_sum:{quantity:true}})
   const cost=weightedAverage(stock._sum.quantity??0,product.costPrice,row.quantity,row.unitCost)
   await tx.product.update({where:{id:row.productId},data:{costPrice:cost}})
   await moveStock(tx,context,{storeId:sale.storeId,productId:row.productId,delta:row.quantity,unitCost:row.unitCost,sourceType:'return',sourceId:ret.id})
  }
  const allReturned=sale.items.every(x=>{
   const previous=x.saleReturnItems.reduce((sum,r)=>sum.add(r.quantity),decimal(0))
   const current=rows.find(r=>r.saleItemId===x.id)?.quantity??decimal(0)
   return previous.add(current).eq(x.quantity)
  })
  await tx.sale.update({where:{id:sale.id},data:{status:allReturned?'returned':'partially_returned'}})
  const settlement={cash:split.cash,card:split.card,transfer:split.transfer,debt:split.credit,waived:split.waived};
  await audit(tx,context,'SaleReturn',ret.id,'returned',{saleId,refundAmount:refund,debtReduction,cashRefund,settlement,manualReference:input.manualNonCash?.referenceNo,waiverReversal:split.waived,reason:input.reason,approvedBy:ret.approvedBy,approvedRole:ret.approvedRole,approvedAt:ret.approvedAt})
  return {...ret,settlement}
}

function PrismaMinZero(value: Parameters<typeof decimal>[0] | null) { const v=decimal(value??0);return v.lt(0)?decimal(0):v }
