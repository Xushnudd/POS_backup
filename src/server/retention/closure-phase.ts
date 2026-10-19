/** Pure lifecycle rules. The caller must supply database time and authorize the
 * owner in the same transaction as persistence. This module grants no access. */
export interface ClosureSnapshot {
  requestedAt: Date
  policyVersionId: string
  cancellationDays: number
  cancellationEndsAt: Date
  cancelledAt: Date | null
}

const dayMs = 86_400_000
function instant(value: Date): number {
  if (!(value instanceof Date) || !Number.isFinite(value.getTime())) {
    throw new Error('Invalid closure timestamp')
  }
  return value.getTime()
}
function validate(snapshot: ClosureSnapshot) {
  const start = instant(snapshot.requestedAt)
  if (!snapshot.policyVersionId.trim() || !Number.isInteger(snapshot.cancellationDays)
    || snapshot.cancellationDays < 1 || snapshot.cancellationDays > 365
    || instant(snapshot.cancellationEndsAt) !== start + snapshot.cancellationDays * dayMs) {
    throw new Error('Invalid closure policy snapshot')
  }
  if (snapshot.cancelledAt !== null) {
    const cancelled = instant(snapshot.cancelledAt)
    if (cancelled < start || cancelled >= instant(snapshot.cancellationEndsAt)) {
      throw new Error('Invalid closure cancellation timestamp')
    }
  }
}

/** Capture the approved version once. Later policy publication must never
 * silently extend or shorten an existing request's cancellation window. */
export function newClosureSnapshot(now: Date, policy: { id: string; closureCancellationDays: number }): ClosureSnapshot {
  const start = instant(now)
  const snapshot: ClosureSnapshot = {
    requestedAt: new Date(start), policyVersionId: policy.id,
    cancellationDays: policy.closureCancellationDays,
    cancellationEndsAt: new Date(start + policy.closureCancellationDays * dayMs),
    cancelledAt: null,
  }
  validate(snapshot)
  return snapshot
}

export function closurePhase(now: Date, snapshot: ClosureSnapshot | null) {
  const time = instant(now)
  if (snapshot === null) return {
    state: 'open' as const, closureBlocksBusinessWrites: false,
    cancellationAllowed: false, reviewDue: false, automaticDeletionAllowed: false as const,
  }
  validate(snapshot)
  if (time < instant(snapshot.requestedAt)
    || (snapshot.cancelledAt !== null && time < instant(snapshot.cancelledAt))) {
    throw new Error('Closure observation predates persisted event')
  }
  if (snapshot.cancelledAt !== null) return {
    state: 'cancelled' as const, closureBlocksBusinessWrites: false,
    cancellationAllowed: false, reviewDue: false, automaticDeletionAllowed: false as const,
  }
  const elapsed = time >= instant(snapshot.cancellationEndsAt)
  return {
    state: elapsed ? 'review_required' as const : 'cancellation_window' as const,
    closureBlocksBusinessWrites: true, cancellationAllowed: !elapsed,
    reviewDue: elapsed, automaticDeletionAllowed: false as const,
  }
}

export function cancelClosureSnapshot(now: Date, snapshot: ClosureSnapshot): ClosureSnapshot {
  const phase = closurePhase(now, snapshot)
  // Caller still checks actor/payload/operation identity before replay. Repeated
  // cancellation must not replace the original cancellation timestamp.
  if (phase.state === 'cancelled') return { ...snapshot,
    requestedAt: new Date(snapshot.requestedAt), cancellationEndsAt: new Date(snapshot.cancellationEndsAt),
    cancelledAt: new Date(snapshot.cancelledAt!),
  }
  if (!phase.cancellationAllowed) throw new Error('CLOSURE_CANCELLATION_EXPIRED')
  return { ...snapshot, requestedAt: new Date(snapshot.requestedAt),
    cancellationEndsAt: new Date(snapshot.cancellationEndsAt), cancelledAt: new Date(now),
  }
}
