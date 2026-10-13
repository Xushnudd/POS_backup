import {Prisma} from '@prisma/client'
import type {TokenPayload} from '@/lib/auth'
import {prisma} from '@/lib/prisma'
import {assertLiveContext} from '../operations'
import {AccessError,tenantScope} from '../auth/policy'
export async function costRouteSource(context:TokenPayload,documentId:string,planId:string){
 if(context.role!=='owner')throw new AccessError(403,'OWNER_REQUIRED')
 await prisma.$transaction(async tx=>{await assertLiveContext(tx,context);if(!await tx.receiptCostPlan.findFirst({where:{id:planId,stockDocumentId:documentId,AND:tenantScope('ReceiptCostPlan',context)},select:{id:true}}))throw new AccessError(404,'NOT_FOUND')})
}
export async function costJournalHistory(context:TokenPayload,documentId:string,planId:string,page:number){
 await costRouteSource(context,documentId,planId)
 if(!Number.isSafeInteger(page)||page<1||page>100000)throw new AccessError(400,'INVALID_PAGINATION')
 return prisma.$transaction(async tx=>{
  await assertLiveContext(tx,context)
  const where={organizationId:context.organizationId,planId}
  const [applications,continuations,total]=await Promise.all([
   tx.$queryRaw<Prisma.JsonObject[]>`SELECT a.id,a.amount::text,a."createdAt",a."reversalOfId",(SELECT jsonb_agg(jsonb_build_object('productId',p->>'productId','allocatedAmount',p->>'allocatedAmount','inventoryCorrection',p->>'inventoryCorrection','cogsCorrection',p->>'cogsCorrection','varianceCorrection',p->>'varianceCorrection','roundingCorrection',p->>'roundingCorrection','beforeAverageCost',p->>'beforeAverageCost','afterAverageCost',p->>'afterAverageCost','storeCorrections',p->'storeCorrections','transitCorrection',p->>'transitCorrection')) FROM jsonb_array_elements(a.snapshot->'products') p) AS products FROM "ReceiptCostApplication" a WHERE a."organizationId"=${context.organizationId} AND a."planId"=${planId} ORDER BY a.ordinal`,
   tx.$queryRaw<Prisma.JsonObject[]>`SELECT c.id,c."productId",c."storeId",c."varianceCorrection"::text,c."roundingCorrection"::text,c."sourceOperationId",c."sourceAuditId",c."createdAt",jsonb_array_length(c."cogsEntries") AS "cogsEntryCount",(SELECT COALESCE(sum((entry->>'amount')::numeric),0)::text FROM jsonb_array_elements(c."cogsEntries") entry) AS "cogsCorrection" FROM "ReceiptCostContinuation" c WHERE c."organizationId"=${context.organizationId} AND c."planId"=${planId} ORDER BY c."createdAt" DESC,c.id ASC LIMIT 20 OFFSET ${(page-1)*20}`,tx.receiptCostContinuation.count({where}),
  ])
  return {applications,continuations,total,page,pages:Math.ceil(total/20)}
 },{isolationLevel:'RepeatableRead'})
}
