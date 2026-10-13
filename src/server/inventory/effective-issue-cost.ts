import {Prisma} from '@prisma/client'
import {AccessError} from '../auth/policy'
/** Latest immutable application snapshot reprices the original issue without
 * changing SaleItem. A subsequent reversal publishes another exact snapshot. */
export async function effectiveIssueCost(tx:Prisma.TransactionClient,organizationId:string,itemId:string,original:Prisma.Decimal){
 const rows=await tx.$queryRaw<{id:string;unitCost:string}[]>`SELECT a.id,issue->>'unitCost' AS "unitCost" FROM "ReceiptCostApplication" a CROSS JOIN LATERAL jsonb_array_elements(a.snapshot->'products') product CROSS JOIN LATERAL jsonb_array_elements(product->'issueCosts') issue WHERE a."organizationId"=${organizationId} AND issue->>'itemId'=${itemId} ORDER BY a.ordinal DESC LIMIT 1`
 if(!rows.length)return {unitCost:original,applicationId:null}
 if(!/^(?:0|[1-9]\d{0,13})(?:\.\d{1,6})?$/.test(rows[0].unitCost))throw new AccessError(409,'COST_SOURCE_RECONCILIATION_REQUIRED')
 return {unitCost:new Prisma.Decimal(rows[0].unitCost),applicationId:rows[0].id}
}
