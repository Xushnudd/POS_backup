import {NextRequest,NextResponse} from 'next/server'
import {withApi} from '@/server/api'
import {getRequestToken,verifyToken} from '@/lib/auth'
import {AccessError} from '@/server/auth/policy'
import {consumeLimit} from '@/server/auth/rate-limit'
import {enqueueJob,jobSchema,listJobs} from '@/server/jobs/service'
async function context(request:NextRequest){const ctx=await verifyToken(getRequestToken(request)??'');if(!ctx)throw new AccessError(401,'UNAUTHORIZED');return ctx}
export const POST=withApi(async(request:NextRequest)=>{const ctx=await context(request);await consumeLimit('job.enqueue',ctx.organizationId+':'+ctx.userId,5,60000);return NextResponse.json({success:true,data:await enqueueJob(ctx,jobSchema.parse(await request.json()))})})
import {parseListQuery,journalListSorts} from '@/lib/list-query'
export const GET=withApi(async(request:NextRequest)=>{
 const ctx=await context(request),params=request.nextUrl.searchParams,state=params.get('state')??undefined;
 let query;try{query=parseListQuery(params,journalListSorts,'newest')}catch(error){throw new AccessError(400,error instanceof Error?error.message:'INVALID_FILTER')}
 if(state&&!['queued','running','succeeded','dead','cancelled'].includes(state))throw new AccessError(400,'INVALID_STATE');
 await consumeLimit('job.read',ctx.organizationId+':'+ctx.userId,60,60000);
 const {page,limit,sort,search}=query,result=await listJobs(ctx,page,state,{limit,sort,search});
 return NextResponse.json({success:true,data:result.rows,pagination:{page,limit,total:result.total,totalPages:Math.ceil(result.total/limit)}});
});
