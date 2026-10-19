import { NextRequest, NextResponse } from 'next/server'
import { withApi } from '@/server/api'
import { getRequestToken, verifyToken } from '@/lib/auth'
import { AccessError } from '@/server/auth/policy'
import { recoverTotpFactor } from '@/server/auth/totp-service'
export const POST = withApi(async (request: NextRequest) => {
 // Existing backup credentials must remain usable if the encryption key or
 // enrollment feature is unavailable. Recovery itself needs no seed decryption.
 const ctx = await verifyToken(getRequestToken(request) ?? '')
 if (!ctx) throw new AccessError(401,'UNAUTHORIZED')
 return NextResponse.json({success:true,data:await recoverTotpFactor(ctx,await request.json())})
},{})
