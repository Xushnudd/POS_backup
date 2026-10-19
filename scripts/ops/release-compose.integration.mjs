import {test} from 'node:test'
import assert from 'node:assert/strict'
import {execFileSync} from 'node:child_process'

test('merged release config preserves each child command and applies digest/minimum-privilege gates to all four runtimes',()=>{
  const image=`registry.invalid/pos/core@sha256:${'a'.repeat(64)}`
  const env={...process.env,DATABASE_URL:'postgresql://fixture:fixture@db/fixture',POSTGRES_PASSWORD:'synthetic-only',POSTGRES_DB:'fixture',POSTGRES_USER:'fixture',AUTH_CHALLENGE_SECRET:'c'.repeat(64),POS_IMAGE:image,APP_ORIGIN:'https://fixture.invalid',COMPOSE_PROJECT_NAME:'pos-release-security-test',POS_STATE_DIRECTORY:'/tmp/pos-release-security-fixture'}
  const raw=execFileSync('docker',['compose','--env-file','/dev/null','--profile','*','-f','docker-compose.yml','-f','docker-compose.release.yml','-f','docker-compose.maintenance.yml','config','--format','json'],{env,encoding:'utf8',stdio:['ignore','pipe','pipe']})
  const {services}=JSON.parse(raw)
  const expected={app:['node','server.js'],jobs:['node','--require','./scripts/worker-resolver.cjs','.worker-build/scripts/workers/jobs.js'],reconciliation:['node','--require','./scripts/worker-resolver.cjs','.worker-build/scripts/workers/reconcile.js'],migrate:['node','node_modules/prisma/build/index.js','migrate','deploy']}
  for(const [name,command] of Object.entries(expected)){
    const service=services[name]
    assert.deepEqual(service.command,command,`${name} must preserve its actual child command after overriding entrypoint`)
    assert.deepEqual(service.entrypoint,['node','scripts/ops/release-entrypoint.mjs'])
    assert.equal(service.image,image);assert.equal(service.environment.POS_RELEASE_IMAGE,image)
    assert.equal(service.user,'1001:1001');assert.equal(service.read_only,true)
    assert.deepEqual(service.cap_drop,['ALL']);assert.ok(service.security_opt.includes('no-new-privileges:true'))
    assert.equal(service.tmpfs.length,2)
    assert.ok(service.tmpfs.every(value=>value.includes('noexec')&&value.includes('nosuid')&&value.includes('nodev')))
  }
})
