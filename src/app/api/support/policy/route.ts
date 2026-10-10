import { NextRequest,NextResponse } from 'next/server'
import { withApi } from '@/server/api'
import { getRequestToken,verifyToken } from '@/lib/auth'
import { AccessError } from '@/server/auth/policy'
import { consumeLimit } from '@/server/auth/rate-limit'
import { getSupportPolicy,publishSupportPolicy } from '@/server/support/tickets'
async function actor(request:NextRequest){const context=await verifyToken(getRequestToken(request)??'');if(!context)throw new AccessError(401,'UNAUTHORIZED');await consumeLimit('support.policy.'+request.method,context.userId,request.method==='GET'?30:10,60000);return context}
export const GET=withApi(async(request:NextRequest)=>NextResponse.json({success:true,data:await getSupportPolicy(await actor(request))}))
export const POST=withApi(async(request:NextRequest)=>NextResponse.json({success:true,data:await publishSupportPolicy(await actor(request),await request.json())}))
