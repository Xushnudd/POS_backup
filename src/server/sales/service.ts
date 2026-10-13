import {serialIdsSchema} from '../inventory/serials'
import {attachSaleBatches} from '../inventory/batches'
import {resolveConversion,assertCurrentConversion} from '../catalog/conversions'
import type {ConversionSnapshot} from '../catalog/conversion-math'
import {complianceSnapshot,assertProductCompliance} from '../catalog/compliance'
import {consumeStock} from '../inventory/reservations'
import {resolvePrices} from '../catalog/price-rules'
import {randomUUID} from 'node:crypto'
import {discountAmount as resolveDiscount,discountAuthorization} from './discounts'
import {priceTaxLines} from '../taxes/calculations'
import {productTaxes,taxFingerprint} from '../taxes/service'
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
  expectedTotalAmount:amountSchema.optional(),expectedTaxFingerprint:z.string().regex(/^[a-f0-9]{64}$/).optional(),
  operationId:z.string().uuid().optional(), note:z.string().max(2000).optional(),discountAmount:amountSchema.default(0),discountPercent:amountSchema.refine(v=>decimal(v).lte(100)).optional(),discountReason:z.string().trim().min(3).max(2000).optional(),
  items:z.array(z.object({productId:z.string().uuid(),quantity:quantitySchema,tradeUnit:z.string().regex(/^[a-z][a-z0-9_-]{0,31}$/).optional(),expectedConversionRatio:z.string().regex(/^\d+(\.\d{1,6})?$/).optional(),discountAmount:amountSchema.default(0),discountPercent:amountSchema.refine(v=>decimal(v).lte(100)).optional(),expectedUnitPrice:amountSchema.optional()})).min(1).max(500),
})
export const paymentSchema=z.object({paymentType:z.enum(['cash','card','transfer','credit']),amount:positiveAmountSchema,referenceNo:z.string().max(200).optional()})
export const completeSchema=z.object({serialSelections:z.array(z.object({productId:z.string().uuid(),ids:serialIdsSchema}).strict()).max(500).refine(rows=>new Set(rows.map(r=>r.productId)).size===rows.length).optional(),reservationId:z.string().uuid().optional(),operationId:z.string().uuid().optional(),payments:z.array(paymentSchema).max(10),creditDueAt:z.iso.datetime({offset:true}).optional(),cashTendered:amountSchema.optional()})
export type DraftInput=z.infer<typeof saleDraftSchema>
export async function prepareItems(tx:Prisma.TransactionClient,context:TokenPayload,input:DraftInput['items'],receiptDiscount:Prisma.Decimal|number|string,options:{discountPercent?:number|string;discountReason?:string|null;storeId?:string;customerId?:string|null}={}) {
  const argumentsExpected=input
  const products=await tx.product.findMany({where:{id:{in:input.map(x=>x.productId)},organizationId:context.organizationId,isActive:true}})
  const units=await tx.unit.findMany({where:{organizationId:context.organizationId,code:{in:[...new Set([...products.map(p=>p.unit),...input.flatMap(i=>i.tradeUnit?[i.tradeUnit]:[])])]}}})
  const conversionCatalogue={units,conversions:input.some(i=>i.tradeUnit)?await tx.productUnitConversion.findMany({where:{organizationId:context.organizationId,productId:{in:products.map(p=>p.id)},tradeUnit:{in:input.flatMap(i=>i.tradeUnit?[i.tradeUnit]:[])},isActive:true}}):[]};
  // One snapshot/stock posting per SKU, even when scanners submit repeated lines.
  const combined=new Map<string,{productId:string;quantity:Prisma.Decimal;discountAmount:Prisma.Decimal;discountPercent?:number|string}>();const conversions=new Map<string,ConversionSnapshot|null>()
  for (const item of input) {
    const product=products.find(p=>p.id===item.productId)
    if (!product) throw new AccessError(404,'PRODUCT_NOT_FOUND')
    const unit=units.find(value=>value.code===product.unit)
    if (!unit?.isActive) throw new AccessError(409,'UNIT_UNAVAILABLE')
    const converted=await resolveConversion(tx,context.organizationId,product,item.quantity,item.tradeUnit,conversionCatalogue);if(item.expectedConversionRatio!==undefined&&decimal(item.expectedConversionRatio).toFixed()!==(converted.snapshot?.ratio??'1'))throw new AccessError(409,'CONVERSION_CHANGED');
    if (converted.quantity.decimalPlaces()>unit.precision) throw new AccessError(400,'INVALID_UNIT_PRECISION',`${unit.name} uchun kasr aniqligi ${unit.precision}`)
    const previous=combined.get(item.productId);const oldConversion=conversions.get(item.productId);if(previous&&(oldConversion?.tradeUnit??product.unit)!==(converted.snapshot?.tradeUnit??product.unit))throw new AccessError(400,'MIXED_TRADE_UNITS');conversions.set(item.productId,converted.snapshot?{...converted.snapshot,tradeQuantity:decimal(converted.snapshot.tradeQuantity).add(oldConversion?.tradeQuantity??0).toFixed()}:null)
    if(previous&&(item.discountPercent!==undefined||previous.discountPercent!==undefined))throw new AccessError(400,'DUPLICATE_PERCENT_ITEM','Foizli SKU bir qatorda birlashtirilsin')
    combined.set(item.productId,{productId:item.productId,quantity:converted.quantity.add(previous?.quantity??0),discountAmount:money(item.discountAmount).add(previous?.discountAmount??0),discountPercent:item.discountPercent})
  }
  input=[...combined.values()].sort((a,b)=>a.productId.localeCompare(b.productId)).map(item=>({...item,quantity:quantitySchema.parse(item.quantity.toFixed()),discountAmount:amountSchema.parse(item.discountAmount.toFixed())}))
  const prices=await resolvePrices(tx,context,input.map(item=>({productId:item.productId,quantity:decimal(item.quantity),basePrice:products.find(p=>p.id===item.productId)!.salePrice})),options)
  for(const item of argumentsExpected){const price=prices.get(item.productId)!;if(item.expectedUnitPrice!==undefined&&!price.unitPrice.eq(item.expectedUnitPrice))throw new AccessError(409,'PRICE_CHANGED','Narx darajasi yoki sana o‘zgardi; savatni yangilang',undefined,{stage:'sale',productId:item.productId,productName:products.find(p=>p.id===item.productId)?.name,previousPrice:money(item.expectedUnitPrice),currentPrice:price.unitPrice})}
  const taxFor=await productTaxes(tx,context.organizationId,products.map(p=>p.taxProfileId));
  const rawRows=input.map(item=>{
    const product=products.find(p=>p.id===item.productId)
    if (!product) throw new AccessError(404,'PRODUCT_NOT_FOUND')
    const price=prices.get(item.productId)!
    const quantity=decimal(item.quantity)
    const unit=units.find(value=>value.code===product.unit)
    if (!unit?.isActive) throw new AccessError(409,'UNIT_UNAVAILABLE')
    if (quantity.decimalPlaces()>unit.precision) throw new AccessError(400,'INVALID_UNIT_PRECISION',`${unit.name} uchun kasr aniqligi ${unit.precision}`)
    const discountAmount=resolveDiscount(lineTotal(quantity,price.unitPrice,0),item.discountAmount,item.discountPercent)
    return {conversionSnapshot:conversions.get(product.id)??Prisma.DbNull,complianceSnapshot:complianceSnapshot(product),id:product.id,priceRuleId:price.priceRuleId,priceSnapshot:price.priceSnapshot,...taxFor(product.taxProfileId),productId:product.id,productName:product.name,sku:product.sku,unit:product.unit,quantity,unitPrice:price.unitPrice,unitCost:product.costPrice,
      discountPercent:item.discountPercent===undefined?null:decimal(item.discountPercent),discountAmount,lineTotal:lineTotal(quantity,price.unitPrice,discountAmount)}
  })
  const base=rawRows.reduce((n,row)=>n.add(row.lineTotal),decimal(0))
  receiptDiscount=resolveDiscount(base,receiptDiscount,options.discountPercent)
  const rawTotals=draftTotals(rawRows,receiptDiscount)
  const authorization=await discountAuthorization(tx,context,rawRows,rawTotals.totalAmount,options.discountReason)
  const rows=priceTaxLines(rawRows,receiptDiscount).map(row=>({...row,id:randomUUID()}))
  const taxAmount=rows.reduce((sum,row)=>sum.add(row.taxAmount),decimal(0)),netAmount=rows.reduce((sum,row)=>sum.add(row.taxBase),decimal(0))
  const totals={...rawTotals,totalAmount:netAmount.add(taxAmount),taxAmount,netAmount}
  if(totals.totalAmount.gte('1000000000000'))throw new AccessError(400,'INVALID_AMOUNT')
  return {rows,totals,authorization,taxFingerprint:taxFingerprint(rows)}
}
export async function enforceDiscountLimit(tx:Prisma.TransactionClient,context:TokenPayload,rows:{quantity:Prisma.Decimal;unitPrice:Prisma.Decimal}[],totalAmount:Prisma.Decimal,reason?:string|null,requireReason=true) {
  return discountAuthorization(tx,context,rows,totalAmount,reason,requireReason)
}
export async function requireOpenShift(tx:Prisma.TransactionClient,context:TokenPayload,shiftId:string,closing=false) {
  await tx.$queryRaw`SELECT id FROM "Shift" WHERE id=${shiftId} FOR UPDATE`
  const shift=await tx.shift.findFirst({where:{id:shiftId,AND:tenantScope('Shift',context)},include:{register:{include:{store:true}}}})
  if (!shift || shift.status!=='open' || !shift.register.isActive || !shift.register.store.isActive) throw new AccessError(409,'INVALID_SHIFT','Smena ochiq emas')
  if(shift.pendingClose&&!closing)throw new AccessError(409,'SHIFT_CLOSE_PENDING','Smena yopilishi rahbar tasdig‘ini kutmoqda')
  return shift
}
export async function createDraft(context:TokenPayload,input:DraftInput,key:string) {
  return runOperation(context,'sale.create',key,input,tx=>createDraftTx(tx,context,input))
}
export async function createDraftTx(tx:Prisma.TransactionClient,context:TokenPayload,input:DraftInput) {
    const shift=await requireOpenShift(tx,context,input.shiftId)
    if (shift.registerId!==input.registerId || shift.register.storeId!==input.storeId || input.organizationId!==context.organizationId) throw new AccessError(409,'INVALID_RELATION')
    if (input.customerId && !await tx.customer.findFirst({where:{id:input.customerId,organizationId:context.organizationId,isActive:true}})) throw new AccessError(404,'CUSTOMER_NOT_FOUND')
    if(input.sellerId){
      if(context.role==='cashier'&&input.sellerId!==context.userId)throw new AccessError(403,'SELLER_FORBIDDEN')
      if(!await tx.organizationUser.findFirst({where:{organizationId:context.organizationId,userId:input.sellerId,isActive:true,user:{isActive:true},...(context.role!=='owner'?{userStores:{some:{storeId:input.storeId}}}:{})}}))throw new AccessError(404,'SELLER_NOT_FOUND')
    }
    const {rows,totals,authorization,taxFingerprint:fingerprint}=await prepareItems(tx,context,input.items,input.discountAmount,input)
    if(input.expectedTotalAmount!==undefined&&!totals.totalAmount.eq(input.expectedTotalAmount)||input.expectedTaxFingerprint!==undefined&&input.expectedTaxFingerprint!==fingerprint)throw new AccessError(409,'TAX_OR_TOTAL_CHANGED','Narx yoki soliq hisobi o‘zgardi; to‘lov oldidan qayta ko‘rib chiqing')
    const [counter]=await tx.$queryRaw<{value:Prisma.Decimal}[]>`UPDATE "Register" SET "receiptSequence"="receiptSequence"+1 WHERE id=${input.registerId} RETURNING "receiptSequence" AS value`
    const sale=await tx.sale.create({data:{organizationId:context.organizationId,storeId:input.storeId,registerId:input.registerId,shiftId:input.shiftId,cashierId:context.userId,customerId:input.customerId,receiptNo:'POS-'+counter.value.toFixed(0),note:input.note,sellerId:input.sellerId,serviceType:input.serviceType,...authorization,discountPercent:input.discountPercent===undefined?null:decimal(input.discountPercent),...totals,items:{create:rows}},include:{items:true}})
    await audit(tx,context,'Sale',sale.id,'draft_created')
    return sale
}
export async function completeSale(context:TokenPayload,saleId:string,input:z.infer<typeof completeSchema>,key:string) {
  return runOperation(context,'sale.complete',key,{saleId,payments:input.payments,...(input.serialSelections?{serialSelections:input.serialSelections}:{}),...(input.reservationId?{reservationId:input.reservationId}:{}),...(input.creditDueAt?{creditDueAt:input.creditDueAt}:{}),...(input.cashTendered!==undefined?{cashTendered:input.cashTendered}:{})},tx=>completeSaleTx(tx,context,saleId,input,key))
}
export async function completeSaleTx(tx:Prisma.TransactionClient,context:TokenPayload,saleId:string,input:z.infer<typeof completeSchema>,key:string,allowedOfflineLeaseId?:string,ownerReviewedOffline=false) {
    await tx.$queryRaw`SELECT id FROM "Sale" WHERE id=${saleId} FOR UPDATE`
    const sale=await tx.sale.findFirst({where:{id:saleId,AND:tenantScope('Sale',context)},include:{items:true,organization:true}})
    if (!sale) throw new AccessError(404,'NOT_FOUND')
    if (sale.status!=='draft') throw new AccessError(409,'INVALID_STATUS','Savdo allaqachon yakunlangan')
    const offlineLease=await tx.offlineCashLease.findFirst({where:{saleId:sale.id,state:'issued'}});if(offlineLease&&offlineLease.id!==allowedOfflineLeaseId)throw new AccessError(409,'OFFLINE_TICKET_PENDING','Offline ticketni sinxronlang yoki rahbar bilan hal qiling')
    if(ownerReviewedOffline){const proof=allowedOfflineLeaseId?await tx.offlineCashLease.findFirst({where:{id:allowedOfflineLeaseId,organizationId:context.organizationId,saleId:sale.id,state:'consumed',settledBy:context.userId,settlementProof:{not:Prisma.DbNull}}}):null;if(context.role!=='owner'||!proof||input.reservationId!==proof.id||input.payments.length!==1||input.payments[0].paymentType!=='cash')throw new AccessError(403,'OWNER_REQUIRED')}
    await requireOpenShift(tx,context,sale.shiftId)
    if (!sale.items.length) throw new AccessError(400,'EMPTY_SALE')
    const authorization=await enforceDiscountLimit(tx,context,sale.items,draftTotals(sale.items,sale.discountAmount).totalAmount,sale.discountReason,sale.discountPolicySnapshot!==null)
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
    const reservedSources=input.reservationId?await consumeStock(tx,context,input.reservationId,sale,key,ownerReviewedOffline):undefined
    const allocation=allocateMoney(sale.discountAmount,sale.items.map(x=>({id:x.id,weight:x.lineTotal})))
    const currentProducts=await tx.product.findMany({where:{id:{in:sale.items.map(i=>i.productId)},organizationId:context.organizationId}})
    const currentPrices=ownerReviewedOffline?new Map(sale.items.map(item=>[item.productId,{unitPrice:item.unitPrice,priceRuleId:item.priceRuleId}])):await resolvePrices(tx,context,sale.items.map(item=>({productId:item.productId,quantity:item.quantity,basePrice:currentProducts.find(p=>p.id===item.productId)?.salePrice??decimal(0)})),{storeId:sale.storeId,customerId:sale.customerId})
    const taxFor=ownerReviewedOffline?null:await productTaxes(tx,context.organizationId,currentProducts.map(p=>p.taxProfileId))
    for (const item of [...sale.items].sort((a,b)=>a.productId.localeCompare(b.productId))) {
      await tx.$queryRaw`SELECT id FROM "Product" WHERE id=${item.productId} AND "organizationId"=${context.organizationId} FOR UPDATE`
      const product=await tx.product.findFirst({where:{id:item.productId,organizationId:context.organizationId,...(ownerReviewedOffline?{}:{isActive:true})}})
      if (product && item.unit && product.unit!==item.unit) throw new AccessError(409,'UNIT_CHANGED','Mahsulot birligi o‘zgardi; savatni yangilang')
      if (!product || (!ownerReviewedOffline&&(!currentPrices.get(item.productId)!.unitPrice.eq(item.unitPrice) || (item.priceSnapshot!==null && currentPrices.get(item.productId)!.priceRuleId!==item.priceRuleId)))) throw new AccessError(409,'PRICE_CHANGED','Narx o‘zgardi; qayta tasdiqlang',undefined,{stage:'sale',productId:item.productId,productName:item.productName,previousPrice:item.unitPrice,currentPrice:product?currentPrices.get(item.productId)!.unitPrice:null})
      if(!ownerReviewedOffline)await assertCurrentConversion(tx,context.organizationId,product,item.quantity,item.conversionSnapshot);
      assertProductCompliance(product,{taxVersionId:item.taxVersionId,taxMode:item.taxMode})
      const balance=await tx.inventoryBalance.findUnique({where:{storeId_productId:{storeId:sale.storeId,productId:item.productId}}})
      if(item.quantity.gt(balance?.quantity??0))throw new AccessError(409,'INSUFFICIENT_STOCK','Yetarli qoldiq yo‘q; miqdorni tekshiring',undefined,{stage:'sale',productId:item.productId,productName:item.productName,requestedQuantity:item.quantity,availableQuantity:balance?.quantity??decimal(0)})
      const currentTax=taxFor?.(product.taxProfileId)
      if(!ownerReviewedOffline&&(!currentTax||item.taxVersionId!==currentTax.taxVersionId||item.taxMode!==currentTax.taxMode||!item.taxRate.eq(currentTax.taxRate)))throw new AccessError(409,'TAX_CHANGED','Soliq siyosati o‘zgardi; original qoralamani tekshiring va qayta tasdiqlang')
      await tx.saleItem.update({where:{id:item.id},data:{complianceSnapshot:complianceSnapshot(product),receiptDiscount:sale.netAmount===null?allocation[item.id]:item.receiptDiscount,unitCost:ownerReviewedOffline?item.unitCost:product.costPrice}})
      await moveStock(tx,context,{storeId:sale.storeId,productId:item.productId,delta:item.quantity.negated(),unitCost:ownerReviewedOffline?item.unitCost:product.costPrice,sourceType:'sale',sourceId:sale.id,serialSource:{ids:input.serialSelections?.find(row=>row.productId===item.productId)?.ids},...(reservedSources?.has(item.productId)?{reservedLocationId:reservedSources.get(item.productId)}:{})})
    }
    for (const p of input.payments) await tx.payment.create({data:{sourceType:'manual',organizationId:context.organizationId,storeId:sale.storeId,shiftId:sale.shiftId,saleId:sale.id,customerId:sale.customerId,paymentType:p.paymentType,direction:'in',amount:money(p.amount),referenceNo:p.referenceNo,receivedBy:context.userId,status:'recorded'}})
    const updated=await tx.sale.update({where:{id:sale.id},data:{status:'completed',completedAt:new Date(),cashTendered:tender,cashChange,...authorization},include:{items:true,payments:true}})
    await audit(tx,context,'Sale',sale.id,'completed',{totalAmount:sale.totalAmount,payments:input.payments,cashTendered:tender,cashChange})
    return attachSaleBatches(tx,context,updated)
}
