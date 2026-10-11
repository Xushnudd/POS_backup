import test from 'node:test'
import assert from 'node:assert/strict'
import {stepUpBinding, requestStepUp} from '../src/lib/step-up'
test('Critical step-up accepts only bounded server action/key/hash binding and is unavailable without a browser', async () => {
  const value = {action: 'retention.closure.request', operationKey: '00000000-0000-4000-8000-000000000000', payloadHash: 'a'.repeat(64)}
  assert.deepEqual(stepUpBinding(value), value)
  for (const invalid of [null, {}, {...value, action: '../admin'}, {...value, action: 'a'.repeat(82)}, {...value, operationKey: 'bad'}, {...value, payloadHash: 'bad'}]) assert.equal(stepUpBinding(invalid), null)
  assert.equal(await requestStepUp(value), false)
})
