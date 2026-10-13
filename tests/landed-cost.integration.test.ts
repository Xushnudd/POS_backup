import {POST as applyCostRoute} from '@/app/api/stock-documents/[id]/cost-plans/[planId]/apply/route'
import {POST as applyPreviewRoute} from '@/app/api/stock-documents/[id]/cost-plans/[planId]/application-preview/route'
import {GET as applicationHistoryRoute} from '@/app/api/stock-documents/[id]/cost-plans/[planId]/applications/route'
import {sendTransfer,receiveTransfer,confirmStockDocument} from '@/server/inventory/documents'
import {changePrices} from '@/server/catalog/prices'
import {queryReportsProducts} from '@/server/exports/queries/reports-products'
import {createDraft,completeSale} from '@/server/sales/service'
import {returnSale} from '@/server/returns/service'
import {profitSummary} from '@/server/reports/profit'
import {readProductValuationFacts} from '@/server/inventory/valuation-facts'
import {previewCostApplication,applyReceiptCost} from '@/server/purchases/cost-applications'
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
import { listReceiptCostSources } from '@/server/purchases/receipt-cost-plans'
import { POST as correctionPreview } from '@/app/api/stock-documents/[id]/cost-correction-preview/route'

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
  for (const identity of identities) await clearLimit('receipt-cost-correction-preview', identity)
  for (const identity of identities) await clearLimit('receipt-cost-sources', identity)
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
test('Historical correction API is owner-only, read-only, bounded and rejects forged source fields',async()=>{
 const a=await receipt(),path=`/stock-documents/${a.stock.id}/cost-correction-preview`
 const call=(cookie=a.cookie,body:unknown={amount:'0.03',method:'value'})=>correctionPreview(request(path,cookie,body),{params:Promise.resolve({id:a.stock.id})})
 const before={operations:await prisma.operation.count({where:{organizationId:a.context.organizationId}}),events:await prisma.inventoryValuationEvent.count({where:{organizationId:a.context.organizationId}})}
 const response=await call();assert.equal(response.status,200);assert.match(response.headers.get('cache-control')!,/no-store/)
 const data=(await response.json()).data
 assert.equal(data.previewOnly,true);assert.equal(data.financialPosting,false)
 assert.deepEqual(data.products.map((row:{allocatedAmount:string})=>row.allocatedAmount),['0.01','0.02'])
 assert.ok(data.products.every((row:{cogsCorrection:string;cogsEntries:unknown[]})=>row.cogsCorrection==='0'&&row.cogsEntries.length===0))
 assert.deepEqual({operations:await prisma.operation.count({where:{organizationId:a.context.organizationId}}),events:await prisma.inventoryValuationEvent.count({where:{organizationId:a.context.organizationId}})},before)
 for(const body of [{amount:'0',method:'value'},{amount:'1',method:'value',unitCost:'999'}])assert.equal((await call(a.cookie,body)).status,400)
 const foreign=await account();assert.equal((await call(foreign.cookie)).status,404)
 await prisma.organizationUser.update({where:{id:a.context.organizationUserId},data:{role:'admin'}})
 assert.equal((await call()).status,403)
 await prisma.session.update({where:{id:a.context.sessionId},data:{revokedAt:new Date()}})
 assert.equal((await call()).status,401)
})
test('Receipt cost sources list only same-branch unassigned unreversed capitalised expenses and preserve original money',async()=>{
 const a=await receipt(),e=await capitalisedExpense(a)
 const before=await prisma.accountEntry.count({where:{organizationId:a.context.organizationId}})
 const source=await listReceiptCostSources(a.context,a.stock.id,{search:'freight',page:1})
 assert.equal(source.total,1);assert.equal(source.rows[0].id,e.expense.id);assert.equal(source.rows[0].amount,'12.01')
 assert.equal((await listReceiptCostSources(a.context,a.stock.id,{search:e.expense.id,page:1})).total,1)
 assert.equal((await listReceiptCostSources(a.context,a.stock.id,{search:'not matching',page:1})).total,0)
 assert.equal((await listReceiptCostSources(a.context,a.stock.id,{page:2})).rows.length,0)
 const plan=await prepareReceiptCost(a.context,a.stock.id,{operationId:randomUUID(),expenseDocumentId:e.expense.id,amount:'12.01',method:'value',reason:'Selected original expense'})
 assert.equal((await listReceiptCostSources(a.context,a.stock.id,{})).total,0)
 await cancelReceiptCost(a.context,a.stock.id,plan.id,{operationId:randomUUID(),reason:'Unassign original expense'})
 assert.equal((await listReceiptCostSources(a.context,a.stock.id,{})).total,1)
 assert.equal(await prisma.accountEntry.count({where:{organizationId:a.context.organizationId}}),before)
 const foreign=await account();await assert.rejects(listReceiptCostSources(foreign.context,a.stock.id,{}),{code:'NOT_FOUND'})
 await assert.rejects(listReceiptCostSources({...a.context,role:'cashier'},a.stock.id,{}),{code:'MANAGER_REQUIRED'})
 await assert.rejects(listReceiptCostSources(a.context,a.stock.id,{page:0}))
 await reverseFinancialDocument(a.context,e.expense.id,{operationId:randomUUID(),reason:'Reverse original freight',shifts:{}})
 assert.equal((await listReceiptCostSources(a.context,a.stock.id,{})).total,0)
})
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

