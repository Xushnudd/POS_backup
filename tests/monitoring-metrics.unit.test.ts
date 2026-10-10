import { test } from 'node:test'
import assert from 'node:assert/strict'
import { ApiMetrics } from '@/server/monitoring/metrics'
test('Telemetry isolates tenants, bounds labels, expires windows and never records unauthenticated traffic', () => {
  const metrics = new ApiMetrics(2)
  metrics.record(undefined, 500, 5000, 0)
  metrics.record('a', 200, 50, 0); metrics.record('a', 503, 2000, 1)
  metrics.record('b', 403, 10, 0)
  assert.equal(metrics.snapshot('a', 2).requests, 2)
  assert.equal(metrics.snapshot('a', 2).serverErrors, 1)
  assert.equal(metrics.snapshot('a', 2).slowResponses, 1)
  assert.equal(metrics.snapshot('b', 2).serverErrors, 0)
  assert.equal(metrics.snapshot('missing', 2).available, false)
  assert.equal(metrics.snapshot('a', 300_000).available, false)
  metrics.record('c', 200, 1, 3)
  assert.equal(metrics.snapshot('a', 4).available, false)
  metrics.record('c', 200, NaN, 4); metrics.record('c', 999, 1, 4)
  assert.equal(metrics.snapshot('c', 5).requests, 1)
  const first = metrics.snapshot('c', 5); first.histogram[0].count = 999
  assert.equal(metrics.snapshot('c', 5).histogram[0].count, 1)
  metrics.record('b', 200, 5, 300_001)
  assert.equal(metrics.snapshot('b', 300_002).requests, 1)
})
