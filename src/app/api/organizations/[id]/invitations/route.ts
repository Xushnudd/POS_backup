import { NextRequest, NextResponse } from 'next/server'
import { withApi } from '@/server/api'
import { getRequestToken, verifyToken } from '@/lib/auth'
import { prisma } from '@/lib/prisma'
import { AccessError } from '@/server/auth/policy'
import { consumeLimit } from '@/server/auth/rate-limit'
import { createInvitation, invitationSchema } from '@/server/users/invitations'
export const GET=withApi(async(request:NextRequest)=>{
 const context=await verifyToken(getRequestToken(request)??'')
 if (!context || context.role!=='owner') throw new AccessError(403,'FORBIDDEN')
 const invitations=await prisma.invitation.findMany({where:{organizationId:context.organizationId},select:{id:true,phone:true,role:true,storeIds:true,expiresAt:true,acceptedAt:true,revokedAt:true,createdAt:true},orderBy:{createdAt:'desc'},take:100})
 return NextResponse.json({success:true,data:invitations})
})
export const POST=withApi(async(request:NextRequest)=>{
 const context=await verifyToken(getRequestToken(request)??'')
 if (!context || context.role!=='owner') throw new AccessError(403,'FORBIDDEN')
 await consumeLimit('invitation.create',context.userId,30,3600000)
 return NextResponse.json({success:true,data:await createInvitation(context,invitationSchema.parse(await request.json()))})
})
