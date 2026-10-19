import {NextRequest,NextResponse} from 'next/server'
import {withApi} from '@/server/api'
import {verifyToken,getRequestToken} from '@/lib/auth'
import {AccessError} from '@/server/auth/policy'
import {createVariant,listVariants,variantSchema} from '@/server/catalog/variants'
type Params={params:Promise<{id:string}>}
export const GET=withApi(async(request:NextRequest,{params}:Params)=>{const ctx=await verifyToken(getRequestToken(request)??'');if(!ctx)throw new AccessError(401,'UNAUTHORIZED');return NextResponse.json(await listVariants(ctx,(await params).id,request.nextUrl.searchParams))})
export const POST=withApi(async(request:NextRequest,{params}:Params)=>{const ctx=await verifyToken(getRequestToken(request)??'');if(!ctx)throw new AccessError(401,'UNAUTHORIZED');return NextResponse.json({success:true,data:await createVariant(ctx,(await params).id,variantSchema.parse(await request.json()))})})
