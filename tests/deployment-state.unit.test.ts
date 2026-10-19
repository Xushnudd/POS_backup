import test from 'node:test'
import assert from 'node:assert/strict'
import {mkdtemp,writeFile,chmod,symlink,rm} from 'node:fs/promises'
import {tmpdir} from 'node:os'
import {join} from 'node:path'
import {spawnSync} from 'node:child_process'
import {deploymentState,assertNewOperationAllowed} from '@/server/deployment/state'
test('Operator maintenance configuration is bounded, strict and fails closed without disclosing path/content',async()=>{
 const directory=await mkdtemp(join(tmpdir(),'pos-deployment-unit-')),path=join(directory,'state.json'),old=process.env.POS_DEPLOYMENT_STATE_FILE
 try{
  delete process.env.POS_DEPLOYMENT_STATE_FILE;assert.equal((await deploymentState()).maintenance,false)
  process.env.POS_DEPLOYMENT_STATE_FILE=path;assert.equal((await deploymentState()).configurationValid,false)
  await writeFile(path,JSON.stringify({maintenance:false,message:'Service available'}),{mode:0o600});await assertNewOperationAllowed()
  await writeFile(path,JSON.stringify({maintenance:true,message:'Planned maintenance',expectedEndAt:'2026-10-10T00:00:00Z'}));await assert.rejects(assertNewOperationAllowed,e=>e instanceof Error&&'code'in e&&e.code==='MAINTENANCE')
  await chmod(path,0o666);assert.equal((await deploymentState()).configurationValid,false);await chmod(path,0o600)
  for(const content of ['{','x'.repeat(5000),JSON.stringify({maintenance:false,message:'Good message',password:'not-a-secret'}),JSON.stringify({maintenance:'false',message:'Wrong flag'})]){await writeFile(path,content);const value=await deploymentState();assert.equal(value.maintenance,true);assert.equal(value.configurationValid,false);assert.ok(!JSON.stringify(value).includes(path))}
  const linked=join(directory,'linked');await symlink(path,linked);process.env.POS_DEPLOYMENT_STATE_FILE=linked;assert.equal((await deploymentState()).configurationValid,false)
 }finally{if(old===undefined)delete process.env.POS_DEPLOYMENT_STATE_FILE;else process.env.POS_DEPLOYMENT_STATE_FILE=old;await rm(directory,{recursive:true,force:true})}
})

test('Operator CLI atomically publishes safe flags and rejects ambiguous dates and symlink destinations',async()=>{
 const directory=await mkdtemp(join(tmpdir(),'pos-deployment-cli-')),path=join(directory,'state.json'),old=process.env.POS_DEPLOYMENT_STATE_FILE
 const run=(...args:string[])=>spawnSync(process.execPath,['scripts/ops/set-maintenance.mjs',path,...args],{encoding:'utf8'})
 try{
  process.env.POS_DEPLOYMENT_STATE_FILE=path;assert.equal(run('on','Physical deployment window','2026-10-10T00:00:00Z').status,0);assert.equal((await deploymentState()).maintenance,true)
  assert.equal(run('off','Completed verified window').status,0);assert.equal((await deploymentState()).maintenance,false)
  assert.notEqual(run('on','No guessed timezone','2026-10-10T00:00:00').status,0);assert.equal((await deploymentState()).maintenance,false)
  await rm(path);await symlink(join(directory,'missing'),path);assert.notEqual(run('on','Cannot overwrite unsafe link').status,0)
 }finally{if(old===undefined)delete process.env.POS_DEPLOYMENT_STATE_FILE;else process.env.POS_DEPLOYMENT_STATE_FILE=old;await rm(directory,{recursive:true,force:true})}
})
