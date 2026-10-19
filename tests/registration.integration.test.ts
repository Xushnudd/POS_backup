import test, { after } from 'node:test'
import assert from 'node:assert/strict'
import { randomUUID } from 'node:crypto'
import { NextRequest } from 'next/server'
import { prisma } from '@/lib/prisma'
import { POST as register } from '@/app/api/auth/register/route'
import { verifySession } from '@/server/auth/session'
import { ApiError } from '@/lib/api'
import { errorMessage } from '@/i18n/errors'
import { localizeOwnedMessage } from '@/i18n/messages'

const connection = new URL(process.env.DATABASE_URL ?? '')
if (connection.protocol !== 'postgresql:' || connection.hostname !== '127.0.0.1' || connection.port !== '55439' || connection.pathname !== '/pos_test' || connection.username !== 'pos_test') throw Error('Isolated registration test DB required')
const orgs: string[] = [], users: string[] = []
after(async () => {
  await prisma.organization.deleteMany({ where: { id: { in: orgs } } })
  await prisma.user.deleteMany({ where: { id: { in: users } } })
  await prisma.$disconnect()
})
function input(extra: Record<string, unknown> = {}) {
  return { fullName: 'Registration test owner', phone: 'register-' + randomUUID(), password: 'test-only-password', organizationName: 'Registration test business', ...extra }
}
async function submit(body: ReturnType<typeof input>) {
  const response = await register(new NextRequest('http://localhost:3000/api/auth/register', { method: 'POST', headers: { origin: 'http://localhost:3000', 'content-type': 'application/json' }, body: JSON.stringify(body) }), undefined)
  const result = await response.json()
  if (response.ok) { orgs.push(result.data.organization.id); users.push(result.data.user.id) }
  return { response, result }
}
async function totals() {
  const values = await Promise.all([prisma.organization.count(), prisma.user.count(), prisma.organizationUser.count(), prisma.store.count(), prisma.register.count(), prisma.userStore.count(), prisma.discountPolicy.count(), prisma.session.count(), prisma.organizationSubscription.count()])
  return values
}
function conflict(output: Awaited<ReturnType<typeof submit>>, code: string, status = 409) {
  assert.equal(output.response.status, status)
  assert.equal(output.result.success, false)
  assert.equal(output.result.error.code, code)
  assert.ok(output.result.error.message)
  assert.ok(output.result.error.nextAction)
  assert.equal(output.result.requestId, output.response.headers.get('x-request-id'))
  assert.equal(output.response.headers.get('set-cookie'), null)
  assert.equal(output.result.data, undefined)
  const uiError = Object.assign(new ApiError('not displayed'), { code, requestId: output.result.requestId })
  const message = errorMessage(uiError)
  assert.ok(message.includes(output.result.error.message))
  assert.ok(!message.includes('Amalni bajarib bo‘lmadi.'))
  assert.notEqual(localizeOwnedMessage(message, 'ru'), message)
}

test('omitted, empty and whitespace-only optional fields register distinct complete accounts', async () => {
  for (const extra of [{}, { tin: '', email: '' }, { tin: '   ', email: ' \t ' }]) {
    const before = await totals(), { response, result } = await submit(input(extra))
    assert.equal(response.status, 200)
    assert.deepEqual(await totals(), before.map(value => value + 1))
    assert.equal(result.data.organization.tin, null)
    assert.equal(result.data.user.email, null)
    assert.equal(result.data.token, 'cookie-session')
    assert.equal(JSON.stringify(result).includes('passwordHash'), false)
    assert.match(response.headers.get('set-cookie') ?? '', /HttpOnly/)
    const token = response.headers.get('set-cookie')!.split(';')[0].split('=')[1]
    const session = await verifySession(token, { touch: false })
    assert.equal(session?.role, 'owner')
    assert.equal(session?.organizationId, result.data.organization.id)
    assert.equal(session?.storeIds.length, 1)
    const subscription = await prisma.organizationSubscription.findUniqueOrThrow({ where: { organizationId: result.data.organization.id }, include: { planVersion: true } })
    assert.equal(subscription.planVersion.code, 'pro')
    assert.equal(subscription.trialEndsAt.getTime() - subscription.trialStartedAt.getTime(), 14 * 86400000)
  }
})

