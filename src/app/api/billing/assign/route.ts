import { NextRequest, NextResponse } from 'next/server'
import { withApi } from '@/server/api'
import { getRequestToken, verifyToken } from '@/lib/auth'
import { AccessError } from '@/server/auth/policy'
import { consumeLimit } from '@/server/auth/rate-limit'
import { assignPlan } from '@/server/billing/service'
export const POST = withApi(async (request: NextRequest) => {
  const context = await verifyToken(getRequestToken(request) ?? '')
  if (!context) throw new AccessError(401, 'UNAUTHORIZED')
  await consumeLimit('billing.assign', context.userId, 10, 60000)
  return NextResponse.json({ success: true, data: await assignPlan(context, await request.json()) })
})
