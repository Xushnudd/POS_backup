import {NextRequest,NextResponse} from 'next/server'
import {withApi} from '@/server/api'
import {getRequestToken,verifySession} from '@/server/auth/session'
import {AccessError} from '@/server/auth/policy'
import {consumeLimit} from '@/server/auth/rate-limit'
import {complianceSchema,getCompliance,setCompliance} from '@/server/catalog/compliance'
export const GET=withApi(async(request:NextRequest,{params}:{params:Promise<{id:string}>})=>{const ctx=await verifySession(getRequestToken(request)??'');if(!ctx)throw new AccessError(401,'UNAUTHORIZED');return NextResponse.json({success:true,data:await getCompliance(ctx,(await params).id)})})
export const POST=withApi(async(request:NextRequest,{params}:{params:Promise<{id:string}>})=>{const ctx=await verifySession(getRequestToken(request)??'');if(!ctx)throw new AccessError(401,'UNAUTHORIZED');await consumeLimit('catalog.compliance',ctx.userId,30,60000);return NextResponse.json({success:true,data:await setCompliance(ctx,(await params).id,complianceSchema.parse(await request.json()))})})
