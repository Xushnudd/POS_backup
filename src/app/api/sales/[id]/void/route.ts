import { NextRequest, NextResponse } from 'next/server'
import { withApi } from '@/server/api'
import { verifyToken, getRequestToken } from '@/lib/auth'
import { AccessError, tenantScope } from '@/server/auth/policy'
import { runOperation, audit } from '@/server/operations'
export const POST=withApi(async(request:NextRequest,{params}:{params:Promise<{id:string}>})=>{
 const context=await verifyToken(getRequestToken(request)??'')
 if (!context) throw new AccessError(401,'UNAUTHORIZED')
 if (context.role==='cashier') throw new AccessError(403,'MANAGER_REQUIRED')
 const {id}=await params
 const result=await runOperation(context,'sale.void',id,{id},async tx=>{
  await tx.$queryRaw`SELECT id FROM "Sale" WHERE id=${id} FOR UPDATE`
  const sale=await tx.sale.findFirst({where:{id,AND:tenantScope('Sale',context)}})
  if (!sale) throw new AccessError(404,'NOT_FOUND')
  if (sale.status!=='draft') throw new AccessError(409,'INVALID_STATUS')
  const result=await tx.sale.update({where:{id},data:{status:'voided',voidedAt:new Date(),voidedBy:context.userId}})
  await audit(tx,context,'Sale',id,'draft_voided')
  return result
 })
 return NextResponse.json({success:true,data:result})
})
