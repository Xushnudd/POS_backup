import { NextRequest, NextResponse } from 'next/server'
import { withApi } from '@/server/api'
import { getRequestToken, verifyToken } from '@/lib/auth'
import { AccessError } from '@/server/auth/policy'
import { consumeLimit } from '@/server/auth/rate-limit'
import { tenantMonitoring } from '@/server/monitoring/health'
export const GET = withApi(async (request: NextRequest) => {
  const context = await verifyToken(getRequestToken(request) ?? '', {touch:false})
  if (!context) throw new AccessError(401, 'UNAUTHORIZED')
  if (context.role !== 'owner') throw new AccessError(403, 'OWNER_REQUIRED')
  await consumeLimit('monitoring.read', context.organizationId + ':' + context.userId, 12, 60_000)
  return NextResponse.json({ success: true, data: await tenantMonitoring(context) })
}, {touchSession:false})
