import {NextRequest,NextResponse} from 'next/server'
import {withApi} from '@/server/api'
import {getRequestToken,verifyToken} from '@/lib/auth'
import {AccessError} from '@/server/auth/policy'
import {getStockPosition} from '@/server/inventory/reservations'
export const GET=withApi(async(request:NextRequest)=>{const ctx=await verifyToken(getRequestToken(request)??'');if(!ctx)throw new AccessError(401,'UNAUTHORIZED');const storeId=request.nextUrl.searchParams.get('storeId'),productId=request.nextUrl.searchParams.get('productId');if(!storeId||!productId)throw new AccessError(400,'STOCK_SCOPE_REQUIRED');return NextResponse.json({success:true,data:await getStockPosition(ctx,storeId,productId)})})