test('Actual late-cost application and reversal preserve source documents and cash, original key replays once',async()=>{
 const a=await receipt(),fee=await capitalisedExpense(a)
 const plan=await prepareReceiptCost(a.context,a.stock.id,{operationId:randomUUID(),expenseDocumentId:fee.expense.id,amount:'12.01',method:'value',reason:'Confirmed freight allocation'})
 const before=await prisma.financialDocument.count({where:{organizationId:a.context.organizationId}})
 const preview=await previewCostApplication(a.context,plan.id)
 const input={operationId:randomUUID(),expectedHash:preview.expectedHash,reason:'Apply real paid freight'}
 const applied=await applyReceiptCost(a.context,plan.id,input)
 assert.equal(applied.financialPosting,true)
 assert.deepEqual(await applyReceiptCost(a.context,plan.id,input),JSON.parse(JSON.stringify(applied)))
 assert.equal(await prisma.receiptCostApplication.count({where:{planId:plan.id}}),1)
 assert.equal(await prisma.financialDocument.count({where:{organizationId:a.context.organizationId}}),before)
 assert.ok((await prisma.stockDocumentItem.findMany({where:{stockDocumentId:a.stock.id}})).every(row=>row.unitCost.eq(2)))
 await assert.rejects(previewCostApplication(a.context,plan.id),{code:'COST_ALREADY_APPLIED'})
 await assert.rejects(previewCostApplication({...a.context,role:'admin'},plan.id),{code:'OWNER_REQUIRED'})
 await assert.rejects(prisma.receiptCostApplication.update({where:{id:applied.id},data:{reason:'Rewrite history'}}))
 const reversal=await previewCostApplication(a.context,plan.id,applied.id)
 await applyReceiptCost(a.context,plan.id,{operationId:randomUUID(),expectedHash:reversal.expectedHash,reason:'Reverse applied freight'},applied.id)
 assert.equal(await prisma.receiptCostApplication.count({where:{planId:plan.id}}),2)
 for(const product of a.products)assert.equal((await prisma.product.findUniqueOrThrow({where:{id:product.id}})).costPrice.toFixed(),'2')
})

