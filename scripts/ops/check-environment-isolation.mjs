import {constants,openSync,fstatSync,readFileSync,closeSync} from 'node:fs'
import {parseEnv} from 'node:util'
import {pathToFileURL} from 'node:url'

// A failed check never includes an input value, path, URL, key or native error.
export function checkIsolation(environments) {
  if (environments.length !== 3) throw new Error('ISOLATION_THREE_ENVIRONMENTS_REQUIRED')
  const databases = new Set(), passwords = new Set(), keys = new Set(), projects = new Set()
  for (const [index,env] of environments.entries()) {
    const kind = ['development','staging','production'][index]
    let database
    try { database = new URL(env.DATABASE_URL) } catch { throw new Error('ISOLATION_DATABASE_INVALID') }
    if (!['postgresql:','postgres:'].includes(database.protocol) || !database.hostname || !database.pathname.slice(1) || !database.username || !database.password) throw new Error('ISOLATION_DATABASE_INVALID')
    // Query/user/password changes do not make the same database a different target.
    let databaseName
    try { databaseName = decodeURIComponent(database.pathname.slice(1)) } catch { throw new Error('ISOLATION_DATABASE_INVALID') }
    const target = `${database.hostname.toLowerCase()}:${database.port || '5432'}/${databaseName}`
    if (databases.has(target)) throw new Error('ISOLATION_DATABASE_REUSED')
    databases.add(target)
    let password
    try { password = decodeURIComponent(database.password) } catch { throw new Error('ISOLATION_DATABASE_INVALID') }
    if (Buffer.byteLength(password) < 32) throw new Error('ISOLATION_DATABASE_PASSWORD_TOO_SHORT')
    if (passwords.has(password)) throw new Error('ISOLATION_DATABASE_PASSWORD_REUSED')
    passwords.add(password)
    if (env.POSTGRES_PASSWORD !== undefined && env.POSTGRES_PASSWORD !== password) throw new Error('ISOLATION_DATABASE_PASSWORD_MISMATCH')
    if (env.POSTGRES_DB !== undefined && env.POSTGRES_DB !== databaseName) throw new Error('ISOLATION_DATABASE_NAME_MISMATCH')
    if (env.POSTGRES_USER !== undefined && env.POSTGRES_USER !== decodeURIComponent(database.username)) throw new Error('ISOLATION_DATABASE_USER_MISMATCH')
    const active = env.AUTH_CHALLENGE_SECRET
    const old = env.AUTH_TOTP_PREVIOUS_SECRETS ? env.AUTH_TOTP_PREVIOUS_SECRETS.split(',') : []
    if (!/^[0-9a-f]{64}$/i.test(active || '') || old.length > 2 || old.some(value => !/^[0-9a-f]{64}$/i.test(value))) throw new Error('ISOLATION_AUTH_KEY_INVALID')
    for (const key of [active,...old]) {
      const normalized = key.toLowerCase()
      if (keys.has(normalized)) throw new Error('ISOLATION_AUTH_KEY_REUSED')
      keys.add(normalized)
    }
    if (kind !== 'development') {
      if (env.AUTH_TOTP_ENABLED !== 'true' || env.AUTH_CRITICAL_MFA_REQUIRED !== 'true') throw new Error('ISOLATION_RELEASE_MFA_REQUIRED')
      let origin
      try { origin = new URL(env.APP_ORIGIN) } catch { throw new Error('ISOLATION_ORIGIN_INVALID') }
      if (origin.protocol !== 'https:' || origin.username || origin.password || origin.pathname !== '/' || origin.search || origin.hash) throw new Error('ISOLATION_ORIGIN_INVALID')
      if (env.COMPOSE_PROJECT_NAME !== `pos-${kind}`) throw new Error('ISOLATION_PROJECT_INVALID')
      if (projects.has(env.COMPOSE_PROJECT_NAME)) throw new Error('ISOLATION_PROJECT_REUSED')
      projects.add(env.COMPOSE_PROJECT_NAME)
      if (env.POSTGRES_DB !== `pos_${kind}` || database.hostname !== 'db') throw new Error('ISOLATION_RELEASE_DATABASE_INVALID')
      if (env.POS_BIND_ADDRESS !== '127.0.0.1') throw new Error('ISOLATION_RELEASE_BIND_INVALID')
      if (!/^\S+@sha256:[a-f0-9]{64}$/.test(env.POS_IMAGE || '') || !/^[A-Za-z0-9._-]{1,100}$/.test(env.POS_RELEASE || '')) throw new Error('ISOLATION_RELEASE_ID_REQUIRED')
    }
  }
  // DNS aliases, external secret-store ACLs and host separation require operator review.
  return {status:'ready_for_operator_review',environments:3,networkVerified:false}
}

function readPrivateEnvironment(path) {
  const fd = openSync(path,constants.O_RDONLY|constants.O_NOFOLLOW)
  try {
    const stat = fstatSync(fd)
    if (!stat.isFile() || stat.uid !== process.getuid() || (stat.mode & 0o077) !== 0 || stat.size < 1 || stat.size > 65536) throw new Error('ISOLATION_PRIVATE_FILE_REQUIRED')
    return parseEnv(readFileSync(fd,'utf8'))
  } finally { closeSync(fd) }
}
if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) {
  try {
    if (process.argv.length !== 5) throw new Error('ISOLATION_THREE_ENVIRONMENTS_REQUIRED')
    console.log(JSON.stringify(checkIsolation(process.argv.slice(2).map(readPrivateEnvironment))))
  } catch (error) {
    const code = error instanceof Error && /^ISOLATION_[A-Z_]+$/.test(error.message) ? error.message : 'ISOLATION_CHECK_FAILED'
    console.error(JSON.stringify({status:'rejected',code}));process.exitCode=1
  }
}
