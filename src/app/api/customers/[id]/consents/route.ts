import {NextRequest,NextResponse} from 'next/server'
import {withApi} from '@/server/api'
import {verifyToken,getRequestToken} from '@/lib/auth'
import {AccessError} from '@/server/auth/policy'
import {consumeLimit} from '@/server/auth/rate-limit'
import {consentHistory,recordConsent} from '@/server/customers/consent'

async function context(request:NextRequest){
 const ctx=await verifyToken(getRequestToken(request)??'')
 if(!ctx)throw new AccessError(401,'UNAUTHORIZED')
 if(ctx.role!=='owner')throw new AccessError(403,'OWNER_REQUIRED')
 await consumeLimit('customer.consent',ctx.organizationId+':'+ctx.userId,60,60000)
 return ctx
}
export const GET=withApi(async(request:NextRequest,{params}:{params:Promise<{id:string}>})=>{
 const ctx=await context(request),before=new URL(request.url).searchParams.get('before')
 return NextResponse.json({success:true,data:await consentHistory(ctx,(await params).id,before===null?undefined:Number(before))})
})
export const POST=withApi(async(request:NextRequest,{params}:{params:Promise<{id:string}>})=>{
 const ctx=await context(request)
 return NextResponse.json({success:true,data:await recordConsent(ctx,(await params).id,await request.json())})
})
