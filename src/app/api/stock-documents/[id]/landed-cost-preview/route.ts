import { NextRequest, NextResponse } from 'next/server'
import { getRequestToken, verifyToken } from '@/lib/auth'
import { withApi } from '@/server/api'
import { AccessError } from '@/server/auth/policy'
import { consumeLimit } from '@/server/auth/rate-limit'
import { landedCostPreviewSchema, previewReceiptLandedCost } from '@/server/purchases/landed-cost-preview'

export const POST = withApi(async (request: NextRequest, { params }: { params: Promise<{ id: string }> }) => {
  const context = await verifyToken(getRequestToken(request) ?? '')
  if (!context) throw new AccessError(401, 'UNAUTHORIZED')
  await consumeLimit('landed-cost-preview', `${context.organizationId}:${context.userId}`, 30, 60_000)
  return NextResponse.json({ success: true, data: await previewReceiptLandedCost(context, (await params).id,
    landedCostPreviewSchema.parse(await request.json())) }, { headers: { 'Cache-Control': 'private, no-store' } })
})
