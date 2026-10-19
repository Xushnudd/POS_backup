import { NextRequest, NextResponse } from 'next/server'
import { z } from 'zod'
import { getRequestToken, verifyToken } from '@/lib/auth'
import { withApi } from '@/server/api'
import { AccessError } from '@/server/auth/policy'
import { consumeLimit } from '@/server/auth/rate-limit'
import { resumeProviderLookup } from '@/server/integrations/outbox'
export const POST = withApi(async (request: NextRequest, { params }: { params: Promise<{ id: string }> }) => {
  const context = await verifyToken(getRequestToken(request) ?? '')
  if (!context) throw new AccessError(401, 'UNAUTHORIZED')
  await consumeLimit('provider-lookup-resume', `${context.organizationId}:${context.userId}`, 10, 60_000)
  const input = z.object({ operationId: z.string().uuid(), reason: z.string().trim().min(3).max(2000) }).strict().parse(await request.json())
  return NextResponse.json({ success: true, data: await resumeProviderLookup(context, (await params).id, input) })
})
