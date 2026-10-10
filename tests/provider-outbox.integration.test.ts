import { test, after } from 'node:test'
import assert from 'node:assert/strict'
import { randomUUID } from 'node:crypto'
import { execFileSync } from 'node:child_process'
import { readFileSync, rmSync } from 'node:fs'
import { join } from 'node:path'
import { tmpdir } from 'node:os'
import { NextRequest } from 'next/server'
import { prisma } from '@/lib/prisma'
import { verifyToken, getRequestToken } from '@/lib/auth'
import { POST as register } from '@/app/api/auth/register/route'
import { GET as listRoute } from '@/app/api/integration-operations/route'
import { clearLimit } from '@/server/auth/rate-limit'
import { runOperation } from '@/server/operations'
import { enqueueProviderIntentTx, claimProviderIntent, executeProviderClaim, processProviderOutbox, recoverProviderLeases,
  providerIntentList, resumeProviderLookup, requestProviderCompensation, bindingKey, configuredProviders, type ProviderBinding, type ProviderOutcome } from '@/server/integrations/outbox'

const connection = new URL(process.env.DATABASE_URL ?? '')
if (connection.hostname !== '127.0.0.1' || connection.port !== '55439' || connection.pathname !== '/pos_test' || connection.username !== 'pos_test') throw new Error('Isolated DB only')
const orgs: string[] = [], users: string[] = [], phones: string[] = []
after(async () => {
  await prisma.organization.deleteMany({ where: { id: { in: orgs } } }); await prisma.user.deleteMany({ where: { id: { in: users } } })
  for (const phone of phones) await clearLimit('register-account', phone)
  await prisma.$disconnect()
})
async function fixture() {
  const phone = 'provider-' + randomUUID(); phones.push(phone)
  const request = new NextRequest('http://localhost:3000/api/auth/register', { method: 'POST', headers: { origin: 'http://localhost:3000', 'content-type': 'application/json' },
    body: JSON.stringify({ phone, password: 'test-only-password', fullName: 'Provider owner', organizationName: 'Provider fixture' }) })
  const registered = await register(request, undefined); assert.equal(registered.status, 200)
  const body = (await registered.json()).data; orgs.push(body.organization.id); users.push(body.user.id)
  const cookie = registered.headers.get('set-cookie')!.split(';')[0]
  const context = await verifyToken(getRequestToken(new NextRequest('http://localhost:3000/api/auth/me', { headers: { cookie } }))!); assert.ok(context)
  const store = await prisma.store.findFirstOrThrow({ where: { organizationId: context.organizationId } })
  const registerRow = await prisma.register.findFirstOrThrow({ where: { storeId: store.id } })
  const shift = await prisma.shift.create({ data: { registerId: registerRow.id, organizationUserId: context.organizationUserId, openingCash: 0 } })
  const sale = await prisma.sale.create({ data: { organizationId: context.organizationId, storeId: store.id, registerId: registerRow.id, shiftId: shift.id,
    cashierId: context.userId, receiptNo: randomUUID(), subtotal: '10.01', totalAmount: '10.01' } })
  return { context, store, sale, cookie }
}
type Fixture = Awaited<ReturnType<typeof fixture>>
async function enqueue(f: Fixture, provider = 'core-test', operationId = randomUUID(), fail = false) {
  return runOperation(f.context, 'provider.test.business', operationId, { saleId: f.sale.id, provider }, async tx => {
    await tx.sale.update({ where: { id: f.sale.id }, data: { note: 'Business operation committed' } })
    const intent = await enqueueProviderIntentTx(tx, f.context, { type: 'provider.test.business', key: operationId }, {
      storeId: f.store.id, provider, capability: 'payment', request: { businessType: 'sale', businessId: f.sale.id, amount: '10.01', currency: 'UZS' }, reason: 'Approved business intent',
    })
    if (fail) throw new Error('Test business rollback')
    return intent
  })
}
function adapter(execute: ProviderBinding['transport']['execute'], lookup: ProviderBinding['transport']['lookup']): ProviderBinding {
  return { supportsCompensation: true, transport: { execute, lookup },
    async confirmed(tx, intent) { await tx.auditLog.create({ data: { organizationId: intent.organizationId, actorId: intent.actorId, entityType: 'ProviderIntent', entityId: intent.id, action: 'test_domain_confirmed' } }) },
    async failed(tx, intent, code) { await tx.auditLog.create({ data: { organizationId: intent.organizationId, actorId: intent.actorId, entityType: 'ProviderIntent', entityId: intent.id, action: 'test_domain_failed', afterData: { code } } }) },
  }
}
const registry = (binding: ProviderBinding, name = 'core-test') => new Map([[bindingKey(name, 'payment'), binding]])
async function due(id: string) { await prisma.providerOutbox.update({ where: { intentId: id }, data: { nextRunAt: new Date(0) } }) }
async function expire(id: string) { await prisma.providerOutbox.update({ where: { intentId: id }, data: { leaseUntil: new Date(0) } }) }
async function confirmations(id: string) { return prisma.auditLog.count({ where: { entityId: id, action: 'test_domain_confirmed' } }) }

