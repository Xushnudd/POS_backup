import {NextRequest,NextResponse} from 'next/server'
import {withApi} from '@/server/api'
import {verifyToken,getRequestToken} from '@/lib/auth'
import {AccessError} from '@/server/auth/policy'
import {brandUpdateSchema,writeBrand} from '@/server/catalog/brands'
export const PUT=withApi(async(request:NextRequest,{params}:{params:Promise<{id:string}>})=>{const ctx=await verifyToken(getRequestToken(request)??'');if(!ctx)throw new AccessError(401,'UNAUTHORIZED');return NextResponse.json({success:true,data:await writeBrand(ctx,brandUpdateSchema.parse(await request.json()),(await params).id)})})
