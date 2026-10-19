import {postCostContinuations} from './purchases/cost-continuations'
import {READ_ONLY_OPERATION_EXCEPTIONS} from './billing/read-only-policy'
import {billingDatabaseError} from './billing/errors'
import {assertNewOperationAllowed} from './deployment/state'
import {requestTrace, safeAudit, logEvent} from './observability/context'
import { createHash, randomInt } from 'node:crypto'
import { Prisma } from '@prisma/client'
import { prisma } from '@/lib/prisma'
import { AccessError } from './auth/policy'
import type { TokenPayload } from '@/lib/auth'
import { assertCriticalAction } from './auth/critical-actions'
function canonical(value: unknown): string {
  if (Array.isArray(value)) return '['+value.map(canonical).join(',')+']'
  if (value && typeof value === 'object') return '{'+Object.entries(value).sort(([a],[b])=>a.localeCompare(b)).map(([k,v])=>JSON.stringify(k)+':'+canonical(v)).join(',')+'}'
  return JSON.stringify(value) ?? 'null'
}
export const payloadHash = (value: unknown) => createHash('sha256').update(canonical(value)).digest('hex')
export async function assertLiveContext(tx:Pick<Prisma.TransactionClient,'$queryRaw'>,context:TokenPayload) {
  // One explicit tenant-scoped SQL snapshot also works with Prisma's scoped
  // client extension; no credential bytes or fabricated effective role leave SQL.
  const rows=await tx.$queryRaw<{role:string;customRoleId:string|null;customRoleRevision:number|null;authenticationMethod:string;pinStoreId:string|null;pinEnabled:boolean;storeIds:string[]}[]>`
    SELECT m.role,m."customRoleId",cr.revision AS "customRoleRevision",s."authenticationMethod",s."pinStoreId",(m."pinHash" IS NOT NULL) AS "pinEnabled",
      ARRAY(SELECT us."storeId" FROM "UserStore" us JOIN "Store" st ON st.id=us."storeId" WHERE us."organizationUserId"=m.id AND st."organizationId"=s."organizationId" AND st."isActive") AS "storeIds"
    FROM "Session" s JOIN "User" u ON u.id=s."userId"
    JOIN "OrganizationUser" m ON m."userId"=s."userId" AND m."organizationId"=s."organizationId"
    LEFT JOIN "CustomRole" cr ON cr.id=m."customRoleId" AND cr."organizationId"=m."organizationId"
    WHERE s.id=${context.sessionId} AND s."userId"=${context.userId} AND s."organizationId"=${context.organizationId}
      AND auth_restore_ready() AND m.id=${context.organizationUserId} AND s."revokedAt" IS NULL AND s."expiresAt">NOW() AND s."idleExpiresAt">NOW() AND u."isActive" AND m."isActive"
      AND (m."customRoleId" IS NULL OR (cr."isActive" AND cr."baseRole"=m.role))`;
  const active=rows[0];
  if(!active||active.role!==context.role||active.customRoleId!==(context.customRole?.id??null)||active.customRoleRevision!==(context.customRole?.revision??null)||(context.role!=='owner'&&context.storeIds.some(id=>!active.storeIds.includes(id))))throw new AccessError(401,'SESSION_CHANGED','Sessiya yoki vakolat o‘zgardi; qayta kiring');
  if(active.authenticationMethod==='pin'&&(context.role!=='cashier'||!active.pinEnabled||context.storeIds.length!==1||context.storeIds[0]!==active.pinStoreId||!active.storeIds.includes(active.pinStoreId!)))throw new AccessError(401,'SESSION_CHANGED');
}
export async function runOperation<T>(context: TokenPayload, type: string, key: string, payload: unknown, work: (tx: Prisma.TransactionClient) => Promise<T>, authorize?: (tx: Prisma.TransactionClient) => Promise<void>): Promise<T> {
  if (!key || key.length > 200) throw new AccessError(400,'OPERATION_ID_REQUIRED','Yagona amal identifikatori talab qilinadi')
  const trace=requestTrace.getStore();if(trace)trace.operationId=key
  const hash=payloadHash(payload)
  for (let attempt=0;attempt<3;attempt++) {
    // A missing-key read inside SERIALIZABLE would predicate-lock a shared
    // unique-index gap for unrelated new operations. Probe identity only,
    // before opening the transaction; never authorize or return this result.
    const observed=await prisma.operation.findUnique({where:{organizationId_type_key:{organizationId:context.organizationId,type,key}},select:{id:true}})
    try {
      return await prisma.$transaction(async tx=>{
        // Small register/shift tables otherwise get relation-wide predicate
        // locks from sequential scans, coupling independent tills under SSI.
        // Keep SERIALIZABLE and all business guards; selective indexed reads
        // stay narrow. Unindexed scans remain available, without JIT overhead.
        await tx.$executeRaw`SET LOCAL enable_seqscan = off`
        // PG15 cold valuation capture showed repeated SIREAD conflicts with
        // index-only plans. Prefer heap index scans for posting transactions;
        // SERIALIZABLE, business guards and retry limits remain unchanged.
        await tx.$executeRaw`SET LOCAL enable_indexonlyscan = off`
        await tx.$executeRaw`SET LOCAL jit = off`
        await assertLiveContext(tx,context)
        // Extra privileges can be revoked independently of the business role.
        // Authorize stored-result replays as well as first execution.
        if(authorize)await authorize(tx)
        await assertCriticalAction(tx,context,type,key,hash)
        const lock=`${context.organizationId}:${type}:${key}`
        await tx.$queryRaw`SELECT pg_advisory_xact_lock(hashtextextended(${lock},0))::text`
        const old=observed?await tx.operation.findUnique({where:{id:observed.id}}):null
        if(observed&&(!old||old.organizationId!==context.organizationId||old.type!==type||old.key!==key))throw new AccessError(409,'CONCURRENT_CONFLICT')
        if (old) {
          if (old.actorId!==context.userId) throw new AccessError(403,"OPERATION_ACTOR_MISMATCH")
          if (old.payloadHash!==hash) throw new AccessError(409,'OPERATION_PAYLOAD_CONFLICT','Bu amal kaliti boshqa ma’lumot bilan ishlatilgan')
          if (old.state==='cancelled') throw new AccessError(409,'OPERATION_CANCELLED','Bu urinish bekor qilingan; yangi amal kaliti kerak')
          return old.result as T
        }
        await assertNewOperationAllowed()
        if(!(READ_ONLY_OPERATION_EXCEPTIONS as readonly string[]).includes(type)){
          try{await tx.$queryRaw`SELECT assert_business_writable(${context.organizationId})::text`}catch(error){throw billingDatabaseError(error)??error}
        }
        const result=await work(tx)
        const json=JSON.parse(JSON.stringify(result)) as Prisma.InputJsonValue
        const operation=await tx.operation.create({data:{organizationId:context.organizationId,actorId:context.userId,type,key,payloadHash:hash,result:json}})
        await postCostContinuations(tx,context,{operationId:operation.id,type,key})
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
      // The same key may commit after the identity probe while we wait on
      // its advisory lock. A stale business-state rejection is then replayed
      // only after a fresh transaction verifies live actor/hash/cancellation.
      const unseenCommittedResult=!observed && error instanceof AccessError && error.status===409 && !!await prisma.operation.findUnique({where:{organizationId_type_key:{organizationId:context.organizationId,type,key}},select:{id:true}})
      const retryable=operationRace || committedBusinessRace || unseenCommittedResult || (error instanceof Prisma.PrismaClientKnownRequestError && (error.code==='P2034' || (error.code==='P2010' && ['40001','40P01'].includes(String(error.meta?.code)))))
      if (!retryable) throw error
      if (attempt===2) throw new AccessError(409,'CONCURRENT_CONFLICT','Parallel amal konflikti; aynan shu amal kaliti bilan qayta tekshiring')
      logEvent('operation_retry',{code:'CONCURRENT_CONFLICT'})
      // Independent tills can collide on shared index pages under SSI. Jitter
      // avoids synchronizing every rolled-back transaction onto the same retry.
      // Preserve the bounded three-attempt policy and the original operation key.
      await new Promise(resolve=>setTimeout(resolve,randomInt(20,81)*(attempt+1)))
    }
  }
  throw new AccessError(409,'CONCURRENT_CONFLICT')
}
export async function audit(tx: Prisma.TransactionClient, context: TokenPayload, entityType: string, entityId: string, action: string, after?: unknown) {
  await tx.auditLog.create({data:{organizationId:context.organizationId,actorId:context.userId,entityType,entityId,action,requestId:requestTrace.getStore()?.requestId,
    ...(after!==undefined && {afterData:JSON.parse(JSON.stringify(safeAudit(after))) as Prisma.InputJsonValue})}})
}
