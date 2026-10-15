import {test} from 'node:test'
import assert from 'node:assert/strict'
import {spawn,spawnSync} from 'node:child_process'
import {once} from 'node:events'
import {validateReleaseRuntime} from './release-entrypoint.mjs'

const image=`registry.invalid/pos/core@sha256:${'a'.repeat(64)}`
const env={...process.env,NODE_ENV:'production',POS_RELEASE_IMAGE:image}
const entrypoint='scripts/ops/release-entrypoint.mjs'

test('release startup requires a digest reference, production and a non-root identity',()=>{
  assert.doesNotThrow(()=>validateReleaseRuntime(env,1001))
  for(const candidate of ['', 'pos:latest', `pos@sha256:${'a'.repeat(63)}`, `pos@sha256:${'A'.repeat(64)}`, ` ${image}`, `${image}\n`]) assert.throws(()=>validateReleaseRuntime({...env,POS_RELEASE_IMAGE:candidate},1001),/IMMUTABLE_IMAGE_REQUIRED/)
  assert.throws(()=>validateReleaseRuntime({...env,NODE_ENV:'development'},1001),/PRODUCTION_MODE_REQUIRED/)
  for(const uid of [0,undefined,-1]) assert.throws(()=>validateReleaseRuntime(env,uid),/NON_ROOT_REQUIRED/)
})

test('mutable-image startup never invokes the child and rejects without echoing input',()=>{
  const privateValue='PRIVATE_STARTUP_CANARY'
  const result=spawnSync(process.execPath,[entrypoint,process.execPath,'-e',"console.log('CHILD_SHOULD_NOT_START')"],{env:{...env,POS_RELEASE_IMAGE:privateValue},encoding:'utf8'})
  assert.equal(result.status,1)
  assert.equal(result.stderr.trim(),'RELEASE_IMMUTABLE_IMAGE_REQUIRED')
  assert.doesNotMatch(result.stdout+result.stderr,/PRIVATE_STARTUP_CANARY|CHILD_SHOULD_NOT_START/)
})

test('release entrypoint preserves the child exit code and forwards shutdown',async()=>{
  if(process.getuid?.()===0)return
  const completed=spawnSync(process.execPath,[entrypoint,process.execPath,'-e','process.exit(7)'],{env,encoding:'utf8'})
  assert.equal(completed.status,7)
  const child=spawn(process.execPath,[entrypoint,process.execPath,'-e',"process.on('SIGTERM',()=>{console.log('DRAINED');process.exit(0)});console.log('READY');setInterval(()=>{},1000)"],{env,stdio:['ignore','pipe','pipe']})
  let stdout='',stderr=''
  child.stdout.on('data',chunk=>stdout+=chunk)
  child.stderr.on('data',chunk=>stderr+=chunk)
  const deadline=Date.now()+5000
  try {
    while(!stdout.includes('READY')&&Date.now()<deadline)await new Promise(resolve=>setTimeout(resolve,10))
    assert.match(stdout,/READY/)
    const exited=once(child,'exit')
    child.kill('SIGTERM')
    const [code,signal]=await exited
    assert.equal(code,0);assert.equal(signal,null)
    assert.match(stdout,/DRAINED/);assert.equal(stderr,'')
  }finally{if(child.exitCode===null)child.kill('SIGKILL')}
})
