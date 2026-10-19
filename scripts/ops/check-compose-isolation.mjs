import {execFileSync} from 'node:child_process'
import {realpathSync} from 'node:fs'
import {isAbsolute, resolve, sep} from 'node:path'
import {pathToFileURL} from 'node:url'
import {checkIsolation, readPrivateEnvironment} from './check-environment-isolation.mjs'

// Consume rendered config in memory. Never print it: it contains credentials.
export function checkComposeIsolation(environments, configurations) {
  checkIsolation(environments)
  if (configurations.length !== 3) throw new Error('ISOLATION_THREE_CONFIGURATIONS_REQUIRED')
  const networks = new Set(), volumes = new Set(), binds = [], projects = new Set()
  configurations.forEach((config, index) => {
    const env = environments[index], localBinds = new Set()
    if (!config.name || config.name !== env.COMPOSE_PROJECT_NAME || projects.has(config.name)) throw new Error('ISOLATION_COMPOSE_PROJECT_INVALID')
    projects.add(config.name)
    for (const [resources, seen, type] of [[config.networks, networks, 'NETWORK'], [config.volumes, volumes, 'VOLUME']]) {
      if (!resources || !Object.keys(resources).length) throw new Error(`ISOLATION_COMPOSE_${type}_MISSING`)
      for (const resource of Object.values(resources)) {
        if (resource.external || !resource.name || seen.has(resource.name)) throw new Error(`ISOLATION_COMPOSE_${type}_SHARED`)
        seen.add(resource.name)
        if (type === 'VOLUME' && (resource.driver && resource.driver !== 'local' || Object.keys(resource.driver_opts || {}).length)) throw new Error('ISOLATION_COMPOSE_VOLUME_DRIVER_UNREVIEWED')
      }
    }
    for (const name of ['db', 'app', 'jobs', 'reconciliation', 'migrate']) {
      const service = config.services?.[name]
      if (!service || service.network_mode || service.links?.length || service.external_links?.length || service.extra_hosts?.length || service.privileged || service.volumes_from?.length || service.devices?.length || service.pid === 'host' || service.ipc === 'host') throw new Error('ISOLATION_COMPOSE_NETWORK_ESCAPE')
      if (!service.networks || Object.keys(service.networks).some(key => !config.networks[key])) throw new Error('ISOLATION_COMPOSE_NETWORK_UNDECLARED')
      if (name === 'db') {
        if (service.ports?.length) throw new Error('ISOLATION_DATABASE_PORT_PUBLISHED')
        if (service.environment?.POSTGRES_INITDB_ARGS !== '--auth-host=scram-sha-256 --auth-local=scram-sha-256') throw new Error('ISOLATION_DATABASE_AUTH_UNREVIEWED')
        for (const key of ['POSTGRES_DB','POSTGRES_USER','POSTGRES_PASSWORD']) if (service.environment?.[key] !== env[key]) throw new Error('ISOLATION_COMPOSE_DATABASE_MISMATCH')
        const data = service.volumes?.filter(mount => mount.target === '/var/lib/postgresql/data')
        if (data?.length !== 1 || data[0].type !== 'volume' || !config.volumes[data[0].source]) throw new Error('ISOLATION_DATABASE_VOLUME_REQUIRED')
      } else {
        if (service.environment?.DATABASE_URL !== env.DATABASE_URL) throw new Error('ISOLATION_COMPOSE_DATABASE_MISMATCH')
        if (name !== 'migrate' && service.environment?.AUTH_CHALLENGE_SECRET !== env.AUTH_CHALLENGE_SECRET) throw new Error('ISOLATION_COMPOSE_AUTH_MISMATCH')
      }
      for (const mount of service.volumes || []) {
        if (mount.type === 'volume' && !config.volumes[mount.source]) throw new Error('ISOLATION_COMPOSE_VOLUME_UNDECLARED')
        if (mount.type !== 'bind') continue
        if (!isAbsolute(mount.source) || mount.target !== '/run/pos-state' || !mount.read_only) throw new Error('ISOLATION_COMPOSE_BIND_UNREVIEWED')
        let path = resolve(mount.source)
        try { path = realpathSync(path) } catch { throw new Error('ISOLATION_COMPOSE_BIND_MUST_EXIST') }
        localBinds.add(path)
      }
    }
    for (const path of localBinds) {
      if (binds.some(other => path === other || path.startsWith(other + sep) || other.startsWith(path + sep))) throw new Error('ISOLATION_COMPOSE_BIND_SHARED')
      binds.push(path)
    }
  })
  return {status:'ready_for_operator_review', environments:3, renderedNetworksAndVolumesVerified:true, liveEnvironmentsVerified:false}
}

export function renderIsolationConfiguration(env, release) {
  const files = ['-f','docker-compose.yml']
  if (release) files.push('-f','docker-compose.release.yml','-f','docker-compose.maintenance.yml')
  // Explicit allowlist avoids inherited shell credentials silently overriding files.
  const childEnv = {PATH:process.env.PATH, HOME:process.env.HOME, ...env}
  return JSON.parse(execFileSync('docker',['compose','--env-file','/dev/null','--profile','*',...files,'config','--format','json'],{env:childEnv,encoding:'utf8',stdio:['ignore','pipe','pipe'],timeout:30000,maxBuffer:1024*1024}))
}

if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) {
  try {
    if (process.argv.length !== 5) throw new Error('ISOLATION_THREE_ENVIRONMENTS_REQUIRED')
    const environments = process.argv.slice(2).map(readPrivateEnvironment)
    checkIsolation(environments)
    console.log(JSON.stringify(checkComposeIsolation(environments,environments.map((env,index)=>renderIsolationConfiguration(env,index>0)))))
  } catch (error) {
    console.error(JSON.stringify({status:'rejected',code:error instanceof Error && /^ISOLATION_[A-Z_]+$/.test(error.message)?error.message:'ISOLATION_COMPOSE_CHECK_FAILED'}))
    process.exitCode=1
  }
}
