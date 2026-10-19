import { NextRequest, NextResponse } from 'next/server'
import { withApi } from '@/server/api'
import { getRequestToken, verifyToken } from '@/lib/auth'
import { collectDebt, collectionSchema } from '@/server/payments/collections'
import { AccessError } from '@/server/auth/policy'
export const POST=withApi(async(request:NextRequest)=>{
 const context=await verifyToken(getRequestToken(request)??'')
 if (!context) throw new AccessError(401,'UNAUTHORIZED')
 return NextResponse.json({success:true,data:await collectDebt(context,collectionSchema.parse(await request.json()))})
})
