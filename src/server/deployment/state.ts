import {open} from 'node:fs/promises'
import {constants} from 'node:fs'
import {isAbsolute} from 'node:path'
import {z} from 'zod'
import {AccessError} from '../auth/policy'
const schema=z.object({maintenance:z.boolean(),message:z.string().trim().min(3).max(500),expectedEndAt:z.iso.datetime({offset:true}).optional()}).strict()
export type DeploymentState={maintenance:boolean;message:string;expectedEndAt?:string;release:string;configurationValid:boolean}
// Next's DefinePlugin can replace an unconfigured deployment ID with false.
// Never coerce that boolean into a seemingly valid "false" release label.
export function deploymentRelease(value:unknown):string{
 return typeof value==='string'&&/^[A-Za-z0-9._-]{1,100}$/.test(value)?value:'unversioned'
}
// This is operator-owned configuration, never a business-facing write API.
// Atomic rename permits all instances/workers to observe the same drain switch.
export async function deploymentState():Promise<DeploymentState>{
 const release=deploymentRelease(process.env.NEXT_DEPLOYMENT_ID)
 const path=process.env.POS_DEPLOYMENT_STATE_FILE
 if(!path)return {maintenance:false,message:'',release,configurationValid:true}
 let handle:Awaited<ReturnType<typeof open>>|undefined
 try{
  if(!isAbsolute(path))throw new Error('Invalid configuration path')
  handle=await open(path,constants.O_RDONLY|constants.O_NOFOLLOW)
  const stat=await handle.stat()
  if(!stat.isFile()||stat.size>4096||(stat.mode&0o022)!==0)throw new Error('Unsafe configuration')
  const buffer=Buffer.alloc(4097),{bytesRead}=await handle.read(buffer,0,buffer.length,0)
  if(bytesRead>4096)throw new Error('Configuration too large')
  return {...schema.parse(JSON.parse(buffer.subarray(0,bytesRead).toString('utf8'))),release,configurationValid:true}
 }catch{return {maintenance:true,message:'Texnik xizmat holatini tekshirib bo‘lmadi. Saqlangan amallarni o‘chirmang; operator bilan bog‘laning.',release,configurationValid:false}}
 finally{await handle?.close().catch(()=>undefined)}
}
export async function assertNewOperationAllowed(){const state=await deploymentState();if(state.maintenance)throw new AccessError(503,'MAINTENANCE',state.message,30)}
