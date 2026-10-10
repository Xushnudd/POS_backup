export function subscriptionPhase(now: Date, subscription: { trialEndsAt: Date; paidThrough: Date | null; graceDays: number }) {
  const endsAt = new Date(Math.max(subscription.trialEndsAt.getTime(), subscription.paidThrough?.getTime() ?? 0))
  const graceEndsAt = new Date(endsAt.getTime() + subscription.graceDays * 86400000)
  const state = now < endsAt ? (subscription.paidThrough && now < subscription.paidThrough ? 'active' : 'trial') : now < graceEndsAt ? 'grace' : 'expired'
  return { state, endsAt, graceEndsAt, newSalesAllowed: state !== 'expired' }
}