test('Business/source/outbox commit together; rollback leaves none and unconfigured adapters stay fail-closed', async () => {
  const f = await fixture(), key = randomUUID()
  await assert.rejects(enqueue(f, 'disabled-test', key, true))
  assert.equal(await prisma.providerIntent.count({ where: { organizationId: f.context.organizationId } }), 0)
  assert.equal(await prisma.operation.count({ where: { organizationId: f.context.organizationId, key } }), 0)
  assert.equal((await prisma.sale.findUniqueOrThrow({ where: { id: f.sale.id } })).note, null)
  const [a, b] = await Promise.all([enqueue(f, 'disabled-test', key), enqueue(f, 'disabled-test', key)])
  assert.equal(a.id, b.id)
  assert.equal((await prisma.providerOutbox.findUniqueOrThrow({ where: { intentId: a.id } })).state, 'queued')
  assert.equal(configuredProviders.size, 0)
  assert.equal(await claimProviderIntent(configuredProviders), null)
  assert.deepEqual(await processProviderOutbox(), { processed: false })
  assert.equal((await prisma.providerOutbox.findUniqueOrThrow({ where: { intentId: a.id } })).submitAttempts, 0)
  const listed = await providerIntentList(f.context, 1); assert.equal(listed.total, 1)
  assert.doesNotMatch(JSON.stringify(listed), /leaseToken|requestHash|externalId|businessId/)
  const response = await listRoute(new NextRequest('http://localhost:3000/api/integration-operations', { headers: { cookie: f.cookie } }), undefined)
  assert.equal(response.status, 200)
  const foreign = await fixture(); assert.equal((await providerIntentList(foreign.context, 1)).total, 0)
  await assert.rejects(providerIntentList({ ...f.context, role: 'cashier' }, 1), { code: 'OWNER_REQUIRED' })
})

test('Transport waits outside real DB locks; settlement/domain acknowledgement commits once', async () => {
  const f = await fixture(), intent = await enqueue(f)
  let start!: () => void, release!: () => void
  const started = new Promise<void>(resolve => { start = resolve }), waiting = new Promise<void>(resolve => { release = resolve })
  const binding = adapter(async () => { start(); await waiting; return { state: 'confirmed', externalId: 'test-lock-proof' } }, async () => ({ state: 'unknown' }))
  const bindings = registry(binding), claim = await claimProviderIntent(bindings); assert.ok(claim); assert.equal(claim.intentId, intent.id)
  const running = executeProviderClaim(claim, bindings)
  await started
  try {
    await prisma.$transaction(async tx => {
      await tx.$executeRaw`SET LOCAL lock_timeout = '500ms'`
      await tx.$queryRaw`SELECT "intentId" FROM "ProviderOutbox" WHERE "intentId"=${intent.id} FOR UPDATE`
      await tx.$queryRaw`SELECT id FROM "Sale" WHERE id=${f.sale.id} FOR UPDATE`
    })
  } finally { release() }
  assert.equal((await running).state, 'confirmed')
  assert.equal(await confirmations(intent.id), 1)
  assert.equal((await executeProviderClaim(claim, bindings)).applied, false)
  assert.equal(await confirmations(intent.id), 1)
  assert.equal(await prisma.payment.count({ where: { organizationId: f.context.organizationId } }), 0)
  await assert.rejects(prisma.providerIntent.update({ where: { id: intent.id }, data: { reason: 'Rewrite request' } }))
  await assert.rejects(prisma.providerOutbox.update({ where: { intentId: intent.id }, data: { state: 'queued', externalId: null } }))
})

