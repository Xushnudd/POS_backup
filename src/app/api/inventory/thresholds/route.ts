import {NextRequest,NextResponse} from 'next/server'
import {z} from 'zod'
import {withApi} from '@/server/api'
import {getRequestToken,verifyToken} from '@/lib/auth'
import {AccessError} from '@/server/auth/policy'
import {setThreshold} from '@/server/monitoring/service'
import {nonnegativeQuantitySchema} from '@/server/catalog/service'
import {decimal} from '@/server/sales/calculations'
export const POST=withApi(async(request:NextRequest)=>{
 const context=await verifyToken(getRequestToken(request)??'');if(!context)throw new AccessError(401,'UNAUTHORIZED')
 const input=z.object({storeId:z.string().uuid(),productId:z.string().uuid(),minimum:nonnegativeQuantitySchema,maximum:nonnegativeQuantitySchema,operationId:z.string().uuid()}).strict().refine(v=>decimal(v.maximum).gte(v.minimum),'Maksimum minimumdan kam bo‘lmasin').parse(await request.json())
 return NextResponse.json({success:true,data:await setThreshold(context,input)})
})
