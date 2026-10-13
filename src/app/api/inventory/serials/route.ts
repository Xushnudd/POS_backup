import {NextRequest,NextResponse} from 'next/server'
import {z} from 'zod'
import {withApi} from '@/server/api'
import {getRequestToken,verifyToken} from '@/lib/auth'
import {AccessError} from '@/server/auth/policy'
import {listSerials} from '@/server/inventory/serials'
const schema=z.object({storeId:z.string().uuid(),productId:z.string().uuid().optional(),receiptId:z.string().uuid().optional(),saleItemId:z.string().uuid().optional(),transferId:z.string().uuid().optional(),search:z.string().trim().max(100).optional(),state:z.enum(['available','sold','transit','damaged','retired']).optional(),page:z.coerce.number().int().min(1).max(10000).default(1)}).strict()
export const GET=withApi(async(request:NextRequest)=>{
 const ctx=await verifyToken(getRequestToken(request)??'');if(!ctx)throw new AccessError(401,'UNAUTHORIZED')
 const result=await listSerials(ctx,schema.parse(Object.fromEntries(request.nextUrl.searchParams)))
 return NextResponse.json({success:true,data:result.data,pagination:{page:result.page,limit:result.limit,total:result.total,totalPages:Math.ceil(result.total/result.limit)}},{headers:{'Cache-Control':'no-store'}})
})
