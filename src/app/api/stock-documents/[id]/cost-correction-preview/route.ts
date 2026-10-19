import { NextRequest, NextResponse } from 'next/server'
import { getRequestToken, verifyToken } from '@/lib/auth'
import { withApi } from '@/server/api'
import { AccessError } from '@/server/auth/policy'
import { consumeLimit } from '@/server/auth/rate-limit'
import { previewReceiptCostCorrection, receiptCostCorrectionPreviewSchema } from '@/server/purchases/receipt-cost-correction-preview'

export const POST = withApi(async (request: NextRequest, { params }: { params: Promise<{ id: string }> }) => {
  const context = await verifyToken(getRequestToken(request) ?? '')
  if (!context) throw new AccessError(401, 'UNAUTHORIZED')
  if (context.role !== 'owner') throw new AccessError(403, 'OWNER_REQUIRED')
  await consumeLimit('receipt-cost-correction-preview', `${context.organizationId}:${context.userId}`, 10, 60_000)
  return NextResponse.json({ success: true, data: await previewReceiptCostCorrection(context, (await params).id,
    receiptCostCorrectionPreviewSchema.parse(await request.json())) }, { headers: { 'Cache-Control': 'private, no-store' } })
})
