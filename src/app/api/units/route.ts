import {queryUnits} from '@/server/exports/queries/units'




import {NextRequest,NextResponse} from 'next/server'
import {withApi} from '@/server/api'
import {verifyToken,getRequestToken} from '@/lib/auth'

import {AccessError} from '@/server/auth/policy'
import {createUnit,unitSchema} from '@/server/catalog/service'
export const GET=withApi(async(request:NextRequest)=>{
 const context=await verifyToken(getRequestToken(request)??'')
 if(!context)throw new AccessError(401,'UNAUTHORIZED')
 return queryUnits(context,request)
})
export const POST=withApi(async(request:NextRequest)=>{
 const context=await verifyToken(getRequestToken(request)??'')
 if (!context)throw new AccessError(401,'UNAUTHORIZED')
 return NextResponse.json({success:true,data:await createUnit(context,unitSchema.parse(await request.json()))})
})
