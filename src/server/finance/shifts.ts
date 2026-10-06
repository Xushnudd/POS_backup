import { z } from 'zod'
import { randomUUID } from 'node:crypto'
import { Prisma } from '@prisma/client'
import type { TokenPayload } from '@/lib/auth'
import { AccessError, tenantScope } from '../auth/policy'
import { runOperation, audit, payloadHash } from '../operations'
import { amountSchema, positiveAmountSchema, requireOpenShift } from '../sales/service'
import { decimal, money, type DecimalInput } from '../sales/calculations'
export function shiftCashSummary(opening:DecimalInput,payments:{paymentType:string;status:string;direction:string;amount:DecimalInput;saleId:string|null;note:string|null}[],movements:{movementType:string;amount:DecimalInput}[]) {
 const cash=payments.filter(p=>p.paymentType==='cash'&&p.status==='recorded')
 const sum=(predicate:(p:typeof cash[number])=>boolean)=>cash.filter(predicate).reduce((total,p)=>total.add(p.amount),decimal(0))
 const movement=(type:string)=>movements.filter(m=>m.movementType===type).reduce((total,m)=>total.add(m.amount),decimal(0))
 const paymentNet=sum(p=>p.direction==='in').sub(sum(p=>p.direction==='out'))
 const movementNet=movements.reduce((total,m)=>total.add(['cash_in','correction_in'].includes(m.movementType)?decimal(m.amount):decimal(m.amount).negated()),decimal(0))
 return {saleReceipts:sum(p=>p.direction==='in'&&p.saleId!==null&&p.note!=='debt_collection'),debtCollections:sum(p=>p.direction==='in'&&p.note==='debt_collection'),refunds:sum(p=>p.direction==='out'&&!!p.note?.startsWith('return:')),manualIn:sum(p=>p.direction==='in'&&p.saleId===null&&p.note!=='debt_collection'),manualOut:sum(p=>p.direction==='out'&&p.saleId===null),cashIn:movement('cash_in'),cashOut:movement('cash_out'),bankDeposits:movement('bank_deposit'),collections:movement('collection'),correctionIn:movement('correction_in'),correctionOut:movement('correction_out'),paymentNet,movementNet,expectedCash:decimal(opening).add(paymentNet).add(movementNet)}
}
export const openSchema=z.object({registerId:z.string().uuid(),organizationUserId:z.string().uuid(),openingCash:amountSchema.default(0),note:z.string().max(2000).optional(),operationId:z.string().uuid(),handoverFromId:z.string().uuid().optional()})
export const closeSchema=z.object({countedCash:amountSchema,note:z.string().trim().max(2000).optional(),approvalRequestId:z.string().uuid().optional(),operationId:z.string().uuid().optional()}).strict()
export const cashSchema=z.object({movementType:z.enum(['cash_in','cash_out','bank_deposit','collection']),amount:positiveAmountSchema,reason:z.string().trim().min(2).max(2000),operationId:z.string().uuid()})
export const correctionSchema=z.object({postingShiftId:z.string().uuid(),direction:z.enum(['cash_in','cash_out']),amount:positiveAmountSchema,reason:z.string().trim().min(3).max(2000),operationId:z.string().uuid()}).strict()
export async function openShift(context:TokenPayload,input:z.infer<typeof openSchema>) {
 if (input.organizationUserId!==context.organizationUserId) throw new AccessError(403,'FORBIDDEN')
 return runOperation(context,'shift.open',input.operationId,input,async tx=>{
  await tx.$queryRaw`SELECT id FROM "Register" WHERE id=${input.registerId} FOR UPDATE`
  const register=await tx.register.findFirst({where:{id:input.registerId,isActive:true,AND:tenantScope('Register',context)}})
  if (!register) throw new AccessError(404,'NOT_FOUND')
  if (await tx.shift.findFirst({where:{registerId:register.id,status:'open'}})) throw new AccessError(409,'SHIFT_ALREADY_OPEN')
  if(input.handoverFromId){
   const previous=await tx.shift.findFirst({where:{id:input.handoverFromId,registerId:register.id,status:'closed'}})
   const latest=await tx.shift.findFirst({where:{registerId:register.id},orderBy:[{openedAt:'desc'},{id:'desc'}]})
   if(!previous||latest?.id!==previous.id||!previous.countedCash?.eq(money(input.openingCash)))throw new AccessError(409,'INVALID_HANDOVER','Faqat oxirgi yopilgan smenadagi sanalgan pulni qabul qilish mumkin')
   if(await tx.shift.findFirst({where:{handoverFromId:previous.id}}))throw new AccessError(409,'HANDOVER_ALREADY_ACCEPTED')
  }
  const shift=await tx.shift.create({data:{handoverFromId:input.handoverFromId,registerId:register.id,organizationUserId:context.organizationUserId,openingCash:money(input.openingCash),note:input.note}})
  await audit(tx,context,'Shift',shift.id,input.handoverFromId?'handover_accepted':'opened',{openingCash:shift.openingCash,handoverFromId:input.handoverFromId})
  return shift
 })
}
export async function closeShift(context:TokenPayload,id:string,input:z.infer<typeof closeSchema>) {
 return runOperation(context,'shift.close',input.approvalRequestId??input.operationId??id,input.approvalRequestId||input.operationId?{shiftId:id,...input}:input,async tx=>{
  const shift=await requireOpenShift(tx,context,id,true)
  if (await tx.sale.count({where:{shiftId:id,status:'draft'}})) throw new AccessError(409,'OPEN_DRAFTS','Qoralama savdolarni yakunlang yoki bekor qiling')
  if (await tx.payment.count({where:{shiftId:id,status:{in:['pending','unknown']}}})) throw new AccessError(409,'UNRESOLVED_PAYMENTS')
  const payments=await tx.payment.findMany({where:{shiftId:id,paymentType:'cash',status:'recorded'}})
  const movements=await tx.cashMovement.findMany({where:{shiftId:id}})
  const cash=payments.reduce((sum,p)=>sum.add(p.direction==='in'?p.amount:p.amount.negated()),decimal(0))
  const moved=movements.reduce((sum,p)=>sum.add(['cash_in','correction_in'].includes(p.movementType)?p.amount:p.amount.negated()),decimal(0))
  const expected=shift.openingCash.add(cash).add(moved),counted=money(input.countedCash)
  const difference=counted.sub(expected)
  const snapshot=payloadHash({expected:expected.toFixed(2),payments:payments.map(p=>p.id).sort(),movements:movements.map(m=>m.id).sort()})
  type CloseRequest={id:string;countedCash:string;expectedCash:string;difference:string;countedBy:string;reason:string;createdAt:string;snapshot:string}
  const pending=shift.pendingClose as CloseRequest|null
  if(input.approvalRequestId&&!pending)throw new AccessError(409,'CLOSE_REQUEST_CHANGED','Yopish so‘rovi bekor qilingan yoki o‘zgargan')
  if(pending){
   if(context.role==='cashier')throw new AccessError(409,'SHIFT_CLOSE_PENDING','Rahbar sanalgan pul farqini tasdiqlashi kerak')
   if(input.approvalRequestId!==pending.id||pending.snapshot!==snapshot||pending.countedCash!==counted.toFixed(2))throw new AccessError(409,'CLOSE_REQUEST_CHANGED','Joriy yopish so‘rovi va sanalgan summani tekshiring')
  }
  if(!difference.isZero()&&!pending&&(!input.note||input.note.trim().length<3))throw new AccessError(400,'CLOSE_REASON_REQUIRED','Pul farqi uchun kamida 3 belgili sabab yozing')
  if(!difference.isZero()&&context.role==='cashier'){
   const request:CloseRequest={id:randomUUID(),countedCash:counted.toFixed(2),expectedCash:expected.toFixed(2),difference:difference.toFixed(2),countedBy:context.userId,reason:input.note!,createdAt:new Date().toISOString(),snapshot}
   const waiting=await tx.shift.update({where:{id},data:{pendingClose:request}})
   await audit(tx,context,'Shift',id,'close_approval_requested',request)
   return waiting
  }
  const result=await tx.shift.update({where:{id},data:{status:'closed',closedAt:new Date(),expectedCash:expected,countedCash:counted,cashDifference:difference,note:input.note,countedBy:pending?.countedBy??context.userId,approvedBy:!difference.isZero()?context.userId:null,closeReason:pending?.reason??input.note,pendingClose:Prisma.DbNull}})
  await audit(tx,context,'Shift',id,'closed',{expectedCash:expected,countedCash:counted,difference,countedBy:result.countedBy,approvedBy:result.approvedBy,reason:result.closeReason})
  return result
 })
}
export async function cashMovement(context:TokenPayload,id:string,input:z.infer<typeof cashSchema>) {
 if(['bank_deposit','collection'].includes(input.movementType)&&context.role==='cashier')throw new AccessError(403,'MANAGER_REQUIRED')
 return runOperation(context,'shift.cash',input.operationId,{shiftId:id,...input},async tx=>{
  await requireOpenShift(tx,context,id)
  const result=await tx.cashMovement.create({data:{shiftId:id,movementType:input.movementType,amount:money(input.amount),reason:input.reason,createdBy:context.userId}})
  await audit(tx,context,'CashMovement',result.id,input.movementType,{amount:result.amount,reason:input.reason})
  return result
 })
}

