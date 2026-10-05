import { NextRequest, NextResponse } from 'next/server'
import { z } from 'zod'
import { prisma } from '@/lib/prisma'
import { withApi } from '@/server/api'
import { hashPassword, verifyPassword, getRequestToken, verifyToken } from '@/lib/auth'
import { AccessError } from '@/server/auth/policy'
import { consumeLimit } from '@/server/auth/rate-limit'
import { SESSION_COOKIE } from '@/server/auth/session'
const schema=z.object({currentPassword:z.string().min(1).max(72),newPassword:z.string().min(8).max(72).refine(value=>Buffer.byteLength(value,'utf8')<=72,'Parol UTF-8 bo‘yicha 72 baytdan oshmasin')}).strict()
export const POST=withApi(async(request:NextRequest)=>{
 const context=await verifyToken(getRequestToken(request)??'')
 if (!context) throw new AccessError(401,'UNAUTHORIZED')
 await consumeLimit('password-change',context.userId)
 const input=schema.parse(await request.json())
 const user=await prisma.user.findUniqueOrThrow({where:{id:context.userId}})
 if (!await verifyPassword(input.currentPassword,user.passwordHash)) throw new AccessError(403,'INVALID_PASSWORD')
 const hash=await hashPassword(input.newPassword)
 await prisma.$transaction(async tx=>{
  await tx.$queryRaw`SELECT id FROM "User" WHERE id=${user.id} FOR UPDATE`
  await tx.$queryRaw`SELECT id FROM "Session" WHERE id=${context.sessionId} FOR UPDATE`
  const current=await tx.user.findUniqueOrThrow({where:{id:user.id}})
  const session=await tx.session.findUnique({where:{id:context.sessionId}})
  const now=new Date()
  if(!current.isActive||!session||session.userId!==user.id||session.revokedAt||session.expiresAt<=now||session.idleExpiresAt<=now)throw new AccessError(401,'UNAUTHORIZED')
  if(current.passwordHash!==user.passwordHash)throw new AccessError(409,'PASSWORD_CHANGED','Parol boshqa so‘rovda o‘zgargan; qayta kiring')
  await tx.user.update({where:{id:user.id},data:{passwordHash:hash}})
  await tx.session.updateMany({where:{userId:user.id,revokedAt:null},data:{revokedAt:new Date()}})
  await tx.auditLog.create({data:{organizationId:context.organizationId,actorId:user.id,entityType:'User',entityId:user.id,action:'password_changed'}})
 })
 const response=NextResponse.json({success:true})
 response.cookies.set(SESSION_COOKIE,'',{path:'/',maxAge:0,httpOnly:true,secure:process.env.NODE_ENV==='production',sameSite:'lax'})
 return response
})
