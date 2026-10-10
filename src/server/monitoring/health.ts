import { Prisma } from '@prisma/client'
import { prisma } from '@/lib/prisma'
import type { TokenPayload } from '@/lib/auth'
import { AccessError } from '../auth/policy'
import { assertLiveContext } from '../operations'
import { apiMetrics } from './metrics'

export async function tenantMonitoring(context: TokenPayload) {
  if (context.role !== 'owner') throw new AccessError(403, 'OWNER_REQUIRED')
  const started = performance.now()
  const queues = await prisma.$transaction(async tx => {
    await assertLiveContext(tx, context)
    const jobs = await tx.$queryRaw<{ state: string; count: bigint; overdue: bigint }[]>(Prisma.sql`
      SELECT state, count(*) AS count,
      count(*) FILTER (WHERE (state='running' AND "leaseUntil" < NOW()) OR
        (state='queued' AND "nextRunAt" < NOW() - INTERVAL '5 minutes')) AS overdue
      FROM "BackgroundJob" WHERE "organizationId"=${context.organizationId} AND state IN ('queued','running','dead') GROUP BY state`)
    const providers = await tx.$queryRaw<{ state: string; count: bigint; overdue: bigint }[]>(Prisma.sql`
      SELECT b.state, count(*) AS count,
      count(*) FILTER (WHERE b.state='running' AND b."leaseUntil" < NOW()) AS overdue
      FROM "ProviderOutbox" b JOIN "ProviderIntent" i ON i.id=b."intentId"
      WHERE i."organizationId"=${context.organizationId} AND b.state IN ('queued','running','unknown','review','failed') GROUP BY b.state`)
    return { jobs, providers }
  }, { isolationLevel: 'RepeatableRead', timeout: 5000 })
  const normalize = (rows: { state: string; count: bigint; overdue: bigint }[]) => rows.map(row => ({ state: row.state, count: row.count.toString(), overdue: row.overdue.toString() }))
  const api = apiMetrics.snapshot(context.organizationId)
  const databaseRoundTripMs = Math.round(performance.now() - started)
  const alerts: string[] = []
  if (databaseRoundTripMs >= 500) alerts.push('DATABASE_SLOW_ROUND_TRIP')
  if (api.serverErrors > 0) alerts.push('API_SERVER_ERRORS')
  if (api.slowResponses > 0) alerts.push('API_SLOW_RESPONSES')
  if (queues.jobs.some(row => row.overdue > BigInt(0))) alerts.push('JOB_QUEUE_OVERDUE')
  if (queues.jobs.some(row => row.state === 'dead' && row.count > BigInt(0))) alerts.push('JOB_FAILURES')
  if (queues.providers.some(row => row.overdue > BigInt(0))) alerts.push('PROVIDER_LEASE_EXPIRED')
  if (queues.providers.some(row => ['unknown','review','failed'].includes(row.state) && row.count > BigInt(0))) alerts.push('PROVIDER_RECONCILIATION_REQUIRED')
  return { observedAt: new Date().toISOString(), api, databaseRoundTripMs,
    queues: { jobs: normalize(queues.jobs), providers: normalize(queues.providers) }, alerts,
    limitations: ['PROCESS_LOCAL_METRICS', 'NO_HOST_DISK_PROBE', 'NO_EXTERNAL_ALERT_DELIVERY', 'NO_VENDOR_ADAPTERS'] }
}
