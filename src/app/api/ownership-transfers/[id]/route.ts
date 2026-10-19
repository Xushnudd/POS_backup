import {NextRequest,NextResponse} from 'next/server'
import {z} from 'zod'
import {withApi} from '@/server/api'
import {getRequestToken,verifyToken} from '@/lib/auth'
import {AccessError} from '@/server/auth/policy'
import {respondOwnership} from '@/server/users/service'
import {setSessionCookie} from '@/server/auth/session'
export const POST=withApi(async(request:NextRequest,{params}:{params:Promise<{id:string}>})=>{
 const context=await verifyToken(getRequestToken(request)??'');if(!context)throw new AccessError(401,'UNAUTHORIZED')
 const {id}=await params;z.string().uuid().parse(id)
 const {action,operationId}=z.object({action:z.enum(['accept','cancel']),operationId:z.string().uuid().optional()}).strict().parse(await request.json())
 const result=await respondOwnership(context,id,action,operationId)
 const response=NextResponse.json({success:true,data:result.request})
 if(result.token)setSessionCookie(response,result.token)
 return response
})
