import {NextRequest,NextResponse} from 'next/server'
import {withApi} from '@/server/api'
import {getRequestToken,verifyToken} from '@/lib/auth'
import {AccessError} from '@/server/auth/policy'
import {consumeLimit} from '@/server/auth/rate-limit'
import {enqueueJob,jobSchema,listJobs} from '@/server/jobs/service'
async function context(request:NextRequest){const ctx=await verifyToken(getRequestToken(request)??'');if(!ctx)throw new AccessError(401,'UNAUTHORIZED');return ctx}
export const POST=withApi(async(request:NextRequest)=>{const ctx=await context(request);await consumeLimit('job.enqueue',ctx.organizationId+':'+ctx.userId,5,60000);return NextResponse.json({success:true,data:await enqueueJob(ctx,jobSchema.parse(await request.json()))})})
export const GET=withApi(async(request:NextRequest)=>{const ctx=await context(request),page=Number(request.nextUrl.searchParams.get('page')??1),state=request.nextUrl.searchParams.get('state')??undefined;if(state&&!['queued','running','succeeded','dead','cancelled'].includes(state))throw new AccessError(400,'INVALID_STATE');await consumeLimit('job.read',ctx.organizationId+':'+ctx.userId,60,60000);const result=await listJobs(ctx,page,state);return NextResponse.json({success:true,data:result.rows,pagination:{page,limit:20,total:result.total,totalPages:Math.ceil(result.total/20)}})})
