import {NextResponse} from "next/server"
import {Prisma} from "@prisma/client"
import {prisma} from "@/lib/prisma"
import {AccessError} from "@/server/auth/policy"
import {financialFilter,financialSummary} from "@/server/reports/financial"
import {reportDecimal} from "@/server/reports/numeric"
import {paging,pagination,exporting,exportCap} from "@/server/catalog/queries"
import {csv,numeric} from "@/server/exports/csv"
import type {NextRequest} from 'next/server'
import type {TokenPayload} from '@/lib/auth'
// Shared authorized query. HTTP authentication remains in the route wrapper.
export async function queryReportsBreakdowns(ctx:TokenPayload,request:NextRequest) {
 if(!['owner','admin'].includes(ctx.role))throw new AccessError(403,'MANAGER_REQUIRED');
 const q=request.nextUrl.searchParams,dimension=q.get('dimension')??'store';if(!['product','category','cashier','store','payment'].includes(dimension))throw new AccessError(400,'INVALID_DIMENSION');
 const {page,limit,skip}=paging(q,50),exportAll=await exporting(q,ctx,'breakdown.export');
 const result=await prisma.$transaction(async tx=>{
  const f=await financialFilter(tx,ctx,q),branches=ctx.role==='owner'?Prisma.empty:ctx.storeIds.length?Prisma.sql`AND s."storeId" IN (${Prisma.join(ctx.storeIds)})`:Prisma.sql`AND FALSE`;
  const scope=Prisma.sql`s."organizationId"=${ctx.organizationId} ${branches} ${f.storeId?Prisma.sql`AND s."storeId"=${f.storeId}`:Prisma.empty}`;
  const sales=Prisma.sql`${scope} AND s.status IN ('completed','partially_returned','returned') AND s."createdAt"<=${f.asOf} AND s."completedAt"<=${f.asOf} ${f.range.gte?Prisma.sql`AND s."completedAt">=${f.range.gte}`:Prisma.empty} ${f.range.lt?Prisma.sql`AND s."completedAt"<${f.range.lt}`:Prisma.empty}`;
  const returns=Prisma.sql`${scope} AND r.status='completed' AND r."createdAt"<=${f.asOf} AND r."returnedAt"<=${f.asOf} ${f.range.gte?Prisma.sql`AND r."returnedAt">=${f.range.gte}`:Prisma.empty} ${f.range.lt?Prisma.sql`AND r."returnedAt"<${f.range.lt}`:Prisma.empty}`;
  const moves=Prisma.sql`WITH moves AS (
   SELECT i."productId",p."categoryId",s."cashierId",s."storeId",i.quantity,COALESCE(i."payableAmount",i."lineTotal"-i."receiptDiscount") AS revenue,i.quantity*i."unitCost" AS cost,i."taxAmount" AS tax FROM "SaleItem" i JOIN "Sale" s ON s.id=i."saleId" JOIN "Product" p ON p.id=i."productId" WHERE ${sales}
   UNION ALL SELECT ri."productId",p."categoryId",s."cashierId",s."storeId",-ri.quantity,-ri."lineTotal",-ri.quantity*i."unitCost",-ri."taxAmount" FROM "SaleReturnItem" ri JOIN "SaleReturn" r ON r.id=ri."saleReturnId" JOIN "SaleItem" i ON i.id=ri."saleItemId" JOIN "Sale" s ON s.id=r."saleId" JOIN "Product" p ON p.id=ri."productId" WHERE ${returns}
  )`;
  const payments=Prisma.sql`WITH moves AS (
   SELECT p."paymentType" AS id,p.amount AS revenue FROM "Payment" p JOIN "Sale" s ON s.id=p."saleId" WHERE ${sales} AND p.direction='in' AND p.status='recorded' AND COALESCE(p.note,'')<>'debt_collection'
   UNION ALL SELECT p."paymentType",-p.amount FROM "Payment" p JOIN "SaleReturn" r ON p.note='return:'||r.id JOIN "Sale" s ON s.id=r."saleId" WHERE ${returns} AND p.direction='out' AND p.status='recorded' AND p."organizationId"=${ctx.organizationId}
   UNION ALL SELECT 'credit',CASE WHEN d."sourceType"='return' THEN d.amount ELSE -d.amount END FROM "DebtEntry" d JOIN "SaleReturn" r ON r.id=d."sourceId" JOIN "Sale" s ON s.id=r."saleId" WHERE ${returns} AND d."sourceType" IN ('return','write_off_reversal') AND d."organizationId"=${ctx.organizationId}
  )`;
  const grouping=dimension==='payment'?Prisma.sql`${payments}, grouped AS (SELECT id,id AS name,NULL::numeric AS quantity,sum(revenue) AS revenue,NULL::numeric AS cost,NULL::numeric AS tax FROM moves GROUP BY id)`:
   dimension==='product'?Prisma.sql`${moves}, grouped AS (SELECT p.id,p.name,sum(m.quantity) AS quantity,sum(m.revenue) AS revenue,sum(m.cost) AS cost,sum(m.tax) AS tax FROM moves m JOIN "Product" p ON p.id=m."productId" GROUP BY p.id,p.name)`:
   dimension==='category'?Prisma.sql`${moves}, grouped AS (SELECT COALESCE(c.id,'uncategorised') AS id,COALESCE(c.name,'Kategoriyasiz') AS name,NULL::numeric AS quantity,sum(m.revenue) AS revenue,sum(m.cost) AS cost,sum(m.tax) AS tax FROM moves m LEFT JOIN "Category" c ON c.id=m."categoryId" GROUP BY c.id,c.name)`:
   dimension==='cashier'?Prisma.sql`${moves}, grouped AS (SELECT u.id,u."fullName" AS name,NULL::numeric AS quantity,sum(m.revenue) AS revenue,sum(m.cost) AS cost,sum(m.tax) AS tax FROM moves m JOIN "User" u ON u.id=m."cashierId" GROUP BY u.id,u."fullName")`:
   Prisma.sql`${moves}, grouped AS (SELECT s.id,s.name,NULL::numeric AS quantity,sum(m.revenue) AS revenue,sum(m.cost) AS cost,sum(m.tax) AS tax FROM moves m JOIN "Store" s ON s.id=m."storeId" GROUP BY s.id,s.name)`;
  type Row={id:string;name:string;quantity:Prisma.Decimal|null;revenue:Prisma.Decimal;cost:Prisma.Decimal|null;tax:Prisma.Decimal|null};
  const [summary]=await tx.$queryRaw<{total:bigint;revenue:Prisma.Decimal;quantity:Prisma.Decimal|null;cost:Prisma.Decimal|null;tax:Prisma.Decimal|null}[]>`${grouping} SELECT count(*) AS total,COALESCE(sum(revenue),0) AS revenue,sum(quantity) AS quantity,sum(cost) AS cost,sum(tax) AS tax FROM grouped`;
  const overall=await financialSummary(tx,ctx,f);if(!reportDecimal(summary.revenue).eq(overall.summary.totalRevenue))throw new AccessError(409,'REPORT_UNRECONCILED','Kesim va umumiy savdo jami mos emas; moliyaviy jurnalni tekshiring');
  const total=Number(summary.total);if(exportAll)exportCap(total);
  const rows=await tx.$queryRaw<Row[]>`${grouping} SELECT * FROM grouped ORDER BY revenue DESC,id ASC LIMIT ${exportAll?10000:limit} OFFSET ${exportAll?0:skip}`;
  const meta={...f.meta,dimension,revenueBasis:'Gross paid/owed amounts including configured tax; profit excludes tax; payment dimension does not attribute tax or cost',categoryBasis:'current product category',paymentBasis:'Sale completion channels minus return settlement channels; excludes later debt collections and manual cash; not cash flow'};
  const totals={netSales:summary.revenue,tax:summary.tax,revenueExcludingTax:summary.tax===null?null:reportDecimal(summary.revenue).sub(summary.tax),quantity:summary.quantity,cogs:summary.cost,grossProfit:summary.cost===null?null:reportDecimal(summary.revenue).sub(summary.tax??0).sub(summary.cost)};
  if(exportAll)return {success:true,data:{filename:'sales-'+dimension+'.csv',meta,summary:totals,content:csv([['Kesim',dimension],['AsOf UTC',f.meta.asOf],['Sof savdo jami',numeric(summary.revenue)],['ID','Nomi','Sof miqdor','Sof savdo','Tarixiy tannarx','Yalpi foyda','Soliq qismi','Soliqsiz tushum'],...rows.map(r=>[r.id,r.name,r.quantity===null?'':numeric(r.quantity,6),numeric(r.revenue),r.cost===null?'':numeric(r.cost,6),r.cost===null?'':numeric(reportDecimal(r.revenue).sub(r.tax??0).sub(r.cost)),r.tax===null?'':numeric(r.tax),r.tax===null?'':numeric(reportDecimal(r.revenue).sub(r.tax))])])}};
  return {success:true,data:rows.map(r=>({...r,grossProfit:r.cost===null?null:reportDecimal(r.revenue).sub(r.tax??0).sub(r.cost)})),meta,summary:totals,pagination:pagination(page,limit,total)};
 },{isolationLevel:'RepeatableRead',timeout:15000});return NextResponse.json(result);
}
