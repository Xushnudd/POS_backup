import { NextRequest,NextResponse } from 'next/server'
import { z } from 'zod'
import { withApi } from '@/server/api'
import { getRequestToken,verifyToken } from '@/lib/auth'
import { AccessError } from '@/server/auth/policy'
import { consumeLimit } from '@/server/auth/rate-limit'
import { commandTicket } from '@/server/support/tickets'
export const POST=withApi(async(request:NextRequest,{params}:{params:Promise<{id:string}>})=>{
 const context=await verifyToken(getRequestToken(request)??'');if(!context)throw new AccessError(401,'UNAUTHORIZED');await consumeLimit('support.ticket.command',context.userId,20,60000)
 return NextResponse.json({success:true,data:await commandTicket(context,z.string().uuid().parse((await params).id),await request.json())})
})
