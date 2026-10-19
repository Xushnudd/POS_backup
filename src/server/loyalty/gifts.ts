import {z} from 'zod';
import {Prisma} from '@prisma/client';
import {prisma} from '@/lib/prisma';
import type {TokenPayload} from '@/lib/auth';
import {AccessError,tenantScope} from '../auth/policy';
import {assertLiveContext,audit,runOperation} from '../operations';
import {receiveAdvanceSchema,receiveAdvanceTx,allocateAdvanceTx,refundAdvanceSchema,refundAdvanceTx} from '../customers/advances';
import {loyaltyPolicySchema} from './calculations';
import {decimal} from '../sales/calculations';
import {completeSaleTx,completeSchema} from '../sales/service';
const reason=z.string().trim().min(3).max(2000);
export const issueGiftSchema=receiveAdvanceSchema.extend({customerId:z.string().uuid(),policyVersionId:z.string().uuid(),code:z.string().trim().toUpperCase().regex(/^[A-Z0-9][A-Z0-9_-]{2,63}$/)}).strict();
export const redeemGiftSchema=z.object({operationId:z.string().uuid(),giftId:z.string().uuid(),saleId:z.string().uuid(),amount:receiveAdvanceSchema.shape.amount,customerConsent:z.literal(true),reason}).strict();
export const refundGiftSchema=refundAdvanceSchema.omit({advanceId:true}).extend({giftId:z.string().uuid()}).strict();
export const checkoutGiftSchema=completeSchema.extend({operationId:z.string().uuid(),giftId:z.string().uuid(),giftAmount:receiveAdvanceSchema.shape.amount,customerConsent:z.literal(true),reason}).strict().refine(data=>data.payments.every(payment=>payment.paymentType!=='credit'),'Gift checkout receives only the remaining non-credit payments');
function owner(context:TokenPayload){if(context.role!=='owner'||context.customRole)throw new AccessError(403,'OWNER_REQUIRED');}
async function current(tx:Prisma.TransactionClient,organizationId:string){
 await tx.$queryRaw`SELECT pg_advisory_xact_lock(hashtextextended(${'loyalty-policy:'+organizationId},0))::text`;
 const row=await tx.loyaltyPolicyVersion.findFirst({where:{organizationId},orderBy:{revision:'desc'}});
 if(!row||!loyaltyPolicySchema.parse(row.configuration).gifts.enabled)throw new AccessError(409,'GIFT_UNAVAILABLE');
 return row;
}
export async function issueGift(context:TokenPayload,input:z.infer<typeof issueGiftSchema>){
 owner(context);const data=issueGiftSchema.parse(input);
 return runOperation(context,'loyalty.gift.issue',data.operationId,data,async tx=>{
  // Retain the existing cash-account -> shift -> customer lock order. If the
  // subsequent policy/registry check fails, the cash entry rolls back with it.
  const advance=await receiveAdvanceTx(tx,context,data.customerId,{operationId:data.operationId,accountId:data.accountId,shiftId:data.shiftId,amount:data.amount,reason:data.reason});
  const policy=await current(tx,context.organizationId),terms=loyaltyPolicySchema.parse(policy.configuration).gifts;
  if(policy.id!==data.policyVersionId)throw new AccessError(409,'LOYALTY_POLICY_CHANGED');
  if(decimal(data.amount).lt(terms.minIssueAmount)||decimal(data.amount).gt(terms.maxIssueAmount))throw new AccessError(409,'GIFT_ISSUE_LIMIT');
  if(await tx.giftCertificate.findFirst({where:{organizationId:context.organizationId,code:data.code}}))throw new AccessError(409,'GIFT_CODE_EXISTS');
  const expiresAt=terms.validityDays===null?null:new Date(advance.createdAt.getTime()+terms.validityDays*86400000);
  const gift=await tx.giftCertificate.create({data:{organizationId:context.organizationId,advanceId:advance.id,policyVersionId:policy.id,code:data.code,createdBy:context.userId,reason:data.reason,expiresAt}});
  await audit(tx,context,'GiftCertificate',gift.id,'gift_issued',{advanceId:advance.id,policyVersionId:policy.id,code:gift.code,reason:data.reason,customerId:data.customerId,amount:advance.amount,expiresAt});
  return {...gift,customerId:data.customerId,amount:advance.amount.toFixed(2)};
 });
}
async function source(tx:Prisma.TransactionClient,context:TokenPayload,id:string){
 const gift=await tx.giftCertificate.findFirst({where:{id,organizationId:context.organizationId},include:{advance:true,policy:true}});
 if(!gift)throw new AccessError(404,'NOT_FOUND');return gift;
}
export async function redeemGift(context:TokenPayload,input:z.infer<typeof redeemGiftSchema>){
 owner(context);const data=redeemGiftSchema.parse(input);
 return runOperation(context,'loyalty.gift.redeem',data.operationId,data,async tx=>{
  const gift=await source(tx,context,data.giftId);
  const allocation=await allocateAdvanceTx(tx,context,gift.advance.customerId,{operationId:data.operationId,advanceId:gift.advanceId,targetKey:'sale:'+data.saleId,amount:data.amount,reason:data.reason});
  await audit(tx,context,'GiftCertificate',gift.id,'gift_redeemed',{allocationId:allocation.id,saleId:data.saleId,amount:allocation.amount,customerConsent:true,reason:data.reason});
  return {giftId:gift.id,allocationId:allocation.id,saleId:data.saleId,amount:allocation.amount.toFixed(2)};
 });
}
export async function refundGift(context:TokenPayload,input:z.infer<typeof refundGiftSchema>){
 owner(context);const data=refundGiftSchema.parse(input);
 return runOperation(context,'loyalty.gift.refund',data.operationId,data,async tx=>{
  const gift=await source(tx,context,data.giftId);
  if(!loyaltyPolicySchema.parse(gift.policy.configuration).gifts.allowUnusedCashRefund)throw new AccessError(409,'GIFT_CASH_REFUND_DENIED');
  const refund=await refundAdvanceTx(tx,context,gift.advance.customerId,{operationId:data.operationId,advanceId:gift.advanceId,accountId:data.accountId,shiftId:data.shiftId,amount:data.amount,reason:data.reason});
  await audit(tx,context,'GiftCertificate',gift.id,'gift_cash_refunded',{refundId:refund.id,amount:refund.amount,reason:data.reason});
  return {giftId:gift.id,refundId:refund.id,amount:refund.amount.toFixed(2)};
 });
}
export async function checkoutGift(context:TokenPayload,saleId:string,input:z.infer<typeof checkoutGiftSchema>){
 z.string().uuid().parse(saleId);const data=checkoutGiftSchema.parse(input);
 return runOperation(context,'loyalty.gift.checkout',data.operationId,{saleId,...data},async tx=>{
  // The ordinary sale path still verifies scope, shift, stock, price, tax and
  // discount authority. Gift funding is validated and consumed in that same
  // transaction; a zero-credit-limit customer is never left with new debt.
  return completeSaleTx(tx,context,saleId,{...data,payments:[...data.payments,{paymentType:'credit',amount:data.giftAmount}]},data.operationId,undefined,false,{id:data.giftId,amount:String(data.giftAmount),reason:data.reason});
 });
}
export async function saleGiftChoices(context:TokenPayload,saleId:string,options:{page:number;search:string}){
 z.string().uuid().parse(saleId);const {page,search}=z.object({page:z.number().int().min(1).max(1000000),search:z.string().max(200)}).strict().parse(options);
 return prisma.$transaction(async tx=>{
  await assertLiveContext(tx,context);
  const sale=await tx.sale.findFirst({where:{id:saleId,AND:tenantScope('Sale',context)},select:{customerId:true}});
  if(!sale)throw new AccessError(404,'NOT_FOUND');
  if(!sale.customerId)return {rows:[],pagination:{page,limit:20,total:0}};
  const [total]=await tx.$queryRaw<{value:bigint}[]>`SELECT count(*) AS value FROM "GiftCertificate" g JOIN "CustomerAdvanceBalance" a ON a.id=g."advanceId" WHERE g."organizationId"=${context.organizationId} AND a."customerId"=${sale.customerId} AND a.available>0 AND (g."expiresAt" IS NULL OR g."expiresAt">statement_timestamp()) AND strpos(g.code,upper(${search}))>0 AND (SELECT configuration#>'{gifts,enabled}' FROM "LoyaltyPolicyVersion" WHERE "organizationId"=${context.organizationId} ORDER BY revision DESC LIMIT 1)='true'::jsonb`;
  const rows=await tx.$queryRaw<{id:string;code:string;available:Prisma.Decimal;expiresAt:Date|null}[]>`SELECT g.id,g.code,a.available,g."expiresAt" FROM "GiftCertificate" g JOIN "CustomerAdvanceBalance" a ON a.id=g."advanceId" WHERE g."organizationId"=${context.organizationId} AND a."customerId"=${sale.customerId} AND a.available>0 AND (g."expiresAt" IS NULL OR g."expiresAt">statement_timestamp()) AND strpos(g.code,upper(${search}))>0 AND (SELECT configuration#>'{gifts,enabled}' FROM "LoyaltyPolicyVersion" WHERE "organizationId"=${context.organizationId} ORDER BY revision DESC LIMIT 1)='true'::jsonb ORDER BY g."createdAt",g.id LIMIT 20 OFFSET ${(page-1)*20}`;
  return {rows:rows.map(row=>({...row,available:row.available.toFixed(2)})),pagination:{page,limit:20,total:Number(total.value)}};
 },{isolationLevel:'RepeatableRead'});
}
export async function listGifts(context:TokenPayload,options:{page:number;limit:number;query:string;customerId?:string}){
 owner(context);const {page,limit,query,customerId}=z.object({page:z.number().int().min(1).max(1000000),limit:z.number().int().min(1).max(200),query:z.string().max(200),customerId:z.string().uuid().optional()}).strict().parse(options);
 return prisma.$transaction(async tx=>{
  await assertLiveContext(tx,context);
  const [clock]=await tx.$queryRaw<{at:Date}[]>`SELECT clock_timestamp()::timestamp(3) AS at`;
  const policy=await tx.loyaltyPolicyVersion.findFirst({where:{organizationId:context.organizationId},orderBy:{revision:'desc'}});
  const enabled=policy!==null&&loyaltyPolicySchema.parse(policy.configuration).gifts.enabled;
  const [count]=await tx.$queryRaw<{total:bigint}[]>`SELECT count(*) AS total FROM "GiftCertificate" g JOIN "CustomerAdvance" a ON a.id=g."advanceId" WHERE g."organizationId"=${context.organizationId} AND strpos(g.code,upper(${query}))>0 AND (CAST(${customerId??null} AS text) IS NULL OR a."customerId"=${customerId??null})`;
  const rows=await tx.$queryRaw<{id:string;code:string;advanceId:string;customerId:string;amount:Prisma.Decimal;available:Prisma.Decimal;allowUnusedCashRefund:boolean;expiresAt:Date|null;createdAt:Date}[]>`SELECT g.id,g.code,g."advanceId",a."customerId",a.amount,a.available,g."expiresAt",g."createdAt",(p.configuration#>>'{gifts,allowUnusedCashRefund}')::boolean AS "allowUnusedCashRefund" FROM "GiftCertificate" g JOIN "CustomerAdvanceBalance" a ON a.id=g."advanceId" JOIN "LoyaltyPolicyVersion" p ON p.id=g."policyVersionId" WHERE g."organizationId"=${context.organizationId} AND strpos(g.code,upper(${query}))>0 AND (CAST(${customerId??null} AS text) IS NULL OR a."customerId"=${customerId??null}) ORDER BY g."createdAt" DESC,g.id DESC LIMIT ${limit} OFFSET ${(page-1)*limit}`;
  return {rows:rows.map(row=>({...row,amount:row.amount.toFixed(2),liability:row.available.toFixed(2),available:undefined,spendable:enabled&&(row.expiresAt===null||row.expiresAt>clock.at)?row.available.toFixed(2):'0.00'})),pagination:{page,limit,total:Number(count.total)},asOf:clock.at};
 },{isolationLevel:'RepeatableRead'});
}
