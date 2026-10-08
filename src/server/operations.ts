import {requestTrace, safeAudit, logEvent} from './observability/context'
import { createHash } from 'node:crypto'
import { Prisma } from '@prisma/client'
import { prisma } from '@/lib/prisma'
import { AccessError } from './auth/policy'
import type { TokenPayload } from '@/lib/auth'
function canonical(value: unknown): string {
  if (Array.isArray(value)) return '['+value.map(canonical).join(',')+']'
  if (value && typeof value === 'object') return '{'+Object.entries(value).sort(([a],[b])=>a.localeCompare(b)).map(([k,v])=>JSON.stringify(k)+':'+canonical(v)).join(',')+'}'
  return JSON.stringify(value) ?? 'null'
}
export const payloadHash = (value: unknown) => createHash('sha256').update(canonical(value)).digest('hex')
export async function assertLiveContext(tx:Prisma.TransactionClient,context:TokenPayload) {
        const active=await tx.session.findFirst({where:{id:context.sessionId,userId:context.userId,organizationId:context.organizationId,revokedAt:null,expiresAt:{gt:new Date()},idleExpiresAt:{gt:new Date()},user:{isActive:true}}})
        const member=await tx.organizationUser.findFirst({where:{id:context.organizationUserId,userId:context.userId,organizationId:context.organizationId,isActive:true},include:{userStores:true}})
        if(active?.authenticationMethod==='pin' && (context.role!=='cashier'||!member?.pinHash||context.storeIds.length!==1||context.storeIds[0]!==active.pinStoreId||!await tx.store.findFirst({where:{id:active.pinStoreId!,organizationId:context.organizationId,isActive:true}})))throw new AccessError(401,'SESSION_CHANGED');
        if (!active || !member || member.role!==context.role || (context.role!=='owner' && context.storeIds.some(id=>!member.userStores.some(x=>x.storeId===id)))) throw new AccessError(401,'SESSION_CHANGED','Sessiya yoki vakolat o‘zgardi; qayta kiring')
}
export async function runOperation<T>(context: TokenPayload, type: string, key: string, payload: unknown, work: (tx: Prisma.TransactionClient) => Promise<T>): Promise<T> {
  if (!key || key.length > 200) throw new AccessError(400,'OPERATION_ID_REQUIRED','Yagona amal identifikatori talab qilinadi')
  const trace=requestTrace.getStore();if(trace)trace.operationId=key
  const hash=payloadHash(payload)
  for (let attempt=0;attempt<3;attempt++) {
    try {
      return await prisma.$transaction(async tx=>{
        await assertLiveContext(tx,context)
        const lock=`${context.organizationId}:${type}:${key}`
        await tx.$queryRaw`SELECT pg_advisory_xact_lock(hashtextextended(${lock},0))::text`
        const old=await tx.operation.findUnique({where:{organizationId_type_key:{organizationId:context.organizationId,type,key}}})
        if (old) {
          if (old.actorId!==context.userId) throw new AccessError(403,"OPERATION_ACTOR_MISMATCH")
          if (old.payloadHash!==hash) throw new AccessError(409,'OPERATION_PAYLOAD_CONFLICT','Bu amal kaliti boshqa ma’lumot bilan ishlatilgan')
          if (old.state==='cancelled') throw new AccessError(409,'OPERATION_CANCELLED','Bu urinish bekor qilingan; yangi amal kaliti kerak')
          return old.result as T
        }
        const result=await work(tx)
        const json=JSON.parse(JSON.stringify(result)) as Prisma.InputJsonValue
        await tx.operation.create({data:{organizationId:context.organizationId,actorId:context.userId,type,key,payloadHash:hash,result:json}})
        // Surface deferred journal violations inside the transaction before returning an acknowledgement.
        await tx.$executeRaw`SET CONSTRAINTS ALL IMMEDIATE`
        return JSON.parse(JSON.stringify(result)) as T
      },{isolationLevel:Prisma.TransactionIsolationLevel.Serializable,timeout:15000})
    } catch(error) {
      // Serializable snapshots can predate the advisory lock. A competing Operation
      // insert then produces this exact unique conflict: retry the rolled-back transaction.
      const operationRace=error instanceof Prisma.PrismaClientKnownRequestError && error.code==='P2002' && error.meta?.modelName==='Operation' && Array.isArray(error.meta?.target) && ['organizationId','type','key'].every(field=>(error.meta!.target as string[]).includes(field))
      // A deterministic business source can collide before the Operation insert.
      // Retry only when this exact operation has a committed terminal record;
      // fresh transaction rechecks live authorization, actor and payload hash.
      const committedBusinessRace=error instanceof Prisma.PrismaClientKnownRequestError && error.code==='P2002' && !!await prisma.operation.findUnique({where:{organizationId_type_key:{organizationId:context.organizationId,type,key}},select:{id:true}})
      const retryable=operationRace || committedBusinessRace || (error instanceof Prisma.PrismaClientKnownRequestError && (error.code==='P2034' || (error.code==='P2010' && ['40001','40P01'].includes(String(error.meta?.code)))))
      if (!retryable) throw error
      if (attempt===2) throw new AccessError(409,'CONCURRENT_CONFLICT','Parallel amal konflikti; aynan shu amal kaliti bilan qayta tekshiring')
      logEvent('operation_retry',{code:'CONCURRENT_CONFLICT'})
      await new Promise(resolve=>setTimeout(resolve,20*(attempt+1)))
    }
  }
  throw new AccessError(409,'CONCURRENT_CONFLICT')
}
export async function audit(tx: Prisma.TransactionClient, context: TokenPayload, entityType: string, entityId: string, action: string, after?: unknown) {
  await tx.auditLog.create({data:{organizationId:context.organizationId,actorId:context.userId,entityType,entityId,action,requestId:requestTrace.getStore()?.requestId,
    ...(after!==undefined && {afterData:JSON.parse(JSON.stringify(safeAudit(after))) as Prisma.InputJsonValue})}})
}
