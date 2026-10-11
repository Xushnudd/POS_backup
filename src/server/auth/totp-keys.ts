// Configuration only; callers must never serialize the returned key material.
export function totpKeyConfiguration() {
  const current = process.env.AUTH_CHALLENGE_SECRET ?? ''
  const raw = process.env.AUTH_TOTP_PREVIOUS_SECRETS
  const previous = raw ? raw.split(',') : []
  if (!/^[0-9a-f]{64}$/i.test(current) || previous.length > 2 || previous.some(value => !/^[0-9a-f]{64}$/i.test(value))) return null
  return { current, previous }
}
