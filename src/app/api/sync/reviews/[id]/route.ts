import {NextRequest,NextResponse} from 'next/server'
import {z} from 'zod'
import {withApi} from '@/server/api'
import {getRequestToken,verifyToken} from '@/lib/auth'
import {AccessError} from '@/server/auth/policy'
import {resolveReview} from '@/server/sync/reviews'
export const POST=withApi(async(request:NextRequest,{params}:{params:Promise<{id:string}>})=>{
 const context=await verifyToken(getRequestToken(request)??'');if(!context)throw new AccessError(401,'UNAUTHORIZED')
 const id=z.string().uuid().parse((await params).id),input=z.object({operationId:z.string().uuid(),reason:z.string().trim().min(3).max(1000)}).strict().parse(await request.json())
 return NextResponse.json({success:true,data:await resolveReview(context,id,input)})
})
