import {Prisma} from '@prisma/client';
import {z} from 'zod';
import {prisma} from '@/lib/prisma';
import type {TokenPayload} from '@/lib/auth';
import {AccessError} from '../auth/policy';
import {assertLiveContext} from '../operations';
import {planPointSpend,type PointLot} from './lots';
import {loyaltyPolicySchema} from './calculations';

/** Retained source lots are never reassigned on a customer merge. Resolve the
 * existing settled-alias group instead, so original receipt/customer identity
 * remains auditable and a merge does not duplicate or hide a reward balance. */
export async function pointWalletRows(tx:Prisma.TransactionClient,organizationId:string,customerId:string,lock=false){
 z.string().uuid().parse(customerId);
 const original=await tx.customer.findFirst({where:{id:customerId,organizationId},select:{id:true,isActive:true,mergedIntoId:true}});
 if(!original)throw new AccessError(404,'CUSTOMER_NOT_FOUND');
 const rootId=original.mergedIntoId??original.id;
 if(lock)await tx.$queryRaw`SELECT id FROM "Customer" WHERE id=${rootId} AND "organizationId"=${organizationId} FOR SHARE`;
 const root=await tx.customer.findFirst({where:{id:rootId,organizationId,isActive:true,mergedIntoId:null},select:{id:true}});
 if(!root)throw new AccessError(404,'CUSTOMER_NOT_FOUND');
 const aliases=await tx.customer.findMany({where:{organizationId,OR:[{id:rootId},{mergedIntoId:rootId}]},select:{id:true},take:101,orderBy:{id:'asc'}});
 if(aliases.length>100)throw new AccessError(409,'MERGE_LIMIT');
 if(lock)await tx.$queryRaw`SELECT pg_advisory_xact_lock(hashtextextended(${'points-wallet:'+organizationId+':'+rootId},0))::text`;
 const [clock]=await tx.$queryRaw<{now:Date}[]>`SELECT clock_timestamp() AS now`;
 const rows=await tx.$queryRaw<PointLot[]>`SELECT l.id,(l."initialPoints"+COALESCE(sum(e.points),0))::text AS remaining,l."createdAt",l."expiresAt"
  FROM "LoyaltyPointLot" l LEFT JOIN "LoyaltyPointEntry" e ON e."lotId"=l.id AND e."organizationId"=l."organizationId"
  WHERE l."organizationId"=${organizationId} AND l."customerId" IN (${Prisma.join(aliases.map(alias=>alias.id))})
  GROUP BY l.id HAVING (l."initialPoints"+COALESCE(sum(e.points),0))<0 OR ((l."expiresAt" IS NULL OR l."expiresAt">${clock.now}) AND (l."initialPoints"+COALESCE(sum(e.points),0))>0)
  ORDER BY l."createdAt",l.id LIMIT 10001`;
 if(rows.length>10000)throw new AccessError(413,'POINT_WALLET_TOO_LARGE');
 return {rootId,rows,at:clock.now};
}
export async function readPointWallet(context:TokenPayload,customerId:string){
 if(!['owner','admin','cashier'].includes(context.role))throw new AccessError(403,'FORBIDDEN');
 return prisma.$transaction(async tx=>{
  await assertLiveContext(tx,context);const wallet=await pointWalletRows(tx,context.organizationId,customerId),position=planPointSpend(wallet.rows,'0',wallet.at);
  const version=await tx.loyaltyPolicyVersion.findFirst({where:{organizationId:context.organizationId},orderBy:{revision:'desc'}}),org=await tx.organization.findUniqueOrThrow({where:{id:context.organizationId},select:{currencyCode:true}});
  const policy=version?loyaltyPolicySchema.parse(version.configuration).points:null;
  await assertLiveContext(tx,context);
  // Projection only: a GET never writes planned debt settlements or consumes
  // points. A future posting must persist them in its own locked transaction.
  return {customerId:wallet.rootId,availablePoints:position.available,recoveryDebtPoints:position.recoveryDebt,asOf:wallet.at.toISOString(),redemptionPolicy:version&&policy?{id:version.id,enabled:policy.enabled&&org.currencyCode==='UZS',redeemMoneyPerPoint:policy.redeemMoneyPerPoint,maxRedeemPercent:policy.maxRedeemPercent,expiryDays:policy.expiryDays,currency:'UZS' as const}:null};
 },{isolationLevel:'RepeatableRead'});
}
