import { NextRequest, NextResponse } from 'next/server'
import { Prisma } from '@prisma/client'
import { reportDecimal } from '@/server/reports/numeric'
import { prisma } from '@/lib/prisma'
import { withApi } from '@/server/api'
import { getRequestToken, verifyToken } from '@/lib/auth'
import { AccessError, tenantScope } from '@/server/auth/policy'
import { financialFilter, financialSummary } from '@/server/reports/financial'
import { localDate } from '@/server/reports/dates'
export const GET=withApi(async(request:NextRequest)=>{
 const context=await verifyToken(getRequestToken(request)??'')
 if(!context)throw new AccessError(401,'UNAUTHORIZED')
 const params=new URLSearchParams(request.nextUrl.searchParams)
 if(!params.get('organizationId'))throw new AccessError(400,'MISSING_PARAM')
 const result=await prisma.$transaction(async tx=>{
  const org=await tx.organization.findUniqueOrThrow({where:{id:context.organizationId},select:{timezone:true}})
  const date=params.get('date')??localDate(new Date(),org.timezone)
  if(!params.has('startDate')&&!params.has('endDate')){params.set('startDate',date);params.set('endDate',date)}
  const filter=await financialFilter(tx,context,params),{total,summary}=await financialSummary(tx,context,filter)
  const openShifts=await tx.shift.count({where:{AND:tenantScope('Shift',context),status:'open',...(filter.storeId?{register:{storeId:filter.storeId}}:{})}})
  const branches=context.role==='owner'?Prisma.empty:context.storeIds.length?Prisma.sql`AND b."storeId" IN (${Prisma.join(context.storeIds)})`:Prisma.sql`AND FALSE`
  const low=await tx.$queryRaw<{count:bigint}[]>(Prisma.sql`SELECT count(*) FROM "InventoryBalance" b JOIN "Store" s ON s.id=b."storeId" JOIN "Product" p ON p.id=b."productId" WHERE s."organizationId"=${context.organizationId} AND p."organizationId"=${context.organizationId} AND p."minStock">0 AND b.quantity<p."minStock" ${branches} ${filter.storeId?Prisma.sql`AND b."storeId"=${filter.storeId}`:Prisma.empty}`)
  const top=await tx.saleItem.groupBy({by:['productId'],where:{sale:filter.sales},_sum:{quantity:true,lineTotal:true,receiptDiscount:true},orderBy:{_sum:{lineTotal:'desc'}},take:5})
  const names=await tx.product.findMany({where:{organizationId:context.organizationId,id:{in:top.map(x=>x.productId)}},select:{id:true,name:true,sku:true}})
  const topProducts=top.map(row=>({...names.find(p=>p.id===row.productId),quantity:row._sum.quantity,revenue:reportDecimal(row._sum.lineTotal??0).sub(row._sum.receiptDiscount??0)}))
  return {success:true,data:{date,...summary,totalSales:total,averageCheck:summary.averageSale,openShifts,lowStockCount:Number(low[0].count),topProducts},meta:{...filter.meta,operationalCounts:'current_snapshot'}}
 },{isolationLevel:'RepeatableRead',timeout:15000})
 return NextResponse.json(result)
})
