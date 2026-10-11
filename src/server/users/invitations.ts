import { newPasswordSchema } from '@/server/auth/password-policy'
import type { Prisma } from '@prisma/client'
import { randomBytes } from 'node:crypto'
import { z } from 'zod'
import { prisma } from '@/lib/prisma'
import { hashPassword, type TokenPayload } from '@/lib/auth'
import { AccessError } from '../auth/policy'
import { sessionHash } from '../auth/session'
import { audit,runOperation,payloadHash } from '../operations'
import {assertCriticalAction} from '../auth/critical-actions'

export const invitationSchema=z.object({operationId:z.string().uuid().optional(),phone:z.string().min(9).max(64),role:z.enum(['admin','cashier']),storeIds:z.array(z.string().uuid()).min(1).max(100)}).strict()
export const acceptInvitationSchema=z.object({token:z.string().regex(/^[A-Za-z0-9_-]{43}$/),fullName:z.string().min(2).max(200).optional(),password:newPasswordSchema.optional()})
async function requireOwner(tx: Prisma.TransactionClient,context:TokenPayload) {
 const member=await tx.organizationUser.findFirst({where:{id:context.organizationUserId,userId:context.userId,organizationId:context.organizationId,role:'owner',isActive:true,user:{isActive:true}}})
 const session=await tx.session.findFirst({where:{id:context.sessionId,userId:context.userId,organizationId:context.organizationId,revokedAt:null,expiresAt:{gt:new Date()},idleExpiresAt:{gt:new Date()}}})
 if (context.role!=='owner' || !member || !session) throw new AccessError(403,'FORBIDDEN')
}
export async function createInvitation(context:TokenPayload,input:z.infer<typeof invitationSchema>) {
 input=invitationSchema.parse(input)
 if(context.role!=='owner')throw new AccessError(403,'FORBIDDEN')
 if(process.env.AUTH_CRITICAL_MFA_REQUIRED==='true'&&!input.operationId)throw new AccessError(400,'OPERATION_ID_REQUIRED')
 let issued:{id:string;token:string}|undefined
 const work=async(tx:Prisma.TransactionClient)=>{
  await requireOwner(tx,context)
  if(!input.operationId)await assertCriticalAction(tx,context,'users.invitation.create',context.organizationUserId,payloadHash(input))
  const storeIds=[...new Set(input.storeIds)]
  if (await tx.store.count({where:{id:{in:storeIds},organizationId:context.organizationId,isActive:true}})!==storeIds.length) throw new AccessError(404,'STORE_NOT_FOUND')
  const existing=await tx.organizationUser.findFirst({where:{organizationId:context.organizationId,user:{phone:input.phone}}})
  if (existing) throw new AccessError(409,'MEMBER_EXISTS','Mavjud a’zoning vakolatini xodimlar ro‘yxatida o‘zgartiring')
  const token=randomBytes(32).toString('base64url')
  const invitation=await tx.invitation.create({data:{organizationId:context.organizationId,phone:input.phone,role:input.role,storeIds,tokenHash:sessionHash(token),invitedBy:context.userId,expiresAt:new Date(Date.now()+72*3600000)}})
  await audit(tx,context,'Invitation',invitation.id,'invited',{role:input.role,storeIds})
  issued={id:invitation.id,token}
  return {id:invitation.id,expiresAt:invitation.expiresAt,invitationTokenUnavailable:true}
 }
 const result=input.operationId?await runOperation(context,'users.invitation.create',input.operationId,input,work):await prisma.$transaction(work)
 // Only the callback that committed this exact source may present its token.
 // Replay/competing winner returns metadata and never a stored capability.
 const token=issued?.id===result.id?issued.token:''
 return {...result,invitationToken:token,invitationTokenUnavailable:!token}
}
export async function revokeInvitation(context:TokenPayload,id:string) {
 return prisma.$transaction(async tx=>{
  await requireOwner(tx,context)
  await tx.$queryRaw`SELECT id FROM "Invitation" WHERE id=${id} FOR UPDATE`
  const invitation=await tx.invitation.findFirst({where:{id,organizationId:context.organizationId}})
  if (!invitation) throw new AccessError(404,'NOT_FOUND')
  if (invitation.acceptedAt) throw new AccessError(409,'INVITATION_ALREADY_USED')
  await tx.invitation.update({where:{id},data:{revokedAt:new Date()}})
  await audit(tx,context,'Invitation',id,'invitation_revoked')
  return {id,revoked:true}
 })
}
export async function acceptInvitation(input:z.infer<typeof acceptInvitationSchema>,context:TokenPayload|null) {
 // Hash before opening the transaction; no raw credential enters audit/result.
 const passwordHash=input.password?await hashPassword(input.password):undefined
 return prisma.$transaction(async tx=>{
  const hash=sessionHash(input.token)
  await tx.$queryRaw`SELECT id FROM "Invitation" WHERE "tokenHash"=${hash} FOR UPDATE`
  const invitation=await tx.invitation.findUnique({where:{tokenHash:hash}})
  if (!invitation || invitation.revokedAt || invitation.acceptedAt || invitation.expiresAt<=new Date()) throw new AccessError(410,'INVITATION_INVALID','Taklif eskirgan, bekor qilingan yoki ishlatilgan')
  const issuer=await tx.organizationUser.findFirst({where:{organizationId:invitation.organizationId,userId:invitation.invitedBy,role:'owner',isActive:true,user:{isActive:true}}})
  if (!issuer) throw new AccessError(410,'INVITATION_INVALID')
  const storeIds=z.array(z.string().uuid()).min(1).parse(invitation.storeIds)
  if (await tx.store.count({where:{id:{in:storeIds},organizationId:invitation.organizationId,isActive:true}})!==storeIds.length) throw new AccessError(409,'STORE_NOT_FOUND')
  let user=await tx.user.findUnique({where:{phone:invitation.phone}})
  if (user) {
   if (!context || context.userId!==user.id || !user.isActive) throw new AccessError(401,'LOGIN_REQUIRED','Mavjud hisob egasi avval tizimga kirishi kerak')
   const session=await tx.session.findFirst({where:{id:context.sessionId,userId:user.id,revokedAt:null,expiresAt:{gt:new Date()},idleExpiresAt:{gt:new Date()}}})
   if (!session) throw new AccessError(401,'LOGIN_REQUIRED')
  } else {
   if (!passwordHash || !input.fullName) throw new AccessError(400,'ACCOUNT_DETAILS_REQUIRED','Ism va yangi parol kerak')
   user=await tx.user.create({data:{phone:invitation.phone,fullName:input.fullName,passwordHash}})
  }
  if (await tx.organizationUser.findUnique({where:{organizationId_userId:{organizationId:invitation.organizationId,userId:user.id}}})) throw new AccessError(409,'MEMBER_EXISTS')
  const member=await tx.organizationUser.create({data:{organizationId:invitation.organizationId,userId:user.id,role:invitation.role,userStores:{create:storeIds.map(storeId=>({storeId}))}}})
  await tx.invitation.update({where:{id:invitation.id},data:{acceptedAt:new Date()}})
  await tx.auditLog.create({data:{organizationId:invitation.organizationId,actorId:user.id,entityType:'Invitation',entityId:invitation.id,action:'invitation_accepted',afterData:{membershipId:member.id,role:member.role}}})
  return {membershipId:member.id,organizationId:member.organizationId}
 })
}