test('Late cost keeps original sale cost, uses corrected return cost and reports dated corrections exactly once',async()=>{
 const a=await receipt(),fee=await capitalisedExpense(a)
 const register=await prisma.register.create({data:{storeId:a.store.id,name:'Cost register',code:randomUUID()}})
 const shift=await prisma.shift.create({data:{registerId:register.id,organizationUserId:a.context.organizationUserId,openingCash:0}})
 const draft=await createDraft(a.context,{organizationId:a.context.organizationId,storeId:a.store.id,registerId:register.id,shiftId:shift.id,items:[{productId:a.products[0].id,quantity:'1',discountAmount:0}],discountAmount:0},randomUUID())
 const sale=await completeSale(a.context,draft.id,{payments:[{paymentType:'cash',amount:String(draft.totalAmount)}]},draft.id)
 const plan=await prepareReceiptCost(a.context,a.stock.id,{operationId:randomUUID(),expenseDocumentId:fee.expense.id,amount:'12.01',method:'value',reason:'Freight with actual sale'})
 const preview=await previewCostApplication(a.context,plan.id)
 const applied=await applyReceiptCost(a.context,plan.id,{operationId:randomUUID(),expectedHash:preview.expectedHash,reason:'Apply freight after sale'})
 const report=()=>prisma.$transaction(tx=>profitSummary(tx,a.context,new URLSearchParams()))
 const first=await report()
 assert.equal(first.summary.cogs.toFixed(2),'4.00')
 const productsReport=await queryReportsProducts(a.context,new NextRequest('http://localhost:3000/api/reports/products'))
 const productsData=await productsReport.json()
 assert.equal(new (await import('@prisma/client')).Prisma.Decimal(productsData.summary.cost).toFixed(2),'4.00')
 const csvReport=await queryReportsProducts(a.context,new NextRequest('http://localhost:3000/api/reports/products?format=csv'))
 assert.equal(csvReport.status,200)
 assert.equal(new (await import('@prisma/client')).Prisma.Decimal((await csvReport.json()).data.summary.cost).toFixed(2),'4.00')
 assert.equal((await prisma.saleItem.findUniqueOrThrow({where:{id:sale.items[0].id}})).unitCost.toFixed(),'2')
 const returned=await returnSale(a.context,sale.id,{operationId:randomUUID(),shiftId:shift.id,reason:'Actual return after freight',items:[{saleItemId:sale.items[0].id,quantity:'1',disposition:'sellable'}]})
 assert.equal(new (await import('@prisma/client')).Prisma.Decimal(String(returned.items[0].unitCostSnapshot)).toFixed(),new (await import('@prisma/client')).Prisma.Decimal(preview.products.find(row=>row.productId===a.products[0].id)!.afterAverageCost).toFixed())
 assert.equal(returned.items[0].costApplicationId,applied.id)
 assert.equal((await report()).summary.cogs.toFixed(2),'0.00')
 await prisma.$transaction(tx=>readProductValuationFacts(tx,a.context,a.products[0].id))
 const reverse=await previewCostApplication(a.context,plan.id,applied.id)
 await applyReceiptCost(a.context,plan.id,{operationId:randomUUID(),expectedHash:reverse.expectedHash,reason:'Reverse after linked return'},applied.id)
 assert.equal((await report()).summary.cogs.toFixed(2),'0.00')
 assert.equal((await prisma.product.findUniqueOrThrow({where:{id:a.products[0].id}})).costPrice.toFixed(),'2')
})

