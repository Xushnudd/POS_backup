import {NextRequest,NextResponse} from 'next/server'
import {Prisma} from '@prisma/client'
import {z} from 'zod'
import {prisma} from '@/lib/prisma'
import {getRequestToken,verifyToken} from '@/lib/auth'
import {withApi} from '@/server/api'
import {AccessError} from '@/server/auth/policy'
import {assertLiveContext} from '@/server/operations'
import {dateRange} from '@/server/reports/dates'
import {paging,pagination,exporting,exportCap} from '@/server/catalog/queries'
import {csv,numeric} from '@/server/exports/csv'
export const GET=withApi(async(request:NextRequest)=>{
 const context=await verifyToken(getRequestToken(request)??'');if(!context)throw new AccessError(401,'UNAUTHORIZED')
 if(context.role==='cashier')throw new AccessError(403,'FORBIDDEN')
 const q=request.nextUrl.searchParams,view=z.enum(['history','comparison']).parse(q.get('view')??'history')
 const {page,limit,skip}=paging(q),isExport=await exporting(q,context,'purchase.report.export')
 const result=await prisma.$transaction(async tx=>{
  await assertLiveContext(tx,context)
  const org=await tx.organization.findUniqueOrThrow({where:{id:context.organizationId},select:{timezone:true,currencyCode:true}})
  const range=dateRange(q.get('from'),q.get('to'),org.timezone),supplierId=q.get('supplierId'),productId=q.get('productId'),storeId=q.get('storeId')
  const supplied=q.get('asOf'),asOf=supplied?new Date(z.iso.datetime({offset:true}).parse(supplied)):new Date()
  if(asOf.getTime()>Date.now())throw new AccessError(400,'INVALID_REPORT_CUTOFF')
  const scope=context.role==='owner'?Prisma.empty:context.storeIds.length?Prisma.sql`AND d."storeId" IN (${Prisma.join(context.storeIds)})`:Prisma.sql`AND FALSE`
  const cte=Prisma.sql`WITH history AS (
   SELECT i.id AS "lineId",d.id AS "documentId",d."documentNo",d."documentType",d."reversalOfId",d."supplierId",s.name AS "supplierName",d."storeId",st.name AS "storeName",i."productId",p.name AS "productName",p.unit,
   COALESCE(d."confirmedAt",d."createdAt") AS "eventAt",(d."confirmedAt" IS NULL) AS "legacyDate",i.quantity,i."unitCost",ROUND(i.quantity*i."unitCost",2) AS value
   FROM "StockDocument" d JOIN "StockDocumentItem" i ON i."stockDocumentId"=d.id JOIN "Product" p ON p.id=i."productId" JOIN "Store" st ON st.id=d."storeId" LEFT JOIN "Supplier" s ON s.id=d."supplierId"
   WHERE d."organizationId"=${context.organizationId} AND d.status='confirmed' ${scope}
   AND (d."documentType"='purchase' OR (d."documentType"='reversal' AND EXISTS(SELECT 1 FROM "StockDocument" original WHERE original.id=d."reversalOfId" AND original."organizationId"=${context.organizationId} AND original."documentType"='purchase')))
   AND d."createdAt"<=${asOf} AND COALESCE(d."confirmedAt",d."createdAt")<=${asOf}
   ${range.gte?Prisma.sql`AND COALESCE(d."confirmedAt",d."createdAt")>=${range.gte}`:Prisma.empty} ${range.lt?Prisma.sql`AND COALESCE(d."confirmedAt",d."createdAt")<${range.lt}`:Prisma.empty}
   ${supplierId?Prisma.sql`AND d."supplierId"=${supplierId}`:Prisma.empty} ${productId?Prisma.sql`AND i."productId"=${productId}`:Prisma.empty} ${storeId?Prisma.sql`AND d."storeId"=${storeId}`:Prisma.empty}
  )`
  const selected=view==='history'?Prisma.sql`SELECT * FROM history`:Prisma.sql`SELECT "productId","productName",unit,"supplierId","supplierName",
   COALESCE(SUM(quantity) FILTER(WHERE "documentType"='purchase'),0) AS "purchaseQuantity",-COALESCE(SUM(quantity) FILTER(WHERE "documentType"='reversal'),0) AS "reversedQuantity",SUM(quantity) AS "netQuantity",
   MIN("unitCost") FILTER(WHERE "documentType"='purchase') AS "minPrice",MAX("unitCost") FILTER(WHERE "documentType"='purchase') AS "maxPrice",
   ROUND(SUM(quantity*"unitCost") FILTER(WHERE "documentType"='purchase')/NULLIF(SUM(quantity) FILTER(WHERE "documentType"='purchase'),0),6) AS "averagePrice",
   (ARRAY_AGG("unitCost" ORDER BY "eventAt","lineId") FILTER(WHERE "documentType"='purchase'))[1] AS "firstPrice",(ARRAY_AGG("unitCost" ORDER BY "eventAt" DESC,"lineId" DESC) FILTER(WHERE "documentType"='purchase'))[1] AS "latestPrice",
   COALESCE(SUM(value) FILTER(WHERE "documentType"='purchase'),0) AS "purchaseValue",-COALESCE(SUM(value) FILTER(WHERE "documentType"='reversal'),0) AS "reversalValue",SUM(value) AS "netPurchaseValue"
   FROM history GROUP BY "productId","productName",unit,"supplierId","supplierName"`
  const [count]=await tx.$queryRaw<{count:bigint}[]>(Prisma.sql`${cte} SELECT COUNT(*) AS count FROM (${selected}) result`),total=Number(count.count)
  if(isExport)exportCap(total)
  const rows=await tx.$queryRaw<Record<string,unknown>[]>(Prisma.sql`${cte} ${selected} ${view==='history'?Prisma.sql`ORDER BY "eventAt" DESC,"lineId" DESC`:Prisma.sql`ORDER BY "productId","supplierId" NULLS FIRST`} ${isExport?Prisma.empty:Prisma.sql`LIMIT ${limit} OFFSET ${skip}`}`)
  const [summary]=await tx.$queryRaw<{purchaseValue:Prisma.Decimal;reversalValue:Prisma.Decimal;netPurchaseValue:Prisma.Decimal}[]>(Prisma.sql`${cte} SELECT COALESCE(SUM(value) FILTER(WHERE "documentType"='purchase'),0) AS "purchaseValue",-COALESCE(SUM(value) FILTER(WHERE "documentType"='reversal'),0) AS "reversalValue",COALESCE(SUM(value),0) AS "netPurchaseValue" FROM history`)
  const meta={asOf:asOf.toISOString(),timezone:org.timezone,currency:org.currencyCode,basis:'confirmation_event_with_explicit_legacy_created_at',names:'current_catalog',view}
  if(isExport){
   const columns=view==='history'?['lineId','documentId','documentNo','documentType','reversalOfId','eventAt','legacyDate','storeId','storeName','supplierId','supplierName','productId','productName','unit','quantity','unitCost','value']:['productId','productName','unit','supplierId','supplierName','purchaseQuantity','reversedQuantity','netQuantity','minPrice','maxPrice','averagePrice','firstPrice','latestPrice','purchaseValue','reversalValue','netPurchaseValue']
   return {success:true,data:{filename:'purchase-'+view+'.csv',content:csv([columns,...rows.map(row=>columns.map(key=>{const value=row[key];return value instanceof Prisma.Decimal?numeric(value,key.endsWith('Value')||key==='value'?2:6):value instanceof Date?value.toISOString():value}))]),summary,meta}}
  }
  return {success:true,data:{rows,summary,meta},pagination:pagination(page,limit,total)}
 },{isolationLevel:'RepeatableRead',timeout:15000})
 return NextResponse.json(result)
})
