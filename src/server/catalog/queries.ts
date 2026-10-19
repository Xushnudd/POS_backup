import type { TokenPayload } from '@/lib/auth'
import { AccessError } from '../auth/policy'
import { consumeLimit } from '../auth/rate-limit'
import { EXPORT_CAP } from '../exports/csv'
export function paging(q:URLSearchParams,defaultLimit=20){
 const page=Number(q.get('page')??1),limit=Number(q.get('limit')??defaultLimit),skip=(page-1)*limit
 if(!Number.isSafeInteger(page)||page<1||!Number.isSafeInteger(limit)||limit<1||limit>200||skip>2147483647)throw new AccessError(400,'INVALID_PAGINATION')
 return {page,limit,skip}
}
export function searchTerm(q:URLSearchParams,max=200){const search=q.get('search')?.trim()??'';if(search.length>max)throw new AccessError(400,'INVALID_FILTER');return search}
export function exportCap(total:number){if(total>EXPORT_CAP)throw new AccessError(413,'EXPORT_TOO_LARGE','Eksport 10000 qatordan oshdi; filtrni toraytiring')}
export async function exporting(q:URLSearchParams,context:TokenPayload,category:string){
 if(q.has('format')&&q.get('format')!=='csv')throw new AccessError(400,'INVALID_FORMAT')
 if(q.get('format')!=='csv')return false
 if(context.role==='cashier')throw new AccessError(403,'FORBIDDEN')
 await consumeLimit(category,context.organizationId+':'+context.userId,10,60000)
 return true
}
export function pagination(page:number,limit:number,total:number){return {page,limit,total,totalPages:Math.ceil(total/limit)}}
