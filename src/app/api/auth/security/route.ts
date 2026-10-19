import {NextRequest,NextResponse} from 'next/server'
import {withApi} from '@/server/api'
import {getRequestToken,verifySession} from '@/server/auth/session'
import {AccessError} from '@/server/auth/policy'
import {consumeLimit} from '@/server/auth/rate-limit'
import {listSecurity} from '@/server/security/service'
export const GET=withApi(async(request:NextRequest)=>{
 const context=await verifySession(getRequestToken(request)??'',{touch:false});if(!context)throw new AccessError(401,'UNAUTHORIZED')
 await consumeLimit('security.read',context.userId,60,60000)
 const result=await listSecurity(context,Number(request.nextUrl.searchParams.get('page')??1),Number(request.nextUrl.searchParams.get('limit')??20))
 return NextResponse.json({success:true,...result})
},{touchSession:false})
