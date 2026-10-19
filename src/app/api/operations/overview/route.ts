import {Prisma} from '@prisma/client'
import {NextRequest,NextResponse} from 'next/server'
import {withApi} from '@/server/api'
import {getRequestToken,verifyToken} from '@/lib/auth'
import {prisma} from '@/lib/prisma'
import {AccessError,tenantScope} from '@/server/auth/policy'
import {assertLiveContext} from '@/server/operations'
export const GET=withApi(async(request:NextRequest)=>{
 const context=await verifyToken(getRequestToken(request)??'');if(!context)throw new AccessError(401,'UNAUTHORIZED')
 const result=await prisma.$transaction(async tx=>{
  await assertLiveContext(tx,context)
  const [drafts,openShifts,pendingClose]=await Promise.all([tx.sale.count({where:{status:'draft',AND:tenantScope('Sale',context)}}),tx.shift.count({where:{status:'open',AND:tenantScope('Shift',context)}}),tx.shift.count({where:{status:'open',pendingClose:{not:Prisma.DbNull},AND:tenantScope('Shift',context)}})])
  const incidents=context.role==='cashier'?null:await tx.incident.count({where:{organizationId:context.organizationId,state:'open',...(context.role!=='owner'?{storeId:{in:context.storeIds}}:{})}})
  const conflicts=context.role==='admin'?null:await tx.syncReview.count({where:{organizationId:context.organizationId,state:'conflict',...(context.role==='cashier'?{actorId:context.userId}:{})}})
  return {home:context.role==='cashier'?'/pos':'/dashboard',drafts,openShifts,pendingClose,incidents,conflicts,fiscalStatus:'not_configured'}
 },{isolationLevel:'RepeatableRead'})
 return NextResponse.json({success:true,data:result})
})
