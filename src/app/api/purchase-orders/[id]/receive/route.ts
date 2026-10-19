import {NextRequest,NextResponse} from 'next/server'
import {withApi} from '@/server/api'
import {getRequestToken,verifyToken} from '@/lib/auth'
import {AccessError} from '@/server/auth/policy'
import {receivePurchaseOrder,receiptSchema} from '@/server/purchases/orders'
export const POST=withApi(async(request:NextRequest,{params}:{params:Promise<{id:string}>})=>{const ctx=await verifyToken(getRequestToken(request)??'');if(!ctx)throw new AccessError(401,'UNAUTHORIZED');return NextResponse.json({success:true,data:await receivePurchaseOrder(ctx,(await params).id,receiptSchema.parse(await request.json()))});});
