import { Prisma } from '@prisma/client'
import type { TokenPayload } from '@/lib/auth'
import { prisma } from '@/lib/prisma'
import { AccessError } from '../auth/policy'
import { assertLiveContext } from '../operations'
export type ReconciliationKind='inventory'|'sales'|'returns'|'shifts'
export type ReconciliationScope=Pick<TokenPayload,'organizationId'|'role'|'storeIds'>
function stores(context:ReconciliationScope,alias:string,storeId?:string) {
 const column=Prisma.raw(`${alias}."storeId"`)
 if (storeId && context.role!=='owner' && !context.storeIds.includes(storeId)) throw new AccessError(403,'FORBIDDEN')
 return Prisma.sql`${storeId?Prisma.sql`AND ${column}=${storeId}`:Prisma.empty} ${context.role==='owner'?Prisma.empty:context.storeIds.length?Prisma.sql`AND ${column} IN (${Prisma.join(context.storeIds)})`:Prisma.sql`AND FALSE`}`
}
export function discrepancyQuery(context:ReconciliationScope,kind:ReconciliationKind,storeId?:string) {
 if (context.role==='cashier') throw new AccessError(403,'FORBIDDEN')
 if (kind==='inventory') return Prisma.sql`
 WITH journal AS (
  SELECT m."storeId",m."productId",SUM(m."quantityDelta") AS quantity
  FROM "InventoryMovement" m WHERE m."organizationId"=${context.organizationId} ${stores(context,'m',storeId)} GROUP BY m."storeId",m."productId"
 ), balances AS (
  SELECT b."storeId",b."productId",b.quantity FROM "InventoryBalance" b JOIN "Store" s ON s.id=b."storeId"
  WHERE s."organizationId"=${context.organizationId} ${stores(context,'b',storeId)}
 )
 SELECT COALESCE(b."storeId",j."storeId") AS "storeId",COALESCE(b."productId",j."productId") AS "productId",
 (SELECT name FROM "Product" p WHERE p.id=COALESCE(b."productId",j."productId")) AS "productName", COALESCE(j.quantity,0) AS expected,COALESCE(b.quantity,0) AS actual,COALESCE(b.quantity,0)-COALESCE(j.quantity,0) AS difference
 FROM balances b FULL JOIN journal j USING ("storeId","productId") WHERE COALESCE(b.quantity,0)<>COALESCE(j.quantity,0)`
 if (kind==='sales') return Prisma.sql`
 WITH selected AS (SELECT s.id,s."receiptNo",s."storeId",s."totalAmount" FROM "Sale" s WHERE s."organizationId"=${context.organizationId} AND s.status IN ('completed','partially_returned','returned') ${stores(context,'s',storeId)}),
 lines AS (SELECT i."saleId",SUM(i."lineTotal"-i."receiptDiscount") AS amount FROM "SaleItem" i JOIN selected s ON s.id=i."saleId" GROUP BY i."saleId"),
 payments AS (SELECT p."saleId",SUM(p.amount) AS amount FROM "Payment" p JOIN selected s ON s.id=p."saleId" WHERE p.direction='in' AND p.status='recorded' AND p.note IS DISTINCT FROM 'debt_collection' GROUP BY p."saleId")
 SELECT s.id AS "saleId",s."receiptNo",s."storeId",s."totalAmount" AS expected,COALESCE(l.amount,0) AS "itemAmount",COALESCE(p.amount,0) AS "paymentAmount"
 FROM selected s LEFT JOIN lines l ON l."saleId"=s.id LEFT JOIN payments p ON p."saleId"=s.id
 WHERE s."totalAmount"<>COALESCE(l.amount,0) OR s."totalAmount"<>COALESCE(p.amount,0)`
 if (kind==='returns') return Prisma.sql`
 WITH selected AS (SELECT ret.id,ret."returnReceiptNo",s."storeId",ret."refundAmount" FROM "SaleReturn" ret JOIN "Sale" s ON s.id=ret."saleId" WHERE s."organizationId"=${context.organizationId} ${stores(context,'s',storeId)}),
 lines AS (SELECT i."saleReturnId",SUM(i."lineTotal") AS amount FROM "SaleReturnItem" i JOIN selected r ON r.id=i."saleReturnId" GROUP BY i."saleReturnId")
 SELECT r.id AS "returnId",r."returnReceiptNo",r."storeId",r."refundAmount" AS expected,COALESCE(l.amount,0) AS actual
 FROM selected r LEFT JOIN lines l ON l."saleReturnId"=r.id WHERE r."refundAmount"<>COALESCE(l.amount,0)`
 return Prisma.sql`
 WITH selected AS (SELECT sh.id,sh."openingCash",sh."expectedCash",r."storeId" FROM "Shift" sh JOIN "Register" r ON r.id=sh."registerId" JOIN "Store" st ON st.id=r."storeId" WHERE st."organizationId"=${context.organizationId} AND sh.status='closed' ${stores(context,'r',storeId)}),
 payments AS (SELECT p."shiftId",SUM(CASE WHEN p.direction='in' THEN p.amount ELSE -p.amount END) AS amount FROM "Payment" p JOIN selected s ON s.id=p."shiftId" WHERE p."paymentType"='cash' AND p.status='recorded' GROUP BY p."shiftId"),
 movements AS (SELECT m."shiftId",SUM(CASE WHEN m."movementType" IN ('cash_in','correction_in') THEN m.amount ELSE -m.amount END) AS amount FROM "CashMovement" m JOIN selected s ON s.id=m."shiftId" GROUP BY m."shiftId")
 SELECT s.id AS "shiftId",s."storeId",s."openingCash"+COALESCE(p.amount,0)+COALESCE(m.amount,0) AS expected,s."expectedCash" AS actual
 FROM selected s LEFT JOIN payments p ON p."shiftId"=s.id LEFT JOIN movements m ON m."shiftId"=s.id
 WHERE s."expectedCash" IS DISTINCT FROM s."openingCash"+COALESCE(p.amount,0)+COALESCE(m.amount,0)`
}
export async function reconcile(context:TokenPayload,kind:ReconciliationKind,storeId?:string,page=1,limit=50) {
 if (!Number.isSafeInteger(page) || page<1 || !Number.isSafeInteger(limit) || limit<1 || limit>200) throw new AccessError(400,'INVALID_PAGINATION')
 const query=discrepancyQuery(context,kind,storeId)
 return prisma.$transaction(async tx=>{
  await assertLiveContext(tx,context)
  const rows=await tx.$queryRaw<Record<string,unknown>[]>(Prisma.sql`SELECT * FROM (${query}) discrepancies ORDER BY "storeId",1,2 LIMIT ${limit} OFFSET ${(page-1)*limit}`)
  const count=await tx.$queryRaw<{count:bigint}[]>(Prisma.sql`SELECT COUNT(*) AS count FROM (${query}) discrepancies`)
  const total=Number(count[0].count)
  return {rows,pagination:{page,limit,total,totalPages:Math.ceil(total/limit)}}
 },{isolationLevel:Prisma.TransactionIsolationLevel.RepeatableRead,timeout:15000})
}
