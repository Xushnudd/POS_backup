import { requestBudgetSetting } from './auth/request-budget-config'
export function validateProductionEnvironment(env: NodeJS.ProcessEnv = process.env) {
  if (env.NODE_ENV !== 'production') return
  if (!env.DATABASE_URL || !env.APP_ORIGIN) throw new Error('Production requires DATABASE_URL and APP_ORIGIN')
  let database: URL, origin: URL
  try { database = new URL(env.DATABASE_URL); origin = new URL(env.APP_ORIGIN) }
  catch { throw new Error('Production connection or origin configuration invalid') }
  if (!['postgres:', 'postgresql:'].includes(database.protocol) || !database.hostname || !database.pathname.slice(1)) {
    throw new Error('DATABASE_URL must reference PostgreSQL')
  }
  if (origin.protocol !== 'https:' || origin.username || origin.password || origin.pathname !== '/' || origin.search || origin.hash) {
    throw new Error('APP_ORIGIN must be a single HTTPS origin')
  }
  if (env.TRUST_PROXY_IP && env.TRUST_PROXY_IP !== 'true') throw new Error('TRUST_PROXY_IP must be true or omitted')
  if(env.AUTH_CHALLENGE_SECRET&&!/^[0-9a-f]{64}$/i.test(env.AUTH_CHALLENGE_SECRET))throw new Error('AUTH_CHALLENGE_SECRET must be a separate 32-byte hexadecimal key')
  for (const name of ['AUTH_TOTP_ENABLED','AUTH_CRITICAL_MFA_REQUIRED'] as const) {
    if (env[name] !== undefined && env[name] !== 'true' && env[name] !== 'false') throw new Error('Production authentication flag is invalid')
  }
  if ((env.AUTH_TOTP_ENABLED === 'true' || env.AUTH_CRITICAL_MFA_REQUIRED === 'true') && !/^[0-9a-f]{64}$/i.test(env.AUTH_CHALLENGE_SECRET ?? '')) throw new Error('Enabled production MFA requires a private authentication key')
  if (env.AUTH_CRITICAL_MFA_REQUIRED === 'true' && env.AUTH_TOTP_ENABLED !== 'true') throw new Error('Required production MFA requires the authenticator to be enabled')
  const previous = env.AUTH_TOTP_PREVIOUS_SECRETS ? env.AUTH_TOTP_PREVIOUS_SECRETS.split(',') : []
  if (previous.length > 2 || previous.some(value => !/^[0-9a-f]{64}$/i.test(value)) || previous.length && !env.AUTH_CHALLENGE_SECRET) throw new Error('Production authentication key overlap is invalid')
  const keys = [env.AUTH_CHALLENGE_SECRET,...previous].filter((value): value is string => Boolean(value)).map(value => value.toLowerCase())
  if (new Set(keys).size !== keys.length) throw new Error('Production authentication key overlap repeats a key')
  for(const name of ['API_READS_PER_MINUTE','API_WRITES_PER_MINUTE','API_PUBLIC_WRITES_PER_MINUTE','API_BODY_TIMEOUT_MS'] as const)requestBudgetSetting(name,env)
}
