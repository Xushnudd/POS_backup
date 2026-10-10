import type { TokenPayload } from '@/lib/auth'
import { consumeLimit } from './rate-limit'
import {requestBudgetSetting} from './request-budget-config'
import {isIP} from 'node:net'
export {requestBudgetSetting} from './request-budget-config'
export async function consumeRequestBudget(context:TokenPayload,method:string){
 const read=['GET','HEAD'].includes(method)
 await consumeLimit(read?'api.read':'api.write',context.organizationId+':'+context.userId,
  requestBudgetSetting(read?'API_READS_PER_MINUTE':'API_WRITES_PER_MINUTE'),60000)
}
export async function consumePublicRequestBudget(headers:Headers){
 const ip=headers.get('x-real-ip')
 // Never treat a caller-supplied forwarding header as an authenticated identity.
 const identity=process.env.TRUST_PROXY_IP==='true'&&ip&&isIP(ip)?ip:'unattributed'
 await consumeLimit('api.public.write',identity,requestBudgetSetting('API_PUBLIC_WRITES_PER_MINUTE'),60000)
}
