import { NextRequest, NextResponse } from 'next/server'
import { withApi } from '@/server/api'
import { getRequestToken, verifyToken } from '@/lib/auth'
import { AccessError } from '@/server/auth/policy'
import { rotateTotpRecoveryCodes } from '@/server/auth/totp-service'
import { assertTotpAvailable } from '@/server/auth/totp-availability'
export const POST = withApi(async (request: NextRequest) => {
 assertTotpAvailable()
 const ctx = await verifyToken(getRequestToken(request) ?? '')
 if (!ctx) throw new AccessError(401,'UNAUTHORIZED')
 return NextResponse.json({success:true,data:await rotateTotpRecoveryCodes(ctx,await request.json())})
},{totpPresentation:'recoveryCodes'})
