import {NextRequest,NextResponse} from 'next/server'
import {z} from 'zod'
import {withApi} from '@/server/api'
import {getRequestToken,verifyToken} from '@/lib/auth'
import {AccessError} from '@/server/auth/policy'
import {readBatchCount,reconcileBatchCount,batchCountSchema} from '@/server/inventory/batches'
type Params={params:Promise<{productId:string}>}
export const GET=withApi(async(request:NextRequest,{params}:Params)=>{const context=await verifyToken(getRequestToken(request)??'');if(!context)throw new AccessError(401,'UNAUTHORIZED');const {productId}=await params;return NextResponse.json({success:true,data:await readBatchCount(context,z.string().uuid().parse(request.nextUrl.searchParams.get('storeId')),z.string().uuid().parse(productId))},{headers:{'Cache-Control':'no-store'}})})
export const POST=withApi(async(request:NextRequest,{params}:Params)=>{const context=await verifyToken(getRequestToken(request)??'');if(!context)throw new AccessError(401,'UNAUTHORIZED');const {productId}=await params;return NextResponse.json({success:true,data:await reconcileBatchCount(context,z.string().uuid().parse(productId),batchCountSchema.parse(await request.json()))})})