test('Repeated fees and selective reversal retain independent paid sources and reconcile latest cost',async()=>{
 const a=await receipt(),fee=await capitalisedExpense(a)
 const prepare=async(expenseDocumentId:string,amount:string)=>prepareReceiptCost(a.context,a.stock.id,{operationId:randomUUID(),expenseDocumentId,amount,method:'value',reason:'Independent paid expense'})
 const apply=async(planId:string,reversalOfId?:string)=>{const preview=await previewCostApplication(a.context,planId,reversalOfId);return applyReceiptCost(a.context,planId,{operationId:randomUUID(),expectedHash:preview.expectedHash,reason:'Reviewed exact correction'},reversalOfId)}
 const first=await prepare(fee.expense.id,'12.01'),one=await apply(first.id)
 const secondExpense=await postExpense(a.context,{operationId:randomUUID(),accountId:fee.account.id,expenseCategoryId:fee.category.id,amount:'2',reason:'Second independent paid expense'})
 const second=await prepare(secondExpense.id,'2'),two=await apply(second.id)
 await apply(first.id,one.id)
 for(const product of a.products)assert.equal((await prisma.product.findUniqueOrThrow({where:{id:product.id}})).costPrice.toFixed(),'2.333333')
 await apply(second.id,two.id)
 for(const product of a.products)assert.equal((await prisma.product.findUniqueOrThrow({where:{id:product.id}})).costPrice.toFixed(),'2')
 assert.equal(await prisma.receiptCostApplication.count({where:{organizationId:a.context.organizationId}}),4)
})
test('Stale confirmation and late audit failure roll back cost, native events and posting before exact retry',async()=>{
 const a=await receipt(),fee=await capitalisedExpense(a)
 const plan=await prepareReceiptCost(a.context,a.stock.id,{operationId:randomUUID(),expenseDocumentId:fee.expense.id,amount:'12.01',method:'value',reason:'Rollback cost posting'})
 const preview=await previewCostApplication(a.context,plan.id),input={operationId:randomUUID(),expectedHash:preview.expectedHash,reason:'Fault injection acceptance'}
 await assert.rejects(applyReceiptCost(a.context,plan.id,{...input,expectedHash:'0'.repeat(64)}),{code:'COST_PREVIEW_CHANGED'})
 const count=await prisma.inventoryValuationEvent.count({where:{organizationId:a.context.organizationId}})
 const trigger='cost_apply_audit_'+randomUUID().replaceAll('-','')
 await prisma.$executeRawUnsafe(`CREATE FUNCTION ${trigger}() RETURNS trigger LANGUAGE plpgsql AS $$ BEGIN IF NEW."organizationId"='${a.context.organizationId}' THEN RAISE EXCEPTION 'test-only posting audit failure'; END IF; RETURN NEW; END $$`)
 await prisma.$executeRawUnsafe(`CREATE TRIGGER ${trigger} BEFORE INSERT ON "AuditLog" FOR EACH ROW EXECUTE FUNCTION ${trigger}()`)
 try{
  await assert.rejects(applyReceiptCost(a.context,plan.id,input))
  assert.equal(await prisma.receiptCostApplication.count({where:{planId:plan.id}}),0)
  assert.equal(await prisma.inventoryValuationEvent.count({where:{organizationId:a.context.organizationId}}),count)
  assert.equal(await prisma.operation.count({where:{organizationId:a.context.organizationId,key:input.operationId}}),0)
  for(const product of a.products)assert.equal((await prisma.product.findUniqueOrThrow({where:{id:product.id}})).costPrice.toFixed(),'2')
 }finally{await prisma.$executeRawUnsafe(`DROP TRIGGER ${trigger} ON "AuditLog"`);await prisma.$executeRawUnsafe(`DROP FUNCTION ${trigger}()`)}
 const outcomes=await Promise.all([applyReceiptCost(a.context,plan.id,input),applyReceiptCost(a.context,plan.id,input)])
 assert.equal(outcomes[0].id,outcomes[1].id)
 assert.equal(await prisma.receiptCostApplication.count({where:{planId:plan.id}}),1)
})

