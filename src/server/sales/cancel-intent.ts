import { z } from 'zod'
import type { TokenPayload } from '@/lib/auth'
import { prisma } from '@/lib/prisma'
import { AccessError } from '../auth/policy'
import { assertLiveContext, audit, payloadHash } from '../operations'
import { saleDraftSchema } from './service'
export const cancelIntentSchema=z.object({operationId:z.string().uuid(),payload:saleDraftSchema})
// Cancels only a request with NO committed draft. Existing draft cancellation keeps
// the manager-only /sales/:id/void boundary; this service never changes a Sale.
export async function cancelDraftIntent(context:TokenPayload,input:z.infer<typeof cancelIntentSchema>) {
 if(input.payload.organizationId!==context.organizationId || (input.payload.cashierId && input.payload.cashierId!==context.userId))throw new AccessError(403,'FORBIDDEN')
 if(input.payload.operationId && input.payload.operationId!==input.operationId)throw new AccessError(400,'OPERATION_ID_MISMATCH')
 const type='sale.create',key=input.operationId,hash=payloadHash(input.payload)
 return prisma.$transaction(async tx=>{
  await assertLiveContext(tx,context)
  const lock=`${context.organizationId}:${type}:${key}`
  await tx.$queryRaw`SELECT pg_advisory_xact_lock(hashtextextended(${lock},0))::text`
  const existing=await tx.operation.findUnique({where:{organizationId_type_key:{organizationId:context.organizationId,type,key}}})
  if(existing){
   if(existing.actorId!==context.userId)throw new AccessError(403,'OPERATION_ACTOR_MISMATCH')
   if(existing.payloadHash!==hash)throw new AccessError(409,'OPERATION_PAYLOAD_CONFLICT')
   if(existing.state==='cancelled')return {state:'cancelled' as const}
   const result=existing.result as {id?:string}|null
   if(!result?.id)throw new AccessError(409,'INVALID_OPERATION_RESULT')
   return {state:'created' as const,saleId:result.id}
  }
  // Reserve the same unique Operation slot. A serializable posting snapshot may
  // predate this lock: its insert then conflicts and retries into the tombstone.
  const cancelled=await tx.operation.create({data:{organizationId:context.organizationId,actorId:context.userId,type,key,payloadHash:hash,state:'cancelled',result:{cancelled:true}}})
  await audit(tx,context,'Operation',cancelled.id,'unposted_draft_intent_cancelled',{operationId:key})
  return {state:'cancelled' as const}
 })
}
