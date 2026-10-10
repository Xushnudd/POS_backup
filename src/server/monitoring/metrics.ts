// Bounded, process-local telemetry; no URL, payload, actor or credential labels.
// Durable business incidents remain in PostgreSQL. This is not cluster telemetry.
const bounds = [100, 250, 500, 1000, 2000, 5000, Infinity]
const windowMs = 300_000
type Bucket = { startedAt: number; requests: number; errors: number; slow: number; durations: number[] }
export class ApiMetrics {
  private tenants = new Map<string, Bucket>()
  constructor(private readonly capacity = 512) {
    if (!Number.isInteger(capacity) || capacity < 1 || capacity > 10_000) throw new Error('INVALID_METRIC_CAPACITY')
  }
  record(organizationId: string | undefined, status: number, durationMs: number, now = Date.now()) {
    if (!organizationId || !Number.isInteger(status) || status < 100 || status > 599 || !Number.isFinite(durationMs) || durationMs < 0) return
    let bucket = this.tenants.get(organizationId)
    if (!bucket || now - bucket.startedAt >= windowMs || now < bucket.startedAt) {
      this.tenants.delete(organizationId)
      if (this.tenants.size >= this.capacity) this.tenants.delete(this.tenants.keys().next().value!)
      bucket = { startedAt: now, requests: 0, errors: 0, slow: 0, durations: bounds.map(() => 0) }
      this.tenants.set(organizationId, bucket)
    }
    bucket.requests++; if (status >= 500) bucket.errors++; if (durationMs >= 2000) bucket.slow++
    bucket.durations[bounds.findIndex(bound => durationMs <= bound)]++
  }
  snapshot(organizationId: string, now = Date.now()) {
    const bucket = this.tenants.get(organizationId)
    const available = Boolean(bucket && now >= bucket.startedAt && now - bucket.startedAt < windowMs)
    return { scope: 'tenant-process-window', available, windowMs,
      startedAt: available ? bucket!.startedAt : null,
      requests: available ? bucket!.requests : 0, serverErrors: available ? bucket!.errors : 0,
      slowResponses: available ? bucket!.slow : 0,
      histogram: bounds.map((bound, index) => ({ upperBoundMs: Number.isFinite(bound) ? bound : null, count: available ? bucket!.durations[index] : 0 })),
    }
  }
}
export const apiMetrics = new ApiMetrics()
