import { z } from 'zod'
import type { TokenPayload } from '@/lib/auth'
import { prisma } from '@/lib/prisma'
import { AccessError } from '../auth/policy'
import { assertLiveContext, audit, runOperation } from '../operations'
import { platformAdmin } from '../billing/service'
import { retentionSchedule } from './phase'
const days=z.number().int().min(1).max(3650)
export const retentionPolicySchema=z.object({
 operationId:z.string().uuid(),expectedVersionId:z.string().min(1).max(100),
 expiredSubscriptionDays:days,closureCancellationDays:z.number().int().min(1).max(365),
 auditRetentionDays:days.nullable(),technicalLogRetentionDays:days.nullable(),backupRetentionDays:days.nullable(),
 proposedFinancialRetentionYears:z.number().int().min(5).max(100),reason:z.string().trim().min(3).max(2000),
}).strict()
export async function retentionStatus(context:TokenPayload){
 return prisma.$transaction(async tx=>{
  await assertLiveContext(tx,context)
  const canManage=Boolean(await tx.platformOperator.findFirst({where:{userId:context.userId,role:'platform_admin',isActive:true}}))&&Boolean(await tx.session.findFirst({where:{id:context.sessionId,authenticationMethod:'password'}}))
  if(context.role!=='owner'&&!canManage)throw new AccessError(403,'OWNER_REQUIRED')
  const pointer=await tx.retentionPolicy.findUnique({where:{key:'default'},include:{currentVersion:true}})
  if(!pointer)throw new AccessError(503,'RETENTION_POLICY_UNAVAILABLE')
  const subscription=await tx.organizationSubscription.findUnique({where:{organizationId:context.organizationId},include:{planVersion:true}})
  const [{now}]=await tx.$queryRaw<{now:Date}[]>`SELECT NOW() AS now`
  const version=pointer.currentVersion
  const {createdBy,reason,...publicVersion}=version;void createdBy;void reason
  return {policy:publicVersion,canManage,now,...retentionSchedule(now,subscription?{trialEndsAt:subscription.trialEndsAt,paidThrough:subscription.paidThrough,graceDays:subscription.planVersion.graceDays}:null,version),automaticDeletionEnabled:false,legalPolicyStatus:'review_required',closureAvailable:false}
 },{isolationLevel:'RepeatableRead'})
}
export async function publishRetentionPolicy(context:TokenPayload,input:z.input<typeof retentionPolicySchema>){
 const parsed=retentionPolicySchema.parse(input)
 return runOperation(context,'retention.policy.publish',parsed.operationId,parsed,async tx=>{
  await tx.$queryRaw`SELECT pg_advisory_xact_lock(hashtextextended('retention-policy:default',0))::text`
  // A changed row invalidates a stale serializable snapshot before version insertion.
  await tx.$queryRaw`SELECT key FROM "RetentionPolicy" WHERE key = 'default' FOR UPDATE`
  const pointer=await tx.retentionPolicy.findUnique({where:{key:'default'},include:{currentVersion:true}})
  if(!pointer)throw new AccessError(503,'RETENTION_POLICY_UNAVAILABLE')
  if(pointer.currentVersionId!==parsed.expectedVersionId)throw new AccessError(409,'RETENTION_POLICY_CHANGED','Saqlash siyosati o‘zgardi; yangi versiyani qayta ko‘rib chiqing')
  const {operationId,expectedVersionId,...fields}=parsed;void operationId;void expectedVersionId
  const version=await tx.retentionPolicyVersion.create({data:{...fields,version:pointer.currentVersion.version+1,createdBy:context.userId}})
  await tx.retentionPolicy.update({where:{key:'default'},data:{currentVersionId:version.id}})
  await audit(tx,context,'RetentionPolicyVersion',version.id,'retention_policy_published',{...fields,version:version.version,previousVersionId:pointer.currentVersionId,automaticDeletionEnabled:false,legalPolicyStatus:'review_required'})
  const {createdBy,...result}=version;void createdBy;return result
 },tx=>platformAdmin(tx,context))
}
