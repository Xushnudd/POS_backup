import { NextRequest, NextResponse } from 'next/server'
import { withApi } from '@/server/api'
import { getRequestToken, verifyToken } from '@/lib/auth'
import { AccessError } from '@/server/auth/policy'
import { finishCount, decisionSchema } from '@/server/inventory/counts'
export const POST=withApi(async(request:NextRequest,{params}:{params:Promise<{id:string}>})=>{
 const context=await verifyToken(getRequestToken(request)??'')
 if(!context)throw new AccessError(401,'UNAUTHORIZED')
 const {id}=await params
 return NextResponse.json({success:true,data:await finishCount(context,id,decisionSchema.parse(await request.json()),true)})
})
