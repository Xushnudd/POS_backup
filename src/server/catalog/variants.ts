import {Prisma} from '@prisma/client'
import {z} from 'zod'
import {prisma} from '@/lib/prisma'
import type {TokenPayload} from '@/lib/auth'
import {AccessError} from '../auth/policy'
import {assertLiveContext,audit,runOperation} from '../operations'
import {amountSchema} from '../sales/service'
import {priceActor} from './prices'
import {paging,pagination} from './queries'
const option=z.object({name:z.string().trim().min(1).max(40),value:z.string().trim().min(1).max(80)}).strict()
export const variantSchema=z.object({operationId:z.string().uuid(),name:z.string().trim().min(2).max(200),sku:z.string().trim().min(2).max(100),barcode:z.string().trim().min(2).max(200),salePrice:amountSchema,reason:z.string().trim().min(3).max(2000),options:z.array(option).min(1).max(8)}).strict().refine(x=>new Set(x.options.map(o=>o.name.toLowerCase())).size===x.options.length,'Takror variant belgisi mumkin emas')
async function root(tx:Prisma.TransactionClient,ctx:TokenPayload,id:string){
 const product=await tx.product.findFirst({where:{id,organizationId:ctx.organizationId},include:{variant:true}})
 if(!product?.variant)throw new AccessError(404,'PRODUCT_NOT_FOUND')
 return tx.product.findFirstOrThrow({where:{id:product.variant.rootProductId,organizationId:ctx.organizationId}})
}
export async function createVariant(ctx:TokenPayload,id:string,input:z.infer<typeof variantSchema>){
 if(!['owner','admin'].includes(ctx.role))throw new AccessError(403,'FORBIDDEN')
 return runOperation(ctx,'catalog.variant',input.operationId,{id,...input},async tx=>{
  const base=await root(tx,ctx,id)
  await tx.$queryRaw`SELECT id FROM "Product" WHERE id=${base.id} FOR UPDATE`
  const current=await tx.product.findUniqueOrThrow({where:{id:base.id}})
  if(!current.isActive)throw new AccessError(409,'PRODUCT_ARCHIVED')
  if(await tx.productVariant.count({where:{rootProductId:base.id}})>=1000)throw new AccessError(413,'VARIANT_LIMIT')
  const options=Object.fromEntries(input.options.map(o=>[o.name.toLowerCase(),o.value.toLowerCase()]))
  if(await tx.productVariant.findFirst({where:{rootProductId:base.id,options:{equals:options}}}))throw new AccessError(409,'VARIANT_EXISTS','Bu rang/o‘lcham kombinatsiyasi mavjud')
  await priceActor(tx,ctx,'catalog.variant')
  const product=await tx.product.create({data:{organizationId:ctx.organizationId,categoryId:current.categoryId,brandId:current.brandId,description:current.description,name:input.name,sku:input.sku,barcode:input.barcode,unit:current.unit,salePrice:input.salePrice,costPrice:current.costPrice,minStock:current.minStock,imageUrl:current.imageUrl}})
  await tx.productVariant.update({where:{productId:product.id},data:{rootProductId:base.id,options}})
  await audit(tx,ctx,'Product',product.id,'variant_created',{rootProductId:base.id,options,reason:input.reason})
  // Cost remains protected; new SKU starts with zero stock and no money movement.
  return {id:product.id,rootProductId:base.id,name:product.name,sku:product.sku,barcode:product.barcode,unit:product.unit,salePrice:product.salePrice,options}
 })
}
export async function listVariants(ctx:TokenPayload,id:string,q:URLSearchParams){
 const {page,limit,skip}=paging(q)
 return prisma.$transaction(async tx=>{
  await assertLiveContext(tx,ctx)
  const base=await root(tx,ctx,id),where={rootProductId:base.id},total=await tx.productVariant.count({where})
  const rows=await tx.productVariant.findMany({where,orderBy:{productId:'asc'},skip,take:limit,include:{product:{select:{id:true,name:true,sku:true,barcode:true,unit:true,salePrice:true,isActive:true}}}})
  const stock=await tx.inventoryBalance.groupBy({by:['productId'],where:{productId:{in:rows.map(r=>r.productId)},store:{organizationId:ctx.organizationId,...(ctx.role==='owner'?{}:{id:{in:ctx.storeIds}})}},_sum:{quantity:true}})
  const byId=new Map(stock.map(s=>[s.productId,s._sum.quantity]))
  return {success:true,root:{id:base.id,name:base.name},data:rows.map(r=>({...r.product,options:r.options,isDefault:r.productId===base.id,quantity:byId.get(r.productId)??new Prisma.Decimal(0)})),pagination:pagination(page,limit,total)}
 },{isolationLevel:'RepeatableRead'})
}
