import { NextRequest, NextResponse } from 'next/server'
import { z } from 'zod'
import { withApi } from '@/server/api'
import { verifyToken, getRequestToken } from '@/lib/auth'
import { AccessError } from '@/server/auth/policy'
import { rejectClose } from '@/server/finance/shifts'
const schema=z.object({requestId:z.string().uuid(),operationId:z.string().uuid(),reason:z.string().trim().min(3).max(2000)}).strict()
export const POST=withApi(async(request:NextRequest,{params}:{params:Promise<{id:string}>})=>{
 const context=await verifyToken(getRequestToken(request)??'');if(!context)throw new AccessError(401,'UNAUTHORIZED')
 return NextResponse.json({success:true,data:await rejectClose(context,(await params).id,schema.parse(await request.json()))})
})
