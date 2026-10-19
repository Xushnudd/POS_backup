import {NextRequest,NextResponse} from 'next/server'
import {withApi} from '@/server/api'
import {verifyToken,getRequestToken} from '@/lib/auth'
import {AccessError} from '@/server/auth/policy'
import {returnSale,returnSchema} from '@/server/returns/service'
import {consumeLimit} from '@/server/auth/rate-limit'
export const POST=withApi(async(request:NextRequest,{params}:{params:Promise<{id:string}>})=>{
 const context=await verifyToken(getRequestToken(request)??'');if(!context)throw new AccessError(401,'UNAUTHORIZED');
 await consumeLimit('return.preview',context.organizationId+':'+context.userId,30,60000);
 return NextResponse.json({success:true,data:await returnSale(context,(await params).id,returnSchema.parse(await request.json()),true)});
});
