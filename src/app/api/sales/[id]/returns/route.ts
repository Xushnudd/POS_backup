import { NextRequest, NextResponse } from 'next/server'
import { withApi } from '@/server/api'
import { getRequestToken, verifyToken } from '@/lib/auth'
import { returnSale, returnSchema } from '@/server/returns/service'
import { AccessError } from '@/server/auth/policy'
export const POST=withApi(async(request:NextRequest,{params}:{params:Promise<{id:string}>})=>{
 const context=await verifyToken(getRequestToken(request)??'')
 if (!context) throw new AccessError(401,'UNAUTHORIZED')
 const {id}=await params
 const result=await returnSale(context,id,returnSchema.parse(await request.json()))
 return NextResponse.json({success:true,data:result})
})
