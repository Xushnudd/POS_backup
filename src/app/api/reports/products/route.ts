import { csv, numeric, EXPORT_CAP } from '@/server/exports/csv'
import { consumeLimit } from '@/server/auth/rate-limit'
import { NextRequest, NextResponse } from 'next/server'
import { Prisma } from '@prisma/client'
import { withApi } from '@/server/api'
import { prisma } from '@/lib/prisma'
import { getRequestToken, verifyToken } from '@/lib/auth'
import { AccessError } from '@/server/auth/policy'
import { dateRange } from '@/server/reports/dates'
export const GET=withApi(async(request:NextRequest)=>{
 const context=await verifyToken(getRequestToken(request)??'')
 if (!context) throw new AccessError(401,'UNAUTHORIZED')
 const params=new URL(request.url).searchParams
 const org=await prisma.organization.findUniqueOrThrow({where:{id:context.organizationId}})
 const range=dateRange(params.get('startDate'),params.get('endDate'),org.timezone)
 const page=Number(params.get('page')??1),limit=Number(params.get('limit')??50)
 const store=params.get('storeId'),category=params.get('categoryId')
 const stores=context.role==='owner'?Prisma.empty:context.storeIds.length?Prisma.sql`AND s."storeId" IN (${Prisma.join(context.storeIds)})`:Prisma.sql`AND FALSE`
 const storeFilter=store?Prisma.sql`AND s."storeId"=${store}`:Prisma.empty
 const categoryFilter=category?Prisma.sql`AND p."categoryId"=${category}`:Prisma.empty
 const salesRange=Prisma.sql`${range.gte?Prisma.sql`AND s."completedAt">=${range.gte}`:Prisma.empty} ${range.lt?Prisma.sql`AND s."completedAt"<${range.lt}`:Prisma.empty}`
 const returnsRange=Prisma.sql`${range.gte?Prisma.sql`AND r."returnedAt">=${range.gte}`:Prisma.empty} ${range.lt?Prisma.sql`AND r."returnedAt"<${range.lt}`:Prisma.empty}`
 const cte=Prisma.sql`WITH movements AS (
  SELECT i."productId",i.quantity,i."lineTotal"-i."receiptDiscount" AS revenue,i.quantity*i."unitCost" AS cost
  FROM "SaleItem" i JOIN "Sale" s ON s.id=i."saleId" JOIN "Product" p ON p.id=i."productId"
  WHERE s."organizationId"=${context.organizationId} AND s.status IN ('completed','partially_returned','returned') ${stores} ${storeFilter} ${categoryFilter} ${salesRange}
  UNION ALL
  SELECT ri."productId",-ri.quantity,-ri."lineTotal",-ri.quantity*i."unitCost"
  FROM "SaleReturnItem" ri JOIN "SaleReturn" r ON r.id=ri."saleReturnId" JOIN "SaleItem" i ON i.id=ri."saleItemId"
  JOIN "Sale" s ON s.id=r."saleId" JOIN "Product" p ON p.id=ri."productId"
  WHERE s."organizationId"=${context.organizationId} ${stores} ${storeFilter} ${categoryFilter} ${returnsRange}
 ), totals AS (SELECT "productId",sum(quantity) AS quantity,sum(revenue) AS revenue,sum(cost) AS cost FROM movements GROUP BY "productId")`
 type Stat={id:string;name:string;sku:string;quantitySold:Prisma.Decimal;revenue:Prisma.Decimal;cost:Prisma.Decimal}
 if(params.get('format')==='csv'){
  if(context.role==='cashier')throw new AccessError(403,'FORBIDDEN')
  await consumeLimit('report.export',context.organizationId+':'+context.userId,10,60000)
  const data=await prisma.$transaction(async tx=>{
   const count=await tx.$queryRaw<{count:bigint}[]>(Prisma.sql`${cte} SELECT count(*) FROM totals`)
   if(Number(count[0].count)>EXPORT_CAP)throw new AccessError(413,'EXPORT_TOO_LARGE','Eksport 10000 qatordan oshdi; davrni toraytiring')
   const rows=await tx.$queryRaw<Stat[]>(Prisma.sql`${cte} SELECT p.id,p.name,p.sku,t.quantity AS "quantitySold",t.revenue,t.cost FROM totals t JOIN "Product" p ON p.id=t."productId" ORDER BY t.revenue DESC,p.id LIMIT ${EXPORT_CAP}`)
   return {filename:'product-report-'+context.organizationId+'.csv',content:csv([['Vaqt zonasi',org.timezone],['Davr boshi',params.get('startDate')],['Davr oxiri',params.get('endDate')],['ID','Mahsulot','SKU','Sof miqdor','Sof tovar tushumi','Tarixiy tannarx','Yalpi foyda'],...rows.map(row=>[row.id,row.name,row.sku,numeric(row.quantitySold,6),numeric(row.revenue),numeric(row.cost,6),numeric(row.revenue.sub(row.cost))])])}
  },{isolationLevel:'RepeatableRead'})
  return NextResponse.json({success:true,data})
 }
 const [rows,count]=await prisma.$transaction([
  prisma.$queryRaw<Stat[]>(Prisma.sql`${cte} SELECT p.id,p.name,p.sku,t.quantity AS "quantitySold",t.revenue,t.cost FROM totals t JOIN "Product" p ON p.id=t."productId" ORDER BY t.revenue DESC,p.id LIMIT ${limit} OFFSET ${(page-1)*limit}`),
  prisma.$queryRaw<{count:bigint}[]>(Prisma.sql`${cte} SELECT count(*) FROM totals`),
 ],{isolationLevel:Prisma.TransactionIsolationLevel.RepeatableRead})
 const data=rows.map(row=>({...row,profit:row.revenue.sub(row.cost),profitMargin:row.revenue.gt(0)?row.revenue.sub(row.cost).mul(100).div(row.revenue).toDecimalPlaces(2):'0'}))
 const total=Number(count[0].count)
 return NextResponse.json({success:true,data,pagination:{page,limit,total,totalPages:Math.ceil(total/limit)}})
})
