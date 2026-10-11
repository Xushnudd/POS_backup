import {NextRequest,NextResponse} from 'next/server'
import {z} from 'zod'
import {paging} from '@/server/catalog/queries'
import {withApi} from '@/server/api'
import {getRequestToken,verifyToken} from '@/lib/auth'
import {AccessError} from '@/server/auth/policy'
import {consumeLimit} from '@/server/auth/rate-limit'
import {incidentList,scan} from '@/server/monitoring/service'
async function context(request:NextRequest){const value=await verifyToken(getRequestToken(request)??'');if(!value)throw new AccessError(401,'UNAUTHORIZED');return value}
export const GET=withApi(async(request:NextRequest)=>{
 const params=request.nextUrl.searchParams,{page,limit}=paging(params,20),state=z.enum(['open','resolved']).parse(params.get('state')??'open')
 const result=await incidentList(await context(request),page,state,limit)
 return NextResponse.json({success:true,data:result.rows,pagination:{page,limit,total:result.total,totalPages:Math.ceil(result.total/limit)}})
})
export const POST=withApi(async(request:NextRequest)=>{
 const actor=await context(request);await consumeLimit('monitor.scan',actor.organizationId+':'+actor.userId,10,60000)
 const input=z.object({operationId:z.string().uuid()}).strict().parse(await request.json())
 return NextResponse.json({success:true,data:await scan(actor,input.operationId)})
})
