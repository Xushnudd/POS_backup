import { Secret, TOTP } from 'otpauth'
import { createCipheriv, createDecipheriv, hkdfSync, randomBytes } from 'node:crypto'
import { AccessError } from './policy'
import { totpKeyConfiguration } from './totp-keys'

// Generation/validation belongs to OTPAuth, not an application crypto protocol.
// Callers must obtain server time, lock the factor row, persist the accepted
// counter atomically, and rate-limit attempts before using this primitive.
const period = 30
const algorithm = 'SHA1'
const digits = 6
function instance(secret: string) {
  if (!/^[A-Z2-7]{32}$/.test(secret)) throw new AccessError(409, 'TOTP_SECRET_INVALID')
  return new TOTP({ secret: Secret.fromBase32(secret), algorithm, digits, period })
}
export function newTotpSecret() { return new Secret({ size: 20 }).base32 }
export function matchTotpCounter(secret: string, code: string, timestamp: number, lastCounter: bigint | null): bigint | null {
  if (!Number.isSafeInteger(timestamp) || timestamp < 30000 || lastCounter !== null && lastCounter < BigInt(0)) throw new AccessError(400, 'INVALID_TOTP_STATE')
  if (!/^\d{6}$/.test(code)) return null
  const delta = instance(secret).validate({ token: code, timestamp, window: 1 })
  if (delta === null) return null
  const counter = BigInt(Math.floor(timestamp / (period * 1000)) + delta)
  return lastCounter !== null && counter <= lastCounter ? null : counter
}
function key(configured: string) {
  return Buffer.from(hkdfSync('sha256', Buffer.from(configured, 'hex'), 'pos-auth-v1', 'totp-factor', 32))
}
function binding(userId: string, factorId: string) {
  if (!userId || !factorId || userId.length > 200 || factorId.length > 200) throw new AccessError(400, 'INVALID_TOTP_STATE')
  return Buffer.from(JSON.stringify(['pos-totp-v1', userId, factorId]))
}
export function sealTotpSecret(secret: string, userId: string, factorId: string) {
  const configuration = totpKeyConfiguration()
  if (!configuration) throw new AccessError(503, 'TOTP_UNAVAILABLE')
  instance(secret)
  const iv = randomBytes(12), cipher = createCipheriv('aes-256-gcm', key(configuration.current), iv)
  cipher.setAAD(binding(userId, factorId))
  const ciphertext = Buffer.concat([cipher.update(secret, 'utf8'), cipher.final()])
  return ['v1', iv.toString('base64url'), cipher.getAuthTag().toString('base64url'), ciphertext.toString('base64url')].join('.')
}
function openTotpSecret(value: string, userId: string, factorId: string) {
  const configuration = totpKeyConfiguration()
  if (!configuration) throw new AccessError(503, 'TOTP_UNAVAILABLE')
  // A bounded deployment-only overlap permits rolling key replacement. Never
  // accept keys supplied by an HTTP caller or use retired keys for new writes.
  const keys = [configuration.current, ...configuration.previous].map(key)
  try {
    const parts = value.split('.')
    if (parts.length !== 4 || parts[0] !== 'v1' || parts.slice(1).some(part => !/^[A-Za-z0-9_-]+$/.test(part))) throw new Error('Invalid envelope')
    const [, iv, tag, ciphertext] = parts.map((part, index) => index ? Buffer.from(part, 'base64url') : Buffer.alloc(0))
    if (iv.length !== 12 || tag.length !== 16 || ciphertext.length !== 32) throw new Error('Invalid envelope')
    for (const [keyIndex, candidate] of keys.entries()) {
      try {
        const decipher = createDecipheriv('aes-256-gcm', candidate, iv)
        decipher.setAAD(binding(userId, factorId)); decipher.setAuthTag(tag)
        const secret = Buffer.concat([decipher.update(ciphertext), decipher.final()]).toString('utf8')
        instance(secret)
        return {secret, keyIndex}
      } catch { /* Try only the bounded, explicitly configured overlap keys. */ }
    }
    throw new Error('Invalid envelope')
  } catch { throw new AccessError(409, 'TOTP_SECRET_INVALID') }
}

export function unsealTotpSecret(value: string, userId: string, factorId: string) {
  return openTotpSecret(value,userId,factorId).secret
}
export function isTotpEnvelopeCurrent(value: string, userId: string, factorId: string) {
  return openTotpSecret(value,userId,factorId).keyIndex===0
}
