import {randomInt} from 'node:crypto'
import {performance} from 'node:perf_hooks'
import {AccessError} from '@/server/auth/policy'

export type AttemptCounts={calls:number;conflicts:number;retries:number;failed:number}
export const attemptCounts=():AttemptCounts=>({calls:0,conflicts:0,retries:0,failed:0})
// The same protocol used by POS recovery: only the explicitly rolled-back
// serialization conflict is retried, always with the original operation key.
// Timers in the caller include every physical attempt and backoff.
export async function originalKeyAttempt<T>(key:string,run:(key:string)=>Promise<T>,counts:AttemptCounts,
 dependencies:{sleep?:(ms:number)=>Promise<void>;now?:()=>number}={}){
 const now=dependencies.now??(()=>performance.now()),sleep=dependencies.sleep??(ms=>new Promise(resolve=>setTimeout(resolve,ms)))
 const deadline=now()+10000
 for(let attempt=0;attempt<8;attempt++){
  counts.calls++
  try{return await run(key)}catch(error){
   counts.failed++
   if(!(error instanceof AccessError)||error.status!==409||error.code!=='CONCURRENT_CONFLICT')throw error
   counts.conflicts++
   if(attempt===7||now()>=deadline)throw error
   counts.retries++
   await sleep(Math.min(25*2**attempt,200)+randomInt(0,26))
   if(now()>=deadline)throw error
  }
 }
 throw new Error('Retry bound exhausted')
}
