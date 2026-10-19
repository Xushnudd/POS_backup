import {NextRequest,NextResponse} from 'next/server'
import {withApi} from '@/server/api'
import {verifyToken,getRequestToken} from '@/lib/auth'
import {AccessError} from '@/server/auth/policy'
import {consumeLimit} from '@/server/auth/rate-limit'
import {updateCustomRole} from '@/server/users/custom-roles'
export const PUT=withApi(async(request:NextRequest,{params}:{params:Promise<{id:string}>})=>{
 const ctx=await verifyToken(getRequestToken(request)??'');if(!ctx)throw new AccessError(401,'UNAUTHORIZED')
 await consumeLimit('users.role.write',ctx.organizationId+':'+ctx.userId,20,60000)
 return NextResponse.json({success:true,data:await updateCustomRole(ctx,(await params).id,await request.json())})
})
