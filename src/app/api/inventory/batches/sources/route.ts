import {NextRequest,NextResponse} from 'next/server'
import {z} from 'zod'
import {withApi} from '@/server/api'
import {getRequestToken,verifyToken} from '@/lib/auth'
import {AccessError} from '@/server/auth/policy'
import {readBatchSource} from '@/server/inventory/batches'
const schema=z.object({kind:z.enum(['sale','transfer_out']),id:z.string().uuid(),productId:z.string().uuid()}).strict()
export const GET=withApi(async(request:NextRequest)=>{
 const context=await verifyToken(getRequestToken(request)??'');if(!context)throw new AccessError(401,'UNAUTHORIZED')
 const input=schema.parse(Object.fromEntries(request.nextUrl.searchParams))
 return NextResponse.json({success:true,data:await readBatchSource(context,input.kind,input.id,input.productId)},{headers:{'Cache-Control':'no-store'}})
})
