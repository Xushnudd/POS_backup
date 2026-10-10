import { NextRequest, NextResponse } from 'next/server'
import { withApi } from '@/server/api'
import { getRequestToken,verifyToken } from '@/lib/auth'
import { AccessError } from '@/server/auth/policy'
import { consumeLimit } from '@/server/auth/rate-limit'
import { publishRetentionPolicy,retentionStatus } from '@/server/retention/service'
async function contextFor(request:NextRequest,touch=true){const context=await verifyToken(getRequestToken(request)??'',{touch});if(!context)throw new AccessError(401,'UNAUTHORIZED');return context}
export const GET=withApi(async(request:NextRequest)=>{const context=await contextFor(request,false);await consumeLimit('retention.read',context.organizationId+':'+context.userId,30,60000);return NextResponse.json({success:true,data:await retentionStatus(context)})},{touchSession:false})
export const POST=withApi(async(request:NextRequest)=>{const context=await contextFor(request);return NextResponse.json({success:true,data:await publishRetentionPolicy(context,await request.json())})})
