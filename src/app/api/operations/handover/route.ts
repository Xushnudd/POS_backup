import { NextRequest, NextResponse } from 'next/server'
import { withApi } from '@/server/api'
import { verifyToken, getRequestToken } from '@/lib/auth'
import { AccessError, tenantScope } from '@/server/auth/policy'
import { prisma } from '@/lib/prisma'
import { assertLiveContext } from '@/server/operations'
export const GET=withApi(async(request:NextRequest)=>{
 const context=await verifyToken(getRequestToken(request)??'');if(!context)throw new AccessError(401,'UNAUTHORIZED')
 const registerId=request.nextUrl.searchParams.get('registerId');if(!registerId)throw new AccessError(400,'REGISTER_REQUIRED')
 const data=await prisma.$transaction(async tx=>{
  await assertLiveContext(tx,context)
  if(!await tx.register.findFirst({where:{id:registerId,AND:tenantScope('Register',context),isActive:true,store:{isActive:true}}}))throw new AccessError(404,'NOT_FOUND')
  const previous=await tx.shift.findFirst({where:{registerId},orderBy:[{openedAt:'desc'},{id:'desc'}],select:{id:true,status:true,countedCash:true,closedAt:true}})
  return previous?.status==='closed'?{id:previous.id,countedCash:previous.countedCash,closedAt:previous.closedAt}:null
 },{isolationLevel:'RepeatableRead'})
 return NextResponse.json({success:true,data})
})
