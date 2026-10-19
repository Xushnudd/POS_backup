import {NextRequest,NextResponse} from 'next/server'
import {withApi} from '@/server/api'
import {verifyToken,getRequestToken} from '@/lib/auth'
import {AccessError} from '@/server/auth/policy'
import {consumeLimit} from '@/server/auth/rate-limit'
import {z} from 'zod'
import {receiveAdvanceSchema,allocateAdvanceSchema,refundAdvanceSchema,receiveAdvance,allocateAdvance,refundAdvance,listAdvances} from '@/server/customers/advances'
const schema=z.discriminatedUnion('action',[
 receiveAdvanceSchema.extend({action:z.literal('receive')}),
 allocateAdvanceSchema.extend({action:z.literal('allocate')}),
 refundAdvanceSchema.extend({action:z.literal('refund')})])
async function context(request:NextRequest){const ctx=await verifyToken(getRequestToken(request)??'');if(!ctx)throw new AccessError(401,'UNAUTHORIZED');if(ctx.role!=='owner')throw new AccessError(403,'OWNER_REQUIRED');return ctx}
export const GET=withApi(async(request:NextRequest,{params}:{params:Promise<{id:string}>})=>{const ctx=await context(request),q=new URL(request.url).searchParams;await consumeLimit('customer.advance.read',ctx.organizationId+':'+ctx.userId,60,60000);return NextResponse.json({success:true,data:await listAdvances(ctx,(await params).id,{page:Number(q.get('page')??1),limit:Number(q.get('limit')??50)})})})
export const POST=withApi(async(request:NextRequest,{params}:{params:Promise<{id:string}>})=>{const ctx=await context(request),id=(await params).id,input=schema.parse(await request.json());await consumeLimit('customer.advance.write',ctx.organizationId+':'+ctx.userId,30,60000);const {action,...payload}=input;const result=action==='receive'?await receiveAdvance(ctx,id,receiveAdvanceSchema.parse(payload)):action==='allocate'?await allocateAdvance(ctx,id,allocateAdvanceSchema.parse(payload)):await refundAdvance(ctx,id,refundAdvanceSchema.parse(payload));return NextResponse.json({success:true,data:result})})
