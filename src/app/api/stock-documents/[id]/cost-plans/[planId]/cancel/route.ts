import { NextRequest, NextResponse } from 'next/server'
import { getRequestToken, verifyToken } from '@/lib/auth'
import { withApi } from '@/server/api'
import { AccessError } from '@/server/auth/policy'
import { consumeLimit } from '@/server/auth/rate-limit'
import { cancelReceiptCost, cancelReceiptCostSchema } from '@/server/purchases/receipt-cost-plans'
export const POST = withApi(async (request: NextRequest, { params }: { params: Promise<{ id: string; planId: string }> }) => {
  const context = await verifyToken(getRequestToken(request) ?? '')
  if (!context) throw new AccessError(401, 'UNAUTHORIZED')
  await consumeLimit('receipt-cost-write', `${context.organizationId}:${context.userId}`, 30, 60_000)
  const { id, planId } = await params
  return NextResponse.json({ success: true, data: await cancelReceiptCost(context, id, planId, cancelReceiptCostSchema.parse(await request.json())) })
})
