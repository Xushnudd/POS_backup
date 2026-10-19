import { newPasswordSchema } from '@/server/auth/password-policy'
import { NextRequest, NextResponse } from 'next/server'
import { z } from 'zod'
import { prisma } from '@/lib/prisma'
import { withApi } from '@/server/api'
import { hashPassword, verifyPassword, getRequestToken, verifyToken } from '@/lib/auth'
import { AccessError } from '@/server/auth/policy'
import { consumeLimit } from '@/server/auth/rate-limit'
import { SESSION_COOKIE } from '@/server/auth/session'
import {assertLiveContext,payloadHash} from '@/server/operations'
import {assertCriticalAction} from '@/server/auth/critical-actions'
import {credentialBinding} from '@/server/auth/credential-binding'
const schema=z.object({operationId:z.string().uuid().optional(),currentPassword:z.string().min(1).max(72),newPassword:newPasswordSchema}).strict()
export const POST=withApi(async(request:NextRequest)=>{
 const context=await verifyToken(getRequestToken(request)??'')
 if (!context) throw new AccessError(401,'UNAUTHORIZED')
 await consumeLimit('password-change',context.userId)
 const input=schema.parse(await request.json())
 const privileged=context.role==='owner'||context.role==='admin'
 if(privileged&&process.env.AUTH_CRITICAL_MFA_REQUIRED==='true'&&!input.operationId)throw new AccessError(400,'OPERATION_ID_REQUIRED')
 const user=await prisma.user.findUniqueOrThrow({where:{id:context.userId}})
 if (!await verifyPassword(input.currentPassword,user.passwordHash)) throw new AccessError(403,'INVALID_PASSWORD')
 const hash=await hashPassword(input.newPassword)
 await prisma.$transaction(async tx=>{
  await tx.$queryRaw`SELECT id FROM "User" WHERE id=${user.id} FOR UPDATE`
  await tx.$queryRaw`SELECT id FROM "Session" WHERE id=${context.sessionId} FOR UPDATE`
  await assertLiveContext(tx,context)
  if(privileged)await assertCriticalAction(tx,context,'auth.password.change',input.operationId??context.sessionId,payloadHash({operationId:input.operationId,newPasswordProof:credentialBinding(input.newPassword)}))
  const current=await tx.user.findUniqueOrThrow({where:{id:user.id}})
  const session=await tx.session.findUnique({where:{id:context.sessionId}})
  const now=new Date()
  if(!current.isActive||!session||session.userId!==user.id||session.revokedAt||session.expiresAt<=now||session.idleExpiresAt<=now)throw new AccessError(401,'UNAUTHORIZED')
  if(current.passwordHash!==user.passwordHash)throw new AccessError(409,'PASSWORD_CHANGED','Parol boshqa so‘rovda o‘zgargan; qayta kiring')
  await tx.user.update({where:{id:user.id},data:{passwordHash:hash}})
  await tx.organizationUser.updateMany({where:{userId:user.id,pinHash:{not:null}},data:{pinHash:null}})
  await tx.session.updateMany({where:{userId:user.id,revokedAt:null},data:{revokedAt:new Date()}})
  await tx.auditLog.create({data:{organizationId:context.organizationId,actorId:user.id,entityType:'User',entityId:user.id,action:'password_changed'}})
 })
 const response=NextResponse.json({success:true})
 response.cookies.set(SESSION_COOKIE,'',{path:'/',maxAge:0,httpOnly:true,secure:process.env.NODE_ENV==='production',sameSite:'lax'})
 return response
})
