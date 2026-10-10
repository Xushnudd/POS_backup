import { NextRequest, NextResponse } from 'next/server'
import { withApi } from '@/server/api'
import { getRequestToken,verifyToken } from '@/lib/auth'
import { AccessError } from '@/server/auth/policy'
import { consumeLimit } from '@/server/auth/rate-limit'
import { cancelCost } from '@/server/billing/costs'
export const POST=withApi(async(request:NextRequest,{params}:{params:Promise<{id:string}>})=>{
 const context=await verifyToken(getRequestToken(request)??'');if(!context)throw new AccessError(401,'UNAUTHORIZED')
 await consumeLimit('billing.cost',context.userId,20,60000)
 return NextResponse.json({success:true,data:await cancelCost(context,(await params).id,await request.json())})
})
