import { z } from 'zod'
import { Prisma, type BillingPlanVersion } from '@prisma/client'
import { prisma } from '@/lib/prisma'
import type { TokenPayload } from '@/lib/auth'
import { AccessError } from '../auth/policy'
import { assertLiveContext, audit, runOperation } from '../operations'
import { subscriptionPhase } from './phase'
const publicVersion = (version: BillingPlanVersion) => ({ id: version.id, code: version.code, version: version.version, name: version.name,
  monthlyPrice: version.monthlyPrice, currency: version.currency, branchLimit: version.branchLimit, registerLimit: version.registerLimit,
  staffLimit: version.staffLimit, trialDays: version.trialDays, graceDays: version.graceDays })

export const planSchema = z.object({
  operationId: z.string().uuid(), code: z.string().regex(/^[a-z][a-z0-9_-]{0,39}$/), name: z.string().trim().min(2).max(80),
  monthlyPrice: z.string().regex(/^(?:0|[1-9]\d{0,11})(?:\.\d{1,2})?$/), currency: z.literal('UZS'),
  branchLimit: z.number().int().min(1).max(100000), registerLimit: z.number().int().min(1).max(100000),
  staffLimit: z.number().int().min(1).max(100000), trialDays: z.number().int().min(1).max(365), graceDays: z.number().int().min(0).max(365),
  reason: z.string().trim().min(3).max(2000),
}).strict()
export async function platformAdmin(tx: Prisma.TransactionClient, context: TokenPayload) {
  await assertLiveContext(tx, context)
  if (!await tx.session.findFirst({ where: { id: context.sessionId, authenticationMethod: 'password' } }) ||
    !await tx.platformOperator.findFirst({ where: { userId: context.userId, role: 'platform_admin', isActive: true, user: { isActive: true } } }))
    throw new AccessError(403, 'PLATFORM_ADMIN_REQUIRED')
}
export async function publishPlan(context: TokenPayload, input: z.input<typeof planSchema>) {
  const parsed = planSchema.parse(input)
  return runOperation(context, 'billing.plan.publish', parsed.operationId, parsed, async tx => {
    await platformAdmin(tx, context)
    const lock = 'billing-plan:' + parsed.code
    await tx.$queryRaw`SELECT pg_advisory_xact_lock(hashtextextended(${lock},0))::text`
    const previous = await tx.billingPlan.findUnique({ where: { code: parsed.code }, include: { currentVersion: true } })
    const { operationId, reason, ...fields } = parsed
    void operationId
    const version = await tx.billingPlanVersion.create({ data: { ...fields, version: (previous?.currentVersion.version ?? 0) + 1, createdBy: context.userId } })
    await tx.billingPlan.upsert({ where: { code: parsed.code }, create: { code: parsed.code, currentVersionId: version.id }, update: { currentVersionId: version.id } })
    await audit(tx, context, 'BillingPlanVersion', version.id, 'billing_plan_published', { ...fields, version: version.version, reason })
    return version
  }, tx => platformAdmin(tx,context))
}
export async function billingStatus(context: TokenPayload) {
  return prisma.$transaction(async tx => {
    await assertLiveContext(tx, context)
    const subscription = await tx.organizationSubscription.findUnique({ where: { organizationId: context.organizationId }, include: { planVersion: true } })
    const [{ now }] = await tx.$queryRaw<{ now: Date }[]>`SELECT NOW() AS now`
    const planRows = await tx.billingPlan.findMany({ where: { isActive: true }, include: { currentVersion: true }, orderBy: { code: 'asc' } })
    const plans = planRows.map(plan=>({code:plan.code,isTrial:plan.isTrial,currentVersion:publicVersion(plan.currentVersion)}))
    const canManagePlans = Boolean(await tx.platformOperator.findFirst({ where: { userId: context.userId, role: 'platform_admin', isActive: true } })) &&
      Boolean(await tx.session.findFirst({ where: { id: context.sessionId, authenticationMethod: 'password' } }))
    const usage = { branches: await tx.store.count({ where: { organizationId: context.organizationId } }),
      registers: await tx.register.count({ where: { store: { organizationId: context.organizationId } } }),
      staff: await tx.organizationUser.count({ where: { organizationId: context.organizationId } }) }
    if (!subscription) return { state: 'legacy_unmanaged', newSalesAllowed: true, subscription: null, plans, usage, now, canManagePlans }
    return { ...subscriptionPhase(now, { ...subscription, graceDays: subscription.planVersion.graceDays }), subscription: {...subscription,planVersion:publicVersion(subscription.planVersion)}, plans, usage, now, canManagePlans }
  }, { isolationLevel: 'RepeatableRead' })
}
export const assignPlanSchema = z.object({ operationId: z.string().uuid(), targetOrganizationId: z.string().uuid(),
  planCode: z.string().regex(/^[a-z][a-z0-9_-]{0,39}$/), reason: z.string().trim().min(3).max(2000) }).strict()
// Explicit operator enrollment/plan change. No paid period or fake payment is created.
export async function assignPlan(context: TokenPayload, input: z.input<typeof assignPlanSchema>) {
  const parsed = assignPlanSchema.parse(input)
  return runOperation(context, 'billing.plan.assign', parsed.operationId, parsed, async tx => {
    await platformAdmin(tx, context)
    const organizations = [context.organizationId, parsed.targetOrganizationId].sort()
    for (const id of organizations) await tx.$queryRaw`SELECT id FROM "Organization" WHERE id=${id} FOR UPDATE`
    if (!await tx.organization.findUnique({ where: { id: parsed.targetOrganizationId } })) throw new AccessError(404, 'NOT_FOUND')
    const plan = await tx.billingPlan.findFirst({ where: { code: parsed.planCode, isActive: true }, include: { currentVersion: true } })
    if (!plan) throw new AccessError(404, 'PLAN_NOT_FOUND')
    const [{ now }] = await tx.$queryRaw<{ now: Date }[]>`SELECT NOW() AS now`
    const result = await tx.organizationSubscription.upsert({ where: { organizationId: parsed.targetOrganizationId },
      create: { organizationId: parsed.targetOrganizationId, planVersionId: plan.currentVersionId, trialStartedAt: now,
        trialEndsAt: now }, // Legacy enrollment grants grace, not another new-organization trial.
      update: { planVersionId: plan.currentVersionId, updatedAt: now } })
    await audit(tx, context, 'OrganizationSubscription', result.organizationId, 'billing_plan_assigned',
      { targetOrganizationId: parsed.targetOrganizationId, planVersionId: result.planVersionId, reason: parsed.reason, financialPosting: false })
    return result
  }, tx => platformAdmin(tx,context))
}
