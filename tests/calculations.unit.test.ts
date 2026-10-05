import { test } from 'node:test'
import assert from 'node:assert/strict'
import { draftTotals, lineTotal, money } from '@/server/sales/calculations'
import { assertRoutePermission, tenantScope } from '@/server/auth/policy'

test('Decimal rounding and discounted fractional sale avoid floating errors', () => {
  assert.equal(money('1.005').toString(), '1.01')
  assert.equal(lineTotal('0.3','0.1').toString(),'0.03')
  const totals=draftTotals([{quantity:'2',unitPrice:'10000',discountAmount:'1000'}],'500')
  assert.equal(totals.totalAmount.toString(),'18500')
})
test('Zero receipt discount replaces old discount; excessive discount is rejected',()=>{
  assert.equal(draftTotals([{quantity:1,unitPrice:100,discountAmount:0}],0).totalAmount.toString(),'100')
  assert.throws(()=>draftTotals([{quantity:1,unitPrice:100,discountAmount:101}],0))
  assert.throws(()=>lineTotal(-1,100))
})
test('Cashier scope contains tenant, assigned stores and own sales',()=>{
  const c={userId:'u',organizationId:'a',organizationUserId:'m',role:'cashier',storeIds:['s'],sessionId:'x'}
  assert.deepEqual(tenantScope('Sale',c),{organizationId:'a',store:{organizationId:'a',id:{in:['s']}},cashierId:'u'})
  assert.throws(()=>assertRoutePermission('/api/reports/sales','GET','cashier'))
  assert.throws(()=>assertRoutePermission('/api/products','POST','cashier'))
  assertRoutePermission('/api/sales','POST','cashier')
})

test('Receipt allocations conserve every cent with stable ties', async()=>{
 const {allocateMoney}=await import('@/server/sales/calculations')
 const result=allocateMoney('0.01',[{id:'b',weight:1},{id:'a',weight:1},{id:'c',weight:1}])
 assert.equal(result.a.toString(),'0.01');assert.equal(result.b.toString(),'0');assert.equal(result.c.toString(),'0')
})

test('Tashkent date range includes whole last day and rejects invalid date',async()=>{
 const {dateRange}=await import('@/server/reports/dates')
 const range=dateRange('2026-10-05','2026-10-05','Asia/Tashkent')
 assert.equal(range.gte?.toISOString(),'2026-10-04T19:00:00.000Z')
 assert.equal(range.lt?.toISOString(),'2026-10-05T19:00:00.000Z')
 assert.throws(()=>dateRange('2026-02-30',null,'Asia/Tashkent'))
})
