import { test, after } from 'node:test'
import assert from 'node:assert/strict'
import { randomUUID } from 'node:crypto'
import { NextRequest } from 'next/server'
import { prisma } from '@/lib/prisma'
import { getRequestToken, verifyToken } from '@/lib/auth'
import { POST as register } from '@/app/api/auth/register/route'
import { POST as preview } from '@/app/api/stock-documents/[id]/landed-cost-preview/route'
import { createPurchaseOrder, receivePurchaseOrder } from '@/server/purchases/orders'
import { clearLimit } from '@/server/auth/rate-limit'
import { createAccount, createExpenseCategory, postExpense, reverseFinancialDocument } from '@/server/finance/accounts'
import { prepareReceiptCost, cancelReceiptCost, listReceiptCosts } from '@/server/purchases/receipt-cost-plans'
import { POST as prepareRoute } from '@/app/api/stock-documents/[id]/cost-plans/route'
import { previewReceiptLandedCost } from '@/server/purchases/landed-cost-preview'

const connection = new URL(process.env.DATABASE_URL ?? '')
if (connection.hostname !== '127.0.0.1' || connection.port !== '55439' || connection.pathname !== '/pos_test' || connection.username !== 'pos_test')
  throw new Error('Isolated test DB required')
const orgs: string[] = [], users: string[] = [], phones: string[] = [], identities: string[] = []
const request = (path: string, cookie: string, body: unknown) => new NextRequest(`http://localhost:3000/api${path}`, {
  method: 'POST', headers: { cookie, origin: 'http://localhost:3000', 'content-type': 'application/json' }, body: JSON.stringify(body),
})
after(async () => {
  await prisma.organization.deleteMany({ where: { id: { in: orgs } } })
  await prisma.user.deleteMany({ where: { id: { in: users } } })
  for (const phone of phones) await clearLimit('register-account', phone)
  for (const identity of identities) await clearLimit('landed-cost-preview', identity)
  for (const identity of identities) await clearLimit('receipt-cost-write', identity)
  await prisma.$disconnect()
})
async function account() {
  const phone = 'landed-' + randomUUID(); phones.push(phone)
  const response = await register(request('/auth/register', '', { phone, password: 'test-only-password', fullName: 'Landed owner', organizationName: 'Landed POS' }), undefined)
  assert.equal(response.status, 200)
  const data = (await response.json()).data
  orgs.push(data.organization.id); users.push(data.user.id)
  identities.push(`${data.organization.id}:${data.user.id}`)
  const cookie = response.headers.get('set-cookie')!.split(';')[0]
  const context = await verifyToken(getRequestToken(request('/stock-documents', cookie, {}))!)
  assert.ok(context)
  const store = await prisma.store.findFirstOrThrow({ where: { organizationId: context.organizationId } })
  return { context, cookie, store }
}
async function receipt() {
  const a = await account()
  const supplier = await prisma.supplier.create({ data: { organizationId: a.context.organizationId, name: 'Landed supplier' } })
  const products = await Promise.all([1, 2].map(index => prisma.product.create({ data: {
    organizationId: a.context.organizationId, name: 'Landed ' + index, sku: randomUUID(), barcode: randomUUID(), unit: 'dona', salePrice: '10', costPrice: '99',
  } })))
  const order = await createPurchaseOrder(a.context, { operationId: randomUUID(), storeId: a.store.id,
    supplierId: supplier.id, referenceNo: randomUUID(), reason: 'Landed receipt test',
    items: products.map(product => ({ productId: product.id, quantity: '10', unitCost: '2' })),
  })
  const received = await receivePurchaseOrder(a.context, order.id, { operationId: randomUUID(), referenceNo: randomUUID(), reason: 'Partial receipt',
    items: order.items.map(item => ({ orderItemId: item.id, quantity: '3' })),
  })
  return { ...a, products, order, stock: received.stockDocument }
}
test('Receipt-backed preview uses actual partial receipt snapshots, has no journal effect and rejects forged fields', async () => {
  const a = await receipt(), path = `/stock-documents/${a.stock.id}/landed-cost-preview`
  await assert.rejects(prisma.product.update({ where: { id: a.products[0].id }, data: { unit: 'kg' } }))
  await prisma.product.updateMany({ where: { id: { in: a.products.map(p => p.id) } }, data: { costPrice: '999' } })
  const before = await prisma.operation.count({ where: { organizationId: a.context.organizationId } })
  const response = await preview(request(path, a.cookie, { amount: '0.03', method: 'value' }), { params: Promise.resolve({ id: a.stock.id }) })
  assert.equal(response.status, 200)
  assert.match(response.headers.get('cache-control')!, /no-store/)
  const result = (await response.json()).data
  assert.equal(result.previewOnly, true)
  assert.deepEqual(result.lines.map((line: { quantity: string; unitCost: string; unit: string }) => [line.quantity, line.unitCost, line.unit]), [['3', '2', 'dona'], ['3', '2', 'dona']])
  assert.deepEqual(result.lines.map((line: { allocatedAmount: string }) => line.allocatedAmount), ['0.01', '0.02'])
  assert.equal(await prisma.operation.count({ where: { organizationId: a.context.organizationId } }), before)
  assert.equal((await prisma.product.findUniqueOrThrow({ where: { id: a.products[0].id } })).costPrice.toString(), '999')
  for (const body of [{ amount: '1', method: 'value', quantity: '999' }, { amount: '1.001', method: 'value' }, { amount: '1', method: 'weight' },
    ...['0', 'not-a-number', 'NaN', 'Infinity'].map(unitWeightKg => ({ amount: '1', method: 'weight', weights: a.stock.items.map(row => ({ stockDocumentItemId: row.id, unitWeightKg })) }))])
    assert.equal((await preview(request(path, a.cookie, body), { params: Promise.resolve({ id: a.stock.id }) })).status, 400)
  const weightBody = { amount: '12', method: 'weight', weights: a.stock.items.map(row => ({ stockDocumentItemId: row.id, unitWeightKg: '2' })) }
  assert.equal((await preview(request(path, a.cookie, weightBody), { params: Promise.resolve({ id: a.stock.id }) })).status, 200)
  weightBody.weights[0].stockDocumentItemId = randomUUID()
  const invalidWeight = await preview(request(path, a.cookie, weightBody), { params: Promise.resolve({ id: a.stock.id }) })
  assert.equal(invalidWeight.status, 400)
  assert.equal((await invalidWeight.json()).error.code, 'INVALID_ITEMS')
})
test('Preview enforces tenant, assigned branch, live role and session boundaries', async () => {
  const a = await receipt(), b = await account(), path = `/stock-documents/${a.stock.id}/landed-cost-preview`
  const call = (cookie: string) => preview(request(path, cookie, { amount: '1', method: 'quantity' }), { params: Promise.resolve({ id: a.stock.id }) })
  assert.equal((await call(b.cookie)).status, 404)
  await prisma.organizationUser.update({ where: { id: a.context.organizationUserId }, data: { role: 'admin' } })
  assert.equal((await call(a.cookie)).status, 200)
  await prisma.userStore.deleteMany({ where: { organizationUserId: a.context.organizationUserId } })
  assert.equal((await call(a.cookie)).status, 404)
  await prisma.organizationUser.update({ where: { id: a.context.organizationUserId }, data: { role: 'cashier' } })
  assert.equal((await call(a.cookie)).status, 403)
  await prisma.session.update({ where: { id: a.context.sessionId }, data: { revokedAt: new Date() } })
  assert.equal((await call(a.cookie)).status, 401)
})

