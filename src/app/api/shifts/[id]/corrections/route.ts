import { paging } from '@/server/catalog/queries'
import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
import { getRequestToken, verifyToken } from '@/lib/auth'
import { withApi } from '@/server/api'
import { AccessError, tenantScope } from '@/server/auth/policy'
import { correctShift, correctionSchema } from '@/server/finance/shifts'
export const POST=withApi(async(request:NextRequest,{params}:{params:Promise<{id:string}>})=>{
 const context=await verifyToken(getRequestToken(request)??'')
 if(!context)throw new AccessError(401,'UNAUTHORIZED')
 const {id}=await params
 return NextResponse.json({success:true,data:await correctShift(context,id,correctionSchema.parse(await request.json()))})
})
export const GET=withApi(async(request:NextRequest,{params}:{params:Promise<{id:string}>})=>{
 const context=await verifyToken(getRequestToken(request)??'')
 if(!context)throw new AccessError(401,'UNAUTHORIZED')
 if(!['owner','admin'].includes(context.role))throw new AccessError(403,'MANAGER_REQUIRED')
 const {id}=await params,{page,limit,skip}=paging(request.nextUrl.searchParams)
 const result=await prisma.$transaction(async tx=>{
  if(!await tx.shift.findFirst({where:{id,AND:tenantScope('Shift',context)},select:{id:true}}))throw new AccessError(404,'NOT_FOUND')
  const where={organizationId:context.organizationId,originalShiftId:id}
  const total=await tx.shiftCorrection.count({where}),data=await tx.shiftCorrection.findMany({where,orderBy:[{createdAt:'desc'},{id:'asc'}],skip,take:limit,include:{creator:{select:{fullName:true}}}})
  return {success:true,data,pagination:{page,limit,total,totalPages:Math.ceil(total/limit)}}
 },{isolationLevel:'RepeatableRead'})
 return NextResponse.json(result)
})
