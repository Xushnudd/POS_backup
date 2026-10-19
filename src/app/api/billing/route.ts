import { NextRequest, NextResponse } from 'next/server'
import { withApi } from '@/server/api'
import { getRequestToken, verifyToken } from '@/lib/auth'
import { AccessError } from '@/server/auth/policy'
import { consumeLimit } from '@/server/auth/rate-limit'
import { billingStatus } from '@/server/billing/service'
export const GET = withApi(async (request: NextRequest) => {
  const context = await verifyToken(getRequestToken(request) ?? '', {touch:false})
  if (!context) throw new AccessError(401, 'UNAUTHORIZED')
  await consumeLimit('billing.read', context.organizationId + ':' + context.userId, 30, 60000)
  return NextResponse.json({ success: true, data: await billingStatus(context) })
}, {touchSession:false})