async function appliedFixture(){
 const a=await receipt(),fee=await capitalisedExpense(a)
 const plan=await prepareReceiptCost(a.context,a.stock.id,{operationId:randomUUID(),expenseDocumentId:fee.expense.id,amount:'12.01',method:'value',reason:'Future source fixture'})
 const preview=await previewCostApplication(a.context,plan.id)
 await applyReceiptCost(a.context,plan.id,{operationId:randomUUID(),expectedHash:preview.expectedHash,reason:'Actual freight source'})
 return {...a,fee,plan,preview}
}
test('Future owner absolute cost override journals displaced freight in original expense branch without changing old documents',async()=>{
 const a=await appliedFixture(),product=a.products[0]
 const current=await prisma.product.findUniqueOrThrow({where:{id:product.id}})
 const input={operationId:randomUUID(),field:'costPrice' as const,reason:'Actual absolute cost decision',preview:true,items:[{productId:product.id,expected:current.costPrice.toFixed(),value:'1'}]}
 const confirmation=await changePrices(a.context,input)
 await changePrices(a.context,{...input,preview:false,confirmationHash:confirmation.confirmationHash})
 const entries=await prisma.receiptCostContinuation.findMany({where:{productId:product.id}})
 assert.equal(entries.length,1);assert.equal(entries[0].storeId,a.store.id)
 const allocated=a.preview.products.find(row=>row.productId===product.id)!
 assert.equal(entries[0].varianceCorrection.add(allocated.roundingCorrection).toFixed(),new (await import('@prisma/client')).Prisma.Decimal(allocated.allocatedAmount).toFixed())
 assert.equal((await prisma.stockDocumentItem.findUniqueOrThrow({where:{id:allocated.stockDocumentItemId}})).unitCost.toFixed(),'2')
 await assert.rejects(prisma.receiptCostContinuation.update({where:{id:entries[0].id},data:{varianceCorrection:0}}))
 await prisma.$transaction(tx=>readProductValuationFacts(tx,a.context,product.id))
})
test('Future stock loss books only its freight share and leaves unrelated SKU valuation untouched',async()=>{
 const a=await appliedFixture(),product=a.products[0],current=await prisma.product.findUniqueOrThrow({where:{id:product.id}})
 const doc=await prisma.stockDocument.create({data:{organizationId:a.context.organizationId,storeId:a.store.id,documentType:'adjustment',documentNo:randomUUID(),createdBy:a.context.userId,items:{create:{productId:product.id,quantity:'-1',unitCost:current.costPrice}}}})
 await confirmStockDocument(a.context,doc.id)
 const entries=await prisma.receiptCostContinuation.findMany({where:{productId:product.id}})
 assert.equal(entries.length,1)
 const allocated=a.preview.products.find(row=>row.productId===product.id)!
 assert.equal(entries[0].varianceCorrection.toFixed(),new (await import('@prisma/client')).Prisma.Decimal(allocated.afterAverageCost).sub(2).toFixed())
 assert.equal((await prisma.inventoryBalance.findUniqueOrThrow({where:{storeId_productId:{storeId:a.store.id,productId:product.id}}})).quantity.toFixed(),'2')
 const other=a.products[1];assert.equal(await prisma.receiptCostContinuation.count({where:{productId:other.id}}),0)
})
test('Late continuation failure rolls back the originating price operation and exact retry posts once',async()=>{
 const a=await appliedFixture(),product=a.products[0],current=await prisma.product.findUniqueOrThrow({where:{id:product.id}})
 const input={operationId:randomUUID(),field:'costPrice' as const,reason:'Atomic future valuation',preview:true,items:[{productId:product.id,expected:current.costPrice.toFixed(),value:'1'}]}
 const review=await changePrices(a.context,input),confirmed={...input,preview:false,confirmationHash:review.confirmationHash}
 const before=await prisma.inventoryValuationEvent.count({where:{organizationId:a.context.organizationId}})
 const trigger='continuation_fault_'+randomUUID().replaceAll('-','')
 await prisma.$executeRawUnsafe(`CREATE FUNCTION ${trigger}() RETURNS trigger LANGUAGE plpgsql AS $$ BEGIN IF NEW."organizationId"='${a.context.organizationId}' THEN RAISE EXCEPTION 'test-only continuation fault'; END IF; RETURN NEW; END $$`)
 await prisma.$executeRawUnsafe(`CREATE TRIGGER ${trigger} BEFORE INSERT ON "ReceiptCostContinuation" FOR EACH ROW EXECUTE FUNCTION ${trigger}()`)
 try{
  await assert.rejects(changePrices(a.context,confirmed))
  assert.equal((await prisma.product.findUniqueOrThrow({where:{id:product.id}})).costPrice.toFixed(),current.costPrice.toFixed())
  assert.equal(await prisma.receiptCostContinuation.count({where:{productId:product.id}}),0)
  assert.equal(await prisma.inventoryValuationEvent.count({where:{organizationId:a.context.organizationId}}),before)
  assert.equal(await prisma.operation.count({where:{organizationId:a.context.organizationId,key:input.operationId}}),0)
 }finally{await prisma.$executeRawUnsafe(`DROP TRIGGER ${trigger} ON "ReceiptCostContinuation"`);await prisma.$executeRawUnsafe(`DROP FUNCTION ${trigger}()`)}
 await changePrices(a.context,confirmed);await changePrices(a.context,confirmed)
 assert.equal(await prisma.receiptCostContinuation.count({where:{productId:product.id}}),1)
 assert.equal(await prisma.operation.count({where:{organizationId:a.context.organizationId,key:input.operationId}}),1)
})
test('Future stale-draft transfer freezes active-fee cost at send and receiving after new purchase records original-branch variance once',async()=>{
 const a=await appliedFixture(),product=a.products[0],other=await prisma.store.create({data:{organizationId:a.context.organizationId,name:'Future transfer branch'}})
 const transfer=await prisma.stockTransfer.create({data:{organizationId:a.context.organizationId,fromStoreId:a.store.id,toStoreId:other.id,createdBy:a.context.userId,items:{create:{productId:product.id,quantity:1,unitCost:2}}},include:{items:true}})
 const sent=await sendTransfer(a.context,transfer.id)
 assert.equal(String(sent.items[0].unitCost),'2')
 assert.equal(String(sent.items[0].issueUnitCostSnapshot),new (await import('@prisma/client')).Prisma.Decimal(a.preview.products.find(row=>row.productId===product.id)!.afterAverageCost).toFixed())
 const supplier=await prisma.supplier.create({data:{organizationId:a.context.organizationId,name:'Later purchase supplier'}})
 const order=await createPurchaseOrder(a.context,{operationId:randomUUID(),storeId:other.id,supplierId:supplier.id,referenceNo:randomUUID(),reason:'Real later purchase',items:[{productId:product.id,quantity:'1',unitCost:'8'}]})
 await receivePurchaseOrder(a.context,order.id,{operationId:randomUUID(),referenceNo:randomUUID(),reason:'Receive later purchase',items:[{orderItemId:order.items[0].id,quantity:'1'}]})
 const input={operationId:randomUUID(),items:[{itemId:transfer.items[0].id,quantity:'1'}]}
 await receiveTransfer(a.context,transfer.id,input)
 const count=await prisma.receiptCostContinuation.count({where:{productId:product.id}})
 await receiveTransfer(a.context,transfer.id,input)
 assert.equal(await prisma.receiptCostContinuation.count({where:{productId:product.id}}),count)
 const report=await prisma.$transaction(tx=>profitSummary(tx,a.context,new URLSearchParams({storeId:a.store.id})))
 assert.equal(report.summary.inventoryValueVariance.toFixed(2),'0.67')
 assert.equal((await prisma.$transaction(tx=>profitSummary(tx,a.context,new URLSearchParams({storeId:other.id})))).summary.inventoryValueVariance.toFixed(2),'0.00')
 await prisma.$transaction(tx=>readProductValuationFacts(tx,a.context,product.id))
})
test('Future write-off already records effective issue cost and does not expense freight twice; fee reversal restores base profit',async()=>{
 const a=await appliedFixture(),register=await prisma.register.create({data:{storeId:a.store.id,name:'Future writeoff register',code:randomUUID()}}),shift=await prisma.shift.create({data:{registerId:register.id,organizationUserId:a.context.organizationUserId,openingCash:0}})
 const draft=await createDraft(a.context,{organizationId:a.context.organizationId,storeId:a.store.id,registerId:register.id,shiftId:shift.id,items:[{productId:a.products[0].id,quantity:'1',discountAmount:0}],discountAmount:0},randomUUID())
 const sale=await completeSale(a.context,draft.id,{payments:[{paymentType:'cash',amount:String(draft.totalAmount)}]},draft.id)
 await returnSale(a.context,sale.id,{operationId:randomUUID(),shiftId:shift.id,reason:'Actual damaged loss',items:[{saleItemId:sale.items[0].id,quantity:'1',disposition:'write_off'}]})
 const report=()=>prisma.$transaction(tx=>profitSummary(tx,a.context,new URLSearchParams()))
 const after=await report();assert.equal(after.summary.cogs.toFixed(2),'0.00');assert.equal(after.summary.inventoryValueVariance.toFixed(2),'0.00');assert.equal(after.summary.inventoryWriteOff.toFixed(2),'4.00')
 const app=await prisma.receiptCostApplication.findFirstOrThrow({where:{planId:a.plan.id,reversalOfId:null}}),preview=await previewCostApplication(a.context,a.plan.id,app.id)
 await applyReceiptCost(a.context,a.plan.id,{operationId:randomUUID(),expectedHash:preview.expectedHash,reason:'Reverse freight after writeoff'},app.id)
 assert.equal((await report()).summary.operatingExpenses.toFixed(2),'2.00')
})

