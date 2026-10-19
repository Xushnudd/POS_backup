import {z} from 'zod';
import {prisma} from '@/lib/prisma';
import type {TokenPayload} from '@/lib/auth';
import {AccessError} from '../auth/policy';
import {assertLiveContext,audit,runOperation} from '../operations';
import {loyaltyPolicySchema} from './calculations';
export const publishLoyaltyPolicySchema=z.object({operationId:z.string().uuid(),expectedRevision:z.number().int().min(0),configuration:loyaltyPolicySchema,reason:z.string().trim().min(3).max(2000)}).strict();
function owner(context:TokenPayload){if(context.role!=='owner'||context.customRole)throw new AccessError(403,'OWNER_REQUIRED');}
export async function publishLoyaltyPolicy(context:TokenPayload,input:z.infer<typeof publishLoyaltyPolicySchema>){
 owner(context);const data=publishLoyaltyPolicySchema.parse(input);
 return runOperation(context,'loyalty.policy.publish',data.operationId,data,async tx=>{
  await tx.$queryRaw`SELECT pg_advisory_xact_lock(hashtextextended(${'loyalty-policy:'+context.organizationId},0))::text`;
  if(!await tx.organization.findFirst({where:{id:context.organizationId,currencyCode:'UZS'},select:{id:true}}))throw new AccessError(409,'LOYALTY_CURRENCY_UNSUPPORTED');
  const previous=await tx.loyaltyPolicyVersion.findFirst({where:{organizationId:context.organizationId},orderBy:{revision:'desc'}});
  if((previous?.revision??0)!==data.expectedRevision)throw new AccessError(409,'LOYALTY_POLICY_CHANGED');
  const row=await tx.loyaltyPolicyVersion.create({data:{organizationId:context.organizationId,revision:data.expectedRevision+1,configuration:JSON.parse(JSON.stringify(data.configuration)),createdBy:context.userId,reason:data.reason}});
  await audit(tx,context,'LoyaltyPolicyVersion',row.id,'loyalty_policy_published',{revision:row.revision,configuration:row.configuration,reason:row.reason});return row;
 });
}
export async function readLoyaltyPolicy(context:TokenPayload){
 owner(context);return prisma.$transaction(async tx=>{
  await assertLiveContext(tx,context);const row=await tx.loyaltyPolicyVersion.findFirst({where:{organizationId:context.organizationId},orderBy:{revision:'desc'}});
  return row?{...row,configuration:loyaltyPolicySchema.parse(row.configuration)}:null;
 },{isolationLevel:'RepeatableRead'});
}
