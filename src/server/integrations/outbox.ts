import { randomUUID } from 'node:crypto'
import { Prisma, type ProviderIntent, type ProviderOutbox } from '@prisma/client'
import { z } from 'zod'
import { prisma } from '@/lib/prisma'
import type { TokenPayload } from '@/lib/auth'
import { AccessError, tenantScope } from '../auth/policy'
import { assertLiveContext, audit, payloadHash, runOperation } from '../operations'
import { deploymentState } from '../deployment/state'
import { IntegrationUnavailable } from './contracts'
import { decimal } from '../sales/calculations'
import { authenticationRestoreReady } from '../auth/restore-state'
import { logEvent } from '../observability/context'

export const providerRequestSchema = z.object({
  businessType: z.enum(['sale', 'sale_return', 'receipt']), businessId: z.string().uuid(),
  amount: z.string().regex(/^(?:0|[1-9]\d{0,11})(?:\.\d{1,2})?$/).optional(),
  currency: z.string().regex(/^[A-Z]{3}$/).optional(),
}).strict().refine(value => (value.amount === undefined) === (value.currency === undefined), 'Summa va valyuta birga beriladi')
export type ProviderRequest = z.infer<typeof providerRequestSchema>
const externalId = z.string().min(1).max(200)
const resultSchema = z.discriminatedUnion('state', [
  z.object({ state: z.literal('confirmed'), externalId }).strict(),
  z.object({ state: z.literal('failed'), code: z.string().regex(/^[A-Z][A-Z0-9_]{0,63}$/) }).strict(),
  z.object({ state: z.enum(['pending', 'unknown']), externalId: externalId.optional() }).strict(),
  z.object({ state: z.literal('not_found') }).strict(),
])
export type ProviderOutcome = z.infer<typeof resultSchema>
export type ProviderIdentity = { operationId: string; organizationId: string; provider: string; capability: string; externalId?: string }
export type ProviderCommand = ProviderIdentity & { request: ProviderRequest; action: 'execute' | 'compensate'; originalExternalId?: string }
export interface ProviderTransport {
  execute(command: ProviderCommand, signal: AbortSignal): Promise<ProviderOutcome>
  lookup(identity: ProviderIdentity, signal: AbortSignal): Promise<ProviderOutcome>
}
export type ProviderBinding = {
  supportsCompensation: boolean
  transport: ProviderTransport
  // DB-only domain hooks. The future integration must supply actual business
  // posting; transport objects and raw provider credentials never enter hooks.
  confirmed(tx: Prisma.TransactionClient, intent: ProviderIntent, proof: { externalId: string }): Promise<void>
  failed(tx: Prisma.TransactionClient, intent: ProviderIntent, code: string): Promise<void>
}
export type ProviderRegistry = ReadonlyMap<string, ProviderBinding>
export const bindingKey = (provider: string, capability: string) => `${provider}:${capability}`
export const configuredProviders: ProviderRegistry = new Map() // Deliberately no vendor implementation.
const sourceSchema = z.object({ type: z.string().min(1).max(100), key: z.string().min(1).max(200) }).strict()
const enqueueSchema = z.object({ storeId: z.string().uuid(), provider: z.string().regex(/^[a-z][a-z0-9_-]{0,63}$/),
  capability: z.enum(['payment', 'fiscal']), request: providerRequestSchema, reason: z.string().trim().min(3).max(2000) }).strict()

function providerScope(context: TokenPayload) { return tenantScope('ProviderIntent', context) }
async function event(tx: Prisma.TransactionClient, row: ProviderOutbox, name: string, code?: string) {
  await tx.providerEvent.create({ data: { intentId: row.intentId, generation: row.generation, event: name, code } })
}
async function workerAudit(tx: Prisma.TransactionClient, intent: ProviderIntent, action: string, data: Prisma.InputJsonObject) {
  // Durable approved business intent, not a fabricated current worker Session.
  await tx.auditLog.create({ data: { organizationId: intent.organizationId, actorId: intent.actorId,
    entityType: 'ProviderIntent', entityId: intent.id, action, afterData: data } })
}

/** Call inside the authorized business runOperation transaction. The deferred
 * source FK/trigger guarantees business Operation + intent + outbox commit as one.
 * This does not mark any payment/fiscal document confirmed or call a provider.
 */
