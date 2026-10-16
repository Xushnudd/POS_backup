import {NextRequest,NextResponse} from 'next/server'
import {z} from 'zod'
import {withApi} from '@/server/api'
import {getRequestToken,verifyToken} from '@/lib/auth'
import {AccessError} from '@/server/auth/policy'
import {consumeLimit} from '@/server/auth/rate-limit'
import {enqueueJob,jobSchema} from '@/server/jobs/service'
import {listCustomerReminders} from '@/server/customers/reminders'
const schema=z.object({operationId:z.string().uuid(),consentEventId:z.string().uuid()}).strict()
async function context(request:NextRequest){const ctx=await verifyToken(getRequestToken(request)??'');if(!ctx)throw new AccessError(401,'UNAUTHORIZED');if(ctx.role!=='owner')throw new AccessError(403,'OWNER_REQUIRED');await consumeLimit('customer.reminders',ctx.organizationId+':'+ctx.userId,30,60000);return ctx}
export const GET=withApi(async(request:NextRequest,{params}:{params:Promise<{id:string}>})=>NextResponse.json({success:true,data:await listCustomerReminders(await context(request),(await params).id,Number(request.nextUrl.searchParams.get('page')??'1'))}))
export const POST=withApi(async(request:NextRequest,{params}:{params:Promise<{id:string}>})=>{
 const ctx=await context(request),{id}=await params,input=schema.parse(await request.json())
 const data=await enqueueJob(ctx,jobSchema.parse({operationId:input.operationId,type:'customer_reminder',reminder:{customerId:id,consentEventId:input.consentEventId},reason:'Owner requested consented in-person service statement'}))
 return NextResponse.json({success:true,data})
})
