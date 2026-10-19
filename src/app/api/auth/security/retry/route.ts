import {NextRequest,NextResponse} from 'next/server'
import {z} from 'zod'
import {withApi} from '@/server/api'
import {getRequestToken,verifySession} from '@/server/auth/session'
import {AccessError} from '@/server/auth/policy'
import {consumeLimit} from '@/server/auth/rate-limit'
import {retrySecurityNotice} from '@/server/security/service'
export const POST=withApi(async(request:NextRequest)=>{
 const context=await verifySession(getRequestToken(request)??'');if(!context)throw new AccessError(401,'UNAUTHORIZED')
 const input=z.object({operationId:z.string().uuid(),eventId:z.string().uuid()}).strict().parse(await request.json())
 await consumeLimit('security.retry',context.userId,10,60000)
 return NextResponse.json({success:true,data:await retrySecurityNotice(context,input.eventId,input.operationId)})
})
