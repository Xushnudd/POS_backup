import {NextRequest,NextResponse} from 'next/server'
import {withApi} from '@/server/api'
import {getRequestToken,verifyToken} from '@/lib/auth'
import {AccessError} from '@/server/auth/policy'
import {relocateStock,relocationSchema} from '@/server/inventory/reservations'
export const POST=withApi(async(request:NextRequest)=>{const ctx=await verifyToken(getRequestToken(request)??'');if(!ctx)throw new AccessError(401,'UNAUTHORIZED');return NextResponse.json({success:true,data:await relocateStock(ctx,relocationSchema.parse(await request.json()))})})
