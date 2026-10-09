import { test } from 'node:test'
import assert from 'node:assert/strict'
import { allocateLandedCost } from '@/server/purchases/landed-cost'
import { decimal } from '@/server/sales/calculations'

const ids = [1, 2, 3].map(n => `00000000-0000-4000-8000-${String(n).padStart(12, '0')}`)
const lines = ids.map(id => ({ id, quantity: '3', unitCost: '2', unit: 'dona' }))
test('Value allocation conserves cents; canonical last positive row closes residual', () => {
  const result = allocateLandedCost({ amount: '0.02', method: 'value', lines })
  assert.deepEqual(result.lines.map(line => line.allocatedAmount), ['0.00', '0.00', '0.02'])
  assert.deepEqual(allocateLandedCost({ amount: '0.02', method: 'value', lines: [...lines].reverse() }), result)
  for (const line of result.lines) {
    const represented = decimal(line.landedUnitCost).sub(line.unitCost).mul(line.quantity)
    assert.equal(represented.add(line.roundingResidual).toFixed(2), line.allocatedAmount)
  }
  assert.equal(result.lines[2].roundingResidual, '-0.000001')
})
test('Quantity and kg snapshot weights differ and zero value rows get no cents', () => {
  const receipt = [
    { ...lines[0], quantity: '2', unitCost: '0', unitWeightKg: '3' },
    { ...lines[1], quantity: '4', unitCost: '5', unitWeightKg: '0.5' },
  ]
  assert.deepEqual(allocateLandedCost({ amount: '12', method: 'quantity', lines: receipt }).lines.map(x => x.allocatedAmount), ['4.00', '8.00'])
  assert.deepEqual(allocateLandedCost({ amount: '12', method: 'weight', lines: receipt }).lines.map(x => x.allocatedAmount), ['9.00', '3.00'])
  assert.deepEqual(allocateLandedCost({ amount: '12', method: 'value', lines: receipt }).lines.map(x => x.allocatedAmount), ['0.00', '12.00'])
})
test('Invalid inputs, mixed quantity units, missing weight and zero denominator fail closed', () => {
  for (const amount of ['-1', '1.001', '1e2', 'NaN', 'Infinity', '1000000000000', ' 1', '01'])
    assert.throws(() => allocateLandedCost({ amount, method: 'quantity', lines }))
  for (const quantity of ['0', '-1', '0.0000001', '1e-6'])
    assert.throws(() => allocateLandedCost({ amount: '1', method: 'quantity', lines: [{ ...lines[0], quantity }] }))
  assert.throws(() => allocateLandedCost({ amount: '1', method: 'quantity', lines: [lines[0], lines[0]] }))
  assert.throws(() => allocateLandedCost({ amount: '1', method: 'quantity', lines: [lines[0], { ...lines[1], unit: 'kg' }] }))
  assert.throws(() => allocateLandedCost({ amount: '1', method: 'weight', lines }))
  for (const amount of ['0', '1'])
    assert.throws(() => allocateLandedCost({ amount, method: 'value', lines: [{ ...lines[0], unitCost: '0' }] }), /LANDED_COST_ZERO_DENOMINATOR/)
  assert.throws(() => allocateLandedCost({ amount: '1', method: 'quantity', lines: [] }))
  assert.throws(() => allocateLandedCost({ amount: '1', method: 'quantity', lines: Array.from({ length: 201 }, () => lines[0]) }))
})
test('Large exact integer ratios never pass through floating point', () => {
  const result = allocateLandedCost({ amount: '999999999999.99', method: 'value', lines: [
    { ...lines[0], quantity: '999999999999.999999', unitCost: '999999999999.999999' },
    { ...lines[1], quantity: '0.000001', unitCost: '0.000001' },
  ] })
  assert.equal(result.lines[0].allocatedAmount, '999999999999.98')
  assert.equal(result.lines[1].allocatedAmount, '0.01')
  assert.equal(result.lines.reduce((sum, line) => sum.add(line.allocatedAmount), decimal(0)).toFixed(2), result.amount)
})
test('Deterministic fractional receipts conserve every cent over many allocation inputs', () => {
  for (let i = 0; i < 200; i++) {
    const amount = decimal(i).div(100).toFixed(2)
    const receipt = lines.map((line, index) => ({ ...line, quantity: decimal(i + index + 1).div(1000000).toFixed(6), unitCost: String(index) }))
    const result = allocateLandedCost({ amount, method: 'value', lines: receipt })
    assert.equal(result.lines.reduce((sum, line) => sum.add(line.allocatedAmount), decimal(0)).toFixed(2), amount)
    assert.ok(result.lines.every(line => decimal(line.allocatedAmount).gte(0)))
  }
})
