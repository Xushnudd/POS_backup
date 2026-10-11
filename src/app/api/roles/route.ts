import {NextRequest,NextResponse} from 'next/server'
import {withApi} from '@/server/api'
import {verifyToken,getRequestToken} from '@/lib/auth'
import {AccessError} from '@/server/auth/policy'
import {consumeLimit} from '@/server/auth/rate-limit'
import {listCustomRoles,createCustomRole} from '@/server/users/custom-roles'
export const GET=withApi(async(request:NextRequest)=>{
 const ctx=await verifyToken(getRequestToken(request)??'');if(!ctx)throw new AccessError(401,'UNAUTHORIZED')
 const query=new URL(request.url).searchParams
 return NextResponse.json({success:true,data:await listCustomRoles(ctx,Number(query.get('page')??1),query.get('search')??'')})
},{touchSession:false})
export const POST=withApi(async(request:NextRequest)=>{
 const ctx=await verifyToken(getRequestToken(request)??'');if(!ctx)throw new AccessError(401,'UNAUTHORIZED')
 await consumeLimit('users.role.write',ctx.organizationId+':'+ctx.userId,20,60000)
 return NextResponse.json({success:true,data:await createCustomRole(ctx,await request.json())})
})
