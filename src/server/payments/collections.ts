import { Prisma } from '@prisma/client'
import { debtTargets } from '../customers/targets'
import { z } from 'zod'
import type { TokenPayload } from '@/lib/auth'
import { AccessError } from '../auth/policy'
import { audit, runOperation } from '../operations'
import { decimal, money } from '../sales/calculations'
import { amountSchema, requireOpenShift } from '../sales/service'
export const collectionSchema=z.object({organizationId:z.string().uuid(),storeId:z.string().uuid(),customerId:z.string().uuid(),shiftId:z.string().uuid(),operationId:z.string().uuid(),amount:amountSchema.refine(v=>decimal(v).gt(0)),referenceNo:z.string().max(200).optional(),note:z.string().max(2000).optional(),paymentType:z.enum(['cash','card','transfer']).default('cash'),manualConfirmed:z.boolean().optional(),allocations:z.array(z.object({saleId:z.string().uuid().nullable(),debtOriginId:z.string().uuid().optional(),amount:amountSchema.refine(v=>decimal(v).gt(0))}).strict().refine(x=>!x.debtOriginId||x.saleId===null,'Hujjat va savdo bir targetda bo‘lishi mumkin emas')).min(1).max(200).optional()})
export async function collectDebt(context:TokenPayload,input:z.infer<typeof collectionSchema>) {
 if(input.paymentType==='card'&&(!input.manualConfirmed||(input.referenceNo?.trim().length??0)<3))throw new AccessError(400,'MANUAL_PAYMENT_PROOF_REQUIRED','Karta orqali haqiqatan undirilgan to‘lovni tasdiqlang va hujjat raqamini kiriting');
 return runOperation(context,'debt.collect',input.operationId,input,async tx=>{
  const shift=await requireOpenShift(tx,context,input.shiftId)
  if (shift.register.storeId!==input.storeId || input.organizationId!==context.organizationId) throw new AccessError(409,'INVALID_RELATION')
  await tx.$queryRaw`SELECT id FROM "Customer" WHERE id=${input.customerId} FOR UPDATE`
  const customer=await tx.customer.findFirst({where:{id:input.customerId,organizationId:context.organizationId,isActive:true}})
  if (!customer) throw new AccessError(404,'CUSTOMER_NOT_FOUND')
  const sums=await tx.debtEntry.aggregate({where:{organizationId:context.organizationId,customerId:customer.id},_sum:{amount:true}})
  const amount=money(input.amount)
  if (amount.gt(sums._sum.amount??0)) throw new AccessError(409,'DEBT_OVERPAYMENT')
  if (input.allocations) {
    const targets=new Set(input.allocations.map(item=>item.saleId??item.debtOriginId??'general'))
    if (targets.size!==input.allocations.length) throw new AccessError(400,'DUPLICATE_DEBT_TARGET')
    const total=input.allocations.reduce((sum,item)=>sum.add(money(item.amount)),decimal(0))
    if (!total.eq(amount)) throw new AccessError(400,'DEBT_ALLOCATION_TOTAL_MISMATCH')
  }
  const reference=input.referenceNo?.trim();
  if(input.paymentType!=='cash'&&reference){
   const proofLock=context.organizationId+':debt-document:'+input.paymentType+':'+reference;
   await tx.$queryRaw`SELECT pg_advisory_xact_lock(hashtextextended(${proofLock},0))::text`;
   const used=await tx.$queryRaw<{id:string}[]>`SELECT id FROM "Payment" WHERE "organizationId"=${context.organizationId} AND "paymentType"=${input.paymentType} AND "direction"='in' AND "sourceType"='manual' AND note='debt_collection' AND btrim("referenceNo")=${reference} LIMIT 1`;
   if(used.length)throw new AccessError(409,'MANUAL_PAYMENT_DOCUMENT_REUSED','Bu to‘lov hujjati oldin qayd etilgan. Bank amalini takrorlamang; original to‘lovni tekshiring');
  }
  const payment=await tx.payment.create({data:{sourceType:'manual',organizationId:context.organizationId,storeId:input.storeId,shiftId:input.shiftId,customerId:customer.id,paymentType:input.paymentType,direction:'in',amount,receivedBy:context.userId,referenceNo:input.referenceNo?.trim(),note:'debt_collection'}})
  const balances=await debtTargets(tx,context.organizationId,customer.id)
  let remaining=amount
  const targets=input.allocations
    ? input.allocations.map(item=>({key:item.saleId?'sale:'+item.saleId:item.debtOriginId?'document:'+item.debtOriginId:'general',requested:money(item.amount)}))
    : balances.filter(target=>target.balance.gt(0)).map(target=>({key:target.key,requested:null}))
  for(const target of targets){
   const origin=balances.find(row=>row.key===target.key)
   if(!origin)throw new AccessError(409,'DEBT_TARGET_NOT_FOUND')
   if(remaining.lte(0))break
   if(target.requested&&target.requested.gt(origin.balance))throw new AccessError(409,'DEBT_TARGET_OVERPAYMENT')
   if(origin.balance.lte(0))continue
   const part=target.requested??Prisma.Decimal.min(remaining,origin.balance)
   await tx.debtEntry.create({data:{organizationId:context.organizationId,customerId:customer.id,sourceType:'collection',sourceId:payment.id+':'+target.key,saleId:origin.saleId,debtOriginId:origin.debtOriginId,amount:part.negated(),note:input.note,actorId:context.userId}})
   remaining=remaining.sub(part)
  }
  if (!remaining.isZero()) throw new AccessError(409,'DEBT_ALLOCATION_MISMATCH')
  await audit(tx,context,'Payment',payment.id,'debt_collected',{customerId:customer.id,amount,paymentType:input.paymentType,referenceNo:input.referenceNo})
  return payment
 })
}