test('Lost acknowledgement without external ID reconciles by original key, never another execute', async () => {
  const f = await fixture(), intent = await enqueue(f)
  let calls = 0, lookups = 0
  const binding = adapter(async command => { calls++; assert.equal(command.operationId, intent.id); throw new Error('Test committed then connection lost') }, async identity => {
    lookups++; assert.equal(identity.operationId, intent.id); assert.equal(identity.externalId, undefined)
    return { state: 'confirmed', externalId: 'test-lost-ack' }
  })
  assert.equal((await processProviderOutbox(registry(binding))).state, 'unknown')
  await due(intent.id)
  assert.equal((await processProviderOutbox(registry(binding))).state, 'confirmed')
  assert.equal(calls, 1); assert.equal(lookups, 1); assert.equal(await confirmations(intent.id), 1)
  await assert.rejects(enqueue(f), { code: 'PROVIDER_BUSINESS_ALREADY_ASSIGNED' })
  await assert.rejects(enqueue(f, 'different-provider'), { code: 'PROVIDER_BUSINESS_ALREADY_ASSIGNED' })
})

test('Changed external identity stays unknown and never posts the wrong proof', async () => {
  const f = await fixture(), intent = await enqueue(f)
  let calls = 0, lookups = 0
  const binding = adapter(async () => { calls++; return { state: 'pending', externalId: 'test-original-proof' } }, async identity => {
    assert.equal(identity.externalId, 'test-original-proof')
    lookups++
    return { state: 'confirmed', externalId: lookups === 1 ? 'test-wrong-proof' : 'test-original-proof' }
  })
  assert.equal((await processProviderOutbox(registry(binding))).state, 'unknown')
  await due(intent.id)
  assert.equal((await processProviderOutbox(registry(binding))).state, 'unknown')
  assert.equal(await confirmations(intent.id), 0)
  assert.equal((await prisma.providerOutbox.findUniqueOrThrow({ where: { intentId: intent.id } })).externalId, 'test-original-proof')
  await due(intent.id)
  assert.equal((await processProviderOutbox(registry(binding))).state, 'confirmed')
  assert.equal(calls, 1); assert.equal(lookups, 2); assert.equal(await confirmations(intent.id), 1)
})

test('Expired lease recovers only lookup; stale worker result cannot finalize or submit again', async () => {
  const f = await fixture(), intent = await enqueue(f)
  let start!: () => void, release!: (value: ProviderOutcome) => void, calls = 0
  const started = new Promise<void>(resolve => { start = resolve }), waiting = new Promise<ProviderOutcome>(resolve => { release = resolve })
  const binding = adapter(async () => { calls++; start(); return waiting }, async () => ({ state: 'confirmed', externalId: 'test-current-proof' }))
  const bindings = registry(binding), old = await claimProviderIntent(bindings); assert.ok(old)
  const running = executeProviderClaim(old, bindings); await started
  await expire(intent.id); assert.equal(await recoverProviderLeases(), 1)
  assert.equal((await processProviderOutbox(bindings)).state, 'confirmed')
  release({ state: 'confirmed', externalId: 'test-stale-proof' })
  assert.equal((await running).applied, false)
  assert.equal(calls, 1); assert.equal(await confirmations(intent.id), 1)
  assert.equal((await prisma.providerOutbox.findUniqueOrThrow({ where: { intentId: intent.id } })).externalId, 'test-current-proof')
})

test('Timeout, malformed status, not-found and bounded lookup require review; owner resumes lookup only', async () => {
  const f = await fixture(), intent = await enqueue(f)
  let calls = 0, outcome: ProviderOutcome = { state: 'pending' }
  const binding = adapter(async () => { calls++; return new Promise<ProviderOutcome>(() => {}) }, async () => outcome)
  const bindings = registry(binding), claim = await claimProviderIntent(bindings); assert.ok(claim)
  assert.equal((await executeProviderClaim(claim, bindings, 10)).state, 'unknown')
  for (let i = 0; i < 8; i++) { outcome = i === 0 ? { state: 'confirmed', externalId: '' } : { state: 'pending' }; await due(intent.id); await processProviderOutbox(bindings) }
  assert.equal((await prisma.providerOutbox.findUniqueOrThrow({ where: { intentId: intent.id } })).state, 'review')
  assert.deepEqual(await processProviderOutbox(bindings), { processed: false })
  await assert.rejects(resumeProviderLookup({ ...f.context, role: 'admin' }, intent.id, { operationId: randomUUID(), reason: 'Unauthorized lookup' }), { code: 'OWNER_REQUIRED' })
  const resume = { operationId: randomUUID(), reason: 'Approved status reconciliation' }
  await resumeProviderLookup(f.context, intent.id, resume); await resumeProviderLookup(f.context, intent.id, resume)
  outcome = { state: 'not_found' }; await processProviderOutbox(bindings)
  assert.equal((await prisma.providerOutbox.findUniqueOrThrow({ where: { intentId: intent.id } })).resultCode, 'LOOKUP_NOT_FOUND')
  await resumeProviderLookup(f.context, intent.id, { ...resume, operationId: randomUUID() })
  outcome = { state: 'confirmed', externalId: 'test-delayed-found' }
  assert.equal((await processProviderOutbox(bindings)).state, 'confirmed')
  assert.equal(calls, 1); assert.equal(await confirmations(intent.id), 1)
})

