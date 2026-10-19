import { test } from 'node:test'
import assert from 'node:assert/strict'
import { cancelClosureSnapshot, closurePhase, newClosureSnapshot } from '@/server/retention/closure-phase'
import { subscriptionPhase } from '@/server/billing/phase'

const start = new Date('2026-10-10T12:00:00.000Z')
const policy = { id: 'reviewed-version-1', closureCancellationDays: 30 }

test('Closure freezes policy and blocks business immediately; deadline only requests review', () => {
  const snapshot = newClosureSnapshot(start, policy)
  assert.equal(snapshot.cancellationEndsAt.toISOString(), '2026-11-09T12:00:00.000Z')
  const original = snapshot.cancellationEndsAt.getTime()
  const changed = { ...policy, id: 'reviewed-version-2', closureCancellationDays: 1 }
  assert.notEqual(newClosureSnapshot(start, changed).cancellationEndsAt.getTime(), original)
  assert.equal(snapshot.policyVersionId, policy.id)
  for (const [time, state, canCancel, reviewDue] of [
    [start.getTime(), 'cancellation_window', true, false],
    [original - 1, 'cancellation_window', true, false],
    [original, 'review_required', false, true],
    [original + 365 * 86400000, 'review_required', false, true],
  ] as const) {
    const phase = closurePhase(new Date(time), snapshot)
    assert.equal(phase.state, state)
    assert.equal(phase.cancellationAllowed, canCancel)
    assert.equal(phase.reviewDue, reviewDue)
    assert.equal(phase.closureBlocksBusinessWrites, true)
    assert.equal(phase.automaticDeletionAllowed, false)
  }
  assert.throws(() => cancelClosureSnapshot(new Date(original), snapshot), /CLOSURE_CANCELLATION_EXPIRED/)
})

test('Cancellation preserves its original event and does not grant expired subscription access', () => {
  const snapshot = newClosureSnapshot(start, policy)
  const cancelledAt = new Date(snapshot.cancellationEndsAt.getTime() - 1)
  const cancelled = cancelClosureSnapshot(cancelledAt, snapshot)
  assert.equal(snapshot.cancelledAt, null)
  const replay = cancelClosureSnapshot(new Date('2027-01-01T00:00:00Z'), cancelled)
  assert.equal(replay.cancelledAt?.getTime(), cancelledAt.getTime())
  assert.notEqual(replay.cancelledAt, cancelled.cancelledAt)
  assert.equal(closurePhase(cancelledAt, cancelled).closureBlocksBusinessWrites, false)
  const subscription = subscriptionPhase(cancelledAt, { trialEndsAt: start, paidThrough: null, graceDays: 7 })
  assert.equal(subscription.businessWritesAllowed, false)
  assert.equal(subscription.businessWritesAllowed && !closurePhase(cancelledAt, cancelled).closureBlocksBusinessWrites, false)
})

test('Invalid policy, inconsistent persisted snapshots and backwards clocks fail closed', () => {
  for (const days of [0, -1, 1.5, 366, NaN, Infinity]) {
    assert.throws(() => newClosureSnapshot(start, { ...policy, closureCancellationDays: days }))
  }
  assert.throws(() => newClosureSnapshot(start, { ...policy, id: ' ' }))
  assert.throws(() => newClosureSnapshot(new Date('invalid'), policy))
  const snapshot = newClosureSnapshot(start, policy)
  assert.throws(() => closurePhase(new Date(start.getTime() - 1), snapshot))
  assert.throws(() => closurePhase(start, { ...snapshot, cancellationEndsAt: new Date(start) }))
  assert.throws(() => closurePhase(start, { ...snapshot, cancelledAt: new Date(start.getTime() - 1) }))
  assert.throws(() => closurePhase(snapshot.cancellationEndsAt, { ...snapshot, cancelledAt: snapshot.cancellationEndsAt }))
  const cancelled = cancelClosureSnapshot(new Date(start.getTime() + 1), snapshot)
  assert.throws(() => closurePhase(start, cancelled))
  assert.throws(() => closurePhase(new Date('invalid'), null))
  const sourceTime = new Date(start)
  const independent = newClosureSnapshot(sourceTime, policy)
  sourceTime.setUTCFullYear(2000)
  assert.equal(independent.requestedAt.getTime(), start.getTime())
  assert.deepEqual(closurePhase(start, null), {
    state: 'open', closureBlocksBusinessWrites: false, cancellationAllowed: false,
    reviewDue: false, automaticDeletionAllowed: false,
  })
})
