import {NextRequest,NextResponse} from 'next/server'
import {withApi} from '@/server/api'
import {getRequestToken,verifyToken} from '@/lib/auth'
import {AccessError} from '@/server/auth/policy'
import {recordWarrantyService,serviceSchema} from '@/server/inventory/serials'
export const POST=withApi(async(request:NextRequest)=>{
 const ctx=await verifyToken(getRequestToken(request)??'');if(!ctx)throw new AccessError(401,'UNAUTHORIZED')
 return NextResponse.json({success:true,data:await recordWarrantyService(ctx,serviceSchema.parse(await request.json()))})
})
