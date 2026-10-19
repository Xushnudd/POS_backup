import { NextRequest, NextResponse } from 'next/server'
import { withApi } from '@/server/api'
import { getRequestToken, verifyToken } from '@/lib/auth'
import { completeSale, completeSchema } from '@/server/sales/service'
import { AccessError } from '@/server/auth/policy'
export const POST=withApi(async (request:NextRequest,{params}:{params:Promise<{id:string}>})=>{
  const context=await verifyToken(getRequestToken(request)??'')
  if (!context) throw new AccessError(401,'UNAUTHORIZED')
  const {id}=await params
  const input=completeSchema.parse(await request.json())
  const sale=await completeSale(context,id,input,input.operationId??request.headers.get('idempotency-key')??id)
  return NextResponse.json({success:true,data:sale,message:'Savdo muvaffaqiyatli yakunlandi'})
})
