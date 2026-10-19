import {NextRequest,NextResponse} from 'next/server'
import {z} from 'zod'
import {withApi} from '@/server/api'
import {getRequestToken,verifyToken} from '@/lib/auth'
import {AccessError} from '@/server/auth/policy'
import {readSerialHistory} from '@/server/inventory/serials'
export const GET=withApi(async(request:NextRequest,{params}:{params:Promise<{id:string}>})=>{
 const ctx=await verifyToken(getRequestToken(request)??'');if(!ctx)throw new AccessError(401,'UNAUTHORIZED')
 const id=z.string().uuid().parse((await params).id),query=z.object({page:z.coerce.number().int().min(1).max(10000).default(1)}).strict().parse(Object.fromEntries(request.nextUrl.searchParams))
 return NextResponse.json({success:true,data:await readSerialHistory(ctx,id,query.page)},{headers:{'Cache-Control':'no-store'}})
})
