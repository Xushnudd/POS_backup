import { Prisma } from '@prisma/client'
export type DebtTarget={key:string;saleId:string|null;debtOriginId:string|null;receiptNo:string|null;sourceType:string;balance:Prisma.Decimal;dueAt:Date|null;effectiveAt:Date;origins:bigint;legacyUnallocated:boolean}
// A historical unlinked general reduction cannot be assigned to a guessed document.
export async function debtTargets(tx:Prisma.TransactionClient,organizationId:string,customerId:string){
 return tx.$queryRaw<DebtTarget[]>`
 WITH selected AS (SELECT * FROM "DebtEntry" WHERE "organizationId"=${organizationId} AND "customerId"=${customerId}),
 legacy AS (SELECT EXISTS(SELECT 1 FROM selected WHERE "saleId" IS NULL AND "debtOriginId" IS NULL AND amount<0) AS ambiguous),
 keyed AS (SELECT d.*,CASE WHEN "saleId" IS NOT NULL THEN 'sale:'||"saleId" WHEN legacy.ambiguous THEN 'general' ELSE 'document:'||COALESCE("debtOriginId",id) END AS key FROM selected d CROSS JOIN legacy),
 grouped AS (SELECT key,max("saleId") AS "saleId",CASE WHEN key LIKE 'document:%' THEN substring(key FROM 10) END AS "debtOriginId",
  COALESCE(max("sourceType") FILTER(WHERE amount>0),'unknown') AS "sourceType",sum(amount) AS balance,
  max("dueAt") FILTER(WHERE amount>0) AS "dueAt",min("effectiveAt") FILTER(WHERE amount>0) AS "effectiveAt",
  count(*) FILTER(WHERE amount>0) AS origins,bool_or(key='general') AS "legacyUnallocated" FROM keyed GROUP BY key)
 SELECT g.*,s."receiptNo" FROM grouped g LEFT JOIN "Sale" s ON s.id=g."saleId" AND s."organizationId"=${organizationId}
 ORDER BY g."effectiveAt",g.key`
}