export async function enqueueProviderIntentTx(tx: Prisma.TransactionClient, context: TokenPayload,
  source: z.input<typeof sourceSchema>, input: z.input<typeof enqueueSchema>) {
  const origin = sourceSchema.parse(source), parsed = enqueueSchema.parse(input)
  await assertLiveContext(tx, context)
  if (!await tx.store.findFirst({ where: { id: parsed.storeId, isActive: true, AND: tenantScope('Store', context) } }))
    throw new AccessError(404, 'STORE_NOT_FOUND')
  // Source identity must belong to a real, scoped POS record; no vendor endpoint
  // or provider request format is guessed or persisted.
  const exists = parsed.request.businessType === 'sale_return'
    ? await tx.saleReturn.findFirst({ where: { id: parsed.request.businessId, AND: tenantScope('SaleReturn', context), sale: { storeId: parsed.storeId } } })
    : await tx.sale.findFirst({ where: { id: parsed.request.businessId, storeId: parsed.storeId, AND: tenantScope('Sale', context) } })
  if (!exists) throw new AccessError(404, 'BUSINESS_SOURCE_NOT_FOUND')
  const organization = await tx.organization.findUniqueOrThrow({ where: { id: context.organizationId }, select: { currencyCode: true } })
  if (parsed.request.currency && parsed.request.currency !== organization.currencyCode)
    throw new AccessError(400, 'INVALID_PROVIDER_CURRENCY')
  if (parsed.capability === 'payment' && (!parsed.request.amount || decimal(parsed.request.amount).lte(0)))
    throw new AccessError(400, 'INVALID_PROVIDER_AMOUNT')
  await tx.$queryRaw`SELECT pg_advisory_xact_lock(hashtextextended(${'provider-intents:' + context.organizationId},0))::text`
  const active = await tx.providerIntent.findFirst({ where: { organizationId: context.organizationId, capability: parsed.capability,
    compensatesId: null, state: { not: 'failed' }, AND: [
      { request: { path: ['businessType'], equals: parsed.request.businessType } },
      { request: { path: ['businessId'], equals: parsed.request.businessId } },
    ] } })
  if (active) throw new AccessError(409, 'PROVIDER_BUSINESS_ALREADY_ASSIGNED', 'Bu biznes amalining original provayder so‘rovini tekshiring')
  if (await tx.providerIntent.count({ where: { organizationId: context.organizationId, state: { in: ['awaiting', 'compensating', 'needs_review'] } } }) >= 1000)
    throw new AccessError(429, 'PROVIDER_QUEUE_LIMIT')
  const intent = await tx.providerIntent.create({ data: { organizationId: context.organizationId, storeId: parsed.storeId,
    actorId: context.userId, sourceType: origin.type, sourceKey: origin.key, provider: parsed.provider, capability: parsed.capability,
    request: parsed.request, requestHash: payloadHash(parsed.request), reason: parsed.reason, outbox: { create: {} } }, include: { outbox: true } })
  await event(tx, intent.outbox!, 'queued')
  await audit(tx, context, 'ProviderIntent', intent.id, 'provider_intent_queued', { provider: intent.provider, capability: intent.capability, reason: parsed.reason })
  return intent
}

export async function requestProviderCompensation(context: TokenPayload, id: string, input: { operationId: string; reason: string }, registry: ProviderRegistry = configuredProviders) {
  if (context.role !== 'owner') throw new AccessError(403, 'OWNER_REQUIRED')
  const parsed = z.object({ operationId: z.string().uuid(), reason: z.string().trim().min(3).max(2000) }).strict().parse(input)
  return runOperation(context, 'provider.compensate', parsed.operationId, { id, ...parsed }, async tx => {
    await tx.$queryRaw`SELECT id FROM "ProviderIntent" WHERE id=${id} AND "organizationId"=${context.organizationId} FOR UPDATE`
    const original = await tx.providerIntent.findFirst({ where: { id, AND: providerScope(context) }, include: { outbox: true, compensation: true } })
    if (!original) throw new AccessError(404, 'NOT_FOUND')
    if (!registry.get(bindingKey(original.provider, original.capability))?.supportsCompensation)
      throw new IntegrationUnavailable(original.capability + ' compensation')
    if (original.state !== 'confirmed' || original.compensation || !original.outbox?.externalId || original.compensatesId)
      throw new AccessError(409, 'COMPENSATION_NOT_ALLOWED')
    const child = await tx.providerIntent.create({ data: { organizationId: original.organizationId, storeId: original.storeId,
      actorId: context.userId, sourceType: 'provider.compensate', sourceKey: parsed.operationId, provider: original.provider,
      capability: original.capability, request: original.request as Prisma.InputJsonValue, requestHash: original.requestHash,
      reason: parsed.reason, compensatesId: original.id, outbox: { create: {} } }, include: { outbox: true } })
    await tx.providerIntent.update({ where: { id }, data: { state: 'compensating' } })
    await event(tx, child.outbox!, 'queued'); await event(tx, original.outbox, 'compensation_requested')
    await audit(tx, context, 'ProviderIntent', id, 'provider_compensation_requested', { childId: child.id, reason: parsed.reason })
    return child
  })
}

