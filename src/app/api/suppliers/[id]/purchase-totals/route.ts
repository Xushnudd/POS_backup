import { NextRequest,NextResponse } from 'next/server'
import { Prisma } from '@prisma/client'
import { withApi } from '@/server/api'
import { prisma } from '@/lib/prisma'
import { getRequestToken,verifyToken } from '@/lib/auth'
import { AccessError } from '@/server/auth/policy'
import { dateRange } from '@/server/reports/dates'
import { consumeLimit } from '@/server/auth/rate-limit'
export const GET=withApi(async(request:NextRequest,{params}:{params:Promise<{id:string}>})=>{
 const context=await verifyToken(getRequestToken(request)??'')
 if(!context)throw new AccessError(401,'UNAUTHORIZED')
 const {id}=await params,q=new URL(request.url).searchParams
 // This summary has deliberately fixed confirmed purchase/reversal semantics.
 for(const field of ['status','documentType','search'])if(q.has(field))throw new AccessError(400,'INVALID_TOTAL_FILTER')
 const organization=await prisma.organization.findUniqueOrThrow({where:{id:context.organizationId},select:{timezone:true,currencyCode:true}})
 const range=dateRange(q.get('from'),q.get('to'),organization.timezone),storeId=q.get('storeId')
 const scope=context.role==='owner'?Prisma.empty:context.storeIds.length?Prisma.sql`AND d."storeId" IN (${Prisma.join(context.storeIds)})`:Prisma.sql`AND FALSE`
 await consumeLimit('supplier.totals',context.organizationId+':'+context.userId,60,60000)
 const [row]=await prisma.$queryRaw<{purchases:bigint;reversals:bigint;purchaseValue:Prisma.Decimal;reversalValue:Prisma.Decimal;netPurchaseValue:Prisma.Decimal}[]>(Prisma.sql`
 WITH selected AS (
  SELECT d.id,d."documentType" FROM "StockDocument" d
  WHERE d."organizationId"=${context.organizationId} AND d."supplierId"=${id} AND d.status='confirmed' ${scope}
  ${storeId?Prisma.sql`AND d."storeId"=${storeId}`:Prisma.empty}
  ${range.gte?Prisma.sql`AND d."createdAt">=${range.gte}`:Prisma.empty} ${range.lt?Prisma.sql`AND d."createdAt"<${range.lt}`:Prisma.empty}
  AND (d."documentType"='purchase' OR (d."documentType"='reversal' AND EXISTS(SELECT 1 FROM "StockDocument" original WHERE original.id=d."reversalOfId" AND original."organizationId"=${context.organizationId} AND original."documentType"='purchase')))
 ), document_values AS (
  SELECT d.id,d."documentType",COALESCE(SUM(ROUND(i.quantity*i."unitCost",2)),0) AS value FROM selected d LEFT JOIN "StockDocumentItem" i ON i."stockDocumentId"=d.id GROUP BY d.id,d."documentType"
 )
 SELECT COUNT(*) FILTER(WHERE "documentType"='purchase') AS purchases,COUNT(*) FILTER(WHERE "documentType"='reversal') AS reversals,
 COALESCE(SUM(value) FILTER(WHERE "documentType"='purchase'),0) AS "purchaseValue",-COALESCE(SUM(value) FILTER(WHERE "documentType"='reversal'),0) AS "reversalValue",COALESCE(SUM(value),0) AS "netPurchaseValue" FROM document_values`)
 return NextResponse.json({success:true,data:{purchases:Number(row.purchases),reversals:Number(row.reversals),purchaseValue:row.purchaseValue.toFixed(2),reversalValue:row.reversalValue.toFixed(2),netPurchaseValue:row.netPurchaseValue.toFixed(2),basis:'confirmed_documents_created_at',currency:organization.currencyCode}})
})
