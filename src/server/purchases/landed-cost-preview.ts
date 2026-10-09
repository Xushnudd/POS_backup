import { z } from 'zod'
import { Prisma } from '@prisma/client'
import type { TokenPayload } from '@/lib/auth'
import { prisma } from '@/lib/prisma'
import { AccessError, tenantScope } from '../auth/policy'
import { assertLiveContext } from '../operations'
import { financeManager } from '../finance/accounts'
import { allocateLandedCost, landedCostSchema, positiveLandedCostMeasure } from './landed-cost'

export const landedCostPreviewSchema = z.object({
  amount: landedCostSchema.shape.amount,
  method: landedCostSchema.shape.method,
  weights: z.array(z.object({
    stockDocumentItemId: z.string().uuid(),
    unitWeightKg: positiveLandedCostMeasure,
  }).strict()).min(1).max(200).optional(),
}).strict().superRefine((input, ctx) => {
  if ((input.method === 'weight') !== (input.weights !== undefined))
    ctx.addIssue({ code: 'custom', message: 'Vazn faqat weight usulida va majburiy beriladi', path: ['weights'] })
  if (input.weights && new Set(input.weights.map(row => row.stockDocumentItemId)).size !== input.weights.length)
    ctx.addIssue({ code: 'custom', message: 'Takror vazn qatori mumkin emas', path: ['weights'] })
})

// Preview an actual receipt, never client-supplied purchase prices/quantities.
// Explicitly read-only: result is not evidence of a posted cost correction.
export async function previewReceiptLandedCost(context: TokenPayload, id: string,
  input: z.input<typeof landedCostPreviewSchema>) {
  financeManager(context)
  const parsed = landedCostPreviewSchema.parse(input)
  return prisma.$transaction(async tx => {
    await assertLiveContext(tx, context)
    return receiptLandedCostTx(tx, context, id, parsed)
  }, { isolationLevel: 'RepeatableRead' })
}

export async function receiptLandedCostTx(tx: Prisma.TransactionClient, context: TokenPayload,
  id: string, parsed: z.infer<typeof landedCostPreviewSchema>) {
    const document = await tx.stockDocument.findFirst({
      where: { id, AND: tenantScope('StockDocument', context) },
      include: { reversal: { select: { id: true } }, items: {
        take: 201, orderBy: { id: 'asc' },
        include: { purchaseReceiptLine: { include: { orderItem: true } } },
      } },
    })
    if (!document) throw new AccessError(404, 'NOT_FOUND')
    if (document.documentType !== 'purchase' || document.status !== 'confirmed' || document.reversalOfId || document.reversal)
      throw new AccessError(409, 'INVALID_STATUS', 'Faqat tasdiqlangan, bekor qilinmagan xarid kirimi kerak')
    if (!document.items.length || document.items.length > 200 || document.items.some(row => !row.purchaseReceiptLine))
      throw new AccessError(409, 'PURCHASE_RECEIPT_REQUIRED', 'Original birlik snapshotli buyurtma kirimi kerak')
    const weights = new Map(parsed.weights?.map(row => [row.stockDocumentItemId, row.unitWeightKg]))
    if (parsed.weights && (weights.size !== document.items.length || document.items.some(row => !weights.has(row.id))))
      throw new AccessError(400, 'INVALID_ITEMS', 'Vaznlar aynan shu kirimning barcha qatorlariga tegishli bo‘lishi kerak')
    try {
      const allocation = allocateLandedCost({ amount: parsed.amount, method: parsed.method,
        lines: document.items.map(row => ({ id: row.id, quantity: row.quantity.toFixed(), unitCost: row.unitCost.toFixed(),
          unit: row.purchaseReceiptLine!.orderItem.unit,
          ...(weights.has(row.id) ? { unitWeightKg: weights.get(row.id)! } : {}),
        })),
      })
      return { stockDocumentId: document.id, storeId: document.storeId, previewOnly: true as const, ...allocation }
    } catch (error) {
      if (error instanceof Error && error.message === 'LANDED_COST_ZERO_DENOMINATOR')
        throw new AccessError(422, 'LANDED_COST_ZERO_DENOMINATOR', 'Taqsimlash asosi nol; boshqa usulni tanlang')
      throw error
    }
}
