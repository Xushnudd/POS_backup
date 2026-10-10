import { subscriptionPhase } from '../billing/phase'
export function retentionSchedule(now: Date, subscription: { trialEndsAt: Date; paidThrough: Date | null; graceDays: number } | null, policy: { expiredSubscriptionDays: number }) {
 if(!Number.isFinite(now.getTime())||!Number.isInteger(policy.expiredSubscriptionDays)||policy.expiredSubscriptionDays<1||policy.expiredSubscriptionDays>3650)throw new Error('Invalid retention schedule')
 if(!subscription)return {subscriptionState:'legacy_unmanaged',periodEndsAt:null,plannedReviewAt:null,reviewDue:false}
 if(!Number.isFinite(subscription.trialEndsAt.getTime())||(subscription.paidThrough&&!Number.isFinite(subscription.paidThrough.getTime()))||!Number.isInteger(subscription.graceDays)||subscription.graceDays<0||subscription.graceDays>365)throw new Error('Invalid subscription schedule')
 const phase=subscriptionPhase(now,subscription)
 // A review deadline, never a purge authorization. Restored paid periods move
 // this date forward; legacy organizations have no guessed expiration date.
 const plannedReviewAt=phase.state==='expired'?new Date(phase.endsAt.getTime()+policy.expiredSubscriptionDays*86400000):null
 return {subscriptionState:phase.state,periodEndsAt:phase.endsAt,plannedReviewAt,reviewDue:plannedReviewAt!==null&&now>=plannedReviewAt}
}
