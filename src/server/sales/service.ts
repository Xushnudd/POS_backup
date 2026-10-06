import { randomUUID } from 'node:crypto'
import { Prisma } from '@prisma/client'
import { z } from 'zod'
import type { TokenPayload } from '@/lib/auth'
import { AccessError, tenantScope } from '../auth/policy'
import { audit, runOperation } from '../operations'
import { moveStock } from '../inventory/movements'
import { allocateMoney, decimal, draftTotals, lineTotal, money } from './calculations'

function validNumeric(value:number|string,precision:number,maximum:string,positive=false) {
  // Zod may run refinements after a dirty union branch. Invalid numbers must
  // become validation issues, never exceptions from Decimal (and HTTP 500).
  try {const parsed=decimal(value);return (positive?parsed.gt(0):parsed.gte(0)) && parsed.decimalPlaces()<=precision && parsed.lt(maximum)} catch {return false}
}
export const amountSchema=z.union([z.number().finite(),z.string().regex(/^\d+(\.\d{1,2})?$/)]).refine(v=>validNumeric(v,2,'1000000000000'),'Summa manfiy bo‘lmasligi kerak')
export const positiveAmountSchema=amountSchema.refine(v=>validNumeric(v,2,'1000000000000',true))
export const quantitySchema=z.union([z.number().finite(),z.string().regex(/^\d+(\.\d{1,6})?$/)]).refine(v=>validNumeric(v,6,'100000000000000',true),'Miqdor musbat bo‘lishi kerak')
export const saleDraftSchema=z.object({
  organizationId:z.string().uuid(),storeId:z.string().uuid(),registerId:z.string().uuid(),shiftId:z.string().uuid(),
  cashierId:z.string().uuid().optional(),customerId:z.string().uuid().nullable().optional(),
  sellerId:z.string().uuid().nullable().optional(),serviceType:z.string().trim().min(1).max(100).optional(),
  operationId:z.string().uuid().optional(), note:z.string().max(2000).optional(),discountAmount:amountSchema.default(0),
  items:z.array(z.object({productId:z.string().uuid(),quantity:quantitySchema,discountAmount:amountSchema.default(0)})).min(1).max(500),
})
export const paymentSchema=z.object({paymentType:z.enum(['cash','card','transfer','credit']),amount:positiveAmountSchema,referenceNo:z.string().max(200).optional()})
export const completeSchema=z.object({operationId:z.string().uuid().optional(),payments:z.array(paymentSchema).max(10),creditDueAt:z.iso.datetime({offset:true}).optional(),cashTendered:amountSchema.optional()})
export type DraftInput=z.infer<typeof saleDraftSchema>
export async function prepareItems(tx:Prisma.TransactionClient,context:TokenPayload,input:DraftInput['items'],receiptDiscount:Prisma.Decimal|number|string) {
  const products=await tx.product.findMany({where:{id:{in:input.map(x=>x.productId)},organizationId:context.organizationId,isActive:true}})
  const units=await tx.unit.findMany({where:{organizationId:context.organizationId,code:{in:[...new Set(products.map(p=>p.unit))]}}})
  // One snapshot/stock posting per SKU, even when scanners submit repeated lines.
  const combined=new Map<string,{productId:string;quantity:Prisma.Decimal;discountAmount:Prisma.Decimal}>()
  for (const item of input) {
    const product=products.find(p=>p.id===item.productId)
    if (!product) throw new AccessError(404,'PRODUCT_NOT_FOUND')
    const unit=units.find(value=>value.code===product.unit)
    if (!unit?.isActive) throw new AccessError(409,'UNIT_UNAVAILABLE')
    if (decimal(item.quantity).decimalPlaces()>unit.precision) throw new AccessError(400,'INVALID_UNIT_PRECISION',`${unit.name} uchun kasr aniqligi ${unit.precision}`)
    const previous=combined.get(item.productId)
    combined.set(item.productId,{productId:item.productId,quantity:decimal(item.quantity).add(previous?.quantity??0),discountAmount:money(item.discountAmount).add(previous?.discountAmount??0)})
  }
  input=[...combined.values()].sort((a,b)=>a.productId.localeCompare(b.productId)).map(item=>({...item,quantity:quantitySchema.parse(item.quantity.toFixed()),discountAmount:amountSchema.parse(item.discountAmount.toFixed())}))
  const rows=input.map(item=>{
    const product=products.find(p=>p.id===item.productId)
    if (!product) throw new AccessError(404,'PRODUCT_NOT_FOUND')
    const quantity=decimal(item.quantity)
    const unit=units.find(value=>value.code===product.unit)
    if (!unit?.isActive) throw new AccessError(409,'UNIT_UNAVAILABLE')
    if (quantity.decimalPlaces()>unit.precision) throw new AccessError(400,'INVALID_UNIT_PRECISION',`${unit.name} uchun kasr aniqligi ${unit.precision}`)
    return {productId:product.id,productName:product.name,sku:product.sku,unit:product.unit,quantity,unitPrice:product.salePrice,unitCost:product.costPrice,
      discountAmount:money(item.discountAmount),lineTotal:lineTotal(quantity,product.salePrice,item.discountAmount)}
  })
  const totals=draftTotals(rows,receiptDiscount)
  await enforceDiscountLimit(tx,context,rows,totals.totalAmount)
  return {rows,totals}
}
export async function enforceDiscountLimit(tx:Prisma.TransactionClient,context:TokenPayload,rows:{quantity:Prisma.Decimal;unitPrice:Prisma.Decimal}[],totalAmount:Prisma.Decimal) {
  const gross=rows.reduce((sum,x)=>sum.add(x.quantity.mul(x.unitPrice)),decimal(0))
  const off=gross.sub(totalAmount)
  const policy=await tx.discountPolicy.findFirst({where:{organizationId:context.organizationId,isActive:true}})
  const max=context.role==='owner'?decimal(100):context.role==='admin'?decimal(policy?.adminMaxPercent??0):decimal(policy?.cashierMaxPercent??0)
  if (gross.gt(0) && off.mul(100).div(gross).gt(max)) throw new AccessError(403,'DISCOUNT_LIMIT','Chegirma vakolat chegarasidan oshdi')
}
export async function requireOpenShift(tx:Prisma.TransactionClient,context:TokenPayload,shiftId:string) {
  await tx.$queryRaw`SELECT id FROM "Shift" WHERE id=${shiftId} FOR UPDATE`
  const shift=await tx.shift.findFirst({where:{id:shiftId,AND:tenantScope('Shift',context)},include:{register:{include:{store:true}}}})
  if (!shift || shift.status!=='open' || !shift.register.isActive || !shift.register.store.isActive) throw new AccessError(409,'INVALID_SHIFT','Smena ochiq emas')
  return shift
}
export async function createDraft(context:TokenPayload,input:DraftInput,key:string) {
  return runOperation(context,'sale.create',key,input,async tx=>{
    const shift=await requireOpenShift(tx,context,input.shiftId)
    if (shift.registerId!==input.registerId || shift.register.storeId!==input.storeId || input.organizationId!==context.organizationId) throw new AccessError(409,'INVALID_RELATION')
    if (input.customerId && !await tx.customer.findFirst({where:{id:input.customerId,organizationId:context.organizationId,isActive:true}})) throw new AccessError(404,'CUSTOMER_NOT_FOUND')
    if(input.sellerId){
      if(context.role==='cashier'&&input.sellerId!==context.userId)throw new AccessError(403,'SELLER_FORBIDDEN')
      if(!await tx.organizationUser.findFirst({where:{organizationId:context.organizationId,userId:input.sellerId,isActive:true,user:{isActive:true},...(context.role!=='owner'?{userStores:{some:{storeId:input.storeId}}}:{})}}))throw new AccessError(404,'SELLER_NOT_FOUND')
    }
    const {rows,totals}=await prepareItems(tx,context,input.items,input.discountAmount)
    const sale=await tx.sale.create({data:{organizationId:context.organizationId,storeId:input.storeId,registerId:input.registerId,shiftId:input.shiftId,cashierId:context.userId,customerId:input.customerId,receiptNo:'RCP-'+randomUUID(),note:input.note,sellerId:input.sellerId,serviceType:input.serviceType,...totals,items:{create:rows}},include:{items:true}})
    await audit(tx,context,'Sale',sale.id,'draft_created')
    return sale
  })
}
export async function completeSale(context:TokenPayload,saleId:string,input:z.infer<typeof completeSchema>,key:string) {
  return runOperation(context,'sale.complete',key,{saleId,payments:input.payments,...(input.creditDueAt?{creditDueAt:input.creditDueAt}:{}),...(input.cashTendered!==undefined?{cashTendered:input.cashTendered}:{})},async tx=>{
    await tx.$queryRaw`SELECT id FROM "Sale" WHERE id=${saleId} FOR UPDATE`
    const sale=await tx.sale.findFirst({where:{id:saleId,AND:tenantScope('Sale',context)},include:{items:true,organization:true}})
    if (!sale) throw new AccessError(404,'NOT_FOUND')
    if (sale.status!=='draft') throw new AccessError(409,'INVALID_STATUS','Savdo allaqachon yakunlangan')
    await requireOpenShift(tx,context,sale.shiftId)
    if (!sale.items.length) throw new AccessError(400,'EMPTY_SALE')
    await enforceDiscountLimit(tx,context,sale.items,sale.totalAmount)
    const total=input.payments.reduce((sum,p)=>sum.add(money(p.amount)),decimal(0))
    if (!total.eq(sale.totalAmount)) throw new AccessError(400,'INVALID_PAYMENT','To‘lovlar jami savdoga teng bo‘lishi kerak')
    const appliedCash=input.payments.filter(p=>p.paymentType==='cash').reduce((sum,p)=>sum.add(money(p.amount)),decimal(0))
    const tender=input.cashTendered===undefined?null:money(input.cashTendered)
    if(tender && (tender.lt(appliedCash)||(appliedCash.eq(0)&&tender.gt(0))))throw new AccessError(400,'INVALID_CASH_TENDER','Berilgan naqd pul naqd qismiga mos emas')
    const cashChange=tender===null?null:tender.sub(appliedCash)
    const credit=input.payments.filter(p=>p.paymentType==='credit').reduce((sum,p)=>sum.add(money(p.amount)),decimal(0))
    if(input.creditDueAt&&(credit.lte(0)||new Date(input.creditDueAt).getTime()<Date.now()))throw new AccessError(400,'INVALID_CREDIT_DUE_DATE','Muddat musbat nasiya qismi uchun va o‘tmagan sana bo‘lishi kerak')
    if (credit.gt(0)) {
      if (!sale.customerId) throw new AccessError(400,'CUSTOMER_REQUIRED')
      await tx.$queryRaw`SELECT id FROM "Customer" WHERE id=${sale.customerId} FOR UPDATE`
      const customer=await tx.customer.findFirst({where:{id:sale.customerId,organizationId:context.organizationId,isActive:true}})
      if (!customer) throw new AccessError(404,'CUSTOMER_NOT_FOUND')
      const debt=await tx.debtEntry.aggregate({where:{customerId:customer.id,organizationId:context.organizationId},_sum:{amount:true}})
      if (decimal(debt._sum.amount??0).add(credit).gt(customer.creditLimit)) throw new AccessError(409,'CREDIT_LIMIT','Nasiya limiti oshdi')
      await tx.debtEntry.create({data:{organizationId:context.organizationId,customerId:customer.id,sourceType:'sale',sourceId:sale.id,saleId:sale.id,amount:credit,actorId:context.userId,dueAt:input.creditDueAt?new Date(input.creditDueAt):undefined}})
    }
    const allocation=allocateMoney(sale.discountAmount,sale.items.map(x=>({id:x.id,weight:x.lineTotal})))
    for (const item of [...sale.items].sort((a,b)=>a.productId.localeCompare(b.productId))) {
      const product=await tx.product.findFirst({where:{id:item.productId,organizationId:context.organizationId,isActive:true}})
      if (product && item.unit && product.unit!==item.unit) throw new AccessError(409,'UNIT_CHANGED','Mahsulot birligi o‘zgardi; savatni yangilang')
      if (!product || !product.salePrice.eq(item.unitPrice)) throw new AccessError(409,'PRICE_CHANGED','Narx o‘zgardi; savatni yangilang')
      await tx.saleItem.update({where:{id:item.id},data:{receiptDiscount:allocation[item.id],unitCost:product.costPrice}})
      await moveStock(tx,context,{storeId:sale.storeId,productId:item.productId,delta:item.quantity.negated(),unitCost:product.costPrice,sourceType:'sale',sourceId:sale.id,allowNegative:sale.organization.allowNegativeStock})
    }
    for (const p of input.payments) await tx.payment.create({data:{organizationId:context.organizationId,storeId:sale.storeId,shiftId:sale.shiftId,saleId:sale.id,customerId:sale.customerId,paymentType:p.paymentType,direction:'in',amount:money(p.amount),referenceNo:p.referenceNo,receivedBy:context.userId,status:'recorded'}})
    const updated=await tx.sale.update({where:{id:sale.id},data:{status:'completed',completedAt:new Date(),cashTendered:tender,cashChange},include:{items:true,payments:true}})
    await audit(tx,context,'Sale',sale.id,'completed',{totalAmount:sale.totalAmount,payments:input.payments,cashTendered:tender,cashChange})
    return updated
  })
}
