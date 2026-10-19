import {Prisma} from '@prisma/client'
import type {TokenPayload} from '@/lib/auth'
import {AccessError} from '../auth/policy'

/** Future-only binding to a native cost event, never a timestamp association.
 * This grants no standalone posting authority: caller must verify the complete
 * product order, source facts, current role and one consistent transaction. */
export async function readManualCostApproval(tx:Prisma.TransactionClient,context:TokenPayload,event:{id:string;productId:string;beforeUnitCost:string|null;afterUnitCost:string|null}){
 if(!event.beforeUnitCost||!event.afterUnitCost)throw new AccessError(409,'COST_MANUAL_APPROVAL_UNPROVEN')
 const reference={id:event.id,productId:event.productId,beforeUnitCost:new Prisma.Decimal(event.beforeUnitCost).toFixed(6),afterUnitCost:new Prisma.Decimal(event.afterUnitCost).toFixed(6)}
 const rows=await tx.auditLog.findMany({where:{organizationId:context.organizationId,OR:[{entityType:'Product',entityId:event.productId,action:'update'},{entityType:'PriceBatch',action:'prices_changed'}],afterData:{path:['valuationReferences'],array_contains:[reference]}},take:2})
 if(rows.length!==1||!rows[0].actorId||!rows[0].afterData||Array.isArray(rows[0].afterData)||typeof rows[0].afterData!=='object')throw new AccessError(409,'COST_MANUAL_APPROVAL_UNPROVEN')
 const data=rows[0].afterData
 if(data.approvedRole!=='owner'||data.approvedBy!==rows[0].actorId)throw new AccessError(409,'COST_MANUAL_APPROVAL_UNPROVEN')
 return {auditId:rows[0].id,actorId:rows[0].actorId,...reference}
}
