import {Prisma} from '@prisma/client'
/** Same journal shape for initial posting/reversal and future value changes.
 * Consumers must apply their existing tenant/branch/date predicates. */
export const costPostingsSql=Prisma.sql`WITH cost_postings AS (
 SELECT "organizationId","storeId","createdAt",snapshot FROM "ReceiptCostApplication"
 UNION ALL
 SELECT "organizationId","storeId","createdAt",jsonb_build_object('products',jsonb_build_array(jsonb_build_object('cogsEntries',"cogsEntries",'varianceCorrection',"varianceCorrection"::text,'roundingCorrection',"roundingCorrection"::text))) FROM "ReceiptCostContinuation"
)`
