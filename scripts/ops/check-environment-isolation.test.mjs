import {test} from 'node:test'
import assert from 'node:assert/strict'
import {mkdtempSync,writeFileSync,rmSync,symlinkSync} from 'node:fs'
import {tmpdir} from 'node:os'
import {join} from 'node:path'
import {spawnSync} from 'node:child_process'
import {randomBytes} from 'node:crypto'
import {checkIsolation} from './check-environment-isolation.mjs'
const fixture=()=>['development','staging','production'].map((kind,index)=>{
  const password=randomBytes(32).toString('hex')
  return {DATABASE_URL:`postgresql://pos_${kind}:${password}@${index?'db':'127.0.0.1'}/pos_${kind}`,POSTGRES_PASSWORD:password,POSTGRES_DB:`pos_${kind}`,POSTGRES_USER:`pos_${kind}`,AUTH_CHALLENGE_SECRET:randomBytes(32).toString('hex'),AUTH_TOTP_ENABLED:'true',AUTH_CRITICAL_MFA_REQUIRED:'true',APP_ORIGIN:`https://${kind}.invalid`,COMPOSE_PROJECT_NAME:`pos-${kind}`,POS_BIND_ADDRESS:'127.0.0.1',POS_IMAGE:`image@sha256:${'a'.repeat(64)}`,POS_RELEASE:'fixture-only'}
})
test('distinct synthetic environments pass without claiming network verification',()=>assert.deepEqual(checkIsolation(fixture()),{status:'ready_for_operator_review',environments:3,networkVerified:false}))
test('same database with a different user and query still rejected',()=>{
  const values=fixture(),url=new URL(values[1].DATABASE_URL);url.username='different';url.search='?schema=other';values[2].DATABASE_URL=url.toString()
  assert.throws(()=>checkIsolation(values),/ISOLATION_DATABASE_REUSED/)
})
test('URL-encoded database name cannot disguise the same target',()=>{
  const values=fixture(),url=new URL(values[2].DATABASE_URL);url.pathname='/pos%5Fstaging';values[2].DATABASE_URL=url.toString()
  assert.throws(()=>checkIsolation(values),/ISOLATION_DATABASE_REUSED/)
})
test('password, active key and old overlap cannot cross environment boundaries',()=>{
  const values=fixture();values[2].AUTH_TOTP_PREVIOUS_SECRETS=values[0].AUTH_CHALLENGE_SECRET
  assert.throws(()=>checkIsolation(values),/ISOLATION_AUTH_KEY_REUSED/)
  delete values[2].AUTH_TOTP_PREVIOUS_SECRETS;values[2].AUTH_CHALLENGE_SECRET=values[1].AUTH_CHALLENGE_SECRET.toUpperCase()
  assert.throws(()=>checkIsolation(values),/ISOLATION_AUTH_KEY_REUSED/)
  const passwords=fixture(),url=new URL(passwords[2].DATABASE_URL);url.password=passwords[0].POSTGRES_PASSWORD;passwords[2].DATABASE_URL=url.toString();passwords[2].POSTGRES_PASSWORD=passwords[0].POSTGRES_PASSWORD
  assert.throws(()=>checkIsolation(passwords),/ISOLATION_DATABASE_PASSWORD_REUSED/)
})
test('overlap configuration follows runtime limit and does not normalize malformed input',()=>{
  for(const old of [Array.from({length:3},()=>randomBytes(32).toString('hex')).join(','),` ${randomBytes(32).toString('hex')}`]){
    const values=fixture();values[2].AUTH_TOTP_PREVIOUS_SECRETS=old;assert.throws(()=>checkIsolation(values),/ISOLATION_AUTH_KEY_INVALID/)
  }
})
test('release MFA, loopback and immutable image are required',()=>{
  for(const [name,value,code] of [['AUTH_CRITICAL_MFA_REQUIRED','false','MFA_REQUIRED'],['POS_BIND_ADDRESS','0.0.0.0','BIND_INVALID'],['POS_IMAGE','image:latest','ID_REQUIRED']]){
    const values=fixture();values[2][name]=value;assert.throws(()=>checkIsolation(values),new RegExp(code))
  }
})
test('CLI accepts own 0600 files, refuses public file/symlink and never logs secret input',()=>{
  const directory=mkdtempSync(join(tmpdir(),'pos-isolation-'))
  try {
    const values=fixture(),paths=values.map((env,index)=>{const path=join(directory,`env${index}`);writeFileSync(path,Object.entries(env).map(([key,value])=>`${key}=${value}`).join('\n'),{mode:0o600});return path})
    const invoke=files=>spawnSync(process.execPath,['scripts/ops/check-environment-isolation.mjs',...files],{encoding:'utf8'})
    assert.equal(invoke(paths).status,0)
    const publicFile=join(directory,'public');writeFileSync(publicFile,'PRIVATE_CANARY_CONTENT',{mode:0o644});const link=join(directory,'link');symlinkSync(paths[0],link)
    for(const path of [publicFile,link]){const result=invoke([path,...paths.slice(1)]);assert.equal(result.status,1);assert.doesNotMatch(result.stdout+result.stderr,/PRIVATE_CANARY_CONTENT|postgresql:|AUTH_CHALLENGE_SECRET/);assert.ok(!result.stderr.includes(directory))}
  } finally {rmSync(directory,{recursive:true,force:true})}
})
