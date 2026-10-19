import {z} from 'zod'
import type {TokenPayload} from '@/lib/auth'
import {prisma} from '@/lib/prisma'
import {AccessError} from '@/server/auth/policy'
import {assertLiveContext,audit,runOperation} from '@/server/operations'
export const complianceSchema=z.object({operationId:z.string().uuid(),mxik:z.string().trim().min(1).max(100).nullable(),mxikSource:z.string().trim().min(3).max(2000).nullable(),mxikRequired:z.boolean(),taxRequired:z.boolean(),markingRequired:z.boolean(),taxProfileId:z.string().uuid().nullable(),reason:z.string().trim().min(3).max(2000)}).strict()
const select={id:true,mxik:true,mxikSource:true,mxikRequired:true,taxRequired:true,markingRequired:true,taxProfileId:true} as const
export function complianceSnapshot(p:{mxik:string|null;mxikSource:string|null;mxikRequired:boolean;taxRequired:boolean;markingRequired:boolean;taxProfileId:string|null}){return {mxik:p.mxik,mxikSource:p.mxikSource,mxikRequired:p.mxikRequired,taxRequired:p.taxRequired,markingRequired:p.markingRequired,taxProfileId:p.taxProfileId}}
export function assertProductCompliance(p:Parameters<typeof complianceSnapshot>[0],tax:{taxVersionId:string|null;taxMode:string}){
 if(p.markingRequired)throw new AccessError(503,'MARKING_INTEGRATION_UNAVAILABLE','Markirovka tekshirish xizmati tayyor emas; ushbu tovarni sotish bloklangan')
 if(p.mxikRequired&&(!p.mxik?.trim()||!p.mxikSource?.trim()))throw new AccessError(409,'CLASSIFICATION_REQUIRED','Mahsulotning MXIK kodi va tekshirilgan manba qaydi kerak')
 if(p.taxRequired&&(!tax.taxVersionId||tax.taxMode==='unconfigured'))throw new AccessError(409,'PRODUCT_TAX_REQUIRED','Mahsulotning kuchga kirgan soliq siyosati kerak')
}
export async function getCompliance(ctx:TokenPayload,id:string){return prisma.$transaction(async tx=>{await assertLiveContext(tx,ctx);const product=await tx.product.findFirst({where:{id,organizationId:ctx.organizationId},select});if(!product)throw new AccessError(404,'NOT_FOUND');return product})}
export async function setCompliance(ctx:TokenPayload,id:string,input:z.infer<typeof complianceSchema>){
 if(ctx.role!=='owner')throw new AccessError(403,'OWNER_REQUIRED')
 return runOperation(ctx,'catalog.compliance',input.operationId,{id,...input},async tx=>{
  await tx.$queryRaw`SELECT id FROM "Product" WHERE id=${id} AND "organizationId"=${ctx.organizationId} FOR UPDATE`
  const current=await tx.product.findFirst({where:{id,organizationId:ctx.organizationId},select});if(!current)throw new AccessError(404,'NOT_FOUND')
  if(input.taxProfileId&&!await tx.taxProfile.findFirst({where:{id:input.taxProfileId,organizationId:ctx.organizationId,isActive:true}}))throw new AccessError(404,'TAX_PROFILE_NOT_FOUND')
  const {operationId:_,reason,...data}=input;void _
  const product=await tx.product.update({where:{id},data,select});await audit(tx,ctx,'Product',id,'classification_updated',{before:current,after:product,reason});return product
 })
}
