import { NextRequest, NextResponse } from 'next/server'
import { withApi } from '@/server/api'
import { getRequestToken, verifyToken } from '@/lib/auth'
import { AccessError } from '@/server/auth/policy'
import { revokeInvitation } from '@/server/users/invitations'
export const DELETE=withApi(async(request:NextRequest,{params}:{params:Promise<{id:string;invitationId:string}>})=>{
 const context=await verifyToken(getRequestToken(request)??'')
 if (!context) throw new AccessError(401,'UNAUTHORIZED')
 const {invitationId}=await params
 return NextResponse.json({success:true,data:await revokeInvitation(context,invitationId)})
})
