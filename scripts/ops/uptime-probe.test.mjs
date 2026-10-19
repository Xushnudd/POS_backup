import { test } from 'node:test'
import assert from 'node:assert/strict'
import { probe } from './uptime-probe.mjs'
test('Independent probe fails closed on outage, malformed/oversized body and redirects; emits no response secrets', async () => {
  const ready = await probe('http://127.0.0.1:3000', async (_, options) => {
    assert.equal(options.redirect, 'error'); assert.ok(options.signal)
    return Response.json({ status: 'ready' })
  })
  assert.equal(ready.ready, true)
  for (const response of [Response.json({ status: 'unavailable' }, { status: 503 }), new Response('secret-token'), new Response('x'.repeat(1025))]) {
    const result = await probe('https://example.invalid', async () => response)
    assert.equal(result.ready, false); assert.ok(!JSON.stringify(result).includes('secret-token'))
  }
  assert.equal((await probe('https://example.invalid', async () => { throw new Error('private-url-password') })).code, 'UPTIME_UNREACHABLE')
  for (const origin of ['http://external.invalid','https://user:secret@example.invalid','https://example.invalid/path','https://example.invalid/?token=x']) {
    await assert.rejects(probe(origin, async () => { throw new Error('must not fetch') }))
  }
})
