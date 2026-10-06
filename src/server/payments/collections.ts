import { Prisma } from '@prisma/client'
import { debtTargets } from '../customers/targets'
import { z } from 'zod'
import type { TokenPayload } from '@/lib/auth'
import { AccessError } from '../auth/policy'
import { audit, runOperation } from '../operations'
import { decimal, money } from '../sales/calculations'
import { amountSchema, requireOpenShift } from '../sales/service'
export const collectionSchema=z.object({organizationId:z.string().uuid(),storeId:z.string().uuid(),customerId:z.string().uuid(),shiftId:z.string().uuid(),operationId:z.string().uuid(),amount:amountSchema.refine(v=>decimal(v).gt(0)),referenceNo:z.string().max(200).optional(),note:z.string().max(2000).optional(),paymentType:z.enum(['cash','transfer']).default('cash'),allocations:z.array(z.object({saleId:z.string().uuid().nullable(),debtOriginId:z.string().uuid().optional(),amount:amountSchema.refine(v=>decimal(v).gt(0))}).strict().refine(x=>!x.debtOriginId||x.saleId===null,'Hujjat va savdo bir targetda bo‘lishi mumkin emas')).min(1).max(200).optional()})
export async function collectDebt(context:TokenPayload,input:z.infer<typeof collectionSchema>) {
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
  const payment=await tx.payment.create({data:{organizationId:context.organizationId,storeId:input.storeId,shiftId:input.shiftId,customerId:customer.id,paymentType:input.paymentType,direction:'in',amount,receivedBy:context.userId,referenceNo:input.referenceNo,note:'debt_collection'}})
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
  await audit(tx,context,'Payment',payment.id,'debt_collected',{customerId:customer.id,amount})
  return payment
 })
}
