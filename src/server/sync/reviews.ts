import {Prisma} from '@prisma/client'
import {prisma} from '@/lib/prisma'
import type {TokenPayload} from '@/lib/auth'
import {AccessError} from '../auth/policy'
import {assertLiveContext,audit,payloadHash,runOperation} from '../operations'
import {safeAudit} from '../observability/context'
export function reviewScope(context:TokenPayload){return {organizationId:context.organizationId,...(context.role==='cashier'?{actorId:context.userId}:{})}}
export async function recordConflict(context:TokenPayload,command:{operationId:string;type:string;payload:unknown},code:string){
 const source=JSON.parse(JSON.stringify(safeAudit(command.payload))) as Prisma.InputJsonValue|null,hash=payloadHash(source)
 return prisma.$transaction(async tx=>{
  await assertLiveContext(tx,context)
  const lock='sync-review:'+context.organizationId+':'+command.type+':'+command.operationId
  await tx.$queryRaw`SELECT pg_advisory_xact_lock(hashtextextended(${lock},0))::text`
  const identity={organizationId:context.organizationId,commandType:command.type,operationId:command.operationId}
  const existing=await tx.syncReview.findUnique({where:{organizationId_commandType_operationId:identity}})
  if(existing){if(existing.actorId!==context.userId||existing.payloadHash!==hash)throw new AccessError(409,'OPERATION_PAYLOAD_CONFLICT');return existing}
  const result=await tx.syncReview.create({data:{...identity,actorId:context.userId,payload:source===null?Prisma.JsonNull:source,payloadHash:hash,code}})
  await audit(tx,context,'SyncReview',result.id,'sync_conflict_recorded',{operationId:command.operationId,type:command.type,code})
  return result
 })
}
// Review never posts an economic operation with the manager's identity, changes an
// immutable payload, or guesses whether a timeout committed. Original key stays mandatory.
export async function resolveReview(context:TokenPayload,id:string,input:{operationId:string;reason:string}){
 if(context.role==='cashier')throw new AccessError(403,'MANAGER_REQUIRED')
 return runOperation(context,'sync.review',input.operationId,{id,...input},async tx=>{
  const review=await tx.syncReview.findFirst({where:{id,...reviewScope(context)}})
  if(!review)throw new AccessError(404,'NOT_FOUND')
  if(context.role!=='owner'){
   const source=(review.payload&&typeof review.payload==='object'?review.payload:{}) as Record<string,unknown>
   const saleId=typeof source.saleId==='string'?source.saleId:undefined
   const sale=saleId?await tx.sale.findFirst({where:{id:saleId,organizationId:context.organizationId}}):null
   const storeId=typeof source.storeId==='string'?source.storeId:sale?.storeId
   if(!storeId||!context.storeIds.includes(storeId))throw new AccessError(403,'FORBIDDEN')
  }
  if(review.state==='resolved')return review
  const op=await tx.operation.findUnique({where:{organizationId_type_key:{organizationId:context.organizationId,type:review.commandType,key:review.operationId}}})
  let proof:Prisma.InputJsonValue
  if(op?.actorId===review.actorId){
   if(review.commandType==='sale.create'&&op.state!=='cancelled'){
    const saleId=(op.result as {id?:string})?.id,sale=saleId?await tx.sale.findFirst({where:{id:saleId,organizationId:context.organizationId}}):null
    if(!sale||sale.status==='draft')throw new AccessError(409,'UNRESOLVED_DRAFT')
   }
   proof={operationState:op.state,operationId:op.id,originalPayloadHash:op.payloadHash,reviewPayloadHash:review.payloadHash,resolution:'existing_result_reviewed'}
  }else if(review.commandType==='sale.complete'){
   const saleId=(review.payload as {saleId?:string}|null)?.saleId
   const sale=saleId?await tx.sale.findFirst({where:{id:saleId,organizationId:context.organizationId,status:'voided'}}):null
   if(!sale)throw new AccessError(409,'RESULT_UNKNOWN','Avval asl amal natijasini tekshiring yoki qoralamani vakolat bilan bekor qiling')
   proof={saleId:sale.id,state:'voided'}
  }else throw new AccessError(409,'RESULT_UNKNOWN','Asl amalning terminal natijasi yo‘q; konfliktni yashirib bo‘lmaydi')
  const result=await tx.syncReview.update({where:{id},data:{state:'resolved',resolvedAt:new Date(),resolvedBy:context.userId,reason:input.reason,result:proof}})
  await audit(tx,context,'SyncReview',id,'sync_review_resolved',{reason:input.reason,proof})
  return result
 })
}
