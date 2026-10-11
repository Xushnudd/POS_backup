import { z } from 'zod'
import type {Prisma} from '@prisma/client'
import type { TokenPayload } from '@/lib/auth'
import { prisma } from '@/lib/prisma'
import { AccessError } from '../auth/policy'
import { assertLiveContext, audit, runOperation, payloadHash } from '../operations'
import {assertCriticalAction} from '../auth/critical-actions'
import {activeMembershipWhere} from '../auth/custom-role-policy'
export const memberSchema=z.object({operationId:z.string().uuid().optional(),role:z.enum(['owner','admin','cashier']).optional(),customRoleId:z.string().uuid().nullable().optional(),isActive:z.boolean().optional(),storeIds:z.array(z.string().uuid()).max(100).optional(),action:z.enum(['archive','restore']).optional()}).strict().refine(input=>!input.action || (input.role===undefined&&input.customRoleId===undefined&&input.isActive===undefined&&input.storeIds===undefined),{message:'Arxivlash/tiklash alohida amal bo‘lishi kerak'})
async function criticalMutation(tx:Prisma.TransactionClient,context:TokenPayload,action:string,operationId:string|undefined,payload:unknown){
 if(process.env.AUTH_CRITICAL_MFA_REQUIRED==='true'&&!operationId)throw new AccessError(400,'OPERATION_ID_REQUIRED','MFA uchun yagona amal identifikatori talab qilinadi')
 await assertCriticalAction(tx,context,action,operationId??context.organizationUserId,payloadHash(payload))
}
export async function updateMember(context:TokenPayload,id:string,input:z.infer<typeof memberSchema>) {
 if (context.role!=='owner') throw new AccessError(403,'FORBIDDEN')
 input=memberSchema.parse(input)
 const work=async(tx:Prisma.TransactionClient)=>{
  await tx.$queryRaw`SELECT id FROM "Organization" WHERE id=${context.organizationId} FOR UPDATE`
  await assertLiveContext(tx,context)
  if(!input.operationId)await criticalMutation(tx,context,'users.member.update',undefined,{id,...input})
  const member=await tx.organizationUser.findFirst({where:{id,organizationId:context.organizationId}})
  if (!member) throw new AccessError(404,'NOT_FOUND')
  let nextRole=input.role??member.role
  let customRoleId=input.customRoleId!==undefined?input.customRoleId:(input.role!==undefined&&input.role!==member.role?null:member.customRoleId)
  if(input.customRoleId){
   const profile=await tx.customRole.findFirst({where:{id:input.customRoleId,organizationId:context.organizationId,isActive:true}})
   if(!profile)throw new AccessError(404,'NOT_FOUND')
   if(input.role&&input.role!==profile.baseRole)throw new AccessError(400,'ROLE_BASE_MISMATCH')
   nextRole=profile.baseRole
  }
  if(nextRole==='owner')customRoleId=null
  if(customRoleId&&input.isActive===true&&!await tx.customRole.findFirst({where:{id:customRoleId,organizationId:context.organizationId,isActive:true,baseRole:nextRole}}))throw new AccessError(409,'ROLE_INACTIVE','Avval faol rolni biriktiring')
  if(member.archivedAt&&!input.action)throw new AccessError(409,'MEMBER_ARCHIVED','Avval xodimni arxivdan tiklang')
  if(input.action==='restore'&&!member.archivedAt)throw new AccessError(409,'NOT_ARCHIVED','Xodim arxivda emas')
  if (member.isActive && member.role==='owner' && (input.action==='archive' || input.isActive===false || nextRole!=='owner')) {
   const owners=await tx.organizationUser.count({where:{organizationId:context.organizationId,role:'owner',isActive:true}})
   if (owners<=1) throw new AccessError(409,'LAST_OWNER','Oxirgi egani bloklash yoki vakolatini olish mumkin emas')
  }
  if (input.storeIds) {
   const stores=await tx.store.count({where:{id:{in:input.storeIds},organizationId:context.organizationId,isActive:true}})
   if (stores!==new Set(input.storeIds).size) throw new AccessError(404,'STORE_NOT_FOUND')
   await tx.userStore.deleteMany({where:{organizationUserId:id}})
   await tx.userStore.createMany({data:[...new Set(input.storeIds)].map(storeId=>({storeId,organizationUserId:id}))})
  }
  const result=await tx.organizationUser.update({where:{id},data:{role:nextRole,customRoleId,isActive:input.action?false:input.isActive,...(input.action==='archive'?{archivedAt:member.archivedAt??new Date()}:input.action==='restore'?{archivedAt:null}:{})},select:{id:true,role:true,customRoleId:true,isActive:true,archivedAt:true,user:{select:{id:true,fullName:true,phone:true,email:true}},userStores:{include:{store:true}}}})
  await tx.session.updateMany({where:{userId:member.userId,organizationId:context.organizationId,revokedAt:null},data:{revokedAt:new Date()}})
  await audit(tx,context,'OrganizationUser',id,input.action==='archive'?'membership_archived':input.action==='restore'?'membership_restored':'membership_updated',{role:result.role,customRoleId:result.customRoleId,isActive:result.isActive,archivedAt:result.archivedAt?.toISOString()??null,storeIds:input.storeIds})
  return result
 }
 return input.operationId?runOperation(context,'users.member.update',input.operationId,{id,...input},work):prisma.$transaction(work)
}
export async function transferOwnership(context:TokenPayload,targetId:string,operationId?:string) {
 if(context.role!=='owner')throw new AccessError(403,'FORBIDDEN')
 if(operationId)z.string().uuid().parse(operationId)
 return prisma.$transaction(async tx=>{
  await tx.$queryRaw`SELECT id FROM "Organization" WHERE id=${context.organizationId} FOR UPDATE`
  await assertLiveContext(tx,context)
  const target=await tx.organizationUser.findFirst({where:{id:targetId,organizationId:context.organizationId,...activeMembershipWhere,user:{isActive:true}}})
  if(!target||target.userId===context.userId)throw new AccessError(400,'INVALID_TARGET')
  await criticalMutation(tx,context,'users.ownership.request',operationId,{targetId,operationId})
  await tx.ownershipTransfer.updateMany({where:{organizationId:context.organizationId,state:'pending',expiresAt:{lte:new Date()}},data:{state:'expired'}})
  const pending=await tx.ownershipTransfer.findFirst({where:{organizationId:context.organizationId,state:'pending'}})
  if(pending){
   if(pending.fromMembershipId===context.organizationUserId&&pending.toMembershipId===targetId)return pending
   throw new AccessError(409,'TRANSFER_PENDING','Avval mavjud egalik so‘rovini bekor qiling')
  }
  const request=await tx.ownershipTransfer.create({data:{organizationId:context.organizationId,fromMembershipId:context.organizationUserId,toMembershipId:targetId,expiresAt:new Date(Date.now()+24*3600000)}})
  await audit(tx,context,'OwnershipTransfer',request.id,'ownership_requested',{targetMembershipId:targetId})
  return request
 })
}
export async function respondOwnership(context:TokenPayload,id:string,action:'accept'|'cancel',operationId?:string){
 if(operationId)z.string().uuid().parse(operationId)
 return prisma.$transaction(async tx=>{
  await tx.$queryRaw`SELECT id FROM "Organization" WHERE id=${context.organizationId} FOR UPDATE`
  await assertLiveContext(tx,context)
  const request=await tx.ownershipTransfer.findFirst({where:{id,organizationId:context.organizationId}})
  if(!request||![request.fromMembershipId,request.toMembershipId].includes(context.organizationUserId))throw new AccessError(404,'NOT_FOUND')
  if(action==='accept'&&request.toMembershipId!==context.organizationUserId)throw new AccessError(403,'RECIPIENT_REQUIRED')
  await criticalMutation(tx,context,'users.ownership.'+action,operationId,{id,action,operationId})
  if(request.state===(action==='accept'?'accepted':'cancelled'))return {request,token:null}
  if(request.state!=='pending'||request.expiresAt<=new Date())throw new AccessError(409,'TRANSFER_EXPIRED')
  if(action==='cancel'){
   const cancelled=await tx.ownershipTransfer.update({where:{id},data:{state:'cancelled'}})
   await audit(tx,context,'OwnershipTransfer',id,'ownership_cancelled',{})
   return {request:cancelled,token:null}
  }
  const from=await tx.organizationUser.findFirst({where:{id:request.fromMembershipId,organizationId:context.organizationId,isActive:true,role:'owner',user:{isActive:true}}})
  if(!from)throw new AccessError(409,'OWNER_CHANGED')
  await tx.organizationUser.update({where:{id:request.toMembershipId},data:{role:'owner',customRoleId:null}})
  await tx.organizationUser.update({where:{id:from.id},data:{role:'admin'}})
  await tx.session.updateMany({where:{organizationId:context.organizationId,userId:{in:[context.userId,from.userId]},revokedAt:null},data:{revokedAt:new Date()}})
  const accepted=await tx.ownershipTransfer.update({where:{id},data:{state:'accepted',acceptedAt:new Date()}})
  const {createSession}=await import('../auth/session')
  const token=await createSession(tx,context.userId,context.organizationId)
  await audit(tx,context,'OwnershipTransfer',id,'ownership_transferred',{fromMembershipId:from.id,targetMembershipId:request.toMembershipId})
  return {request:accepted,token}
 })
}
