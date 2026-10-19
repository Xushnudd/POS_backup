import { NextRequest, NextResponse } from 'next/server'
import { withApi } from '@/server/api'
import { getRequestToken, verifyToken } from '@/lib/auth'
import { AccessError } from '@/server/auth/policy'
import { consumeLimit } from '@/server/auth/rate-limit'
import { confirmBillingPayment } from '@/server/billing/invoices'
async function actor(request: NextRequest) {
 const context = await verifyToken(getRequestToken(request) ?? '')
 if (!context) throw new AccessError(401, 'UNAUTHORIZED')
 await consumeLimit('billing.write',context.organizationId+':'+context.userId,20,60000)
 return context
}
export const POST = withApi(async (request: NextRequest) => NextResponse.json({ success: true, data: await confirmBillingPayment(await actor(request), await request.json()) }))
