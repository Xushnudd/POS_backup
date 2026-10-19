import { AccessError } from './policy'
import { totpKeyConfiguration } from './totp-keys'
export function totpAvailable() {
  // Explicit opt-in until reviewed UI/recovery/critical-action rollout is complete.
  return process.env.AUTH_TOTP_ENABLED === 'true' && totpKeyConfiguration() !== null
}
export function assertTotpAvailable() {
  if (!totpAvailable()) throw new AccessError(503, 'TOTP_UNAVAILABLE', 'Authenticator hali yoqilmagan')
}
