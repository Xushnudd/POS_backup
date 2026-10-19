import { NextRequest, NextResponse } from 'next/server'
import { getRequestToken, verifyToken } from '@/lib/auth'
import { withApi } from '@/server/api'
import { AccessError } from '@/server/auth/policy'
import { providerIntentList } from '@/server/integrations/outbox'
export const GET = withApi(async (request: NextRequest) => {
  const context = await verifyToken(getRequestToken(request) ?? '')
  if (!context) throw new AccessError(401, 'UNAUTHORIZED')
  return NextResponse.json({ success: true, data: await providerIntentList(context, Number(request.nextUrl.searchParams.get('page') ?? 1)) })
})
