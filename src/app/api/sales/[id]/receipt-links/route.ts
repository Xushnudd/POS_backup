import {NextRequest,NextResponse} from 'next/server'
import {withApi} from '@/server/api'
import {getRequestToken,verifyToken} from '@/lib/auth'
import {AccessError} from '@/server/auth/policy'
import {consumeLimit} from '@/server/auth/rate-limit'
import {createReceiptLink,listReceiptLinks,revokeReceiptLink} from '@/server/sales/receipt-links'
async function context(request:NextRequest){
 const ctx=await verifyToken(getRequestToken(request)??'')
 if(!ctx)throw new AccessError(401,'UNAUTHORIZED')
 await consumeLimit('receipt.links',ctx.organizationId+':'+ctx.userId,30,60000)
 return ctx
}
export const POST=withApi(async(request:NextRequest,{params}:{params:Promise<{id:string}>})=>{
 const result=await createReceiptLink(await context(request),(await params).id,await request.json())
 // Durable client acknowledgement stores only metadata, never the bearer URL.
 return NextResponse.json({success:true,data:{operationId:result.operationId,expiresAt:result.expiresAt,available:result.available}})
})
export const GET=withApi(async(request:NextRequest,{params}:{params:Promise<{id:string}>})=>NextResponse.json({success:true,data:await listReceiptLinks(await context(request),(await params).id,Number(request.nextUrl.searchParams.get('page')??'1'))}))
export const DELETE=withApi(async(request:NextRequest,{params}:{params:Promise<{id:string}>})=>NextResponse.json({success:true,data:await revokeReceiptLink(await context(request),(await params).id,await request.json())}))
