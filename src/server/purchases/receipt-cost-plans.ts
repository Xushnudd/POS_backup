import { z } from 'zod'
import type { TokenPayload } from '@/lib/auth'
import { prisma } from '@/lib/prisma'
import { AccessError, tenantScope } from '../auth/policy'
import { audit, assertLiveContext, runOperation } from '../operations'
import { financeManager } from '../finance/accounts'
import { landedCostPreviewSchema, receiptLandedCostTx } from './landed-cost-preview'

export const prepareReceiptCostSchema = landedCostPreviewSchema.safeExtend({
  operationId: z.string().uuid(), expenseDocumentId: z.string().uuid(),
  reason: z.string().trim().min(3).max(2000),
})
export const cancelReceiptCostSchema = z.object({ operationId: z.string().uuid(), reason: z.string().trim().min(3).max(2000) }).strict()

// Durable preparation only. It does not capitalize inventory or correct COGS.
export async function prepareReceiptCost(context: TokenPayload, stockDocumentId: string,
  input: z.input<typeof prepareReceiptCostSchema>) {
  financeManager(context)
  const parsed = prepareReceiptCostSchema.parse(input)
  return runOperation(context, 'receipt.cost.prepare', parsed.operationId, { stockDocumentId, ...parsed }, async tx => {
    await tx.$queryRaw`SELECT id FROM "FinancialDocument" WHERE id=${parsed.expenseDocumentId} AND "organizationId"=${context.organizationId} FOR UPDATE`
    const expense = await tx.financialDocument.findFirst({ where: { id: parsed.expenseDocumentId, AND: tenantScope('FinancialDocument', context) },
      include: { category: true, reversal: true } })
    if (!expense) throw new AccessError(404, 'NOT_FOUND')
    if (expense.kind !== 'expense' || expense.category?.treatment !== 'capitalised' || expense.reversal || expense.amount.lte(0))
      throw new AccessError(409, 'INVALID_EXPENSE_SOURCE', 'Bekor qilinmagan kapitalizatsiya xarajati kerak')
    if (!expense.amount.eq(parsed.amount)) throw new AccessError(409, 'EXPENSE_AMOUNT_CHANGED', 'Original xarajat summasini qayta tekshiring')
    if (await tx.receiptCostPlan.findFirst({ where: { expenseDocumentId: expense.id, status: 'prepared' } }))
      throw new AccessError(409, 'EXPENSE_ALREADY_ASSIGNED', 'Xarajat allaqachon boshqa tayyor taqsimotga bog‘langan')
    await tx.$queryRaw`SELECT id FROM "StockDocument" WHERE id=${stockDocumentId} AND "organizationId"=${context.organizationId} FOR UPDATE`
    const snapshot = await receiptLandedCostTx(tx, context, stockDocumentId, landedCostPreviewSchema.parse({
      amount: parsed.amount, method: parsed.method, ...(parsed.weights ? { weights: parsed.weights } : {}),
    }))
    if (snapshot.storeId !== expense.storeId) throw new AccessError(409, 'STORE_MISMATCH', 'Xarajat va kirim bir filialga tegishli bo‘lishi kerak')
    const result = await tx.receiptCostPlan.create({ data: { organizationId: context.organizationId, storeId: expense.storeId,
      stockDocumentId, expenseDocumentId: expense.id, amount: expense.amount, method: parsed.method,
      snapshot, reason: parsed.reason, createdBy: context.userId } })
    await audit(tx, context, 'ReceiptCostPlan', result.id, 'prepared', { stockDocumentId, expenseDocumentId: expense.id, amount: expense.amount, reason: parsed.reason, financialPosting: false })
    return result
  })
}
export async function cancelReceiptCost(context: TokenPayload, stockDocumentId: string, id: string,
  input: z.input<typeof cancelReceiptCostSchema>) {
  financeManager(context)
  const parsed = cancelReceiptCostSchema.parse(input)
  return runOperation(context, 'receipt.cost.cancel', parsed.operationId, { stockDocumentId, id, ...parsed }, async tx => {
    const initial = await tx.receiptCostPlan.findFirst({ where: { id, stockDocumentId, AND: tenantScope('ReceiptCostPlan', context) } })
    if (!initial) throw new AccessError(404, 'NOT_FOUND')
    // Same expense -> receipt -> plan lock order as preparation and reversals.
    await tx.$queryRaw`SELECT id FROM "FinancialDocument" WHERE id=${initial.expenseDocumentId} FOR UPDATE`
    await tx.$queryRaw`SELECT id FROM "StockDocument" WHERE id=${stockDocumentId} FOR UPDATE`
    await tx.$queryRaw`SELECT id FROM "ReceiptCostPlan" WHERE id=${id} FOR UPDATE`
    const current = await tx.receiptCostPlan.findUniqueOrThrow({ where: { id } })
    if (current.status !== 'prepared') throw new AccessError(409, 'INVALID_STATUS')
    const result = await tx.receiptCostPlan.update({ where: { id }, data: { status: 'cancelled', cancelledBy: context.userId,
      cancelledAt: new Date(), cancellationReason: parsed.reason } })
    await audit(tx, context, 'ReceiptCostPlan', id, 'cancelled', { reason: parsed.reason, financialPosting: false })
    return result
  })
}
export async function listReceiptCosts(context: TokenPayload, stockDocumentId: string, page: number) {
  financeManager(context)
  if (!Number.isSafeInteger(page) || page < 1 || (page - 1) * 20 > 2147483647)
    throw new AccessError(400, 'INVALID_PAGINATION')
  return prisma.$transaction(async tx => {
    await assertLiveContext(tx, context)
    if (!await tx.stockDocument.findFirst({ where: { id: stockDocumentId, AND: tenantScope('StockDocument', context) } }))
      throw new AccessError(404, 'NOT_FOUND')
    const where = { stockDocumentId, AND: tenantScope('ReceiptCostPlan', context) }
    return { rows: await tx.receiptCostPlan.findMany({ where, take: 20, skip: (page - 1) * 20, orderBy: [{ createdAt: 'desc' }, { id: 'asc' }] }), total: await tx.receiptCostPlan.count({ where }) }
  }, { isolationLevel: 'RepeatableRead' })
}
