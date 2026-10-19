import { test } from 'node:test'
import assert from 'node:assert/strict'
import { subscriptionPhase } from '@/server/billing/phase'
import { nextBillingMonth } from '@/server/billing/invoices'
test('Trial/grace/expired millisecond boundaries and paid restoration use configured policy', () => {
  const trialEndsAt = new Date('2026-01-15T00:00:00.000Z'), subscription = { trialEndsAt, paidThrough: null, graceDays: 7 }
  assert.equal(subscriptionPhase(new Date(trialEndsAt.getTime()-1),subscription).state,'trial')
  assert.equal(subscriptionPhase(trialEndsAt,subscription).state,'grace')
  const graceEnd = new Date('2026-01-22T00:00:00.000Z')
  assert.equal(subscriptionPhase(new Date(graceEnd.getTime()-1),subscription).newSalesAllowed,true)
  assert.equal(subscriptionPhase(graceEnd,subscription).newSalesAllowed,false)
  assert.equal(subscriptionPhase(trialEndsAt,{...subscription,graceDays:0}).state,'expired')
  assert.equal(subscriptionPhase(graceEnd,{...subscription,paidThrough:new Date('2026-02-15T00:00:00Z')}).state,'active')
})
test('Monthly period clamps month end and preserves UTC time, including leap year', () => {
  for (const [start,end] of [['2026-01-31T15:16:17.123Z','2026-02-28T15:16:17.123Z'],['2028-01-31T00:00:00.000Z','2028-02-29T00:00:00.000Z'],['2026-12-15T12:00:00.000Z','2027-01-15T12:00:00.000Z']]) {
    assert.equal(nextBillingMonth(new Date(start)).toISOString(),end)
  }
})
