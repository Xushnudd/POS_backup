import {Prisma} from '@prisma/client';import {z} from 'zod';import type {TokenPayload} from '@/lib/auth';import {prisma} from '@/lib/prisma';import {AccessError} from '../auth/policy';import {assertLiveContext,audit,runOperation} from '../operations';import {consumeLimit} from '../auth/rate-limit';
export const supportScopes=['catalog.read','inventory.read','sales.read','diagnostics.read'] as const;
export const grantSchema=z.object({operationId:z.string().uuid(),operatorUserId:z.string().uuid(),reason:z.string().trim().min(3).max(2000),scopes:z.array(z.enum(supportScopes)).min(1).max(4),storeIds:z.array(z.string().uuid()).min(1).max(20),expiresMinutes:z.number().int().min(1).max(60)}).strict();
const owner=(ctx:TokenPayload)=>{if(ctx.role!=='owner')throw new AccessError(403,'OWNER_REQUIRED')};
async function passwordSession(tx:Prisma.TransactionClient,ctx:TokenPayload){await assertLiveContext(tx,ctx);if(!await tx.session.findFirst({where:{id:ctx.sessionId,authenticationMethod:'password'}}))throw new AccessError(403,'PASSWORD_SESSION_REQUIRED')}
const dto=(grant:Prisma.SupportGrantGetPayload<{include:{organization:{select:{name:true}}}}>)=>({id:grant.id,organizationId:grant.organizationId,organizationName:grant.organization.name,operatorUserId:grant.operatorUserId,approvedBy:grant.approvedBy,reason:grant.reason,scopes:grant.scopes,storeIds:grant.storeIds,createdAt:grant.createdAt,expiresAt:grant.expiresAt,revokedAt:grant.revokedAt});
export async function availableOperators(ctx:TokenPayload){owner(ctx);return prisma.$transaction(async tx=>{await passwordSession(tx,ctx);return tx.platformOperator.findMany({where:{isActive:true,user:{isActive:true}},select:{userId:true,role:true,user:{select:{fullName:true}}},orderBy:{userId:'asc'},take:100})})}
export async function createGrant(ctx:TokenPayload,input:z.infer<typeof grantSchema>){owner(ctx);if(new Set(input.scopes).size!==input.scopes.length||new Set(input.storeIds).size!==input.storeIds.length)throw new AccessError(400,'DUPLICATE_SCOPE');return runOperation(ctx,'support.grant',input.operationId,input,async tx=>{await passwordSession(tx,ctx);const operator=await tx.platformOperator.findFirst({where:{userId:input.operatorUserId,isActive:true,user:{isActive:true}}});if(!operator)throw new AccessError(404,'OPERATOR_NOT_FOUND');if(await tx.store.count({where:{id:{in:input.storeIds},organizationId:ctx.organizationId,isActive:true}})!==input.storeIds.length)throw new AccessError(404,'STORE_NOT_FOUND');const [{now}]=await tx.$queryRaw<{now:Date}[]>`SELECT NOW() AS now`;const grant=await tx.supportGrant.create({data:{organizationId:ctx.organizationId,operatorUserId:input.operatorUserId,approvedBy:ctx.userId,reason:input.reason,scopes:input.scopes,storeIds:input.storeIds,createdAt:now,expiresAt:new Date(now.getTime()+input.expiresMinutes*60000)},include:{organization:{select:{name:true}}}});await audit(tx,ctx,'SupportGrant',grant.id,'support_granted',{operatorUserId:grant.operatorUserId,reason:grant.reason,scopes:grant.scopes,storeIds:grant.storeIds,expiresAt:grant.expiresAt});return dto(grant)})}
export async function listGrants(ctx:TokenPayload,received:boolean,page=1,limit=50){
 if(!received)owner(ctx);
 return prisma.$transaction(async tx=>{
  await passwordSession(tx,ctx);
  if(received&&!await tx.platformOperator.findFirst({where:{userId:ctx.userId,isActive:true,user:{isActive:true}}}))throw new AccessError(403,'OPERATOR_REQUIRED');
  const where:Prisma.SupportGrantWhereInput=received?{operatorUserId:ctx.userId,revokedAt:null,expiresAt:{gt:new Date()}}:{organizationId:ctx.organizationId};
  const total=await tx.supportGrant.count({where});
  const rows=await tx.supportGrant.findMany({where,include:{organization:{select:{name:true}}},orderBy:[{createdAt:'desc'},{id:'asc'}],skip:(page-1)*limit,take:limit});
  return {rows:rows.map(dto),total};
 },{isolationLevel:'RepeatableRead'});
}
export const revokeSchema=z.object({operationId:z.string().uuid(),reason:z.string().trim().min(3).max(2000)}).strict();
export async function revokeGrant(ctx:TokenPayload,id:string,input:z.infer<typeof revokeSchema>){owner(ctx);return runOperation(ctx,'support.revoke',input.operationId,{id,...input},async tx=>{await passwordSession(tx,ctx);await tx.$queryRaw`SELECT id FROM "SupportGrant" WHERE id=${id} AND "organizationId"=${ctx.organizationId} FOR UPDATE`;const grant=await tx.supportGrant.findFirst({where:{id,organizationId:ctx.organizationId}});if(!grant)throw new AccessError(404,'NOT_FOUND');if(grant.revokedAt)throw new AccessError(409,'GRANT_REVOKED');const result=await tx.supportGrant.update({where:{id},data:{revokedAt:new Date(),revokedBy:ctx.userId}});await audit(tx,ctx,'SupportGrant',id,'support_revoked',{reason:input.reason,operatorUserId:grant.operatorUserId});return {id:result.id,revokedAt:result.revokedAt}})}
export const viewSchema=z.object({view:z.enum(['catalog','inventory','sales','diagnostics']),branchKey:z.string().uuid(),page:z.coerce.number().int().min(1).max(100000).default(1)}).strict();
export async function supportView(ctx:TokenPayload,id:string,input:z.infer<typeof viewSchema>){
 await consumeLimit('support.read',ctx.userId,30,60000);
 const result=await prisma.$transaction(async tx=>{
  await passwordSession(tx,ctx);
  // Serialize reads with revocation; no business write capability is created.
  await tx.$queryRaw`SELECT id FROM "SupportGrant" WHERE id=${id} FOR UPDATE`;
  const grant=await tx.supportGrant.findUnique({where:{id},include:{operator:{include:{user:{select:{isActive:true}}}}}});
  if(!grant||grant.operatorUserId!==ctx.userId)throw new AccessError(404,'NOT_FOUND');
  const [{now}]=await tx.$queryRaw<{now:Date}[]>`SELECT NOW() AS now`;
  const code=grant.revokedAt?'GRANT_REVOKED':grant.expiresAt<=now?'GRANT_EXPIRED':!grant.operator.isActive||!grant.operator.user.isActive?'OPERATOR_DISABLED':!grant.scopes.includes(input.view+'.read')||!grant.storeIds.includes(input.branchKey)?'SUPPORT_SCOPE_DENIED':!await tx.store.findFirst({where:{id:input.branchKey,organizationId:grant.organizationId,isActive:true}})?'STORE_UNAVAILABLE':null;
  const target={...ctx,organizationId:grant.organizationId};
  if(code){await audit(tx,target,'SupportGrant',id,'support_read_denied',{view:input.view,branchKey:input.branchKey,code,sourceOrganizationId:ctx.organizationId});return {denied:code} as const}
  const limit=50,skip=(input.page-1)*limit,org=grant.organizationId,branch=input.branchKey;
  let data:unknown;
  if(input.view==='catalog')data=await tx.product.findMany({where:{organizationId:org},select:{id:true,name:true,sku:true,unit:true,salePrice:true,isActive:true},orderBy:{id:'asc'},skip,take:limit});
  else if(input.view==='inventory')data=await tx.inventoryBalance.findMany({where:{storeId:branch,store:{organizationId:org}},select:{productId:true,quantity:true,updatedAt:true},orderBy:{productId:'asc'},skip,take:limit});
  else if(input.view==='sales')data=await tx.sale.findMany({where:{organizationId:org,storeId:branch},select:{id:true,receiptNo:true,status:true,totalAmount:true,taxAmount:true,completedAt:true},orderBy:[{createdAt:'desc'},{id:'asc'}],skip,take:limit});
  else data={registers:await tx.register.count({where:{storeId:branch,isActive:true}}),openShifts:await tx.shift.count({where:{register:{storeId:branch},status:'open'}}),openIncidents:await tx.incident.count({where:{organizationId:org,storeId:branch,state:'open'}})};
  await audit(tx,target,'SupportGrant',id,'support_read',{view:input.view,branchKey:branch,sourceOrganizationId:ctx.organizationId,page:input.page,limit});return {data,organizationId:org,branchKey:branch,view:input.view,page:input.page,limit,expiresAt:grant.expiresAt} as const;
 },{isolationLevel:'ReadCommitted'});
 if(result.denied){const messages:Record<string,string>={GRANT_REVOKED:'Biznes egasi support ruxsatini bekor qildi.',GRANT_EXPIRED:'Support ruxsati muddati tugadi; biznes egasining yangi tasdig‘i kerak.',OPERATOR_DISABLED:'Platforma operatori vakolati bekor qilingan.',SUPPORT_SCOPE_DENIED:'Bu filial yoki ko‘rish turi support ruxsatiga kiritilmagan.',STORE_UNAVAILABLE:'Ruxsatli filial faol emas.'};throw new AccessError(403,result.denied,messages[result.denied]);}
 return result;
}
