import { Prisma } from '@prisma/client'
import type { TokenPayload } from '@/lib/auth'
import { AccessError } from './policy'

// Explicit rollout, independent of authenticator availability: a key outage
// must never silently disable a configured authorization requirement.
export const CRITICAL_ACTIONS = [
  'loyalty.card.issue', 'loyalty.promotion.create', 'loyalty.card.revoke', 'loyalty.promotion.revoke',
  'loyalty.policy.publish',
  'report.schedule.configure',
  'inventory.serial.policy', 'inventory.batch.policy', 'receipt.cost.apply', 'receipt.cost.reverse',
  'retention.closure.request', 'retention.closure.cancel',
  'retention.policy.publish', 'billing.plan.publish', 'billing.plan.assign',
  'billing.payment.confirm', 'billing.subscription.cancel', 'offline-cash.policy',
  'billing.cost.record', 'billing.cost.cancel', 'support.policy.publish', 'support.grant',
  'users.role.create', 'users.role.update',
  'users.member.update', 'users.ownership.request', 'users.ownership.accept', 'users.ownership.cancel',
  'users.member.create', 'users.invitation.create',
  'auth.password.change',
] as const
export async function assertCriticalAction(tx: Prisma.TransactionClient, context: TokenPayload, action: string, operationKey: string, hash: string) {
  if (!(CRITICAL_ACTIONS as readonly string[]).includes(action)) return
  const configured = process.env.AUTH_CRITICAL_MFA_REQUIRED
  if (configured === undefined || configured === 'false') return
  if (configured !== 'true') throw new AccessError(503, 'TOTP_UNAVAILABLE', 'Muhim amal uchun MFA siyosati noto‘g‘ri sozlangan')
  await requireBoundStepUp(tx, context, action, operationKey, hash)
}
export async function requireBoundStepUp(tx: Prisma.TransactionClient, context: TokenPayload, action: string, operationKey: string, hash: string) {
  // Lazy import avoids the operations -> challenges -> operations module cycle.
  const { assertStepUp } = await import('./challenges')
  try { await assertStepUp(tx, context, action, operationKey, hash) }
  catch (error) {
    if (error instanceof AccessError && error.code === 'STEP_UP_REQUIRED') throw new AccessError(403, error.code, error.message, undefined, {action, operationKey, payloadHash: hash})
    throw error
  }
}
