import { NextRequest, NextResponse } from 'next/server'
import { withApi } from '@/server/api'
import { getRequestToken, verifyToken } from '@/lib/auth'
import { AccessError } from '@/server/auth/policy'
import { memberSchema, updateMember } from '@/server/users/service'
export const PUT=withApi(async(request:NextRequest,{params}:{params:Promise<{id:string;userId:string}>})=>{
 const context=await verifyToken(getRequestToken(request)??'')
 if (!context) throw new AccessError(401,'UNAUTHORIZED')
 const {userId}=await params
 return NextResponse.json({success:true,data:await updateMember(context,userId,memberSchema.parse(await request.json()))})
})
