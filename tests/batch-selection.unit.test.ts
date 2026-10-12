import { test } from 'node:test';
import assert from 'node:assert/strict';
import { selectFefo, inventoryBusinessDate, batchExpiryState, batchDate } from '@/server/inventory/batch-selection';
const ids = [1, 2, 3, 4].map(id => `00000000-0000-4000-8000-${String(id).padStart(12, '0')}`);
const batch = (id: string, expiresOn: string | null, availableQuantity = '1') => ({ id, expiresOn, availableQuantity, receivedOn: '2026-10-01' });
test('FEFO splits exact fractional quantities, excludes expired/unknown dates and has stable equal-expiry ordering', () => {
  const batches = [batch(ids[3], null, '100'), batch(ids[2], '2026-10-11', '100'), batch(ids[1], '2026-10-13', '1.000001'), batch(ids[0], '2026-10-12', '0.000001')];
  const result = selectFefo({ today: '2026-10-12', quantity: '1.000002', batches });
  assert.deepEqual(result.allocations, [{ batchId: ids[0], quantity: '0.000001' }, { batchId: ids[1], quantity: '1.000001' }]);
  assert.deepEqual(selectFefo({ today: '2026-10-12', quantity: '1.000002', batches: [...batches].reverse() }), result);
  assert.equal(batches[0].availableQuantity, '100');
  assert.deepEqual(selectFefo({ today: '2026-10-12', quantity: '1', batches: [batch(ids[1], '2026-10-13'), batch(ids[0], '2026-10-13')] }).allocations, [{ batchId: ids[0], quantity: '1.000000' }]);
});
test('Insufficient valid stock returns no partial allocation; unknown expiry needs an explicit nonperishable policy', () => {
  assert.throws(() => selectFefo({ today: '2026-10-12', quantity: '2', batches: [batch(ids[0], '2026-10-12')] }), { code: 'INSUFFICIENT_VALID_BATCH_STOCK' });
  assert.throws(() => selectFefo({ today: '2026-10-12', quantity: '1', batches: [batch(ids[0], null)] }), { code: 'INSUFFICIENT_VALID_BATCH_STOCK' });
  assert.equal(selectFefo({ today: '2026-10-12', quantity: '1', expiryRequired: false, batches: [batch(ids[0], null)] }).allocations[0].batchId, ids[0]);
  assert.throws(() => selectFefo({ today: '2026-10-12', quantity: '1', batches: [{ ...batch(ids[0], '2026-10-20'), receivedOn: '2026-10-13' }] }), { code: 'INSUFFICIENT_VALID_BATCH_STOCK' });
});
test('Calendar, duplicate, precision and range validation reject ambiguous inventory inputs', () => {
  for (const date of ['2026-02-29', '2026-04-31', '2026-13-01', '2026-10-12T00:00:00Z', '12/10/2026']) assert.equal(batchDate.safeParse(date).success, false);
  assert.equal(batchDate.parse('2028-02-29'), '2028-02-29');
  for (const quantity of ['0', '-1', '1e2', 'NaN', '01', '0.0000001', '100000000000000']) assert.throws(() => selectFefo({ today: '2026-10-12', quantity, batches: [] }));
  assert.throws(() => selectFefo({ today: '2026-10-12', quantity: '1', batches: [batch(ids[0], null), batch(ids[0], null)] }));
  assert.throws(() => selectFefo({ today: '2026-10-12', quantity: '1', batches: [batch(ids[0], '2026-10-20', '-1')] }));
});
test('Business-day expiry includes today, alert cutoff is inclusive and midnight follows organization timezone', () => {
  const before = inventoryBusinessDate(new Date('2026-10-11T18:59:59Z'), 'Asia/Tashkent');
  const after = inventoryBusinessDate(new Date('2026-10-11T19:00:00Z'), 'Asia/Tashkent');
  assert.equal(before, '2026-10-11'); assert.equal(after, '2026-10-12');
  assert.equal(batchExpiryState('2026-10-11', after, 7), 'expired');
  assert.equal(batchExpiryState(after, after, 0), 'due_soon');
  assert.equal(batchExpiryState('2026-10-19', after, 7), 'due_soon');
  assert.equal(batchExpiryState('2026-10-20', after, 7), 'valid');
  assert.equal(batchExpiryState(null, after, 7), 'unknown');
  assert.throws(() => inventoryBusinessDate(new Date('invalid'), 'Asia/Tashkent'));
  assert.throws(() => inventoryBusinessDate(new Date(), 'Invalid/Timezone'));
  assert.throws(() => batchExpiryState(after, after, -1));
  assert.equal(batchExpiryState('9999-12-31', '9999-12-30', 7), 'due_soon');
});
test('Large six-place inventory amounts do not lose a micro-unit through binary floating point', () => {
  const result = selectFefo({ today: '2026-10-12', quantity: '99999999999999.999999', batches: [batch(ids[0], '2026-10-13', '99999999999999.999998'), batch(ids[1], '2026-10-14', '0.000001')] });
  assert.deepEqual(result.allocations.map(value => value.quantity), ['99999999999999.999998', '0.000001']);
});

test('Known expiry sorts before unknown even on the maximum calendar date',()=>{
 const result=selectFefo({today:'2026-10-12',quantity:'1',expiryRequired:false,batches:[batch(ids[0],null),batch(ids[1],'9999-12-31')]});
 assert.equal(result.allocations[0].batchId,ids[1]);
});
