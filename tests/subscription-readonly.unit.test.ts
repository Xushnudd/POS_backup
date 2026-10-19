import {test} from 'node:test'
import assert from 'node:assert/strict'
import {Prisma} from '@prisma/client'
import {READ_ONLY_BUSINESS_MODELS,READ_ONLY_EXEMPT_MODELS,READ_ONLY_OPERATION_EXCEPTIONS} from '@/server/billing/read-only-policy'
import {subscriptionPhase} from '@/server/billing/phase'
test('Every model has a reviewed business/read-only exception decision, with no silent new model exemption',()=>{
 const names=[...READ_ONLY_BUSINESS_MODELS,...READ_ONLY_EXEMPT_MODELS,'Operation']
 assert.equal(new Set(names).size,names.length);assert.deepEqual([...names].sort(),Prisma.dmmf.datamodel.models.map(m=>m.name).sort())
 assert.ok(READ_ONLY_BUSINESS_MODELS.includes('Payment'));assert.ok(READ_ONLY_BUSINESS_MODELS.includes('SaleReturn'));assert.ok(READ_ONLY_BUSINESS_MODELS.includes('InventoryBalance'))
 assert.ok(!(READ_ONLY_OPERATION_EXCEPTIONS as readonly string[]).includes('sale.checkout'));assert.ok(READ_ONLY_OPERATION_EXCEPTIONS.includes('billing.payment.confirm'));assert.ok(READ_ONLY_OPERATION_EXCEPTIONS.includes('job.enqueue'))
})
test('Business write entitlement expires exactly at grace end and paid extension restores it',()=>{
 const sub={trialEndsAt:new Date('2026-01-01Z'),paidThrough:null,graceDays:7}
 assert.equal(subscriptionPhase(new Date('2026-01-07T23:59:59.999Z'),sub).businessWritesAllowed,true)
 assert.equal(subscriptionPhase(new Date('2026-01-08Z'),sub).businessWritesAllowed,false)
 assert.equal(subscriptionPhase(new Date('2026-01-09Z'),{...sub,paidThrough:new Date('2026-02-01Z')}).businessWritesAllowed,true)
})
