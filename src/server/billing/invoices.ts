import { createHash } from 'node:crypto'
import { z } from 'zod'
import { prisma } from '@/lib/prisma'
import type { TokenPayload } from '@/lib/auth'
import { AccessError } from '../auth/policy'
import { assertLiveContext, audit, runOperation } from '../operations'
import { platformAdmin } from './service'
const owner = (context: TokenPayload) => { if (context.role !== 'owner') throw new AccessError(403, 'OWNER_REQUIRED') }
export const invoiceSchema = z.object({ operationId: z.string().uuid(), planCode: z.string().regex(/^[a-z][a-z0-9_-]{0,39}$/), planVersionId: z.string().min(1).max(100) }).strict()
export function nextBillingMonth(start: Date) {
  const end = new Date(start)
  const day = end.getUTCDate()
  end.setUTCDate(1); end.setUTCMonth(end.getUTCMonth() + 1)
  const last = new Date(Date.UTC(end.getUTCFullYear(), end.getUTCMonth() + 1, 0)).getUTCDate()
  end.setUTCDate(Math.min(day, last)); return end
}
export async function createInvoice(context: TokenPayload, input: z.input<typeof invoiceSchema>) {
  owner(context); const parsed = invoiceSchema.parse(input)
  return runOperation(context, 'billing.invoice.create', parsed.operationId, parsed, async tx => {
    await tx.$queryRaw`SELECT id FROM "Organization" WHERE id=${context.organizationId} FOR UPDATE`
    const subscription = await tx.organizationSubscription.findUnique({ where: { organizationId: context.organizationId } })
    if (!subscription) throw new AccessError(409, 'BILLING_ENROLLMENT_REQUIRED')
    if (await tx.billingInvoice.findFirst({ where: { organizationId: context.organizationId, state: 'open' } })) throw new AccessError(409, 'BILLING_INVOICE_OPEN')
    const plan = await tx.billingPlan.findFirst({ where: { code: parsed.planCode, isActive: true }, include: { currentVersion: true } })
    if (!plan) throw new AccessError(404, 'PLAN_NOT_FOUND')
    if (plan.currentVersionId !== parsed.planVersionId) throw new AccessError(409, 'BILLING_PLAN_CHANGED', 'Tarif versiyasi o‘zgardi; joriy narxni qayta ko‘rib tasdiqlang')
    const [{ now }] = await tx.$queryRaw<{ now: Date }[]>`SELECT NOW() AS now`
    const periodStart = new Date(Math.max(now.getTime(), subscription.trialEndsAt.getTime(), subscription.paidThrough?.getTime() ?? 0))
    const invoice = await tx.billingInvoice.create({ data: { organizationId: context.organizationId, planVersionId: plan.currentVersionId,
      amount: plan.currentVersion.monthlyPrice, currency: plan.currentVersion.currency, periodStart, periodEnd: nextBillingMonth(periodStart), createdBy: context.userId } })
    await audit(tx, context, 'BillingInvoice', invoice.id, 'billing_invoice_created', { amount: invoice.amount, planVersionId: invoice.planVersionId, periodStart, periodEnd: invoice.periodEnd, providerCharge: false })
    return invoice
  })
}
export const cancelInvoiceSchema = z.object({ operationId: z.string().uuid(), reason: z.string().trim().min(3).max(2000) }).strict()
export async function cancelInvoice(context: TokenPayload, id: string, input: z.input<typeof cancelInvoiceSchema>) {
  owner(context); const parsed = cancelInvoiceSchema.parse(input)
  return runOperation(context, 'billing.invoice.cancel', parsed.operationId, { id, ...parsed }, async tx => {
    await tx.$queryRaw`SELECT id FROM "Organization" WHERE id=${context.organizationId} FOR UPDATE`
    const invoice = await tx.billingInvoice.findFirst({ where: { id, organizationId: context.organizationId } })
    if (!invoice) throw new AccessError(404, 'NOT_FOUND')
    if (invoice.state !== 'open') throw new AccessError(409, 'BILLING_INVOICE_FINAL')
    const result = await tx.billingInvoice.update({ where: { id }, data: { state: 'cancelled', cancelledAt: new Date(), cancellationReason: parsed.reason } })
    await audit(tx, context, 'BillingInvoice', id, 'billing_invoice_cancelled', { reason: parsed.reason }); return result
  })
}
export const confirmBillingPaymentSchema = z.object({ operationId: z.string().uuid(), billingInvoiceId: z.string().uuid(),
  proofReference: z.string().trim().min(3).max(200), reason: z.string().trim().min(3).max(2000) }).strict()