test('Definitive failure is terminal; approved compensation is separately idempotent and linked to original proof', async () => {
  const f = await fixture(), failed = await enqueue(f)
  let calls = 0
  const rejected = adapter(async () => { calls++; return { state: 'failed', code: 'TEST_DECLINED' } }, async () => ({ state: 'unknown' }))
  assert.equal((await processProviderOutbox(registry(rejected))).state, 'failed')
  assert.deepEqual(await processProviderOutbox(registry(rejected)), { processed: false }); assert.equal(calls, 1)
  assert.equal(await prisma.auditLog.count({ where: { entityId: failed.id, action: 'test_domain_failed' } }), 1)
  const original = await enqueue(f)
  const successful = adapter(async command => {
    if (command.action === 'compensate') assert.equal(command.originalExternalId, 'test-original-confirmed')
    return { state: 'confirmed', externalId: command.action === 'compensate' ? 'test-compensation-confirmed' : 'test-original-confirmed' }
  }, async () => ({ state: 'unknown' }))
  await processProviderOutbox(registry(successful))
  const input = { operationId: randomUUID(), reason: 'Owner approved full compensation' }
  await assert.rejects(requestProviderCompensation(f.context, original.id, input))
  const [child, replay] = await Promise.all([requestProviderCompensation(f.context, original.id, input, registry(successful)), requestProviderCompensation(f.context, original.id, input, registry(successful))])
  assert.equal(child.id, replay.id)
  assert.equal((await prisma.providerIntent.findUniqueOrThrow({ where: { id: original.id } })).state, 'compensating')
  await processProviderOutbox(registry(successful))
  assert.equal((await prisma.providerIntent.findUniqueOrThrow({ where: { id: original.id } })).state, 'compensated')
  assert.equal(await confirmations(child.id), 1)
})

test('Remote confirmation plus late domain/audit failure recovers through lookup, never another charge', async () => {
  const f = await fixture(), intent = await enqueue(f)
  let calls = 0, fail = true
  const binding = adapter(async () => { calls++; return { state: 'confirmed', externalId: 'test-domain-rollback' } }, async () => ({ state: 'confirmed', externalId: 'test-domain-rollback' }))
  const confirmed = binding.confirmed
  binding.confirmed = async (tx, intent, proof) => { await confirmed(tx, intent, proof); if (fail) throw new Error('Late domain failure') }
  assert.equal((await processProviderOutbox(registry(binding))).state, 'settlement_rollback')
  assert.equal(await confirmations(intent.id), 0)
  assert.equal((await prisma.providerIntent.findUniqueOrThrow({ where: { id: intent.id } })).state, 'awaiting')
  fail = false; await expire(intent.id); await recoverProviderLeases()
  assert.equal((await processProviderOutbox(registry(binding))).state, 'confirmed')
  assert.equal(calls, 1); assert.equal(await confirmations(intent.id), 1)
})

test('Actual worker process crash after remote commit restarts with lookup and one domain finalization', async () => {
  const f = await fixture(), intent = await enqueue(f, 'restart-test')
  const path = join(tmpdir(), 'pos-provider-restart-' + intent.id + '.json')
  const worker = join(process.cwd(), '.test-build/tests/fixtures/provider-worker.js')
  const launch = (mode: string) => execFileSync(process.execPath, ['--require', './scripts/test-resolver.cjs', worker], {
    env: { ...process.env, POS_PROVIDER_TEST_INTENT: intent.id, POS_PROVIDER_TEST_MODE: mode }, timeout: 10_000, stdio: 'pipe',
  })
  try {
    launch('crash')
    assert.equal((await prisma.providerOutbox.findUniqueOrThrow({ where: { intentId: intent.id } })).state, 'running')
    await expire(intent.id)
    launch('restart')
    assert.equal((await prisma.providerIntent.findUniqueOrThrow({ where: { id: intent.id } })).state, 'confirmed')
    assert.equal(await confirmations(intent.id), 1)
    launch('restart')
    const proof = JSON.parse(readFileSync(path, 'utf8')); assert.equal(proof.executeCalls, 1)
    const row = await prisma.providerOutbox.findUniqueOrThrow({ where: { intentId: intent.id } })
    assert.equal(row.submitAttempts, 1); assert.equal(row.lookupAttempts, 1)
  } finally { rmSync(path, { force: true }) }
})
