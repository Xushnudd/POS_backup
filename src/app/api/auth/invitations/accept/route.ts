import { NextRequest, NextResponse } from 'next/server'
import { withApi } from '@/server/api'
import { getRequestToken, verifyToken } from '@/lib/auth'
import { consumeLimit } from '@/server/auth/rate-limit'
import { acceptInvitation, acceptInvitationSchema } from '@/server/users/invitations'
export const POST=withApi(async(request:NextRequest)=>{
 const input=acceptInvitationSchema.parse(await request.json())
 await consumeLimit('invitation.accept',input.token,10)
 if (process.env.TRUST_PROXY_IP==='true') await consumeLimit('invitation.accept.ip',request.headers.get('x-real-ip')??'unknown',30)
 const context=await verifyToken(getRequestToken(request)??'')
 return NextResponse.json({success:true,data:await acceptInvitation(input,context)})
},{public:true})
