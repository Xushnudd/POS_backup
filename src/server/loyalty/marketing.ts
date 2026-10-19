import {z} from 'zod';
import {Prisma} from '@prisma/client';
import {prisma} from '@/lib/prisma';
import type {TokenPayload} from '@/lib/auth';
import {AccessError,tenantScope} from '../auth/policy';
import {audit,runOperation,assertLiveContext} from '../operations';
import {requireOpenShift} from '../sales/service';
import {decimal} from '../sales/calculations';
import {loyaltyPolicySchema,promotionRuleSchema,promotionDiscount} from './calculations';
import {reprice} from './redemption';
const reason=z.string().trim().min(3).max(2000),code=z.string().trim().toUpperCase().regex(/^[A-Z0-9][A-Z0-9_-]{2,63}$/);
export const issueCardSchema=z.object({operationId:z.string().uuid(),policyVersionId:z.string().uuid(),customerId:z.string().uuid(),code,reason}).strict();
export const createPromotionSchema=z.object({operationId:z.string().uuid(),policyVersionId:z.string().uuid(),code,configuration:promotionRuleSchema,reason}).strict();
export const revokeRegistrySchema=z.object({operationId:z.string().uuid(),kind:z.enum(['card','promotion']),id:z.string().uuid(),reason}).strict();
export const prepareBenefitSchema=z.object({operationId:z.string().uuid(),policyVersionId:z.string().uuid(),cardId:z.string().uuid().nullable(),promotionId:z.string().uuid().nullable(),reason,customerConsent:z.literal(true)}).strict().refine(data=>data.cardId!==null||data.promotionId!==null,'Card or promotion required');
export const cancelBenefitSchema=z.object({operationId:z.string().uuid(),reason}).strict();
function owner(ctx:TokenPayload){if(ctx.role!=='owner'||ctx.customRole)throw new AccessError(403,'OWNER_REQUIRED');}
async function policy(tx:Prisma.TransactionClient,ctx:TokenPayload,id:string){
 await tx.$queryRaw`SELECT pg_advisory_xact_lock(hashtextextended(${'loyalty-policy:'+ctx.organizationId},0))::text`;
 const row=await tx.loyaltyPolicyVersion.findFirst({where:{organizationId:ctx.organizationId},orderBy:{revision:'desc'}});
 if(!row||row.id!==id)throw new AccessError(409,'LOYALTY_POLICY_CHANGED');return {row,config:loyaltyPolicySchema.parse(row.configuration)};
}
export async function issueCard(ctx:TokenPayload,input:z.infer<typeof issueCardSchema>){
 owner(ctx);const data=issueCardSchema.parse(input);
 return runOperation(ctx,'loyalty.card.issue',data.operationId,data,async tx=>{
  const terms=await policy(tx,ctx,data.policyVersionId);if(!terms.config.cards.enabled)throw new AccessError(409,'CARD_UNAVAILABLE');
  if(!await tx.customer.findFirst({where:{id:data.customerId,organizationId:ctx.organizationId,isActive:true,mergedIntoId:null},select:{id:true}}))throw new AccessError(404,'CUSTOMER_NOT_FOUND');
  if(await tx.loyaltyCard.findFirst({where:{organizationId:ctx.organizationId,code:data.code},select:{id:true}}))throw new AccessError(409,'LOYALTY_CODE_EXISTS');
  const [clock]=await tx.$queryRaw<{at:Date}[]>`SELECT transaction_timestamp()::timestamp(3) AS at`;
  const expiresAt=terms.config.cards.validityDays===null?null:new Date(clock.at.getTime()+terms.config.cards.validityDays*86400000);
  const row=await tx.loyaltyCard.create({data:{organizationId:ctx.organizationId,customerId:data.customerId,policyVersionId:terms.row.id,code:data.code,reason:data.reason,createdBy:ctx.userId,expiresAt}});
  await audit(tx,ctx,'LoyaltyCard',row.id,'loyalty_registry_issued',{customerId:row.customerId,code:row.code,policyVersionId:row.policyVersionId,expiresAt:row.expiresAt,reason:data.reason});return row;
 });
}
export async function createPromotion(ctx:TokenPayload,input:z.infer<typeof createPromotionSchema>){
 owner(ctx);const data=createPromotionSchema.parse(input);
 // A receipt promotion applies to the whole cart. Product-targeted discounts
 // require a separate line-level tax allocation contract; never approximate it.
 if(data.configuration.productIds.length)throw new AccessError(409,'PROMO_PRODUCT_SCOPE_UNAVAILABLE');
 return runOperation(ctx,'loyalty.promotion.create',data.operationId,data,async tx=>{
  const terms=await policy(tx,ctx,data.policyVersionId);if(!terms.config.promos.enabled)throw new AccessError(409,'PROMO_UNAVAILABLE');
  const stores=await tx.store.count({where:{id:{in:data.configuration.storeIds},organizationId:ctx.organizationId,isActive:true}});if(stores!==data.configuration.storeIds.length)throw new AccessError(404,'NOT_FOUND');
  if(await tx.loyaltyPromotion.findFirst({where:{organizationId:ctx.organizationId,code:data.code},select:{id:true}}))throw new AccessError(409,'LOYALTY_CODE_EXISTS');
  const row=await tx.loyaltyPromotion.create({data:{organizationId:ctx.organizationId,policyVersionId:terms.row.id,code:data.code,configuration:JSON.parse(JSON.stringify(data.configuration)),createdBy:ctx.userId,reason:data.reason}});
  await audit(tx,ctx,'LoyaltyPromotion',row.id,'loyalty_registry_issued',{code:row.code,policyVersionId:row.policyVersionId,configuration:row.configuration,reason:data.reason});return row;
 });
}
export async function revokeRegistry(ctx:TokenPayload,input:z.infer<typeof revokeRegistrySchema>){
 owner(ctx);const data=revokeRegistrySchema.parse(input);
 return runOperation(ctx,'loyalty.'+data.kind+'.revoke',data.operationId,data,async tx=>{
  const row=data.kind==='card'?await tx.loyaltyCard.findFirst({where:{id:data.id,organizationId:ctx.organizationId}}):await tx.loyaltyPromotion.findFirst({where:{id:data.id,organizationId:ctx.organizationId}});
  if(!row)throw new AccessError(404,'NOT_FOUND');if(row.revokedAt)throw new AccessError(409,'ALREADY_ARCHIVED');
  const updated=data.kind==='card'?await tx.loyaltyCard.update({where:{id:row.id},data:{revokedAt:new Date()}}):await tx.loyaltyPromotion.update({where:{id:row.id},data:{revokedAt:new Date()}});
  await audit(tx,ctx,data.kind==='card'?'LoyaltyCard':'LoyaltyPromotion',row.id,'loyalty_registry_revoked',{reason:data.reason,sessionId:ctx.sessionId});return updated;
 });
}
async function source(tx:Prisma.TransactionClient,ctx:TokenPayload,id:string){
 z.string().uuid().parse(id);await tx.$queryRaw`SELECT id FROM "Sale" WHERE id=${id} AND "organizationId"=${ctx.organizationId} FOR UPDATE`;
 const sale=await tx.sale.findFirst({where:{id,AND:tenantScope('Sale',ctx)},include:{items:true}});
 if(!sale)throw new AccessError(404,'NOT_FOUND');if(sale.status!=='draft')throw new AccessError(409,'INVALID_STATUS');
 await requireOpenShift(tx,ctx,sale.shiftId);if(!sale.customerId)throw new AccessError(400,'CUSTOMER_REQUIRED');return sale;
}
export async function prepareBenefit(ctx:TokenPayload,saleId:string,input:z.infer<typeof prepareBenefitSchema>){
 const data=prepareBenefitSchema.parse(input);
 return runOperation(ctx,'loyalty.benefit.prepare',data.operationId,{saleId,...data},async tx=>{
  const sale=await source(tx,ctx,saleId),terms=await policy(tx,ctx,data.policyVersionId);
  if(!await tx.customer.findFirst({where:{id:sale.customerId!,organizationId:ctx.organizationId,isActive:true,mergedIntoId:null},select:{id:true}}))throw new AccessError(404,'CUSTOMER_NOT_FOUND');
  if(await tx.loyaltyBenefitSelection.findFirst({where:{saleId,state:{in:['prepared','posted']}}}))throw new AccessError(409,'LOYALTY_BENEFIT_EXISTS');
  if(await tx.loyaltyRedemption.findFirst({where:{saleId,state:{in:['prepared','posted']}}}))throw new AccessError(409,'POINTS_SELECTION_CANCEL_REQUIRED');
  if(await tx.offlineCashLease.findFirst({where:{saleId,state:'issued'}}))throw new AccessError(409,'LOYALTY_OFFLINE_UNAVAILABLE');
  const [clock]=await tx.$queryRaw<{at:Date}[]>`SELECT clock_timestamp()::timestamp(3) AS at`;
  let base=sale.subtotal.sub(sale.discountAmount),cardAmount=decimal(0),promotionAmount=decimal(0);
  if(data.cardId){
   const [actual]=await tx.$queryRaw<{valid:boolean}[]>`SELECT EXISTS(SELECT 1 FROM "LoyaltyCard" WHERE id=${data.cardId} AND "organizationId"=${ctx.organizationId} AND "revokedAt" IS NULL AND ("expiresAt" IS NULL OR "expiresAt">${clock.at}) AND pos_loyalty_wallet_root("customerId",${ctx.organizationId})=pos_loyalty_wallet_root(${sale.customerId!},${ctx.organizationId})) AS valid`;
   if(!actual.valid||!terms.config.cards.enabled)throw new AccessError(409,'CARD_UNAVAILABLE');
   cardAmount=base.mul(terms.config.cards.discountPercent).div(100).toDecimalPlaces(2,Prisma.Decimal.ROUND_HALF_UP);base=base.sub(cardAmount);
  }
  if(data.promotionId){
   if(!terms.config.promos.enabled||(data.cardId&&!terms.config.promos.allowStackingWithCard))throw new AccessError(409,'PROMO_STACKING_DENIED');
   const row=await tx.loyaltyPromotion.findFirst({where:{id:data.promotionId,organizationId:ctx.organizationId,revokedAt:null}});
   if(!row)throw new AccessError(409,'PROMO_UNAVAILABLE');const config=promotionRuleSchema.parse(row.configuration);
   if(config.storeIds.length&&!config.storeIds.includes(sale.storeId))throw new AccessError(409,'PROMO_STORE_UNAVAILABLE');
   try{promotionAmount=decimal(promotionDiscount(base.toFixed(2),config,clock.at));}catch(error){throw new AccessError(409,error instanceof Error?error.message:'PROMO_UNAVAILABLE');}
  }
  const off=cardAmount.add(promotionAmount);if(off.lte(0))throw new AccessError(409,'LOYALTY_ZERO_BENEFIT');
  const [snapshot]=await tx.$queryRaw<{items:Prisma.InputJsonValue}[]>`SELECT pos_loyalty_item_snapshot(${sale.id}) AS items`;
  const row=await tx.loyaltyBenefitSelection.create({data:{organizationId:ctx.organizationId,saleId,customerId:sale.customerId!,policyVersionId:terms.row.id,cardId:data.cardId,promotionId:data.promotionId,discountAmount:off,cardAmount,promotionAmount,baseDiscountAmount:sale.discountAmount,originalDiscountPercent:sale.discountPercent,subtotalSnapshot:sale.subtotal,itemsSnapshot:snapshot.items,createdBy:ctx.userId,sessionId:ctx.sessionId,reason:data.reason}});
  const updated=await reprice(tx,ctx,sale,sale.discountAmount.add(off),null,data.reason);
  await audit(tx,ctx,'LoyaltyBenefitSelection',row.id,'loyalty_benefit_prepared',{saleId,discountAmount:off,cardId:data.cardId,promotionId:data.promotionId,customerConsent:true,reason:data.reason});return {sale:updated,selection:{id:row.id,discountAmount:off.toFixed(2),state:row.state}};
 });
}
export async function cancelBenefit(ctx:TokenPayload,saleId:string,input:z.infer<typeof cancelBenefitSchema>){
 const data=cancelBenefitSchema.parse(input);
 return runOperation(ctx,'loyalty.benefit.cancel',data.operationId,{saleId,...data},async tx=>{
  const sale=await source(tx,ctx,saleId);
  if(await tx.loyaltyRedemption.findFirst({where:{saleId,state:{in:['prepared','posted']}}}))throw new AccessError(409,'POINTS_SELECTION_CANCEL_REQUIRED');
  const row=await tx.loyaltyBenefitSelection.findFirst({where:{saleId,organizationId:ctx.organizationId,state:'prepared'}});if(!row)throw new AccessError(404,'NOT_FOUND');
  await tx.loyaltyBenefitSelection.update({where:{id:row.id},data:{state:'cancelled'}});
  const updated=await reprice(tx,ctx,sale,row.baseDiscountAmount,row.originalDiscountPercent,data.reason);
  await audit(tx,ctx,'LoyaltyBenefitSelection',row.id,'loyalty_benefit_cancelled',{saleId,sessionId:ctx.sessionId,reason:data.reason});return {sale:updated,selection:{id:row.id,state:'cancelled'}};
 });
}
export async function readBenefits(ctx:TokenPayload,saleId:string,options:{cardPage?:number;promotionPage?:number;search?:string}={}){
 z.string().uuid().parse(saleId);
 const {cardPage,promotionPage,search}=z.object({cardPage:z.number().int().min(1).max(1000000).default(1),promotionPage:z.number().int().min(1).max(1000000).default(1),search:z.string().max(200).default('')}).strict().parse(options);
 return prisma.$transaction(async tx=>{await assertLiveContext(tx,ctx);
  const sale=await tx.sale.findFirst({where:{id:saleId,AND:tenantScope('Sale',ctx)},select:{customerId:true,storeId:true}});if(!sale)throw new AccessError(404,'NOT_FOUND');
  const terms=await tx.loyaltyPolicyVersion.findFirst({where:{organizationId:ctx.organizationId},orderBy:{revision:'desc'}});
  const selection=await tx.loyaltyBenefitSelection.findFirst({where:{saleId,state:{in:['prepared','posted']}},select:{id:true,state:true,discountAmount:true,cardId:true,promotionId:true}});
  const [clock]=await tx.$queryRaw<{at:Date}[]>`SELECT statement_timestamp()::timestamp(3) AS at`;
  const cardFilter=Prisma.sql`"organizationId"=${ctx.organizationId} AND "revokedAt" IS NULL AND ("expiresAt" IS NULL OR "expiresAt">${clock.at}) AND strpos(code,upper(${search}))>0 AND "customerId" IN (SELECT id FROM "Customer" WHERE "organizationId"=${ctx.organizationId} AND (id=pos_loyalty_wallet_root(${sale.customerId},${ctx.organizationId}) OR "mergedIntoId"=pos_loyalty_wallet_root(${sale.customerId},${ctx.organizationId})))`;
  const promotionFilter=Prisma.sql`"organizationId"=${ctx.organizationId} AND "revokedAt" IS NULL AND configuration->'enabled'='true'::jsonb AND (configuration->>'startsAt')::timestamptz<=${clock.at} AND (configuration->>'endsAt')::timestamptz>${clock.at} AND (jsonb_array_length(configuration->'storeIds')=0 OR configuration->'storeIds' ? ${sale.storeId}) AND strpos(code,upper(${search}))>0`;
  const cards=sale.customerId?await tx.$queryRaw<{id:string;code:string;expiresAt:Date|null}[]>(Prisma.sql`SELECT id,code,"expiresAt" FROM "LoyaltyCard" WHERE ${cardFilter} ORDER BY "createdAt",id LIMIT 20 OFFSET ${(cardPage-1)*20}`):[];
  const [cardCount]=sale.customerId?await tx.$queryRaw<{value:bigint}[]>(Prisma.sql`SELECT count(*) AS value FROM "LoyaltyCard" WHERE ${cardFilter}`):[{value:BigInt(0)}];
  const promotions=await tx.$queryRaw<{id:string;code:string;kind:string;value:string;endsAt:string}[]>(Prisma.sql`SELECT id,code,configuration->>'kind' AS kind,configuration->>'value' AS value,configuration->>'endsAt' AS "endsAt" FROM "LoyaltyPromotion" WHERE ${promotionFilter} ORDER BY "createdAt",id LIMIT 20 OFFSET ${(promotionPage-1)*20}`);
  const [promotionCount]=await tx.$queryRaw<{value:bigint}[]>(Prisma.sql`SELECT count(*) AS value FROM "LoyaltyPromotion" WHERE ${promotionFilter}`);
  return {policy:terms?{id:terms.id,configuration:loyaltyPolicySchema.parse(terms.configuration)}:null,selection:selection?{...selection,discountAmount:selection.discountAmount.toFixed(2)}:null,cards,promotions,pagination:{cards:{page:cardPage,limit:20,total:Number(cardCount.value)},promotions:{page:promotionPage,limit:20,total:Number(promotionCount.value)}}};
 },{isolationLevel:'RepeatableRead'});
}
export async function listMarketing(ctx:TokenPayload,options:{kind:'card'|'promotion';page:number;search:string;customerId?:string;limit?:number;sort?:'newest'|'oldest'|'code'}){
 owner(ctx);const data=z.object({kind:z.enum(['card','promotion']),page:z.number().int().min(1).max(1000000),search:z.string().max(200),customerId:z.string().uuid().optional(),limit:z.number().int().min(1).max(200).default(20),sort:z.enum(['newest','oldest','code']).default('newest')}).strict().parse(options);
 return prisma.$transaction(async tx=>{await assertLiveContext(tx,ctx);
  const where={organizationId:ctx.organizationId,code:{contains:data.search.toUpperCase()}};
  const orderBy:({createdAt:'asc'|'desc'}|{code:'asc'}|{id:'asc'|'desc'})[]=data.sort==='code'?[{code:'asc'},{id:'asc'}]:[{createdAt:data.sort==='oldest'?'asc':'desc'},{id:data.sort==='oldest'?'asc':'desc'}];
  if(data.kind==='card'){
   const filter={...where,...(data.customerId?{customerId:data.customerId}:{})};
   const [total,rows]=await Promise.all([tx.loyaltyCard.count({where:filter}),tx.loyaltyCard.findMany({where:filter,orderBy,take:data.limit,skip:(data.page-1)*data.limit})]);return {rows,pagination:{page:data.page,limit:data.limit,total}};
  }
  const [total,rows]=await Promise.all([tx.loyaltyPromotion.count({where}),tx.loyaltyPromotion.findMany({where,orderBy,take:data.limit,skip:(data.page-1)*data.limit})]);return {rows,pagination:{page:data.page,limit:data.limit,total}};
 },{isolationLevel:'RepeatableRead'});
}
