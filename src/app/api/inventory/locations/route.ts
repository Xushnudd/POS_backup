import {NextRequest,NextResponse} from 'next/server'
import {withApi} from '@/server/api'
import {getRequestToken,verifyToken} from '@/lib/auth'
import {AccessError} from '@/server/auth/policy'
import {createLocation,listStockControl,locationSchema} from '@/server/inventory/reservations'
export const GET=withApi(async(request:NextRequest)=>{const ctx=await verifyToken(getRequestToken(request)??'');if(!ctx)throw new AccessError(401,'UNAUTHORIZED');const storeId=request.nextUrl.searchParams.get('storeId');if(!storeId)throw new AccessError(400,'STORE_REQUIRED');return NextResponse.json({success:true,data:await listStockControl(ctx,storeId,Number(request.nextUrl.searchParams.get('page')??1),Number(request.nextUrl.searchParams.get('limit')??50))})})
export const POST=withApi(async(request:NextRequest)=>{const ctx=await verifyToken(getRequestToken(request)??'');if(!ctx)throw new AccessError(401,'UNAUTHORIZED');return NextResponse.json({success:true,data:await createLocation(ctx,locationSchema.parse(await request.json()))})})
