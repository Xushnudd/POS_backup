// Disposable local rehearsal of the checked-in Compose isolation contract.
// No .env file, existing database, live project or production deployment is used.
import assert from 'node:assert/strict'
import {spawnSync} from 'node:child_process'
import {randomBytes,createHash} from 'node:crypto'
import {mkdtempSync,mkdirSync,rmSync,readFileSync,writeFileSync} from 'node:fs'
import {tmpdir} from 'node:os'
import {join,resolve} from 'node:path'
import {checkComposeIsolation,renderIsolationConfiguration} from './check-compose-isolation.mjs'

const prefix=`pos-isolation-drill-${Date.now()}-${process.pid}`
const work=mkdtempSync(join(tmpdir(),'pos-isolation-'))
const cleanup=[],checks=[]
function docker(args,{input,mayFail=false}={}) {
  const result=spawnSync('docker',args,{input,encoding:'utf8',timeout:45000,maxBuffer:1024*1024})
  // Native errors/arguments may contain generated credentials; never forward them.
  if(!mayFail&&result.status!==0)throw new Error('ISOLATION_DRILL_DOCKER_FAILED')
  return result
}
const environments=['development','staging','production'].map((kind,index)=>{
  const password=randomBytes(32).toString('hex'),state=join(work,kind);mkdirSync(state,{mode:0o700})
  return {COMPOSE_PROJECT_NAME:`pos-${kind}`,POSTGRES_DB:`pos_${kind}`,POSTGRES_USER:`pos_${kind}`,POSTGRES_PASSWORD:password,DATABASE_URL:`postgresql://pos_${kind}:${password}@db/pos_${kind}`,AUTH_CHALLENGE_SECRET:randomBytes(32).toString('hex'),AUTH_TOTP_ENABLED:'true',AUTH_CRITICAL_MFA_REQUIRED:'true',APP_ORIGIN:`https://${kind}.invalid`,POS_BIND_ADDRESS:'127.0.0.1',POS_PORT:String(33000+index),POS_STATE_DIRECTORY:state,POS_IMAGE:`fixture.invalid/pos@sha256:${'a'.repeat(64)}`,POS_RELEASE:'synthetic-isolation-rehearsal'}
})
const resources=environments.map((env,index)=>({env,container:`${prefix}-${index}`,network:`${prefix}-${index}-net`,volume:`${prefix}-${index}-data`}))
function query(target,credential,sql,host='127.0.0.1') {
  return docker(['exec','-i','-e',`PGPASSWORD=${credential.POSTGRES_PASSWORD}`,'-e','PGCONNECT_TIMEOUT=2',target.container,'psql','-XAt','-h',host,'-U',credential.POSTGRES_USER,'-d',target.env.POSTGRES_DB,'-v','ON_ERROR_STOP=1'],{input:sql,mayFail:true})
}
let evidence
try {
  const configurations=environments.map((env,index)=>renderIsolationConfiguration(env,index>0))
  const rendered=checkComposeIsolation(environments,configurations)
  checks.push({check:'actual_base_and_release_compose_render',passed:true,...rendered})
  const imageId=docker(['image','inspect','--format','{{.Id}}','postgres:15-alpine']).stdout.trim()
  assert.match(imageId,/^sha256:[a-f0-9]{64}$/)
  for(const item of resources) {
    docker(['network','create','--internal','--label','pos.isolation.drill=true',item.network]);cleanup.push(['network','rm',item.network])
    docker(['volume','create','--label','pos.isolation.drill=true',item.volume]);cleanup.push(['volume','rm',item.volume])
    docker(['run','-d','--name',item.container,'--label','pos.isolation.drill=true','--network',item.network,'-v',`${item.volume}:/var/lib/postgresql/data`,'-e','POSTGRES_INITDB_ARGS=--auth-host=scram-sha-256 --auth-local=scram-sha-256','-e',`POSTGRES_USER=${item.env.POSTGRES_USER}`,'-e',`POSTGRES_DB=${item.env.POSTGRES_DB}`,'-e',`POSTGRES_PASSWORD=${item.env.POSTGRES_PASSWORD}`,imageId]);cleanup.push(['rm','-f',item.container])
    const deadline=Date.now()+60000
    while(query(item,item.env,'SELECT 1;').stdout.trim()!=='1') {
      if(Date.now()>deadline)throw new Error('ISOLATION_DRILL_STARTUP_TIMEOUT')
      await new Promise(resolve=>setTimeout(resolve,250))
    }
    const result=query(item,item.env,"CREATE TABLE isolation_probe(id integer PRIMARY KEY, environment text NOT NULL); INSERT INTO isolation_probe VALUES(1,current_database()); SELECT environment FROM isolation_probe;")
    assert.equal(result.status,0);assert.ok(result.stdout.endsWith(item.env.POSTGRES_DB+'\n'))
  }
  let deniedCredentials=0,deniedNetworks=0
  for(const target of resources) {
    const inspection=JSON.parse(docker(['inspect',target.container]).stdout)[0]
    assert.deepEqual(inspection.HostConfig.PortBindings,{})
    assert.deepEqual(Object.keys(inspection.NetworkSettings.Networks),[target.network])
    assert.equal(inspection.Mounts.find(m=>m.Destination==='/var/lib/postgresql/data').Name,target.volume)
    for(const source of resources.filter(source=>source!==target)) {
      // Test authentication independently of Docker's network denial.
      const rejected=query(target,{...source.env,POSTGRES_USER:target.env.POSTGRES_USER},"INSERT INTO isolation_probe VALUES(2,'cross-environment-write');")
      assert.notEqual(rejected.status,0);assert.match(rejected.stderr,/password authentication failed/);deniedCredentials++
      const address=inspection.NetworkSettings.Networks[target.network].IPAddress
      // Even stolen target credentials in another environment cannot cross bridges.
      const blocked=docker(['exec','-e',`PGPASSWORD=${target.env.POSTGRES_PASSWORD}`,'-e','PGCONNECT_TIMEOUT=2',source.container,'psql','-XAt','-h',address,'-U',target.env.POSTGRES_USER,'-d',target.env.POSTGRES_DB,'-c',"INSERT INTO isolation_probe VALUES(3,'cross-network-write')"],{mayFail:true})
      assert.notEqual(blocked.status,0);assert.match(blocked.stderr,/timeout expired|No route to host|Network unreachable|Connection refused/);deniedNetworks++
    }
    assert.equal(query(target,target.env,'SELECT count(*) FROM isolation_probe;').stdout.trim(),'1')
  }
  checks.push({check:'three_real_private_postgresql_clusters',passed:true,ownEnvironmentWrites:3,foreignCredentialsRejected:deniedCredentials,foreignNetworksRejectedEvenWithTargetCredentials:deniedNetworks,publishedDatabasePorts:0,unexpectedWrites:0,syntheticDataOnly:true})
  const files=['scripts/ops/check-environment-isolation.mjs','scripts/ops/check-compose-isolation.mjs','scripts/ops/check-compose-isolation.test.mjs','scripts/ops/test-environment-isolation.mjs','docker-compose.yml','docker-compose.release.yml','docker-compose.maintenance.yml']
  evidence={task:'OPS-01.01',status:'local_technical_acceptance_passed',executedAtUtc:new Date().toISOString(),command:'node scripts/ops/test-environment-isolation.mjs',sourceRevision:spawnSync('git',['rev-parse','HEAD'],{encoding:'utf8'}).stdout.trim(),postgresImageId:imageId,scope:'Synthetic local development/staging/production configuration and isolation rehearsal. No approved real staging/production environment exists.',checks,files:files.map(path=>({path,sha256:createHash('sha256').update(readFileSync(path)).digest('hex')})),limits:['Actual host/secret-store access controls and operator credentials require external acceptance before deployment.','No real personal data copied, provider enabled, existing .env inspected or real deployment performed.','Three fresh PostgreSQL clusters use distinct bootstrap roles/passwords and private volumes/networks. A bootstrap role is superuser only inside its own disposable cluster; this is not proof of least-privileged runtime DB roles.']}
} finally {
  const failed=cleanup.reverse().filter(args=>docker(args,{mayFail:true}).status!==0)
  rmSync(work,{recursive:true,force:true})
  if(failed.length)throw new Error('ISOLATION_DRILL_CLEANUP_FAILED')
}
evidence.cleanup='all disposable containers, networks, volumes and generated credentials removed'
const output=resolve(process.env.POS_ISOLATION_EVIDENCE||'tasks/evidence/environment-isolation-20261016.json')
writeFileSync(output,JSON.stringify(evidence,null,2)+'\n')
console.log('PASS: rendered configuration and 3 isolated databases; 6 foreign-credential and 6 cross-network writes rejected. Evidence: '+output)