export async function correctShift(context:TokenPayload,id:string,input:z.infer<typeof correctionSchema>) {
 if(!['owner','admin'].includes(context.role))throw new AccessError(403,'MANAGER_REQUIRED')
 return runOperation(context,'shift.correct',input.operationId,{originalShiftId:id,...input},async tx=>{
  for(const shiftId of [id,input.postingShiftId].sort())await tx.$queryRaw`SELECT id FROM "Shift" WHERE id=${shiftId} FOR UPDATE`
  const original=await tx.shift.findFirst({where:{id,AND:tenantScope('Shift',context)},include:{register:true}})
  if(!original)throw new AccessError(404,'NOT_FOUND')
  if(original.status!=='closed')throw new AccessError(409,'SHIFT_NOT_CLOSED')
  const posting=await requireOpenShift(tx,context,input.postingShiftId)
  if(posting.register.storeId!==original.register.storeId)throw new AccessError(409,'INVALID_RELATION')
  const amount=money(input.amount),incoming=input.direction==='cash_in'
  const movement=await tx.cashMovement.create({data:{shiftId:posting.id,movementType:incoming?'correction_in':'correction_out',amount,reason:input.reason,createdBy:context.userId}})
  const result=await tx.shiftCorrection.create({data:{organizationId:context.organizationId,originalShiftId:id,postingShiftId:posting.id,cashMovementId:movement.id,amount:incoming?amount:amount.negated(),reason:input.reason,createdBy:context.userId}})
  await audit(tx,context,'ShiftCorrection',result.id,'posted',{originalShiftId:id,postingShiftId:posting.id,amount:result.amount,reason:result.reason})
  return result
 })
}

export async function rejectClose(context:TokenPayload,id:string,input:{requestId:string;operationId:string;reason:string}){
 if(!['owner','admin'].includes(context.role))throw new AccessError(403,'MANAGER_REQUIRED')
 return runOperation(context,'shift.close_reject',input.operationId,{shiftId:id,...input},async tx=>{
  const shift=await requireOpenShift(tx,context,id,true)
  const pending=shift.pendingClose as {id?:string}|null
  if(!pending||pending.id!==input.requestId)throw new AccessError(409,'CLOSE_REQUEST_CHANGED')
  const result=await tx.shift.update({where:{id},data:{pendingClose:Prisma.DbNull}})
  await audit(tx,context,'Shift',id,'close_approval_rejected',{requestId:input.requestId,reason:input.reason})
  return result
 })
}
