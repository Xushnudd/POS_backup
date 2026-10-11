import { NextRequest, NextResponse } from 'next/server'
import { z } from 'zod'
import { withApi } from '@/server/api'
import { getRequestToken, verifyToken } from '@/lib/auth'
import { AccessError } from '@/server/auth/policy'
import { transferOwnership } from '@/server/users/service'
export const POST=withApi(async(request:NextRequest)=>{
 const context=await verifyToken(getRequestToken(request)??'')
 if (!context) throw new AccessError(401,'UNAUTHORIZED')
 const input=z.object({targetMembershipId:z.string().uuid(),operationId:z.string().uuid().optional()}).strict().parse(await request.json())
 return NextResponse.json({success:true,data:await transferOwnership(context,input.targetMembershipId,input.operationId)})
})