async function capitalisedExpense(a: Awaited<ReturnType<typeof receipt>>) {
  const account = await createAccount(a.context, { operationId: randomUUID(), storeId: a.store.id, name: 'Manual bank book', kind: 'bank', openingBalance: '20', reason: 'Test account opening' })
  const category = await createExpenseCategory(a.context, { operationId: randomUUID(), name: 'Freight', treatment: 'capitalised' })
  const expense = await postExpense(a.context, { operationId: randomUUID(), accountId: account.id, expenseCategoryId: category.id, amount: '12.01', reason: 'Confirmed freight payment' })
  return { account, category, expense }
}
test('Prepared receipt cost journal uses one paid source, replays once, cancels safely and never posts valuation', async () => {
  const a = await receipt(), e = await capitalisedExpense(a)
  const body = { operationId: randomUUID(), expenseDocumentId: e.expense.id, amount: '12.01', method: 'value' as const, reason: 'Prepare freight allocation' }
  const [first, duplicate] = await Promise.all([prepareReceiptCost(a.context, a.stock.id, body), prepareReceiptCost(a.context, a.stock.id, body)])
  assert.equal(first.id, duplicate.id); assert.equal(first.status, 'prepared')
  assert.equal(await prisma.receiptCostPlan.count({ where: { expenseDocumentId: e.expense.id } }), 1)
  assert.equal((await listReceiptCosts(a.context, a.stock.id, 1)).total, 1)
  await assert.rejects(listReceiptCosts(a.context, a.stock.id, Number.MAX_SAFE_INTEGER), { code: 'INVALID_PAGINATION' })
  assert.equal((await prisma.accountEntry.aggregate({ where: { accountId: e.account.id }, _sum: { amount: true } }))._sum.amount!.toString(), '7.99')
  assert.equal((await prisma.product.findUniqueOrThrow({ where: { id: a.products[0].id } })).costPrice.toString(), '2')
  assert.equal((await prisma.inventoryBalance.findUniqueOrThrow({ where: { storeId_productId: { storeId: a.store.id, productId: a.products[0].id } } })).quantity.toString(), '3')
  await assert.rejects(prepareReceiptCost(a.context, a.stock.id, { ...body, operationId: randomUUID() }), { code: 'EXPENSE_ALREADY_ASSIGNED' })
  await assert.rejects(reverseFinancialDocument(a.context, e.expense.id, { operationId: randomUUID(), reason: 'Must cancel plan', shifts: {} }), { code: 'RECEIPT_COST_PLAN_ACTIVE' })
  await assert.rejects(prisma.receiptCostPlan.update({ where: { id: first.id }, data: { reason: 'Rewrite history' } }))
  await assert.rejects(prisma.receiptCostPlan.delete({ where: { id: first.id } }))
  await assert.rejects(prisma.receiptCostPlan.update({ where: { id: first.id }, data: { status: 'cancelled', cancelledBy: a.context.userId,
    cancelledAt: new Date(), cancellationReason: null } }))
  const cancel = { operationId: randomUUID(), reason: 'Cancel unused allocation' }
  const [cancelled, replay] = await Promise.all([cancelReceiptCost(a.context, a.stock.id, first.id, cancel), cancelReceiptCost(a.context, a.stock.id, first.id, cancel)])
  assert.equal(cancelled.id, replay.id); assert.equal(cancelled.status, 'cancelled')
  const replan = await prepareReceiptCost(a.context, a.stock.id, { ...body, operationId: randomUUID() })
  assert.notEqual(replan.id, first.id)
  await cancelReceiptCost(a.context, a.stock.id, replan.id, { operationId: randomUUID(), reason: 'Cancel before reversal' })
  await reverseFinancialDocument(a.context, e.expense.id, { operationId: randomUUID(), reason: 'Reverse unused freight', shifts: {} })
  await assert.rejects(prepareReceiptCost(a.context, a.stock.id, { ...body, operationId: randomUUID() }), { code: 'INVALID_EXPENSE_SOURCE' })
  assert.equal((await prisma.accountEntry.aggregate({ where: { accountId: e.account.id }, _sum: { amount: true } }))._sum.amount!.toString(), '20')
})
test('Distinct concurrent keys cannot assign one expense twice; source guards and API remain scoped', async () => {
  const a = await receipt(), e = await capitalisedExpense(a), foreign = await account()
  const body = { operationId: randomUUID(), expenseDocumentId: e.expense.id, amount: '12.01', method: 'quantity' as const, reason: 'Prepare freight allocation' }
  await assert.rejects(prepareReceiptCost(foreign.context, a.stock.id, body), { code: 'NOT_FOUND' })
  await assert.rejects(prepareReceiptCost(a.context, a.stock.id, { ...body, amount: '12' }), { code: 'EXPENSE_AMOUNT_CHANGED' })
  const results = await Promise.allSettled([prepareReceiptCost(a.context, a.stock.id, body), prepareReceiptCost(a.context, a.stock.id, { ...body, operationId: randomUUID() })])
  assert.equal(results.filter(row => row.status === 'fulfilled').length, 1)
  const plan = await prisma.receiptCostPlan.findFirstOrThrow({ where: { expenseDocumentId: e.expense.id, status: 'prepared' } })
  await assert.rejects(prisma.financialDocument.create({ data: { organizationId: a.context.organizationId, storeId: a.store.id, kind: 'expense_reversal', amount: e.expense.amount,
    categoryId: e.category.id, reversalOfId: e.expense.id, reason: 'Bypass plan guard', actorId: a.context.userId } }))
  const response = await prepareRoute(request(`/stock-documents/${a.stock.id}/cost-plans`, a.cookie, { ...body, operationId: randomUUID() }), { params: Promise.resolve({ id: a.stock.id }) })
  assert.equal(response.status, 409)
  assert.equal((await response.json()).error.code, 'EXPENSE_ALREADY_ASSIGNED')
  await prisma.organizationUser.update({ where: { id: a.context.organizationUserId }, data: { role: 'cashier' } })
  assert.equal((await prepareRoute(request(`/stock-documents/${a.stock.id}/cost-plans`, a.cookie, body), { params: Promise.resolve({ id: a.stock.id }) })).status, 403)
  assert.equal((await prisma.receiptCostPlan.findUniqueOrThrow({ where: { id: plan.id } })).status, 'prepared')
})

