import { NextRequest,NextResponse } from 'next/server'
import { withApi } from '@/server/api'
import { getRequestToken,verifyToken } from '@/lib/auth'
import { AccessError } from '@/server/auth/policy'
import { consumeLimit } from '@/server/auth/rate-limit'
import { createTicket,listTickets,ticketListSchema } from '@/server/support/tickets'
async function actor(request:NextRequest){const context=await verifyToken(getRequestToken(request)??'');if(!context)throw new AccessError(401,'UNAUTHORIZED');await consumeLimit('support.tickets',context.organizationId+':'+context.userId,20,60000);return context}
export const POST=withApi(async(request:NextRequest)=>NextResponse.json({success:true,data:await createTicket(await actor(request),await request.json())}))
export const GET=withApi(async(request:NextRequest)=>{const query=request.nextUrl.searchParams;return NextResponse.json({success:true,data:await listTickets(await actor(request),ticketListSchema.parse({scope:query.get('scope')??'tenant',page:query.get('page')??1,search:query.get('search')??'',...(query.has('state')?{state:query.get('state')}:{}),...(query.has('severity')?{severity:query.get('severity')}:{})}))})})
