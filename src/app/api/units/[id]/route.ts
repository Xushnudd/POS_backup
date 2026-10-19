import { NextRequest, NextResponse } from 'next/server'
import { withApi } from '@/server/api'
import { verifyToken, getRequestToken } from '@/lib/auth'
import { AccessError } from '@/server/auth/policy'
import { updateUnit, updateUnitSchema } from '@/server/catalog/service'
export const PUT=withApi(async(request:NextRequest,{params}:{params:Promise<{id:string}>})=>{
 const context=await verifyToken(getRequestToken(request)??'')
 if (!context)throw new AccessError(401,'UNAUTHORIZED')
 const {id}=await params
 return NextResponse.json({success:true,data:await updateUnit(context,id,updateUnitSchema.parse(await request.json()))})
})
