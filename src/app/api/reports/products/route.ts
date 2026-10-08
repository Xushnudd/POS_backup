import { paging } from '@/server/catalog/queries'
import { csv, numeric, EXPORT_CAP } from '@/server/exports/csv'
import { consumeLimit } from '@/server/auth/rate-limit'
import { NextRequest, NextResponse } from 'next/server'
import { Prisma } from '@prisma/client'
import { withApi } from '@/server/api'
import { prisma } from '@/lib/prisma'
import { getRequestToken, verifyToken } from '@/lib/auth'
import { AccessError } from '@/server/auth/policy'
import { financialFilter } from '@/server/reports/financial'
import { reportDecimal } from '@/server/reports/numeric'
export const GET=withApi(async(request:NextRequest)=>{
 const context=await verifyToken(getRequestToken(request)??'')
 if (!context) throw new AccessError(401,'UNAUTHORIZED')
 const params=new URL(request.url).searchParams
 const filter=await prisma.$transaction(tx=>financialFilter(tx,context,params)),range=filter.range
 const org={timezone:filter.meta.timezone}
 const {page,limit,skip}=paging(params,50)
 const store=params.get('storeId'),category=params.get('categoryId')
 const stores=context.role==='owner'?Prisma.empty:context.storeIds.length?Prisma.sql`AND s."storeId" IN (${Prisma.join(context.storeIds)})`:Prisma.sql`AND FALSE`
 const storeFilter=store?Prisma.sql`AND s."storeId"=${store}`:Prisma.empty
 const categoryFilter=category?Prisma.sql`AND p."categoryId"=${category}`:Prisma.empty
 const salesRange=Prisma.sql`${range.gte?Prisma.sql`AND s."completedAt">=${range.gte}`:Prisma.empty} ${range.lt?Prisma.sql`AND s."completedAt"<${range.lt}`:Prisma.empty}`
 const returnsRange=Prisma.sql`${range.gte?Prisma.sql`AND r."returnedAt">=${range.gte}`:Prisma.empty} ${range.lt?Prisma.sql`AND r."returnedAt"<${range.lt}`:Prisma.empty}`
 const cte=Prisma.sql`WITH movements AS (
  SELECT i."productId",i.quantity,COALESCE(i."payableAmount",i."lineTotal"-i."receiptDiscount") AS revenue,i.quantity*i."unitCost" AS cost,i."taxAmount" AS tax
  FROM "SaleItem" i JOIN "Sale" s ON s.id=i."saleId" JOIN "Product" p ON p.id=i."productId"
  WHERE s."organizationId"=${context.organizationId} AND s.status IN ('completed','partially_returned','returned') ${stores} ${storeFilter} ${categoryFilter} ${salesRange} AND s."createdAt"<=${filter.asOf} AND s."completedAt"<=${filter.asOf}
  UNION ALL
  SELECT ri."productId",-ri.quantity,-ri."lineTotal",-ri.quantity*i."unitCost",-ri."taxAmount"
  FROM "SaleReturnItem" ri JOIN "SaleReturn" r ON r.id=ri."saleReturnId" JOIN "SaleItem" i ON i.id=ri."saleItemId"
  JOIN "Sale" s ON s.id=r."saleId" JOIN "Product" p ON p.id=ri."productId"
  WHERE s."organizationId"=${context.organizationId} ${stores} ${storeFilter} ${categoryFilter} ${returnsRange} AND r."createdAt"<=${filter.asOf} AND r."returnedAt"<=${filter.asOf}
 ), totals AS (SELECT "productId",sum(quantity) AS quantity,sum(revenue) AS revenue,sum(cost) AS cost,sum(tax) AS tax FROM movements GROUP BY "productId")`
 type Summary={quantity:Prisma.Decimal;revenue:Prisma.Decimal;cost:Prisma.Decimal;tax:Prisma.Decimal}
 const totalsSql=Prisma.sql`${cte} SELECT COALESCE(SUM(quantity),0) AS quantity,COALESCE(SUM(revenue),0) AS revenue,COALESCE(SUM(cost),0) AS cost,COALESCE(SUM(tax),0) AS tax FROM totals`
 type Stat={id:string;name:string;sku:string;quantitySold:Prisma.Decimal;revenue:Prisma.Decimal;cost:Prisma.Decimal;tax:Prisma.Decimal}
 if(params.get('format')==='csv'){
  if(context.role==='cashier')throw new AccessError(403,'FORBIDDEN')
  await consumeLimit('report.export',context.organizationId+':'+context.userId,10,60000)
  const data=await prisma.$transaction(async tx=>{
   const count=await tx.$queryRaw<{count:bigint}[]>(Prisma.sql`${cte} SELECT count(*) FROM totals`)
   if(Number(count[0].count)>EXPORT_CAP)throw new AccessError(413,'EXPORT_TOO_LARGE','Eksport 10000 qatordan oshdi; davrni toraytiring')
   const rows=await tx.$queryRaw<Stat[]>(Prisma.sql`${cte} SELECT p.id,p.name,p.sku,t.quantity AS "quantitySold",t.revenue,t.cost,t.tax FROM totals t JOIN "Product" p ON p.id=t."productId" ORDER BY t.revenue DESC,p.id LIMIT ${EXPORT_CAP}`)
   const [summary]=await tx.$queryRaw<Summary[]>(totalsSql)
   return {filename:'product-report-'+context.organizationId+'.csv',meta:filter.meta,summary:{...summary,profit:reportDecimal(summary.revenue).sub(summary.tax).sub(summary.cost)},content:csv([['Vaqt zonasi',org.timezone],['Hisob holati UTC',filter.meta.asOf],['Sof tovar tushumi',numeric(summary.revenue)],['Tarixiy jami tannarx',numeric(summary.cost,6)],['Davr boshi',params.get('startDate')],['Davr oxiri',params.get('endDate')],['ID','Mahsulot','SKU','Sof miqdor','Sof tovar tushumi','Tarixiy tannarx','Yalpi foyda','Soliq qismi','Soliqsiz tushum'],...rows.map(row=>[row.id,row.name,row.sku,numeric(row.quantitySold,6),numeric(row.revenue),numeric(row.cost,6),numeric(reportDecimal(row.revenue).sub(row.tax).sub(row.cost)),numeric(row.tax),numeric(reportDecimal(row.revenue).sub(row.tax))])])}
  },{isolationLevel:'RepeatableRead'})
  return NextResponse.json({success:true,data})
 }
 const [rows,count,summaryRows]=await prisma.$transaction([
  prisma.$queryRaw<Stat[]>(Prisma.sql`${cte} SELECT p.id,p.name,p.sku,t.quantity AS "quantitySold",t.revenue,t.cost,t.tax FROM totals t JOIN "Product" p ON p.id=t."productId" ORDER BY t.revenue DESC,p.id LIMIT ${limit} OFFSET ${skip}`),
  prisma.$queryRaw<{count:bigint}[]>(Prisma.sql`${cte} SELECT count(*) FROM totals`),
  prisma.$queryRaw<Summary[]>(totalsSql),
 ],{isolationLevel:Prisma.TransactionIsolationLevel.RepeatableRead})
 const data=rows.map(row=>({...row,profit:reportDecimal(row.revenue).sub(row.tax).sub(row.cost),netRevenue:reportDecimal(row.revenue).sub(row.tax),profitMargin:row.revenue.sub(row.tax).gt(0)?reportDecimal(row.revenue).sub(row.tax).sub(row.cost).mul(100).div(row.revenue.sub(row.tax)).toDecimalPlaces(2):'0'}))
 const total=Number(count[0].count)
 return NextResponse.json({success:true,data,meta:filter.meta,summary:{...summaryRows[0],profit:reportDecimal(summaryRows[0].revenue).sub(summaryRows[0].tax).sub(summaryRows[0].cost)},pagination:{page,limit,total,totalPages:Math.ceil(total/limit)}})
})
