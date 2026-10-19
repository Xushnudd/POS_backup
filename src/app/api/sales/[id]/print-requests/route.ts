import { NextRequest, NextResponse } from 'next/server'
import { z } from 'zod'
import { withApi } from '@/server/api'
import { getRequestToken, verifyToken } from '@/lib/auth'
import { AccessError, tenantScope } from '@/server/auth/policy'
import { consumeLimit } from '@/server/auth/rate-limit'
import { audit, runOperation } from '@/server/operations'
const schema=z.object({operationId:z.string().uuid(),width:z.union([z.literal(58),z.literal(80)]),copy:z.boolean()}).strict()
export const POST=withApi(async(request:NextRequest,{params}:{params:Promise<{id:string}>})=>{
 const context=await verifyToken(getRequestToken(request)??'')
 if(!context)throw new AccessError(401,'UNAUTHORIZED')
 const {id}=await params,input=schema.parse(await request.json())
 await consumeLimit('receipt.print',context.organizationId+':'+context.userId,30,60000)
 const data=await runOperation(context,'receipt.print',input.operationId,{saleId:id,...input},async tx=>{
  const sale=await tx.sale.findFirst({where:{id,AND:tenantScope('Sale',context)},select:{id:true,receiptNo:true,status:true}})
  if(!sale)throw new AccessError(404,'NOT_FOUND')
  await audit(tx,context,'Sale',id,'receipt_print_requested',{...input,receiptNo:sale.receiptNo,status:sale.status})
  return {saleId:id,operationId:input.operationId,requested:true}
 })
 return NextResponse.json({success:true,data})
})
