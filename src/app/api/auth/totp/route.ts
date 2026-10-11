import { NextRequest, NextResponse } from 'next/server'
import { withApi } from '@/server/api'
import { getRequestToken, verifyToken } from '@/lib/auth'
import { AccessError } from '@/server/auth/policy'
import { totpStatus } from '@/server/auth/totp-service'
import { totpAvailable } from '@/server/auth/totp-availability'
export const GET = withApi(async(request:NextRequest)=>{
 const ctx=await verifyToken(getRequestToken(request)??'',{touch:false})
 if(!ctx)throw new AccessError(401,'UNAUTHORIZED')
 const available=totpAvailable()
 const status=await totpStatus(ctx)
 return NextResponse.json({success:true,data:{available,...(available||status.enabled?{...status,recoveryAvailable:status.enabled}:{})}})
},{touchSession:false})
