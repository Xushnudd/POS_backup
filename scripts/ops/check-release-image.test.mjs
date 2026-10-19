import {test} from 'node:test'
import assert from 'node:assert/strict'
import {imageConfigurationProblems,forbiddenImagePath,auditReleaseImage,classifyPrivateKeys} from './check-release-image.mjs'

test('image audit rejects baked runtime credentials and root identities without returning credential values',()=>{
  for(const user of ['', 'root','root:1001','0','000:1001'])assert.deepEqual(imageConfigurationProblems({User:user}),['root_or_unspecified_user'])
  assert.deepEqual(imageConfigurationProblems({User:'nextjs',Env:['NODE_ENV=production']}),[])
  assert.deepEqual(imageConfigurationProblems({User:'1001:1001',Env:['AUTH_CHALLENGE_SECRET=PRIVATE_CANARY','DATABASE_URL=PRIVATE_CANARY']}),['baked_runtime_secret'])
  assert.deepEqual(imageConfigurationProblems({User:'1001:1001',Env:['EXAMPLE_API_KEY=PRIVATE_CANARY','ACCESS_TOKEN=PRIVATE_CANARY']}),['baked_runtime_secret'])
})
test('image audit recognizes excluded credential stores inside nested layers but allows public system certificates',()=>{
  for(const path of ['app/.env','./app/.env_backup','app/subdir/.env.production','app/.local/https/private.key','app/.aws/credentials'])assert.equal(forbiddenImagePath(path),true)
  for(const path of ['etc/ssl/certs/public.pem','app/server.js','app/node_modules/dotenv/lib/main.js'])assert.equal(forbiddenImagePath(path),false)
})
test('image audit refuses mutable references before invoking Docker',async()=>{
  for(const value of ['', 'pos:latest',`sha256:${'a'.repeat(64)}\n`, 'PRIVATE_REFERENCE_CANARY'])await assert.rejects(auditReleaseImage(value),{message:'RELEASE_IMAGE_IMMUTABLE_REFERENCE_REQUIRED'})
})
test('reviewed public test vectors do not permit unknown keys or extra copies of the same key in another file',()=>{
  assert.deepEqual(classifyPrivateKeys({publicVector:1},{publicVector:1}),{unknown:0,publicTestVectors:1})
  assert.deepEqual(classifyPrivateKeys({publicVector:2,unknownSecret:1},{publicVector:1}),{unknown:2,publicTestVectors:1})
  assert.deepEqual(classifyPrivateKeys({publicVector:1},{}),{unknown:1,publicTestVectors:0})
})
