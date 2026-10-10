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
}
