import {test} from 'node:test'
import assert from 'node:assert/strict'
import {randomBytes} from 'node:crypto'
import {mkdtempSync,mkdirSync,symlinkSync,rmSync} from 'node:fs'
import {tmpdir} from 'node:os'
import {join} from 'node:path'
import {checkComposeIsolation} from './check-compose-isolation.mjs'

function fixture() {
  const environments=['development','staging','production'].map(kind=>{
    const password=randomBytes(32).toString('hex')
    return {DATABASE_URL:`postgresql://pos_${kind}:${password}@db/pos_${kind}`,POSTGRES_DB:`pos_${kind}`,POSTGRES_USER:`pos_${kind}`,POSTGRES_PASSWORD:password,COMPOSE_PROJECT_NAME:`pos-${kind}`,AUTH_CHALLENGE_SECRET:randomBytes(32).toString('hex'),AUTH_TOTP_ENABLED:'true',AUTH_CRITICAL_MFA_REQUIRED:'true',APP_ORIGIN:`https://${kind}.invalid`,POS_BIND_ADDRESS:'127.0.0.1',POS_IMAGE:`image@sha256:${'a'.repeat(64)}`,POS_RELEASE:'synthetic-only'}
  })
  const configurations=environments.map(env=>({
    name:env.COMPOSE_PROJECT_NAME,networks:{default:{name:env.COMPOSE_PROJECT_NAME+'_default'}},volumes:{postgres_data:{name:env.COMPOSE_PROJECT_NAME+'_postgres_data'}},
    services:Object.fromEntries(['db','app','jobs','reconciliation','migrate'].map(name=>[name,{networks:{default:null},environment:name==='db'?{POSTGRES_DB:env.POSTGRES_DB,POSTGRES_USER:env.POSTGRES_USER,POSTGRES_PASSWORD:env.POSTGRES_PASSWORD}:{DATABASE_URL:env.DATABASE_URL,AUTH_CHALLENGE_SECRET:env.AUTH_CHALLENGE_SECRET},volumes:name==='db'?[{type:'volume',source:'postgres_data',target:'/var/lib/postgresql/data'}]:[]}]))
  }))
  for(const config of configurations)config.services.db.environment.POSTGRES_INITDB_ARGS='--auth-host=scram-sha-256 --auth-local=scram-sha-256'
  return {environments,configurations}
}
test('rendered isolation cannot be inferred merely from distinct env keys',()=>{
  const {environments,configurations}=fixture()
  assert.equal(checkComposeIsolation(environments,configurations).liveEnvironmentsVerified,false)
  for(const kind of ['networks','volumes']) {
    const bad=structuredClone(configurations),key=kind==='networks'?'default':'postgres_data'
    bad[2][kind][key].name=bad[1][kind][key].name
    assert.throws(()=>checkComposeIsolation(environments,bad),/SHARED/)
    bad[2][kind][key]={name:'external-resource',external:true}
    assert.throws(()=>checkComposeIsolation(environments,bad),/SHARED/)
  }
})
test('DB publishing, network bypass and incorrect runtime targets are rejected',()=>{
  for(const change of [c=>c.services.db.ports=[{published:'5432',target:5432}],c=>c.services.app.network_mode='host',c=>c.services.jobs.networks={foreign:null},c=>c.services.app.environment.DATABASE_URL='postgresql://private-secret@other/prod',c=>c.volumes.postgres_data.driver_opts={device:'/shared'},c=>c.services.app.volumes_from=['other-environment-db'],c=>c.services.app.devices=['/dev/sda:/dev/sda'],c=>c.services.app.pid='host']) {
    const {environments,configurations}=fixture();change(configurations[1])
    assert.throws(()=>checkComposeIsolation(environments,configurations),/^Error: ISOLATION_/)
  }
})
test('maintenance paths cannot alias or nest across environments, including symlinks',()=>{
  const root=mkdtempSync(join(tmpdir(),'pos-compose-isolation-'))
  try {
    mkdirSync(join(root,'staging'));mkdirSync(join(root,'production'));mkdirSync(join(root,'staging','nested'));symlinkSync(join(root,'staging'),join(root,'alias'))
    const {environments,configurations}=fixture()
    const mount=source=>({type:'bind',source,target:'/run/pos-state',read_only:true})
    configurations[1].services.app.volumes=[mount(join(root,'staging'))]
    configurations[2].services.app.volumes=[mount(join(root,'production'))]
    assert.equal(checkComposeIsolation(environments,configurations).renderedNetworksAndVolumesVerified,true)
    for(const path of ['alias','staging/nested']) {
      configurations[2].services.app.volumes=[mount(join(root,path))]
      assert.throws(()=>checkComposeIsolation(environments,configurations),/BIND_SHARED/)
    }
  }finally{rmSync(root,{recursive:true,force:true})}
})
