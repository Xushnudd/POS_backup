import { z } from 'zod'
import type { TokenPayload } from '@/lib/auth'
import { AccessError } from '../auth/policy'
import { audit, runOperation } from '../operations'
import { decimal, money } from '../sales/calculations'
import { amountSchema, requireOpenShift } from '../sales/service'
export const collectionSchema=z.object({organizationId:z.string().uuid(),storeId:z.string().uuid(),customerId:z.string().uuid(),shiftId:z.string().uuid(),operationId:z.string().uuid(),amount:amountSchema.refine(v=>decimal(v).gt(0)),referenceNo:z.string().max(200).optional(),note:z.string().max(2000).optional(),paymentType:z.enum(['cash','transfer']).default('cash')})
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
  const payment=await tx.payment.create({data:{organizationId:context.organizationId,storeId:input.storeId,shiftId:input.shiftId,customerId:customer.id,paymentType:input.paymentType,direction:'in',amount,receivedBy:context.userId,referenceNo:input.referenceNo,note:'debt_collection'}})
  const origins=await tx.debtEntry.findMany({where:{organizationId:context.organizationId,customerId:customer.id,amount:{gt:0}},orderBy:[{effectiveAt:'asc'},{id:'asc'}]})
  let remaining=amount
  const visited=new Set<string|null>()
  for (const origin of origins) {
    if (remaining.lte(0)) break
    if (visited.has(origin.saleId)) continue
    visited.add(origin.saleId)
    const balance=await tx.debtEntry.aggregate({where:{organizationId:context.organizationId,customerId:customer.id,saleId:origin.saleId},_sum:{amount:true}})
    const available=decimal(balance._sum.amount??0)
    if (available.lte(0)) continue
    const part=remaining.lt(available)?remaining:available
    await tx.debtEntry.create({data:{organizationId:context.organizationId,customerId:customer.id,sourceType:'collection',sourceId:payment.id+':'+origin.id,saleId:origin.saleId,amount:part.negated(),note:input.note,actorId:context.userId}})
    remaining=remaining.sub(part)
  }
  if (!remaining.isZero()) throw new AccessError(409,'DEBT_ALLOCATION_MISMATCH')
  await audit(tx,context,'Payment',payment.id,'debt_collected',{customerId:customer.id,amount})
  return payment
 })
}
