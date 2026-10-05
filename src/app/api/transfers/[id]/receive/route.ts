import { NextRequest, NextResponse } from 'next/server'
import { withApi } from '@/server/api'
import { verifyToken, getRequestToken } from '@/lib/auth'
import { AccessError } from '@/server/auth/policy'
import { receiveTransfer, receiveSchema } from '@/server/inventory/documents'
export const POST=withApi(async(request:NextRequest,{params}:{params:Promise<{id:string}>})=>{
 const context=await verifyToken(getRequestToken(request)??'')
 if (!context) throw new AccessError(401,'UNAUTHORIZED')
 const {id}=await params
 const text=await request.text()
 const input=receiveSchema.parse(text?JSON.parse(text):{})
 return NextResponse.json({success:true,data:await receiveTransfer(context,id,input)})
})
