import {NextRequest,NextResponse} from 'next/server'
import {withApi} from '@/server/api'
import {getRequestToken,verifyToken} from '@/lib/auth'
import {AccessError} from '@/server/auth/policy'
import {consumeLimit} from '@/server/auth/rate-limit'
import {closureStatus,requestClosure,cancelClosure} from '@/server/retention/closure'
async function contextFor(request:NextRequest,touch=true){const ctx=await verifyToken(getRequestToken(request)??'',{touch});if(!ctx)throw new AccessError(401,'UNAUTHORIZED');return ctx}
export const GET=withApi(async(request:NextRequest)=>{const ctx=await contextFor(request,false);await consumeLimit('closure.read',ctx.userId,30,60000);return NextResponse.json({success:true,data:await closureStatus(ctx)})},{touchSession:false})
export const POST=withApi(async(request:NextRequest)=>NextResponse.json({success:true,data:await requestClosure(await contextFor(request),await request.json())}))
export const PATCH=withApi(async(request:NextRequest)=>NextResponse.json({success:true,data:await cancelClosure(await contextFor(request),await request.json())}))
