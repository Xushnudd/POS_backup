import { NextRequest, NextResponse } from 'next/server'
import { withApi } from '@/server/api'
import { verifyToken, getRequestToken } from '@/lib/auth'
import { prisma } from '@/lib/prisma'
import { AccessError } from '@/server/auth/policy'
import { addBarcode, barcodeSchema } from '@/server/catalog/service'
export const GET=withApi(async(request:NextRequest,{params}:{params:Promise<{id:string}>})=>{
 const context=await verifyToken(getRequestToken(request)??'')
 if (!context)throw new AccessError(401,'UNAUTHORIZED')
 const {id}=await params
 return NextResponse.json({success:true,data:await prisma.productBarcode.findMany({where:{productId:id,organizationId:context.organizationId},orderBy:[{isPrimary:'desc'},{createdAt:'asc'}],take:200})})
})
export const POST=withApi(async(request:NextRequest,{params}:{params:Promise<{id:string}>})=>{
 const context=await verifyToken(getRequestToken(request)??'')
 if (!context)throw new AccessError(401,'UNAUTHORIZED')
 const {id}=await params,input=barcodeSchema.parse(await request.json())
 return NextResponse.json({success:true,data:await addBarcode(context,id,input.value)})
})
