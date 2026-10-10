import { NextRequest,NextResponse } from 'next/server'
import { z } from 'zod'
import { withApi } from '@/server/api'
import { getRequestToken,verifyToken } from '@/lib/auth'
import { AccessError } from '@/server/auth/policy'
import { consumeLimit } from '@/server/auth/rate-limit'
import { getTicket } from '@/server/support/tickets'
export const GET=withApi(async(request:NextRequest,{params}:{params:Promise<{id:string}>})=>{
 const context=await verifyToken(getRequestToken(request)??'');if(!context)throw new AccessError(401,'UNAUTHORIZED');await consumeLimit('support.ticket.read',context.userId,30,60000)
 const id=z.string().uuid().parse((await params).id),scope=z.enum(['tenant','platform']).parse(request.nextUrl.searchParams.get('scope')??'tenant'),page=z.coerce.number().int().min(1).max(100000).parse(request.nextUrl.searchParams.get('page')??1)
 return NextResponse.json({success:true,data:await getTicket(context,id,scope,page)})
})
