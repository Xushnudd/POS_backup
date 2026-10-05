import { z } from 'zod'
import type { TokenPayload } from '@/lib/auth'
import { AccessError, tenantScope } from '../auth/policy'
import { runOperation, audit } from '../operations'
import { amountSchema, requireOpenShift } from '../sales/service'
import { decimal, money } from '../sales/calculations'
export const openSchema=z.object({registerId:z.string().uuid(),organizationUserId:z.string().uuid(),openingCash:amountSchema.default(0),note:z.string().max(2000).optional(),operationId:z.string().uuid()})
export const closeSchema=z.object({countedCash:amountSchema,note:z.string().max(2000).optional()})
export const cashSchema=z.object({movementType:z.enum(['cash_in','cash_out']),amount:amountSchema.refine(v=>decimal(v).gt(0)),reason:z.string().min(2).max(2000),operationId:z.string().uuid()})
export async function openShift(context:TokenPayload,input:z.infer<typeof openSchema>) {
 if (input.organizationUserId!==context.organizationUserId) throw new AccessError(403,'FORBIDDEN')
 return runOperation(context,'shift.open',input.operationId,input,async tx=>{
  await tx.$queryRaw`SELECT id FROM "Register" WHERE id=${input.registerId} FOR UPDATE`
  const register=await tx.register.findFirst({where:{id:input.registerId,isActive:true,AND:tenantScope('Register',context)}})
  if (!register) throw new AccessError(404,'NOT_FOUND')
  if (await tx.shift.findFirst({where:{registerId:register.id,status:'open'}})) throw new AccessError(409,'SHIFT_ALREADY_OPEN')
  const shift=await tx.shift.create({data:{registerId:register.id,organizationUserId:context.organizationUserId,openingCash:money(input.openingCash),note:input.note}})
  await audit(tx,context,'Shift',shift.id,'opened',{openingCash:shift.openingCash})
  return shift
 })
}
export async function closeShift(context:TokenPayload,id:string,input:z.infer<typeof closeSchema>) {
 return runOperation(context,'shift.close',id,input,async tx=>{
  const shift=await requireOpenShift(tx,context,id)
  if (await tx.sale.count({where:{shiftId:id,status:'draft'}})) throw new AccessError(409,'OPEN_DRAFTS','Qoralama savdolarni yakunlang yoki bekor qiling')
  if (await tx.payment.count({where:{shiftId:id,status:{in:['pending','unknown']}}})) throw new AccessError(409,'UNRESOLVED_PAYMENTS')
  const payments=await tx.payment.findMany({where:{shiftId:id,paymentType:'cash',status:'recorded'}})
  const movements=await tx.cashMovement.findMany({where:{shiftId:id}})
  const cash=payments.reduce((sum,p)=>sum.add(p.direction==='in'?p.amount:p.amount.negated()),decimal(0))
  const moved=movements.reduce((sum,p)=>sum.add(p.movementType==='cash_in'?p.amount:p.amount.negated()),decimal(0))
  const expected=shift.openingCash.add(cash).add(moved),counted=money(input.countedCash)
  const result=await tx.shift.update({where:{id},data:{status:'closed',closedAt:new Date(),expectedCash:expected,countedCash:counted,cashDifference:counted.sub(expected),note:input.note}})
  await audit(tx,context,'Shift',id,'closed',{expectedCash:expected,countedCash:counted,difference:counted.sub(expected)})
  return result
 })
}
export async function cashMovement(context:TokenPayload,id:string,input:z.infer<typeof cashSchema>) {
 return runOperation(context,'shift.cash',input.operationId,{shiftId:id,...input},async tx=>{
  await requireOpenShift(tx,context,id)
  const result=await tx.cashMovement.create({data:{shiftId:id,movementType:input.movementType,amount:money(input.amount),reason:input.reason,createdBy:context.userId}})
  await audit(tx,context,'CashMovement',result.id,input.movementType,{amount:result.amount,reason:input.reason})
  return result
 })
}