export async function resumeProviderLookup(context: TokenPayload, id: string, input: { operationId: string; reason: string }) {
  if (context.role !== 'owner') throw new AccessError(403, 'OWNER_REQUIRED')
  const parsed = z.object({ operationId: z.string().uuid(), reason: z.string().trim().min(3).max(2000) }).strict().parse(input)
  return runOperation(context, 'provider.lookup.resume', parsed.operationId, { id, ...parsed }, async tx => {
    const intent = await tx.providerIntent.findFirst({ where: { id, AND: providerScope(context) } })
    if (!intent) throw new AccessError(404, 'NOT_FOUND')
    await tx.$queryRaw`SELECT "intentId" FROM "ProviderOutbox" WHERE "intentId"=${id} FOR UPDATE`
    const row = await tx.providerOutbox.findUniqueOrThrow({ where: { intentId: id } })
    if (row.state !== 'review' || row.lookupAttempts >= 32) throw new AccessError(409, 'PROVIDER_REVIEW_REQUIRED')
    const updated = await tx.providerOutbox.update({ where: { intentId: id }, data: { state: 'unknown', mode: 'lookup', generation: { increment: 1 }, nextRunAt: new Date(), resultCode: null } })
    await event(tx, updated, 'unknown', 'MANUAL_LOOKUP_APPROVED')
    await audit(tx, context, 'ProviderIntent', id, 'provider_lookup_resumed', { reason: parsed.reason })
    return { id, state: updated.state }
  })
}

type Claim = ProviderOutbox & { intent: ProviderIntent }
export async function recoverProviderLeases() {
  return prisma.$transaction(async tx => {
    const rows = await tx.$queryRaw<ProviderOutbox[]>`SELECT * FROM "ProviderOutbox" WHERE state='running' AND "leaseUntil"<=NOW() ORDER BY "leaseUntil","intentId" FOR UPDATE SKIP LOCKED LIMIT 50`
    for (const row of rows) {
      const updated = await tx.providerOutbox.update({ where: { intentId: row.intentId }, data: { state: 'unknown', mode: 'lookup', leaseToken: null, leaseUntil: null, nextRunAt: new Date(), resultCode: 'LEASE_EXPIRED', updatedAt: new Date() } })
      await event(tx, updated, 'lease_lost', 'LEASE_EXPIRED')
    }
    return rows.length
  })
}
export async function claimProviderIntent(registry: ProviderRegistry): Promise<Claim | null> {
  if (!registry.size || (await deploymentState()).maintenance) return null
  const keys = [...registry.keys()]
  return prisma.$transaction(async tx => {
    if (!await authenticationRestoreReady(tx)) return null
    const rows = await tx.$queryRaw<ProviderOutbox[]>(Prisma.sql`SELECT b.* FROM "ProviderOutbox" b JOIN "ProviderIntent" p ON p.id=b."intentId"
      WHERE b.state IN ('queued','unknown') AND b."nextRunAt"<=NOW() AND (p.provider||':'||p.capability) IN (${Prisma.join(keys)})
      AND ((b.mode='submit' AND b."submitAttempts"=0) OR (b.mode='lookup' AND b."lookupAttempts"<32))
      ORDER BY b."nextRunAt",b."intentId" FOR UPDATE OF b SKIP LOCKED LIMIT 1`)
    if (!rows[0]) return null
    const row = rows[0]
    const [recovery] = await tx.$queryRaw<{restored:boolean}[]>`SELECT EXISTS(SELECT 1 FROM "ProviderIntent" p JOIN "AuthRestoreCheckpoint" c ON p."createdAt"<=c."createdAt" WHERE p.id=${row.intentId}) AS restored`
    const lookup = row.mode === 'lookup' || recovery.restored
    const updated = await tx.providerOutbox.update({ where: { intentId: row.intentId }, data: { state: 'running', leaseToken: randomUUID(),
      leaseUntil: new Date(Date.now() + 30_000), generation: { increment: 1 }, updatedAt: new Date(),
      mode: lookup ? 'lookup' : 'submit',
      ...(lookup ? { lookupAttempts: { increment: 1 } } : { submitAttempts: { increment: 1 } }),
    }, include: { intent: true } })
    await event(tx, updated, 'claimed')
    return updated
  })
}

