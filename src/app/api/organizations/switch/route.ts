import { NextRequest, NextResponse } from 'next/server'
import { z } from 'zod'
import { prisma } from '@/lib/prisma'
import { withApi } from '@/server/api'
import { getRequestToken, verifyToken } from '@/lib/auth'
import { createSession, setSessionCookie } from '@/server/auth/session'
import { AccessError } from '@/server/auth/policy'
export const POST=withApi(async(request:NextRequest)=>{
 const context=await verifyToken(getRequestToken(request)??'')
 if (!context) throw new AccessError(401,'UNAUTHORIZED')
 // targetOrganizationId is intentionally distinct from the current-tenant filter.
 const input=z.object({targetOrganizationId:z.string().uuid()}).parse(await request.json())
 const member=await prisma.organizationUser.findUnique({where:{organizationId_userId:{organizationId:input.targetOrganizationId,userId:context.userId}}})
 if (!member?.isActive) throw new AccessError(403,'FORBIDDEN')
 const token=await prisma.$transaction(async tx=>{
  await tx.session.update({where:{id:context.sessionId},data:{revokedAt:new Date()}})
  return createSession(tx,context.userId,member.organizationId)
 })
 const response=NextResponse.json({success:true,data:{organizationId:member.organizationId}})
 setSessionCookie(response,token)
 return response
})