test('duplicate normalized TIN returns actionable409 without disclosing or modifying the existing business', async () => {
  const tin = 'tin-' + randomUUID(), first = await submit(input({ tin }))
  assert.equal(first.response.status, 200)
  const before = await totals(), attempt = input({ tin: '  ' + tin + '  ' })
  const failed = await submit(attempt)
  conflict(failed, 'TIN_EXISTS')
  assert.deepEqual(await totals(), before)
  assert.equal(await prisma.user.count({ where: { phone: attempt.phone } }), 0)
  const raw = JSON.stringify(failed.result)
  for (const hidden of [first.result.data.organization.id, first.result.data.user.id, tin, attempt.password, 'Organization_tin_key', 'P2002']) assert.equal(raw.includes(hidden), false)
  assert.equal((await prisma.organization.findUniqueOrThrow({ where: { id: first.result.data.organization.id } })).tin, tin)
})

test('duplicate e-mail rolls back the new organization and trial; duplicate phone keeps USER_EXISTS', async () => {
  const email = randomUUID() + '@example.test', original = input({ email })
  const first = await submit(original)
  assert.equal(first.response.status, 200)
  const before = await totals(), attempt = input({ email: '  ' + email + '  ' })
  conflict(await submit(attempt), 'EMAIL_EXISTS')
  assert.deepEqual(await totals(), before)
  assert.equal(await prisma.organization.count({ where: { phone: attempt.phone } }), 0)
  conflict(await submit(input({ phone: original.phone })), 'USER_EXISTS', 400)
  assert.deepEqual(await totals(), before)
})

test('parallel sign-ups with one TIN commit exactly one complete business', async () => {
  const tin = 'parallel-' + randomUUID(), before = await totals()
  const attempts = [input({ tin }), input({ tin })]
  const results = await Promise.all(attempts.map(submit))
  assert.deepEqual(results.map(row => row.response.status).sort(), [200, 409])
  conflict(results.find(row => row.response.status === 409)!, 'TIN_EXISTS')
  assert.deepEqual(await totals(), before.map(value => value + 1))
  assert.equal(await prisma.user.count({ where: { phone: { in: attempts.map(row => row.phone) } } }), 1)
})

test('parallel sign-ups with one phone leave no orphan organization or trial', async () => {
  const phone = 'parallel-phone-' + randomUUID(), before = await totals()
  const results = await Promise.all([submit(input({ phone })), submit(input({ phone }))])
  assert.deepEqual(results.map(row => row.response.status).sort(), [200, 400])
  conflict(results.find(row => row.response.status === 400)!, 'USER_EXISTS', 400)
  assert.deepEqual(await totals(), before.map(value => value + 1))
})

test('late session failure rolls back every registration row and exposes no database diagnostics', async () => {
  const before = await totals(), attempt = input()
  await prisma.$executeRawUnsafe(`CREATE FUNCTION registration_test_failure() RETURNS trigger LANGUAGE plpgsql AS $$ BEGIN RAISE EXCEPTION 'ISOLATED_REGISTRATION_FAILURE'; END $$`)
  await prisma.$executeRawUnsafe('CREATE TRIGGER registration_test_failure BEFORE INSERT ON "Session" FOR EACH ROW EXECUTE FUNCTION registration_test_failure()')
  try {
    const output = await submit(attempt)
    assert.equal(output.response.status, 500)
    assert.equal(output.result.error.code, 'INTERNAL_ERROR')
    assert.equal(output.response.headers.get('set-cookie'), null)
    assert.equal(JSON.stringify(output.result).includes('ISOLATED_REGISTRATION_FAILURE'), false)
    assert.equal(JSON.stringify(output.result).includes(attempt.password), false)
    assert.deepEqual(await totals(), before)
  } finally {
    await prisma.$executeRawUnsafe('DROP TRIGGER registration_test_failure ON "Session"')
    await prisma.$executeRawUnsafe('DROP FUNCTION registration_test_failure()')
  }
})

test('invalid optional field types remain validation errors with no registration side effects', async () => {
  const before = await totals()
  for (const extra of [{ tin: null }, { tin: 123 }, { email: null }, { email: 'invalid-email' }]) {
    const output = await submit(input(extra))
    assert.equal(output.response.status, 400)
    assert.equal(output.result.error.code, 'VALIDATION_ERROR')
    assert.equal(output.response.headers.get('set-cookie'), null)
  }
  assert.deepEqual(await totals(), before)
})
