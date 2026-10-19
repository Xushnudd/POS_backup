import { NextRequest, NextResponse } from 'next/server'
import { withApi } from '@/server/api'
import { verifyToken, getRequestToken } from '@/lib/auth'
import { AccessError } from '@/server/auth/policy'
import { deleteBarcode } from '@/server/catalog/service'
export const DELETE=withApi(async(request:NextRequest,{params}:{params:Promise<{id:string;barcodeId:string}>})=>{
 const context=await verifyToken(getRequestToken(request)??'')
 if (!context)throw new AccessError(401,'UNAUTHORIZED')
 const {id,barcodeId}=await params
 return NextResponse.json({success:true,data:await deleteBarcode(context,id,barcodeId)})
})