export async function confirmBillingPayment(context: TokenPayload, input: z.input<typeof confirmBillingPaymentSchema>) {
  const parsed = confirmBillingPaymentSchema.parse(input)
  return runOperation(context, 'billing.payment.confirm', parsed.operationId, parsed, async tx => {
    await platformAdmin(tx, context)
    const initial = await tx.billingInvoice.findUnique({ where: { id: parsed.billingInvoiceId } })
    if (!initial) throw new AccessError(404, 'NOT_FOUND')
    for (const id of [...new Set([context.organizationId, initial.organizationId])].sort()) await tx.$queryRaw`SELECT id FROM "Organization" WHERE id=${id} FOR UPDATE`
    const invoice = await tx.billingInvoice.findUniqueOrThrow({ where: { id: initial.id } })
    if (invoice.state !== 'open') throw new AccessError(409, 'BILLING_INVOICE_FINAL')
    const [{ now }] = await tx.$queryRaw<{ now: Date }[]>`SELECT NOW() AS now`
    if (invoice.periodEnd <= now) throw new AccessError(409, 'BILLING_INVOICE_EXPIRED', 'Eski invoice muddatini yangilash uchun uni bekor qilib, yangi invoice yarating')
    const subscription = await tx.organizationSubscription.findUniqueOrThrow({ where: { organizationId: invoice.organizationId } })
    if (subscription.paidThrough && subscription.paidThrough > invoice.periodStart) throw new AccessError(409, 'BILLING_PERIOD_CHANGED')
    const proofHash = createHash('sha256').update(parsed.proofReference.normalize('NFKC').toLowerCase()).digest('hex')
    if (await tx.billingPayment.findUnique({ where: { proofHash } })) throw new AccessError(409, 'BILLING_PROOF_REUSED')
    const payment = await tx.billingPayment.create({ data: { organizationId: invoice.organizationId, invoiceId: invoice.id, amount: invoice.amount,
      currency: invoice.currency, channel: 'manual_bank', proofHash, confirmedBy: context.userId, reason: parsed.reason } })
    await tx.billingInvoice.update({ where: { id: invoice.id }, data: { state: 'paid' } })
    await tx.organizationSubscription.update({ where: { organizationId: invoice.organizationId }, data: { planVersionId: invoice.planVersionId,
      paidThrough: invoice.periodEnd, cancelAtPeriodEnd: false, updatedAt: new Date() } })
    const result = { id: payment.id, invoiceId: invoice.id, amount: payment.amount, currency: payment.currency, channel: payment.channel, paidThrough: invoice.periodEnd }
    await audit(tx, context, 'BillingPayment', payment.id, 'billing_payment_confirmed', { ...result, targetOrganizationId: invoice.organizationId, reason: parsed.reason, providerConfirmation: false })
    return result
  }, tx => platformAdmin(tx,context))
}
export const subscriptionCancelSchema = z.object({ operationId: z.string().uuid(), cancelAtPeriodEnd: z.boolean(), reason: z.string().trim().min(3).max(2000) }).strict()
export async function cancelSubscription(context: TokenPayload, input: z.input<typeof subscriptionCancelSchema>) {
  owner(context); const parsed = subscriptionCancelSchema.parse(input)
  return runOperation(context, 'billing.subscription.cancel', parsed.operationId, parsed, async tx => {
    await tx.$queryRaw`SELECT id FROM "Organization" WHERE id=${context.organizationId} FOR UPDATE`
    if (!await tx.organizationSubscription.findUnique({ where: { organizationId: context.organizationId } })) throw new AccessError(409, 'BILLING_ENROLLMENT_REQUIRED')
    const result = await tx.organizationSubscription.update({ where: { organizationId: context.organizationId }, data: { cancelAtPeriodEnd: parsed.cancelAtPeriodEnd, updatedAt: new Date() } })
    await audit(tx, context, 'OrganizationSubscription', context.organizationId, 'billing_subscription_cancelled', { cancelAtPeriodEnd: parsed.cancelAtPeriodEnd, reason: parsed.reason }); return result
  })
}
export async function listInvoices(context: TokenPayload, page: number) {
  owner(context)
  if (!Number.isSafeInteger(page) || page < 1 || (page - 1) * 20 > 2147483647) throw new AccessError(400, 'INVALID_PAGINATION')
  return prisma.$transaction(async tx => {
    await assertLiveContext(tx, context)
    const where = { organizationId: context.organizationId }
    return { rows: await tx.billingInvoice.findMany({ where, take: 20, skip: (page - 1) * 20, orderBy: [{ createdAt: 'desc' }, { id: 'asc' }],
      include: { planVersion: { select: { name: true, version: true } }, payment: { select: { id: true, amount: true, currency: true, channel: true, createdAt: true } } } }), total: await tx.billingInvoice.count({ where }) }
  }, { isolationLevel: 'RepeatableRead' })
}
