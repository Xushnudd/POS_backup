import { NextRequest, NextResponse } from 'next/server'
import { withApi } from '@/server/api'
import { verifyToken, getRequestToken } from '@/lib/auth'
import { prisma } from '@/lib/prisma'
import { AccessError } from '@/server/auth/policy'
import { createUnit, unitSchema } from '@/server/catalog/service'
export const GET=withApi(async(request:NextRequest)=>{
 const context=await verifyToken(getRequestToken(request)??'')
 if (!context)throw new AccessError(401,'UNAUTHORIZED')
 return NextResponse.json({success:true,data:await prisma.unit.findMany({where:{organizationId:context.organizationId},orderBy:{name:'asc'},take:200})})
})
export const POST=withApi(async(request:NextRequest)=>{
 const context=await verifyToken(getRequestToken(request)??'')
 if (!context)throw new AccessError(401,'UNAUTHORIZED')
 return NextResponse.json({success:true,data:await createUnit(context,unitSchema.parse(await request.json()))})
})
