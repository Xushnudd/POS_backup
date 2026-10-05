import { z } from 'zod'
import type { TokenPayload } from '@/lib/auth'
import { prisma } from '@/lib/prisma'
import { AccessError } from '../auth/policy'
import { assertLiveContext, audit } from '../operations'
export const memberSchema=z.object({role:z.enum(['owner','admin','cashier']).optional(),isActive:z.boolean().optional(),storeIds:z.array(z.string().uuid()).max(100).optional()})
export async function updateMember(context:TokenPayload,id:string,input:z.infer<typeof memberSchema>) {
 if (context.role!=='owner') throw new AccessError(403,'FORBIDDEN')
 return prisma.$transaction(async tx=>{
  await tx.$queryRaw`SELECT id FROM "Organization" WHERE id=${context.organizationId} FOR UPDATE`
  await assertLiveContext(tx,context)
  const member=await tx.organizationUser.findFirst({where:{id,organizationId:context.organizationId}})
  if (!member) throw new AccessError(404,'NOT_FOUND')
  if (member.isActive && member.role==='owner' && (input.isActive===false || (input.role && input.role!=='owner'))) {
   const owners=await tx.organizationUser.count({where:{organizationId:context.organizationId,role:'owner',isActive:true}})
   if (owners<=1) throw new AccessError(409,'LAST_OWNER','Oxirgi egani bloklash yoki vakolatini olish mumkin emas')
  }
  if (input.storeIds) {
   const stores=await tx.store.count({where:{id:{in:input.storeIds},organizationId:context.organizationId,isActive:true}})
   if (stores!==new Set(input.storeIds).size) throw new AccessError(404,'STORE_NOT_FOUND')
   await tx.userStore.deleteMany({where:{organizationUserId:id}})
   await tx.userStore.createMany({data:[...new Set(input.storeIds)].map(storeId=>({storeId,organizationUserId:id}))})
  }
  const result=await tx.organizationUser.update({where:{id},data:{role:input.role,isActive:input.isActive},select:{id:true,role:true,isActive:true,user:{select:{id:true,fullName:true,phone:true,email:true}},userStores:{include:{store:true}}}})
  await tx.session.updateMany({where:{userId:member.userId,organizationId:context.organizationId,revokedAt:null},data:{revokedAt:new Date()}})
  await audit(tx,context,'OrganizationUser',id,'membership_updated',{role:result.role,isActive:result.isActive,storeIds:input.storeIds})
  return result
 })
}
export async function transferOwnership(context:TokenPayload,targetId:string) {
 if (context.role!=='owner') throw new AccessError(403,'FORBIDDEN')
 return prisma.$transaction(async tx=>{
  await tx.$queryRaw`SELECT id FROM "Organization" WHERE id=${context.organizationId} FOR UPDATE`
  await assertLiveContext(tx,context)
  const target=await tx.organizationUser.findFirst({where:{id:targetId,organizationId:context.organizationId,isActive:true,user:{isActive:true}}})
  if (!target || target.userId===context.userId) throw new AccessError(400,'INVALID_TARGET')
  await tx.organizationUser.update({where:{id:target.id},data:{role:'owner'}})
  await tx.organizationUser.update({where:{id:context.organizationUserId},data:{role:'admin'}})
  await tx.session.updateMany({where:{organizationId:context.organizationId,userId:{in:[context.userId,target.userId]},revokedAt:null},data:{revokedAt:new Date()}})
  await audit(tx,context,'Organization',context.organizationId,'ownership_transferred',{targetMembershipId:target.id})
  return {organizationId:context.organizationId,newOwnerMembershipId:target.id}
 })
}
