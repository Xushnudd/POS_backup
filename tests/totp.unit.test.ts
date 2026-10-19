import test from 'node:test'
import assert from 'node:assert/strict'
import { TOTP, Secret } from 'otpauth'
import { matchTotpCounter, newTotpSecret, sealTotpSecret, unsealTotpSecret } from '../src/server/auth/totp'
import { totpEnrollmentSchema } from '../src/server/auth/totp-service'
import { totpAvailable } from '../src/server/auth/totp-availability'

const secret = Secret.fromUTF8('12345678901234567890').base32
test('TOTP key overlap preserves identity binding, writes only with the current key, and rejects invalid configuration', () => {
  const current = process.env.AUTH_CHALLENGE_SECRET, previous = process.env.AUTH_TOTP_PREVIOUS_SECRETS, enabled = process.env.AUTH_TOTP_ENABLED
  try {
    delete process.env.AUTH_TOTP_PREVIOUS_SECRETS
    process.env.AUTH_TOTP_ENABLED = 'true'
    process.env.AUTH_CHALLENGE_SECRET = 'a'.repeat(64)
    assert.equal(totpAvailable(), true)
    const old = sealTotpSecret(secret, 'u', 'f')
    process.env.AUTH_CHALLENGE_SECRET = 'b'.repeat(64)
    process.env.AUTH_TOTP_PREVIOUS_SECRETS = 'a'.repeat(64)
    assert.equal(unsealTotpSecret(old, 'u', 'f'), secret)
    assert.throws(() => unsealTotpSecret(old, 'other', 'f'))
    const replacement = sealTotpSecret(unsealTotpSecret(old, 'u', 'f'), 'u', 'f')
    delete process.env.AUTH_TOTP_PREVIOUS_SECRETS
    assert.equal(unsealTotpSecret(replacement, 'u', 'f'), secret)
    assert.throws(() => unsealTotpSecret(old, 'u', 'f'))
    for (const invalid of ['bad', 'a'.repeat(64) + ',', Array(3).fill('a'.repeat(64)).join(',')]) {
      process.env.AUTH_TOTP_PREVIOUS_SECRETS = invalid
      assert.equal(totpAvailable(), false)
      assert.throws(() => sealTotpSecret(secret, 'u', 'f'), (error: unknown) => (error as {code:string}).code === 'TOTP_UNAVAILABLE')
      assert.throws(() => unsealTotpSecret(replacement, 'u', 'f'), (error: unknown) => (error as {code:string}).code === 'TOTP_UNAVAILABLE')
    }
    process.env.AUTH_TOTP_PREVIOUS_SECRETS = 'a'.repeat(64)
    delete process.env.AUTH_CHALLENGE_SECRET
    assert.throws(() => unsealTotpSecret(old, 'u', 'f'))
  } finally {
    if (current === undefined) delete process.env.AUTH_CHALLENGE_SECRET; else process.env.AUTH_CHALLENGE_SECRET = current
    if (previous === undefined) delete process.env.AUTH_TOTP_PREVIOUS_SECRETS; else process.env.AUTH_TOTP_PREVIOUS_SECRETS = previous
    if (enabled === undefined) delete process.env.AUTH_TOTP_ENABLED; else process.env.AUTH_TOTP_ENABLED = enabled
  }
})
test('TOTP reauthentication bounds password UTF8 bytes to avoid bcrypt truncation equivalence', () => {
  for (const password of ['a'.repeat(72),'é'.repeat(36),'🙂'.repeat(18)]) assert.equal(totpEnrollmentSchema.parse({password}).password,password)
  for (const password of ['a'.repeat(73),'é'.repeat(37),'🙂'.repeat(19)]) assert.throws(()=>totpEnrollmentSchema.parse({password}))
})
test('TOTP accepts RFC6238 SHA1 vectors modulo six digits, including times after 2038', () => {
  for (const [seconds, expected] of [[59,'287082'],[1111111109,'081804'],[1111111111,'050471'],[1234567890,'005924'],[2000000000,'279037'],[20000000000,'353130']] as const) {
    assert.equal(matchTotpCounter(secret, expected, seconds * 1000, null), BigInt(Math.floor(seconds / 30)))
  }
})
test('TOTP permits only bounded clock drift and rejects consumed or older counters', () => {
  const timestamp = 1800000000000, counter = BigInt(timestamp / 30000)
  const generator = new TOTP({ secret, digits: 6, period: 30 })
  for (const delta of [-1, 0, 1]) {
    const code = generator.generate({ timestamp: timestamp + delta * 30000 })
    assert.equal(matchTotpCounter(secret, code, timestamp, null), counter + BigInt(delta))
    assert.equal(matchTotpCounter(secret, code, timestamp, counter + BigInt(delta)), null)
  }
  assert.equal(matchTotpCounter(secret, generator.generate({ timestamp: timestamp - 60000 }), timestamp, null), null)
  for (const code of ['1','0000000',' 123456','１２３４５６','abcdef']) assert.equal(matchTotpCounter(secret, code, timestamp, null), null)
  for (const value of [NaN, Infinity, -1, 1.5]) assert.throws(() => matchTotpCounter(secret, '123456', value, null))
})
test('TOTP secrets are random, encrypted, identity-bound, and fail closed without a configured key', () => {
  const previous = process.env.AUTH_CHALLENGE_SECRET
  try {
    process.env.AUTH_CHALLENGE_SECRET = 'a'.repeat(64)
    const values = new Set(Array.from({ length: 100 }, newTotpSecret))
    assert.equal(values.size, 100)
    for (const value of values) assert.match(value, /^[A-Z2-7]{32}$/)
    const sealed = sealTotpSecret(secret, 'user-a', 'factor-a')
    assert.ok(!sealed.includes(secret))
    assert.notEqual(sealTotpSecret(secret, 'user-a', 'factor-a'), sealed)
    assert.equal(unsealTotpSecret(sealed, 'user-a', 'factor-a'), secret)
    assert.throws(() => unsealTotpSecret(sealed, 'user-b', 'factor-a'))
    assert.throws(() => unsealTotpSecret(sealed, 'user-a', 'factor-b'))
    assert.throws(() => unsealTotpSecret(sealed + '.extra', 'user-a', 'factor-a'))
    process.env.AUTH_CHALLENGE_SECRET = 'b'.repeat(64)
    assert.throws(() => unsealTotpSecret(sealed, 'user-a', 'factor-a'))
    delete process.env.AUTH_CHALLENGE_SECRET
    assert.throws(() => sealTotpSecret(secret, 'user-a', 'factor-a'))
    assert.throws(() => unsealTotpSecret(sealed, 'user-a', 'factor-a'))
  } finally {
    if (previous === undefined) delete process.env.AUTH_CHALLENGE_SECRET
    else process.env.AUTH_CHALLENGE_SECRET = previous
  }
})