test('Late audit failure rolls back prepared source assignment and SQL refuses altered original receipt quantities', async () => {
  const a = await receipt(), e = await capitalisedExpense(a)
  const body = { operationId: randomUUID(), expenseDocumentId: e.expense.id, amount: '12.01', method: 'value' as const, reason: 'Prepare rollback test' }
  const trigger = 'cost_plan_audit_' + randomUUID().replaceAll('-', '')
  await prisma.$executeRawUnsafe(`CREATE FUNCTION ${trigger}() RETURNS trigger LANGUAGE plpgsql AS $$ BEGIN IF NEW."organizationId"='${a.context.organizationId}' THEN RAISE EXCEPTION 'test-only audit failure'; END IF; RETURN NEW; END $$`)
  await prisma.$executeRawUnsafe(`CREATE TRIGGER ${trigger} BEFORE INSERT ON "AuditLog" FOR EACH ROW EXECUTE FUNCTION ${trigger}()`)
  try {
    await assert.rejects(prepareReceiptCost(a.context, a.stock.id, body))
    assert.equal(await prisma.receiptCostPlan.count({ where: { expenseDocumentId: e.expense.id } }), 0)
    assert.equal(await prisma.operation.count({ where: { organizationId: a.context.organizationId, key: body.operationId } }), 0)
  } finally {
    await prisma.$executeRawUnsafe(`DROP TRIGGER ${trigger} ON "AuditLog"`)
    await prisma.$executeRawUnsafe(`DROP FUNCTION ${trigger}()`)
  }
  const snapshot = await previewReceiptLandedCost(a.context, a.stock.id, { amount: body.amount, method: body.method })
  await assert.rejects(prisma.receiptCostPlan.create({ data: {
    organizationId: a.context.organizationId, storeId: a.store.id, stockDocumentId: a.stock.id,
    expenseDocumentId: e.expense.id, amount: body.amount, method: body.method, reason: body.reason, createdBy: a.context.userId,
    snapshot: { ...snapshot, lines: snapshot.lines.map((line, index) => index === 0 ? { ...line, quantity: '999' } : line) },
  } }))
  const plan = await prepareReceiptCost(a.context, a.stock.id, body)
  assert.equal(plan.status, 'prepared')
  assert.equal(await prisma.receiptCostPlan.count({ where: { expenseDocumentId: e.expense.id } }), 1)
})
