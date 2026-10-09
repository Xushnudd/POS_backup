import { NextRequest, NextResponse } from 'next/server'
import { getRequestToken, verifyToken } from '@/lib/auth'
import { withApi } from '@/server/api'
import { AccessError } from '@/server/auth/policy'
import { consumeLimit } from '@/server/auth/rate-limit'
import { listReceiptCosts, prepareReceiptCost, prepareReceiptCostSchema } from '@/server/purchases/receipt-cost-plans'
type Route = { params: Promise<{ id: string }> }
export const POST = withApi(async (request: NextRequest, { params }: Route) => {
  const context = await verifyToken(getRequestToken(request) ?? '')
  if (!context) throw new AccessError(401, 'UNAUTHORIZED')
  await consumeLimit('receipt-cost-write', `${context.organizationId}:${context.userId}`, 30, 60_000)
  return NextResponse.json({ success: true, data: await prepareReceiptCost(context, (await params).id, prepareReceiptCostSchema.parse(await request.json())) })
})
export const GET = withApi(async (request: NextRequest, { params }: Route) => {
  const context = await verifyToken(getRequestToken(request) ?? '')
  if (!context) throw new AccessError(401, 'UNAUTHORIZED')
  return NextResponse.json({ success: true, data: await listReceiptCosts(context, (await params).id, Number(request.nextUrl.searchParams.get('page') ?? 1)) })
})
