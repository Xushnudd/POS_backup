import { NextRequest,NextResponse } from 'next/server'
import { withApi } from '@/server/api'
import { getRequestToken,verifyToken } from '@/lib/auth'
import { AccessError } from '@/server/auth/policy'
import { consumeLimit } from '@/server/auth/rate-limit'
import { ticketOperators } from '@/server/support/tickets'
export const GET=withApi(async(request:NextRequest)=>{const context=await verifyToken(getRequestToken(request)??'');if(!context)throw new AccessError(401,'UNAUTHORIZED');await consumeLimit('support.ticket.operators',context.userId,10,60000);return NextResponse.json({success:true,data:await ticketOperators(context)})})