async function boundedCall(call: (signal: AbortSignal) => Promise<ProviderOutcome>, timeoutMs: number) {
  const abort = new AbortController()
  let timer: ReturnType<typeof setTimeout> | undefined
  try {
    return resultSchema.parse(await Promise.race([Promise.resolve().then(() => call(abort.signal)), new Promise<never>((_, reject) => {
      timer = setTimeout(() => { abort.abort(); reject(new Error('PROVIDER_TIMEOUT')) }, timeoutMs)
    })]))
  } finally { if (timer) clearTimeout(timer) }
}

async function finishClaim(claim: Claim, binding: ProviderBinding, result: ProviderOutcome) {
  return prisma.$transaction(async tx => {
    if (!await authenticationRestoreReady(tx)) return { applied: false, state: 'restore_review' }
    await tx.$queryRaw`SELECT "intentId" FROM "ProviderOutbox" WHERE "intentId"=${claim.intentId} FOR UPDATE`
    const row = await tx.providerOutbox.findUniqueOrThrow({ where: { intentId: claim.intentId } })
    if (row.state !== 'running' || row.leaseToken !== claim.leaseToken || row.generation !== claim.generation || !row.leaseUntil || row.leaseUntil.getTime() <= Date.now())
      return { applied: false, state: 'lease_lost' }
    const intent = await tx.providerIntent.findUniqueOrThrow({ where: { id: claim.intentId } })
    // A changed provider identity is ambiguous, never a second financial posting.
    if ('externalId' in result && result.externalId && row.externalId && row.externalId !== result.externalId) result = { state: 'unknown' }
    if (result.state === 'confirmed' || result.state === 'failed') {
      if (result.state === 'confirmed') await binding.confirmed(tx, intent, { externalId: result.externalId })
      else await binding.failed(tx, intent, result.code)
      const state = result.state
      await tx.providerIntent.update({ where: { id: intent.id }, data: { state } })
      if (intent.compensatesId) await tx.providerIntent.update({ where: { id: intent.compensatesId }, data: { state: state === 'confirmed' ? 'compensated' : 'needs_review' } })
      const updated = await tx.providerOutbox.update({ where: { intentId: row.intentId }, data: { state, leaseToken: null, leaseUntil: null,
        externalId: state === 'confirmed' ? result.state === 'confirmed' ? result.externalId : null : row.externalId,
        resultCode: result.state === 'failed' ? result.code : null, updatedAt: new Date() } })
      await event(tx, updated, state, result.state === 'failed' ? result.code : undefined)
      await workerAudit(tx, intent, 'provider_' + state, { generation: row.generation, provider: intent.provider, capability: intent.capability })
      return { applied: true, state }
    }
    const review = result.state === 'not_found' || (row.mode === 'lookup' && row.lookupAttempts % 8 === 0)
    const code = result.state === 'not_found' ? 'LOOKUP_NOT_FOUND' : review ? 'LOOKUP_EXHAUSTED' : 'RESULT_UNKNOWN'
    const updated = await tx.providerOutbox.update({ where: { intentId: row.intentId }, data: { state: review ? 'review' : 'unknown', mode: 'lookup',
      leaseToken: null, leaseUntil: null, externalId: 'externalId' in result ? result.externalId ?? row.externalId : row.externalId,
      resultCode: code, nextRunAt: new Date(Date.now() + Math.min(300_000, 5_000 * 2 ** Math.min(row.lookupAttempts, 6))), updatedAt: new Date() } })
    if (review) {
      await tx.providerIntent.update({ where: { id: intent.id }, data: { state: 'needs_review' } })
      if (intent.compensatesId) await tx.providerIntent.update({ where: { id: intent.compensatesId }, data: { state: 'needs_review' } })
      await workerAudit(tx, intent, 'provider_review_required', { code, generation: row.generation })
    }
    await event(tx, updated, review ? 'review' : 'unknown', code)
    return { applied: true, state: updated.state }
  }, { timeout: 15_000 })
}

/** No DB transaction is open while execute/lookup waits. Exceptions and malformed
 * responses are ambiguous: lookup the SAME original identity; never charge again.
 */
