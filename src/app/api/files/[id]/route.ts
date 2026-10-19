import {NextRequest,NextResponse} from 'next/server'
import {withApi} from '@/server/api'
import {verifyToken,getRequestToken} from '@/lib/auth'
import {AccessError} from '@/server/auth/policy'
import {readAsset,deleteAsset,deleteSchema} from '@/server/files/assets'
type Params={params:Promise<{id:string}>}
export const GET=withApi(async(request:NextRequest,{params}:Params)=>{const ctx=await verifyToken(getRequestToken(request)??'');if(!ctx)throw new AccessError(401,'UNAUTHORIZED');const asset=await readAsset(ctx,(await params).id);return new Response(new Uint8Array(asset.data!),{headers:{'Content-Type':asset.mime,'Content-Length':String(asset.size),'Content-Disposition':'inline; filename="image.webp"'}})},{binary:true})
export const DELETE=withApi(async(request:NextRequest,{params}:Params)=>{const ctx=await verifyToken(getRequestToken(request)??'');if(!ctx)throw new AccessError(401,'UNAUTHORIZED');return NextResponse.json({success:true,data:await deleteAsset(ctx,(await params).id,deleteSchema.parse(await request.json()))})})
