import {z} from 'zod'
import {prisma} from '@/lib/prisma'
import type {TokenPayload} from '@/lib/auth'
import {AccessError} from '../auth/policy'
import {runOperation,assertLiveContext,audit} from '../operations'
import {ROUTE_PERMISSIONS} from '../auth/route-permissions'
import {allowedCustomPermission,CUSTOM_ROLE_TEMPLATES} from '../auth/custom-role-policy'
const fields={name:z.string().trim().min(2).max(80).regex(/^[^\u0000-\u001f\u007f]+$/),permissions:z.array(z.string().max(200)).max(256).refine(values=>new Set(values).size===values.length),reason:z.string().trim().min(3).max(2000)}
export const createCustomRoleSchema=z.object({operationId:z.string().uuid(),baseRole:z.enum(['admin','cashier']),...fields}).strict()
export const updateCustomRoleSchema=z.object({operationId:z.string().uuid(),expectedRevision:z.number().int().positive(),isActive:z.boolean(),...fields}).strict()
function owner(ctx:TokenPayload){if(ctx.role!=='owner')throw new AccessError(403,'OWNER_REQUIRED')}
function validatePermissions(permissions:string[],baseRole:'admin'|'cashier'){if(permissions.some(key=>!allowedCustomPermission(key,baseRole)))throw new AccessError(400,'INVALID_ROLE_PERMISSION','Tanlangan vakolat asosiy rolga berilmagan')}
export async function listCustomRoles(ctx:TokenPayload,page=1,search=''){
 owner(ctx);z.number().int().min(1).max(10000).parse(page);search=z.string().trim().max(100).parse(search)
 return prisma.$transaction(async tx=>{
  await assertLiveContext(tx,ctx)
  const where={organizationId:ctx.organizationId,...(search?{name:{contains:search,mode:'insensitive' as const}}:{})}
  const rows=await tx.customRole.findMany({where,take:20,skip:(page-1)*20,orderBy:[{name:'asc'},{id:'asc'}],select:{id:true,name:true,baseRole:true,permissions:true,revision:true,isActive:true,_count:{select:{members:true}}}})
  const catalog=Object.entries(ROUTE_PERMISSIONS).filter(([key])=>allowedCustomPermission(key,'admin')||allowedCustomPermission(key,'cashier')).map(([key,roles])=>({key,baseRoles:roles.filter(role=>role!=='owner')}))
  return {rows,total:await tx.customRole.count({where}),page,catalog,templates:CUSTOM_ROLE_TEMPLATES}
 },{isolationLevel:'RepeatableRead'})
}
export async function createCustomRole(ctx:TokenPayload,input:z.input<typeof createCustomRoleSchema>){
 owner(ctx);const parsed=createCustomRoleSchema.parse(input);validatePermissions(parsed.permissions,parsed.baseRole)
 return runOperation(ctx,'users.role.create',parsed.operationId,parsed,async tx=>{
  const row=await tx.customRole.create({data:{organizationId:ctx.organizationId,name:parsed.name,baseRole:parsed.baseRole,permissions:[...parsed.permissions].sort(),createdBy:ctx.userId}})
  await audit(tx,ctx,'CustomRole',row.id,'custom_role_created',{name:row.name,baseRole:row.baseRole,permissions:row.permissions,revision:row.revision,reason:parsed.reason})
  return row
 })
}
export async function updateCustomRole(ctx:TokenPayload,id:string,input:z.input<typeof updateCustomRoleSchema>){
 owner(ctx);z.string().uuid().parse(id);const parsed=updateCustomRoleSchema.parse(input)
 return runOperation(ctx,'users.role.update',parsed.operationId,{id,...parsed},async tx=>{
  await tx.$queryRaw`SELECT id FROM "CustomRole" WHERE id=${id} AND "organizationId"=${ctx.organizationId} FOR UPDATE`
  const previous=await tx.customRole.findFirst({where:{id,organizationId:ctx.organizationId}})
  if(!previous)throw new AccessError(404,'NOT_FOUND')
  if(previous.revision!==parsed.expectedRevision)throw new AccessError(409,'ROLE_REVISION_CHANGED','Rol o‘zgargan; yangi versiyani qayta ko‘rib chiqing')
  validatePermissions(parsed.permissions,previous.baseRole as 'admin'|'cashier')
  const row=await tx.customRole.update({where:{id},data:{name:parsed.name,permissions:[...parsed.permissions].sort(),isActive:parsed.isActive,revision:{increment:1}}})
  await audit(tx,ctx,'CustomRole',row.id,'custom_role_updated',{previous:{name:previous.name,permissions:previous.permissions,isActive:previous.isActive,revision:previous.revision},current:{name:row.name,permissions:row.permissions,isActive:row.isActive,revision:row.revision},reason:parsed.reason})
  return row
 })
}