export async function executeProviderClaim(claim: Claim, registry: ProviderRegistry, timeoutMs = 10_000) {
  if (!Number.isInteger(timeoutMs) || timeoutMs < 1 || timeoutMs > 10_000) throw new Error('INVALID_PROVIDER_TIMEOUT')
  const binding = registry.get(bindingKey(claim.intent.provider, claim.intent.capability))
  if (!binding) return { applied: false, state: 'unconfigured' }
  if (!await authenticationRestoreReady()) return { applied: false, state: 'restore_review' }
  // Check fencing immediately before transport. Recovery never requeues submit.
  const current = await prisma.providerOutbox.findUnique({ where: { intentId: claim.intentId } })
  if (!current || current.state !== 'running' || current.leaseToken !== claim.leaseToken || current.generation !== claim.generation || !current.leaseUntil || current.leaseUntil.getTime() <= Date.now())
    return { applied: false, state: 'lease_lost' }
  if (claim.mode === 'submit') {
    const [recovery] = await prisma.$queryRaw<{restored:boolean}[]>`SELECT EXISTS(SELECT 1 FROM "AuthRestoreCheckpoint" WHERE "createdAt">=${claim.intent.createdAt}) AS restored`
    if (recovery.restored) return { applied: false, state: 'restore_lookup_required' }
  }
  const identity: ProviderIdentity = { operationId: claim.intentId, organizationId: claim.intent.organizationId,
    provider: claim.intent.provider, capability: claim.intent.capability, ...(current.externalId ? { externalId: current.externalId } : {}) }
  let outcome: ProviderOutcome
  const transportStarted = performance.now()
  try {
    if (claim.mode === 'lookup') outcome = await boundedCall(signal => binding.transport.lookup(identity, signal), timeoutMs)
    else {
      const original = claim.intent.compensatesId ? await prisma.providerOutbox.findUnique({ where: { intentId: claim.intent.compensatesId } }) : null
      if (claim.intent.compensatesId && !original?.externalId) throw new Error('COMPENSATION_SOURCE_UNAVAILABLE')
      const command: ProviderCommand = { ...identity, request: providerRequestSchema.parse(claim.intent.request),
        action: claim.intent.compensatesId ? 'compensate' : 'execute', ...(original?.externalId ? { originalExternalId: original.externalId } : {}) }
      outcome = await boundedCall(signal => binding.transport.execute(command, signal), timeoutMs)
      if (outcome.state === 'not_found') outcome = { state: 'unknown' }
    }
  } catch { outcome = { state: 'unknown' } }
  // Worker-local duration goes to structured stdout, not an app-process counter.
  // Transport payloads, external IDs/codes and exception messages never enter logs.
  // A broken log sink must not change a payment/fiscal outcome or retry decision.
  try {
    logEvent('provider_transport', { organizationId: claim.intent.organizationId, operationId: claim.intentId,
      kind: `${claim.intent.capability}.${claim.mode}`, code: `PROVIDER_${outcome.state.toUpperCase()}`,
      durationMs: Math.max(0, Math.round(performance.now() - transportStarted)) })
  } catch { /* Operational logging is not the financial commit boundary. */ }
  try { return await finishClaim(claim, binding, outcome) }
  catch {
    // A late domain/audit rollback cannot justify resubmitting a successful call.
    // Leave the running lease durable; recovery moves it only into lookup.
    return { applied: false, state: 'settlement_rollback' }
  }
}

export async function processProviderOutbox(registry: ProviderRegistry = configuredProviders): Promise<{ processed: boolean; applied?: boolean; state?: string }> {
  if ((await deploymentState()).maintenance) return { processed: false }
  await recoverProviderLeases()
  const claim = await claimProviderIntent(registry)
  if (!claim) return { processed: false }
  return { processed: true, ...await executeProviderClaim(claim, registry) }
}

export async function providerIntentList(context: TokenPayload, page: number) {
  if (context.role !== 'owner') throw new AccessError(403, 'OWNER_REQUIRED')
  if (!Number.isSafeInteger(page) || page < 1 || (page - 1) * 20 > 2147483647) throw new AccessError(400, 'INVALID_PAGINATION')
  return prisma.$transaction(async tx => {
    await assertLiveContext(tx, context)
    const where = { AND: providerScope(context) }
    const rows = await tx.providerIntent.findMany({ where, take: 20, skip: (page - 1) * 20,
      orderBy: [{ createdAt: 'desc' }, { id: 'asc' }], select: { id: true, provider: true, capability: true, state: true,
        storeId: true, createdAt: true, compensatesId: true, outbox: { select: { state: true, mode: true, submitAttempts: true, lookupAttempts: true, resultCode: true, nextRunAt: true } } } })
    return { rows, total: await tx.providerIntent.count({ where }) }
  }, { isolationLevel: 'RepeatableRead' })
}
