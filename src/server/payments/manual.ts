import { z } from 'zod'
import type { TokenPayload } from '@/lib/auth'
import { AccessError } from '../auth/policy'
import { audit, runOperation } from '../operations'
import { amountSchema, requireOpenShift } from '../sales/service'
import { decimal, money } from '../sales/calculations'

// Standalone ledger entries are explicit manual records, never provider confirmations.
export const manualPaymentSchema = z.object({
  organizationId: z.string().uuid(), storeId: z.string().uuid(), shiftId: z.string().uuid(),
  operationId: z.string().uuid(), paymentType: z.enum(['cash', 'card', 'transfer']),
  direction: z.enum(['in', 'out']), amount: amountSchema.refine(value => decimal(value).gt(0)),
  referenceNo: z.string().max(200).optional(), note: z.string().min(2).max(2000),
}).strict()

export async function recordManualPayment(context: TokenPayload, input: z.infer<typeof manualPaymentSchema>) {
  if (context.role === 'cashier') throw new AccessError(403, 'FORBIDDEN')
  return runOperation(context, 'payment.manual', input.operationId, input, async tx => {
    const shift = await requireOpenShift(tx, context, input.shiftId)
    if (input.organizationId !== context.organizationId || input.storeId !== shift.register.storeId) {
      throw new AccessError(409, 'INVALID_RELATION')
    }
    const payment = await tx.payment.create({ data: {
      organizationId: context.organizationId, storeId: input.storeId, shiftId: shift.id,
      paymentType: input.paymentType, direction: input.direction, amount: money(input.amount),
      referenceNo: input.referenceNo, note: input.note, receivedBy: context.userId, status: 'recorded',
    } })
    await audit(tx, context, 'Payment', payment.id, 'manually_recorded', {
      paymentType: input.paymentType, direction: input.direction, amount: payment.amount, note: input.note,
    })
    return payment
  })
}
