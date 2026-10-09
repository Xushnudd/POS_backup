import {AsyncLocalStorage} from 'node:async_hooks'
import {Prisma} from '@prisma/client'
export type RequestTrace={requestId:string;organizationId?:string;operationId?:string}
export const requestTrace=new AsyncLocalStorage<RequestTrace>()
const allowed=new Set(['event','requestId','organizationId','operationId','status','code','durationMs','kind','count'])
export function logRecord(fields:Record<string,unknown>){
 return Object.fromEntries(Object.entries({...requestTrace.getStore(),...fields}).filter(([key,value])=>allowed.has(key)&&(typeof value==='string'||typeof value==='number')).map(([key,value])=>[key,typeof value==='string'?value.slice(0,200):value]))
}
export function logEvent(event:string,fields:Record<string,unknown>={}){console.info(JSON.stringify(logRecord({...fields,event})))}
const sensitive=/^pin$|pinHash|password|secret|token|cookie|authorization|credential|phone|email|address/i
export function safeAudit(value:unknown):unknown{
 if(value instanceof Date)return value.toISOString();
 if(value instanceof Prisma.Decimal)return value.toFixed();
 if(Array.isArray(value))return value.map(safeAudit)
 if(!value||typeof value!=='object')return value
 return Object.fromEntries(Object.entries(value).filter(([key])=>!sensitive.test(key)).map(([key,v])=>[key,safeAudit(v)]))
}
