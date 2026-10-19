import {NextRequest,NextResponse} from 'next/server'
import {z} from 'zod'
import {withApi} from '@/server/api'
import {getRequestToken,verifySession} from '@/server/auth/session'
import {AccessError} from '@/server/auth/policy'
import {consumeLimit} from '@/server/auth/rate-limit'
import {readSecurityNotice} from '@/server/security/service'
export const POST=withApi(async(request:NextRequest)=>{
 const context=await verifySession(getRequestToken(request)??'');if(!context)throw new AccessError(401,'UNAUTHORIZED')
 const input=z.object({operationId:z.string().uuid(),noticeId:z.string().uuid()}).strict().parse(await request.json())
 await consumeLimit('security.read-mark',context.userId,30,60000)
 return NextResponse.json({success:true,data:await readSecurityNotice(context,input.noticeId,input.operationId)})
})
