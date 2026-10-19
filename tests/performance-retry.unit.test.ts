import test from 'node:test'
import assert from 'node:assert/strict'
import {AccessError} from '@/server/auth/policy'
import {attemptCounts,originalKeyAttempt} from './performance/retry'
test('Performance recovery reuses the original key and records every conflict and retry',async()=>{
 const counts=attemptCounts(),keys:string[]=[]
 const result=await originalKeyAttempt('original-key',async key=>{keys.push(key);if(keys.length<3)throw new AccessError(409,'CONCURRENT_CONFLICT');return 'committed'},counts,{sleep:async()=>{}})
 assert.equal(result,'committed');assert.deepEqual(keys,['original-key','original-key','original-key'])
 assert.deepEqual(counts,{calls:3,conflicts:2,retries:2,failed:2})
})
test('Recovery never retries unknown conflicts, authorization failures or unknown network outcomes',async()=>{
 for(const error of [new AccessError(409,'OTHER_CONFLICT'),new AccessError(403,'FORBIDDEN'),new Error('Unknown response')]){
  const counts=attemptCounts();await assert.rejects(()=>originalKeyAttempt('original',async()=>{throw error},counts,{sleep:async()=>{}}),value=>value===error)
  assert.deepEqual(counts,{calls:1,conflicts:0,retries:0,failed:1})
 }
})
test('Conflict recovery stops at its attempt and elapsed-time bounds',async()=>{
 const conflict=new AccessError(409,'CONCURRENT_CONFLICT'),counts=attemptCounts()
 await assert.rejects(()=>originalKeyAttempt('original',async()=>{throw conflict},counts,{sleep:async()=>{},now:()=>0}),value=>value===conflict)
 assert.deepEqual(counts,{calls:8,conflicts:8,retries:7,failed:8})
 const timed=attemptCounts();let clock=0
 await assert.rejects(()=>originalKeyAttempt('original',async()=>{throw conflict},timed,{now:()=>clock,sleep:async()=>{clock=10000}}),value=>value===conflict)
 assert.deepEqual(timed,{calls:1,conflicts:1,retries:1,failed:1})
})
