import {NextRequest,NextResponse} from 'next/server'
import {Prisma} from '@prisma/client'
import {z} from 'zod'
import {prisma} from '@/lib/prisma'
import {getRequestToken,verifyToken} from '@/lib/auth'
import {withApi} from '@/server/api'
import {AccessError} from '@/server/auth/policy'
import {assertLiveContext} from '@/server/operations'
import {financeManager} from '@/server/finance/accounts'
import {paging,pagination,exporting,exportCap} from '@/server/catalog/queries'
import {csv,numeric} from '@/server/exports/csv'
export const GET=withApi(async(request:NextRequest)=>{
 const ctx=await verifyToken(getRequestToken(request)??'');if(!ctx)throw new AccessError(401,'UNAUTHORIZED');financeManager(ctx);const q=request.nextUrl.searchParams,{page,limit,skip}=paging(q),isExport=await exporting(q,ctx,'supplier.balance.export');
 const cutoff=q.get('asOf'),asOf=cutoff?new Date(z.iso.datetime({offset:true}).parse(cutoff)):new Date();if(asOf.getTime()>Date.now())throw new AccessError(400,'INVALID_REPORT_CUTOFF');const supplierId=q.get('supplierId'),storeId=q.get('storeId');
 const result=await prisma.$transaction(async tx=>{
 await assertLiveContext(tx,ctx);const org=await tx.organization.findUniqueOrThrow({where:{id:ctx.organizationId},select:{timezone:true,currencyCode:true}});
 // Both books use immutable original rows and allocation timestamps; no historical paid-state guessing.
 const scope=ctx.role==='owner'?Prisma.empty:ctx.storeIds.length?Prisma.sql`AND "storeId" IN (${Prisma.join(ctx.storeIds)})`:Prisma.sql`AND FALSE`;
 const filter=Prisma.sql`${scope} ${storeId?Prisma.sql`AND "storeId"=${storeId}`:Prisma.empty} ${supplierId?Prisma.sql`AND "supplierId"=${supplierId}`:Prisma.empty}`;
 const cte=Prisma.sql`WITH invoices AS (
 SELECT i.id,i."supplierId",i."storeId",i."dueAt",i.amount-COALESCE((SELECT sum(c.amount) FROM "SupplierCredit" c WHERE c."invoiceId"=i.id AND c."createdAt"<=${asOf}),0) AS amount,COALESCE((SELECT sum(a.amount-COALESCE((SELECT sum(r.amount) FROM "SupplierAllocationRelease" r WHERE r."allocationId"=a.id AND r."createdAt"<=${asOf}),0)) FROM "SupplierAllocation" a WHERE a."invoiceId"=i.id AND a."createdAt"<=${asOf}),0) AS allocated
 FROM "SupplierInvoice" i WHERE "organizationId"=${ctx.organizationId} AND "createdAt"<=${asOf} ${filter}
 ), payments AS (
 SELECT p.*,d.amount,COALESCE((SELECT sum(a.amount-COALESCE((SELECT sum(r.amount) FROM "SupplierAllocationRelease" r WHERE r."allocationId"=a.id AND r."createdAt"<=${asOf}),0)) FROM "SupplierAllocation" a WHERE a."paymentId"=p.id AND a."createdAt"<=${asOf}),0) AS allocated
 FROM "SupplierPayment" p JOIN "FinancialDocument" d ON d.id=p."financialDocumentId"
 WHERE p."organizationId"=${ctx.organizationId} AND p."createdAt"<=${asOf} ${ctx.role==='owner'?Prisma.empty:ctx.storeIds.length?Prisma.sql`AND p."storeId" IN (${Prisma.join(ctx.storeIds)})`:Prisma.sql`AND FALSE`} ${storeId?Prisma.sql`AND p."storeId"=${storeId}`:Prisma.empty} ${supplierId?Prisma.sql`AND p."supplierId"=${supplierId}`:Prisma.empty}
 ), invoice_totals AS (
 SELECT "supplierId","storeId",sum(amount) AS invoiced,sum(allocated) AS allocated,sum(amount-allocated) AS unpaid,
 COALESCE(sum(amount-allocated) FILTER(WHERE "dueAt"<${asOf}),0) AS overdue,
 COALESCE(sum(amount-allocated) FILTER(WHERE "dueAt">=${asOf}),0) AS upcoming,
 COALESCE(sum(amount-allocated) FILTER(WHERE "dueAt" IS NULL),0) AS "noDueDate"
 FROM invoices GROUP BY "supplierId","storeId"
 ), payment_totals AS (SELECT "supplierId","storeId",sum(amount) AS paid,sum(amount-allocated) AS advance FROM payments GROUP BY "supplierId","storeId"), balances AS (
 SELECT COALESCE(i."supplierId",p."supplierId") AS "supplierId",COALESCE(i."storeId",p."storeId") AS "storeId",
 COALESCE(i.invoiced,0) AS invoiced,COALESCE(i.allocated,0) AS allocated,COALESCE(i.unpaid,0) AS unpaid,COALESCE(i.overdue,0) AS overdue,COALESCE(i.upcoming,0) AS upcoming,COALESCE(i."noDueDate",0) AS "noDueDate",COALESCE(p.paid,0) AS paid,COALESCE(p.advance,0) AS advance
 FROM invoice_totals i FULL JOIN payment_totals p USING("supplierId","storeId")
 )`;
 type Summary={invoiced:Prisma.Decimal;allocated:Prisma.Decimal;unpaid:Prisma.Decimal;overdue:Prisma.Decimal;upcoming:Prisma.Decimal;noDueDate:Prisma.Decimal;paid:Prisma.Decimal;advance:Prisma.Decimal};
 type Row=Summary&{supplierId:string;storeId:string;supplierName:string;storeName:string};
 const [count]=await tx.$queryRaw<{total:bigint}[]>(Prisma.sql`${cte} SELECT count(*) AS total FROM balances`),total=Number(count.total);if(isExport)exportCap(total);
 const rows=await tx.$queryRaw<Row[]>(Prisma.sql`${cte} SELECT b.*,s.name AS "supplierName",st.name AS "storeName" FROM balances b JOIN "Supplier" s ON s.id=b."supplierId" JOIN "Store" st ON st.id=b."storeId" ORDER BY b."supplierId",b."storeId" ${isExport?Prisma.empty:Prisma.sql`LIMIT ${limit} OFFSET ${skip}`}`);
 const [summary]=await tx.$queryRaw<Summary[]>(Prisma.sql`${cte} SELECT COALESCE(sum(invoiced),0) AS invoiced,COALESCE(sum(allocated),0) AS allocated,COALESCE(sum(unpaid),0) AS unpaid,COALESCE(sum(overdue),0) AS overdue,COALESCE(sum(upcoming),0) AS upcoming,COALESCE(sum("noDueDate"),0) AS "noDueDate",COALESCE(sum(paid),0) AS paid,COALESCE(sum(advance),0) AS advance FROM balances`);
 if(!summary.invoiced.sub(summary.allocated).eq(summary.unpaid)||!summary.overdue.add(summary.upcoming).add(summary.noDueDate).eq(summary.unpaid)||!summary.paid.sub(summary.allocated).eq(summary.advance))throw new AccessError(409,'SUPPLIER_REPORT_UNRECONCILED');
 const meta={asOf:asOf.toISOString(),timezone:org.timezone,currency:org.currencyCode,basis:'registered_supplier_invoice_and_payment_allocation',names:'current_catalog',unregisteredReceipts:'excluded_not_assumed_unpaid'};
 if(isExport){const fields=['invoiced','allocated','unpaid','overdue','upcoming','noDueDate','paid','advance'] as const;return {success:true,data:{filename:'supplier-balances.csv',content:csv([['Supplier ID','Supplier','Filial ID','Filial',...fields],...rows.map(r=>[r.supplierId,r.supplierName,r.storeId,r.storeName,...fields.map(k=>numeric(r[k],2))])]),summary,meta}};}
 return {success:true,data:{rows,summary,meta},pagination:pagination(page,limit,total)};
 },{isolationLevel:'RepeatableRead'});return NextResponse.json(result);
});
