import { NextRequest,NextResponse } from 'next/server'
import { withApi } from '@/server/api'
import { getRequestToken,verifyToken } from '@/lib/auth'
import { AccessError } from '@/server/auth/policy'
import { requestChallenge } from '@/server/auth/challenges'
export const POST=withApi(async(request:NextRequest)=>{const context=await verifyToken(getRequestToken(request)??'');if(!context)throw new AccessError(401,'UNAUTHORIZED');return NextResponse.json({success:true,data:await requestChallenge(context,await request.json())})})
