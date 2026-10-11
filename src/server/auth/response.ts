// Defense in depth after endpoint DTO selection. Authentication credentials are
// removed by default. Invitation capabilities and explicitly reviewed one-time
// TOTP enrollment/recovery DTOs are presented only by their authorized endpoints.
const credentials = new Set(['pin','pinhash','password','passwordhash','passworddigest','tokenhash','resettoken','secret','secrethash','sealedsecret','provisioninguri','apikey','privatekey','clientsecret','accesstoken','refreshtoken','sessiontoken','authorization','cookie','credentials','deliverylease','leasetoken','otp','otpcode','verificationcode','recoverycode','recoverycodes','totpsecret','totpseed']);
const costs = new Set(['costprice','unitcost','profit','profitmargin','cost']);
export function sanitizeResponse(value: unknown, role?: string): unknown {
  if (Array.isArray(value)) return value.map(row => sanitizeResponse(row, role));
  if (!value || typeof value !== 'object') return value;
  return Object.fromEntries(Object.entries(value).filter(([key]) => {
    const normalized=key.toLowerCase().replace(/[_-]/g,'');
    return !credentials.has(normalized) && !(normalized==='token' && (value as Record<string,unknown>)[key]!=='cookie-session') && !(role==='cashier' && costs.has(normalized));
  }).map(([key, row]) => [key,sanitizeResponse(row,role)]));
}
// Explicit one-time enrollment capabilities. No blanket sanitization bypass:
// only these exact successful endpoint DTOs may present the owned credential.
export function sanitizeTotpPresentation(value: unknown, role: string | undefined, path: string, method: string, presentation?: 'enrollment'|'recoveryCodes') {
  const clean = sanitizeResponse(value, role)
  if (!presentation || method !== 'POST' || !value || typeof value !== 'object') return clean
  const raw = value as Record<string, unknown>, data = raw.data
  if (raw.success !== true || !data || typeof data !== 'object' || !clean || typeof clean !== 'object') return clean
  const target = (clean as Record<string, unknown>).data as Record<string, unknown>
  const source = data as Record<string, unknown>
  if (presentation === 'enrollment' && path === '/api/auth/totp/enroll' && typeof source.provisioningUri === 'string') {
    try {
      const uri = new URL(source.provisioningUri)
      if (uri.protocol === 'otpauth:' && uri.hostname === 'totp' && !uri.hash && !uri.username && !uri.password && !uri.port && /^[A-Z2-7]{32}$/.test(uri.searchParams.get('secret') ?? '') && uri.searchParams.get('digits') === '6' && uri.searchParams.get('period') === '30' && uri.searchParams.get('algorithm') === 'SHA1') target.provisioningUri = source.provisioningUri
    } catch { /* A malformed capability is never presented. */ }
  }
  if (presentation === 'recoveryCodes' && ['/api/auth/totp/confirm','/api/auth/totp/rotate'].includes(path) && Array.isArray(source.recoveryCodes) && source.recoveryCodes.length === 10 && source.recoveryCodes.every(code => typeof code === 'string' && /^[0-9a-f]{32}$/.test(code)) && new Set(source.recoveryCodes).size === 10) target.recoveryCodes = source.recoveryCodes
  return clean
}
