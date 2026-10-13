import {Prisma} from '@prisma/client';
import {z} from 'zod';
import {prisma} from '@/lib/prisma';
import type {TokenPayload} from '@/lib/auth';
import {AccessError,tenantScope} from '../auth/policy';
import {assertLiveContext,audit,runOperation} from '../operations';
import {requireOpenShift,enforceDiscountLimit} from '../sales/service';
import {decimal,draftTotals} from '../sales/calculations';
import {priceTaxLines,type TaxMode} from '../taxes/calculations';
import {loyaltyPolicySchema,exactPoints,pointsDiscount} from './calculations';
import {pointWalletRows} from './wallet';
import {planPointSpend} from './lots';
type EditableSale=Prisma.SaleGetPayload<{include:{items:true}}>;
export const preparePointRedemptionSchema=z.object({operationId:z.string().uuid(),policyVersionId:z.string().uuid(),points:z.string().regex(/^\d+$/).max(19).refine(value=>{try{return exactPoints(value)>BigInt(0);}catch{return false;}}),customerConsent:z.literal(true),reason:z.string().trim().min(3).max(2000)}).strict();
export const cancelPointRedemptionSchema=z.object({operationId:z.string().uuid(),reason:z.string().trim().min(3).max(2000)}).strict();
async function source(tx:Prisma.TransactionClient,context:TokenPayload,id:string){
 z.string().uuid().parse(id);await tx.$queryRaw`SELECT id FROM "Sale" WHERE id=${id} AND "organizationId"=${context.organizationId} FOR UPDATE`;
 const sale=await tx.sale.findFirst({where:{id,AND:tenantScope('Sale',context)},include:{items:true}});
 if(!sale)throw new AccessError(404,'NOT_FOUND');if(sale.status!=='draft')throw new AccessError(409,'INVALID_STATUS');
 await requireOpenShift(tx,context,sale.shiftId);return sale;
}
async function reprice(tx:Prisma.TransactionClient,context:TokenPayload,sale:EditableSale,off:Prisma.Decimal,percent:Prisma.Decimal|null,reason:string){
 const authorization=await enforceDiscountLimit(tx,context,sale.items,draftTotals(sale.items,off).totalAmount,reason);
 const rows=priceTaxLines(sale.items.map(item=>({...item,taxMode:item.taxMode as TaxMode})),off);
 for(const row of rows)await tx.saleItem.update({where:{id:row.id},data:{receiptDiscount:row.receiptDiscount,taxBase:row.taxBase,taxAmount:row.taxAmount,payableAmount:row.payableAmount,roundingVersion:row.roundingVersion}});
 const netAmount=rows.reduce((total,row)=>total.add(row.taxBase),decimal(0)),taxAmount=rows.reduce((total,row)=>total.add(row.taxAmount),decimal(0));
 return tx.sale.update({where:{id:sale.id},data:{discountAmount:off,discountPercent:percent,netAmount,taxAmount,totalAmount:netAmount.add(taxAmount),...authorization},include:{items:true,payments:true}});
}
export async function preparePointRedemption(context:TokenPayload,saleId:string,input:z.infer<typeof preparePointRedemptionSchema>){
 const data=preparePointRedemptionSchema.parse(input);
 return runOperation(context,'loyalty.redeem.prepare',data.operationId,{saleId,...data},async tx=>{
  const sale=await source(tx,context,saleId);if(!sale.customerId)throw new AccessError(400,'CUSTOMER_REQUIRED');
  if(await tx.loyaltyRedemption.findFirst({where:{saleId,state:{in:['prepared','posted']}}}))throw new AccessError(409,'LOYALTY_REDEMPTION_EXISTS');
  if(await tx.offlineCashLease.findFirst({where:{saleId,state:'issued'}}))throw new AccessError(409,'LOYALTY_OFFLINE_UNAVAILABLE');
  if(!await tx.organization.findFirst({where:{id:context.organizationId,currencyCode:'UZS'},select:{id:true}}))throw new AccessError(409,'LOYALTY_CURRENCY_UNSUPPORTED');
  const wallet=await pointWalletRows(tx,context.organizationId,sale.customerId,true),position=planPointSpend(wallet.rows,'0',wallet.at);
  await tx.$queryRaw`SELECT pg_advisory_xact_lock(hashtextextended(${'loyalty-policy:'+context.organizationId},0))::text`;
  const policy=await tx.loyaltyPolicyVersion.findFirst({where:{organizationId:context.organizationId},orderBy:{revision:'desc'}});
  if(!policy||policy.id!==data.policyVersionId)throw new AccessError(409,'LOYALTY_POLICY_CHANGED');
  const config=loyaltyPolicySchema.parse(policy.configuration);
  let amount:string;
  try{amount=pointsDiscount(data.points,position.available,sale.subtotal.sub(sale.discountAmount).toFixed(2),config.points);}catch(error){throw new AccessError(409,error instanceof Error?error.message:'POINTS_BALANCE_CHANGED');}
  const [snapshot]=await tx.$queryRaw<{items:Prisma.InputJsonValue}[]>`SELECT pos_loyalty_item_snapshot(${sale.id}) AS items`;
  const quote=await tx.loyaltyRedemption.create({data:{organizationId:context.organizationId,saleId,customerId:sale.customerId,policyVersionId:policy.id,points:BigInt(data.points),discountAmount:amount,baseDiscountAmount:sale.discountAmount,originalDiscountPercent:sale.discountPercent,subtotalSnapshot:sale.subtotal,itemsSnapshot:snapshot.items,reason:data.reason,createdBy:context.userId,sessionId:context.sessionId}});
  const updated=await reprice(tx,context,sale,sale.discountAmount.add(amount),null,data.reason);
  await audit(tx,context,'LoyaltyRedemption',quote.id,'loyalty_redemption_prepared',{saleId,points:quote.points.toString(),discountAmount:quote.discountAmount.toFixed(2),policyVersionId:quote.policyVersionId,customerConsent:true,reason:data.reason});
  return {sale:updated,redemption:{id:quote.id,state:quote.state,points:quote.points.toString(),discountAmount:quote.discountAmount.toFixed(2),policyVersionId:quote.policyVersionId}};
 });
}
export async function cancelPointRedemption(context:TokenPayload,saleId:string,input:z.infer<typeof cancelPointRedemptionSchema>){
 const data=cancelPointRedemptionSchema.parse(input);
 return runOperation(context,'loyalty.redeem.cancel',data.operationId,{saleId,...data},async tx=>{
  const sale=await source(tx,context,saleId),quote=await tx.loyaltyRedemption.findFirst({where:{saleId,organizationId:context.organizationId,state:'prepared'}});
  if(!quote)throw new AccessError(404,'LOYALTY_REDEMPTION_NOT_FOUND');
  await tx.loyaltyRedemption.update({where:{id:quote.id},data:{state:'cancelled'}});
  const updated=await reprice(tx,context,sale,quote.baseDiscountAmount,quote.originalDiscountPercent,data.reason);
  await audit(tx,context,'LoyaltyRedemption',quote.id,'loyalty_redemption_cancelled',{saleId,reason:data.reason,sessionId:context.sessionId});
  return {sale:updated,redemption:{id:quote.id,state:'cancelled'}};
 });
}
export async function salePointRedemption(context:TokenPayload,saleId:string){
 z.string().uuid().parse(saleId);return prisma.$transaction(async tx=>{
  await assertLiveContext(tx,context);
  const row=await tx.loyaltyRedemption.findFirst({where:{saleId,AND:tenantScope('LoyaltyRedemption',context),state:{in:['prepared','posted']}},select:{id:true,state:true,points:true,discountAmount:true,policyVersionId:true}});
  return row?{...row,points:row.points.toString(),discountAmount:row.discountAmount.toFixed(2)}:null;
 },{isolationLevel:'RepeatableRead'});
}
