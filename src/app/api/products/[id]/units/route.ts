import {NextRequest,NextResponse} from 'next/server'
import {withApi} from '@/server/api'
import {getRequestToken,verifySession} from '@/server/auth/session'
import {AccessError} from '@/server/auth/policy'
import {consumeLimit} from '@/server/auth/rate-limit'
import {conversionSchema,listConversions,setConversion} from '@/server/catalog/conversions'
export const GET=withApi(async(request:NextRequest,{params}:{params:Promise<{id:string}>})=>{const ctx=await verifySession(getRequestToken(request)??'');if(!ctx)throw new AccessError(401,'UNAUTHORIZED');return NextResponse.json({success:true,data:await listConversions(ctx,(await params).id)})})
export const POST=withApi(async(request:NextRequest,{params}:{params:Promise<{id:string}>})=>{const ctx=await verifySession(getRequestToken(request)??'');if(!ctx)throw new AccessError(401,'UNAUTHORIZED');await consumeLimit('catalog.conversion',ctx.userId,30,60000);return NextResponse.json({success:true,data:await setConversion(ctx,(await params).id,conversionSchema.parse(await request.json()))})})