test('Application endpoints bind tenant, original receipt path, owner role, strict input and paginated source journal',async()=>{
 const a=await receipt(),fee=await capitalisedExpense(a)
 const plan=await prepareReceiptCost(a.context,a.stock.id,{operationId:randomUUID(),expenseDocumentId:fee.expense.id,amount:'12.01',method:'value',reason:'Owner API source'})
 const path=`/stock-documents/${a.stock.id}/cost-plans/${plan.id}`,params={params:Promise.resolve({id:a.stock.id,planId:plan.id})}
 const previewResponse=await applyPreviewRoute(request(path+'/application-preview',a.cookie,{}),params)
 assert.equal(previewResponse.status,200);assert.match(previewResponse.headers.get('cache-control')!,/no-store/)
 const preview=(await previewResponse.json()).data
 assert.ok(preview.products.every((row:Record<string,unknown>)=>!('issueCosts' in row)&&!('cogsEntries' in row)))
 const input={operationId:randomUUID(),expectedHash:preview.expectedHash,reason:'Review actual original receipt'}
 assert.equal((await applyCostRoute(request(path+'/apply',a.cookie,{...input,amount:'999'}),params)).status,400)
 const foreign=await account()
 assert.equal((await applyCostRoute(request(path+'/apply',foreign.cookie,input),params)).status,404)
 assert.equal((await applyCostRoute(request(path+'/apply',a.cookie,input),{params:Promise.resolve({id:randomUUID(),planId:plan.id})})).status,404)
 const applied=await applyCostRoute(request(path+'/apply',a.cookie,input),params);assert.equal(applied.status,200)
 const history=await applicationHistoryRoute(new NextRequest('http://localhost:3000/api'+path+'/applications',{headers:{cookie:a.cookie}}),params)
 assert.equal(history.status,200);const data=(await history.json()).data;assert.equal(data.applications.length,1);assert.equal(data.applications[0].products.length,2);assert.equal(data.total,0)
 await prisma.organizationUser.update({where:{id:a.context.organizationUserId},data:{role:'admin'}})
 assert.equal((await applyPreviewRoute(request(path+'/application-preview',a.cookie,{}),params)).status,403)
})
test('Atomic exchange of a fee-bearing unit continues the original dated cost ledger without double freight',async()=>{
 const {previewExchange,postExchange}=await import('@/server/returns/exchanges'),a=await appliedFixture(),register=await prisma.register.create({data:{storeId:a.store.id,name:'Freight exchange register',code:randomUUID()}}),shift=await prisma.shift.create({data:{registerId:register.id,organizationUserId:a.context.organizationUserId,openingCash:0}})
 const draft=await createDraft(a.context,{organizationId:a.context.organizationId,storeId:a.store.id,registerId:register.id,shiftId:shift.id,items:[{productId:a.products[0].id,quantity:'1',discountAmount:0}],discountAmount:0},randomUUID()),sale=await completeSale(a.context,draft.id,{payments:[{paymentType:'cash',amount:'10'}]},randomUUID())
 const input={originalSaleId:sale.id,shiftId:shift.id,reason:'Actual fee-bearing same-SKU exchange',items:[{saleItemId:sale.items[0].id,quantity:'1',disposition:'sellable' as const}],replacement:{discountAmount:0,items:[{productId:a.products[0].id,quantity:'1',discountAmount:0}]},creditAmount:0},review=await previewExchange(a.context,input),posted={...input,operationId:randomUUID(),confirmationHash:review.confirmationHash,cashTendered:0}
 await postExchange(a.context,posted);await postExchange(a.context,posted)
 const report=await prisma.$transaction(tx=>profitSummary(tx,a.context,new URLSearchParams()))
 assert.equal(report.summary.inventoryValueVariance.toFixed(2),'0.00');assert.equal(report.summary.cogs.toFixed(2),'4.00')
 await prisma.$transaction(tx=>readProductValuationFacts(tx,a.context,a.products[0].id))
})
