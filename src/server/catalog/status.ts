import type { TokenPayload } from '@/lib/auth'
import { AccessError } from '../auth/policy'
export function activeStatus(params:URLSearchParams,context:TokenPayload){
 const status=params.get('status')??'active'
 if(!['active','archived','all'].includes(status))throw new AccessError(400,'INVALID_STATUS')
 if(status!=='active'&&context.role==='cashier')throw new AccessError(403,'FORBIDDEN')
 return status==='all'?{}:{isActive:status==='active'}
}
