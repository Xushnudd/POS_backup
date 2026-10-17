import {createHash} from 'node:crypto'
import {Prisma} from '@prisma/client'
import {z} from 'zod'
import {prisma} from '@/lib/prisma'
import {verifyPassword,type TokenPayload} from '@/lib/auth'
import {AccessError} from '../auth/policy'
import {consumeLimit} from '../auth/rate-limit'
import {assertLiveContext,audit,runOperation} from '../operations'
import {cancelClosureSnapshot,closurePhase,newClosureSnapshot} from './closure-phase'

const password=z.string().min(1).max(1024)
const reason=z.string().trim().min(3).max(2000)
export const requestClosureSchema=z.object({operationId:z.string().uuid(),expectedPolicyVersionId:z.string().min(1).max(100),exportJobId:z.string().uuid(),reason,password}).strict()
export const cancelClosureSchema=z.object({operationId:z.string().uuid(),closureId:z.string().uuid(),reason,password}).strict()
async function owner(tx:Prisma.TransactionClient,ctx:TokenPayload,passwordValue?:string){
 if(ctx.role!=='owner')throw new AccessError(403,'OWNER_REQUIRED')
 // Serialize password changes/revocation with authentication and persistence.
 if(passwordValue!==undefined)await tx.$queryRaw`SELECT s.id FROM "Session" s JOIN "User" u ON u.id=s."userId" JOIN "OrganizationUser" m ON m.id=${ctx.organizationUserId} WHERE s.id=${ctx.sessionId} AND u.id=${ctx.userId} FOR SHARE OF s,u,m`
 await assertLiveContext(tx,ctx)
 if(!await tx.session.findFirst({where:{id:ctx.sessionId,authenticationMethod:'password'}}))throw new AccessError(403,'PASSWORD_SESSION_REQUIRED')
 if(passwordValue!==undefined){
  const user=await tx.user.findUniqueOrThrow({where:{id:ctx.userId}})
  if(!await verifyPassword(passwordValue,user.passwordHash))throw new AccessError(403,'REAUTHENTICATION_FAILED','Joriy parol bilan qayta tasdiqlang')
 }
}
async function databaseTime(tx:Prisma.TransactionClient){const [row]=await tx.$queryRaw<{now:Date}[]>`SELECT clock_timestamp() AT TIME ZONE 'UTC' AS now`;return row.now}
export async function closureStatus(ctx:TokenPayload){
 return prisma.$transaction(async tx=>{
  await owner(tx,ctx)
  const now=await databaseTime(tx)
  const current=await tx.organizationClosure.findFirst({where:{organizationId:ctx.organizationId,cancelledAt:null},orderBy:[{requestedAt:'desc'},{id:'desc'}]})
  const policy=await tx.retentionPolicy.findUniqueOrThrow({where:{key:'default'},include:{currentVersion:true}})
  return {current,phase:closurePhase(now,current),policyVersionId:policy.currentVersionId,cancellationDays:policy.currentVersion.closureCancellationDays,now,automaticDeletionEnabled:false}
 },{isolationLevel:'RepeatableRead'})
}
export async function requestClosure(ctx:TokenPayload,input:z.input<typeof requestClosureSchema>){
 const parsed=requestClosureSchema.parse(input),{password:credential,...publicPayload}=parsed
 await consumeLimit('retention.reauthenticate',ctx.userId,5,15*60000)
 // Credential is excluded from the operation hash/result/audit. Replays still
 // require current owner authority and a fresh comparison of the current password.
 return runOperation(ctx,'retention.closure.request',parsed.operationId,publicPayload,async tx=>{
  await tx.$queryRaw`SELECT id FROM "Organization" WHERE id=${ctx.organizationId} FOR UPDATE`
  if(await tx.organizationClosure.findFirst({where:{organizationId:ctx.organizationId,cancelledAt:null}}))throw new AccessError(409,'CLOSURE_ALREADY_REQUESTED')
  await tx.$queryRaw`SELECT key FROM "RetentionPolicy" WHERE key='default' FOR SHARE`
  const pointer=await tx.retentionPolicy.findUniqueOrThrow({where:{key:'default'},include:{currentVersion:true}})
  if(pointer.currentVersionId!==parsed.expectedPolicyVersionId)throw new AccessError(409,'RETENTION_POLICY_CHANGED')
  const now=await databaseTime(tx)
  const artifact=await tx.jobExport.findFirst({where:{jobId:parsed.exportJobId,organizationId:ctx.organizationId,job:{type:'tenant_export',state:'succeeded'},expiresAt:{gt:now}}})
  if(!artifact||(!artifact.data&&!artifact.chunkCount))throw new AccessError(409,'CLOSURE_EXPORT_REQUIRED','Avval to‘liq biznes eksportini tayyorlang va yuklab oling')
  if(artifact.data&&(artifact.size!==artifact.data.length||createHash('sha256').update(artifact.data).digest('hex')!==artifact.sha256))throw new AccessError(503,'EXPORT_CORRUPTED')
  if(!await tx.auditLog.findFirst({where:{organizationId:ctx.organizationId,actorId:ctx.userId,entityType:'BackgroundJob',entityId:parsed.exportJobId,action:'export_downloaded'}}))throw new AccessError(409,'CLOSURE_EXPORT_REQUIRED')
  // Do not strand ongoing till/provider/offline work behind a closure block.
  if(await tx.shift.count({where:{register:{store:{organizationId:ctx.organizationId}},status:'open'}})
    ||await tx.sale.count({where:{organizationId:ctx.organizationId,status:'draft'}})
    ||await tx.providerIntent.count({where:{organizationId:ctx.organizationId,state:{notIn:['confirmed','compensated','failed']}}})
    ||await tx.offlineCashLease.count({where:{organizationId:ctx.organizationId,state:'issued'}}))throw new AccessError(409,'CLOSURE_ACTIVE_WORK','Ochiq smena, savdo yoki offline/tashqi amalni avval hal qiling')
  const snapshot=newClosureSnapshot(now,pointer.currentVersion)
  const row=await tx.organizationClosure.create({data:{...snapshot,organizationId:ctx.organizationId,requestedBy:ctx.userId,exportJobId:artifact.jobId,exportSha256:artifact.sha256,reason:parsed.reason}})
  await audit(tx,ctx,'OrganizationClosure',row.id,'organization_closure_requested',{reason:row.reason,policyVersionId:row.policyVersionId,cancellationEndsAt:row.cancellationEndsAt,exportJobId:row.exportJobId,exportSha256:row.exportSha256,automaticDeletionEnabled:false})
  return row
 },tx=>owner(tx,ctx,credential))
}
export async function cancelClosure(ctx:TokenPayload,input:z.input<typeof cancelClosureSchema>){
 const parsed=cancelClosureSchema.parse(input),{password:credential,...publicPayload}=parsed
 await consumeLimit('retention.reauthenticate',ctx.userId,5,15*60000)
 return runOperation(ctx,'retention.closure.cancel',parsed.operationId,publicPayload,async tx=>{
  await tx.$queryRaw`SELECT id FROM "Organization" WHERE id=${ctx.organizationId} FOR UPDATE`
  const row=await tx.organizationClosure.findFirst({where:{id:parsed.closureId,organizationId:ctx.organizationId}})
  if(!row)throw new AccessError(404,'NOT_FOUND')
  if(row.cancelledAt)throw new AccessError(409,'CLOSURE_ALREADY_CANCELLED')
  const now=await databaseTime(tx)
  if(!closurePhase(now,row).cancellationAllowed)throw new AccessError(409,'CLOSURE_CANCELLATION_EXPIRED')
  const snapshot=cancelClosureSnapshot(now,row)
  const result=await tx.organizationClosure.update({where:{id:row.id},data:{cancelledAt:snapshot.cancelledAt,cancelledBy:ctx.userId,cancellationReason:parsed.reason}})
  await audit(tx,ctx,'OrganizationClosure',row.id,'organization_closure_cancelled',{reason:parsed.reason,cancelledAt:result.cancelledAt})
  return result
 },tx=>owner(tx,ctx,credential))
}
