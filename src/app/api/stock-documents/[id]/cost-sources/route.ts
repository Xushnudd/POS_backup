import { NextRequest, NextResponse } from 'next/server'
import { getRequestToken, verifyToken } from '@/lib/auth'
import { withApi } from '@/server/api'
import { AccessError } from '@/server/auth/policy'
import { consumeLimit } from '@/server/auth/rate-limit'
import { listReceiptCostSources, receiptCostSourcesSchema } from '@/server/purchases/receipt-cost-plans'

export const GET = withApi(async (request: NextRequest, { params }: { params: Promise<{ id: string }> }) => {
  const context = await verifyToken(getRequestToken(request) ?? '')
  if (!context) throw new AccessError(401, 'UNAUTHORIZED')
  await consumeLimit('receipt-cost-sources', `${context.organizationId}:${context.userId}`, 60, 60_000)
  const query = request.nextUrl.searchParams
  return NextResponse.json({ success: true, data: await listReceiptCostSources(context, (await params).id,
    receiptCostSourcesSchema.parse({ search: query.get('search') ?? '', page: query.get('page') ?? 1 })) },
  { headers: { 'Cache-Control': 'private, no-store' } })
})
