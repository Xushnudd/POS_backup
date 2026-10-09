import { Prisma } from '@prisma/client'
import { z } from 'zod'
import { prisma } from '@/lib/prisma'
import type { TokenPayload } from '@/lib/auth'
import { AccessError, tenantScope } from '../auth/policy'
import { runOperation, audit } from '../operations'
import { nonnegativeQuantitySchema, validateUnitQuantity } from '../catalog/service'
import { decimal } from '../sales/calculations'
import { moveStock } from './movements'

const include={lines:{include:{readings:{orderBy:{round:'asc' as const}},product:{select:{unit:true}}},orderBy:{sku:'asc' as const}}}
type Count=Prisma.StockCountGetPayload<{include:typeof include}>
function manager(context:TokenPayload){if(!['owner','admin'].includes(context.role))throw new AccessError(403,'MANAGER_REQUIRED')}
// Blind counting hides expected values until the count has been submitted for review.
export function countView(count:Count){
 return {...count,lines:count.lines.map(({expectedQuantity,unitCost,product,...line})=>({
  ...line,unitChanged:product.unit!==line.unit,...(!count.blind || count.status!=='counting'?{expectedQuantity,unitCost}:{})
 }))}
}
async function lockedCount(tx:Prisma.TransactionClient,context:TokenPayload,id:string){
 await tx.$queryRaw`SELECT id FROM "StockCount" WHERE id=${id} FOR UPDATE`
 const count=await tx.stockCount.findFirst({where:{id,AND:tenantScope('StockCount',context)},include})
 if(!count)throw new AccessError(404,'NOT_FOUND')
 return count
}
export const startCountSchema=z.object({operationId:z.string().uuid(),organizationId:z.string().uuid(),storeId:z.string().uuid(),scope:z.enum(['full','partial']),blind:z.boolean().default(true),productIds:z.array(z.string().uuid()).min(1).max(2000).optional()}).strict().refine(x=>x.scope==='full'||!!x.productIds,'Qisman sanash uchun mahsulot tanlang')
export async function startCount(context:TokenPayload,input:z.infer<typeof startCountSchema>){
 manager(context)
 if(input.organizationId!==context.organizationId)throw new AccessError(403,'TENANT_MISMATCH')
 return runOperation(context,'count.start',input.operationId,input,async tx=>{
  const store=await tx.store.findFirst({where:{id:input.storeId,isActive:true,AND:tenantScope('Store',context)}})
  if(!store)throw new AccessError(404,'NOT_FOUND')
  const ids=input.productIds?[...new Set(input.productIds)]:undefined
  if(ids && ids.length!==input.productIds!.length)throw new AccessError(400,'DUPLICATE_PRODUCTS')
  const products=await tx.product.findMany({where:{organizationId:context.organizationId,...(input.scope==='partial'?{id:{in:ids}}:{OR:[{isActive:true},{inventoryBalances:{some:{storeId:store.id,quantity:{not:0}}}}]})},orderBy:{id:'asc'},take:2001})
  if(!products.length||products.length>2000||(input.scope==='partial'&&products.length!==ids!.length))throw new AccessError(400,'INVALID_COUNT_SCOPE','Bir sanashda 1–2000 mahsulot bo‘lishi kerak; katta katalogni qismlarga ajrating')
  // Short transaction locks only selected SKU balances; no DB locks span UI time.
  await tx.$queryRaw`SELECT pg_advisory_xact_lock(hashtextextended('stock:' || ${store.id} || ':' || id,0))::text FROM (SELECT unnest(ARRAY[${Prisma.join(products.map(p=>p.id))}]::text[]) AS id ORDER BY id) selected`
  if(await tx.stockFreeze.count({where:{storeId:store.id,productId:{in:products.map(p=>p.id)}}}))throw new AccessError(409,'COUNT_ALREADY_ACTIVE')
  await tx.inventoryBalance.createMany({data:products.map(p=>({storeId:store.id,productId:p.id,quantity:0})),skipDuplicates:true})
  // Version write makes transactions with snapshots predating the freeze retry.
  await tx.inventoryBalance.updateMany({where:{storeId:store.id,productId:{in:products.map(p=>p.id)}},data:{updatedAt:new Date()}})
  const balances=await tx.inventoryBalance.findMany({where:{storeId:store.id,productId:{in:products.map(p=>p.id)}}})
  const expected=new Map(balances.map(b=>[b.productId,b.quantity]))
  const count=await tx.stockCount.create({data:{organizationId:context.organizationId,storeId:store.id,scope:input.scope,blind:input.blind,createdBy:context.userId}})
  await tx.stockCountLine.createMany({data:products.map(p=>({countId:count.id,productId:p.id,productName:p.name,sku:p.sku,unit:p.unit,unitCost:p.costPrice,expectedQuantity:expected.get(p.id)!}))})
  await tx.stockFreeze.createMany({data:products.map(p=>({countId:count.id,storeId:store.id,productId:p.id}))})
  await audit(tx,context,'StockCount',count.id,'started',{scope:input.scope,blind:input.blind,products:products.length})
  return countView(await lockedCount(tx,context,count.id))
 })
}
export async function getCount(context:TokenPayload,id:string){manager(context);const count=await prisma.stockCount.findFirst({where:{id,AND:tenantScope('StockCount',context)},include});if(!count)throw new AccessError(404,'NOT_FOUND');return countView(count)}
export const readingSchema=z.object({operationId:z.string().uuid(),items:z.array(z.object({lineId:z.string().uuid(),quantity:nonnegativeQuantitySchema})).min(1).max(2000)}).strict()
export async function recordCount(context:TokenPayload,id:string,input:z.infer<typeof readingSchema>){
 manager(context)
 return runOperation(context,'count.reading',input.operationId,{id,items:input.items},async tx=>{
  const count=await lockedCount(tx,context,id)
  if(!['counting','review'].includes(count.status))throw new AccessError(409,'INVALID_STATUS')
  if(new Set(input.items.map(i=>i.lineId)).size!==input.items.length)throw new AccessError(400,'DUPLICATE_LINES')
  for(const item of input.items){
   const line=count.lines.find(l=>l.id===item.lineId)
   if(!line)throw new AccessError(404,'NOT_FOUND')
   if(line.unit!==line.product.unit)throw new AccessError(409,'COUNT_UNIT_CHANGED')
   await validateUnitQuantity(tx,context.organizationId,line.unit,decimal(item.quantity))
   if(line.readings.length>=20)throw new AccessError(409,'READING_LIMIT')
   await tx.stockCountReading.create({data:{lineId:line.id,quantity:decimal(item.quantity),round:line.readings.length+1,countedBy:context.userId}})
  }
  await audit(tx,context,'StockCount',id,'readings_recorded',{lines:input.items.length})
  return countView(await lockedCount(tx,context,id))
 })
}
export async function submitCount(context:TokenPayload,id:string){
 manager(context)
 return runOperation(context,'count.submit',id,{id},async tx=>{
  const count=await lockedCount(tx,context,id)
  if(count.status!=='counting')throw new AccessError(409,'INVALID_STATUS')
  if(count.lines.some(l=>!l.readings.length))throw new AccessError(409,'COUNT_INCOMPLETE')
  await tx.stockCount.update({where:{id},data:{status:'review',submittedAt:new Date()}})
  await audit(tx,context,'StockCount',id,'submitted')
  return countView(await lockedCount(tx,context,id))
 })
}
export const decisionSchema=z.object({operationId:z.string().uuid(),reason:z.string().trim().min(3).max(2000)}).strict()
export async function finishCount(context:TokenPayload,id:string,input:z.infer<typeof decisionSchema>,cancel=false){
 manager(context)
 return runOperation(context,cancel?'count.cancel':'count.approve',input.operationId,{id,reason:input.reason},async tx=>{
  const count=await lockedCount(tx,context,id)
  if(cancel?!['counting','review'].includes(count.status):count.status!=='review')throw new AccessError(409,'INVALID_STATUS')
  if(!cancel){
   for(const line of count.lines){
    const last=line.readings.at(-1)
    if(!last)throw new AccessError(409,'COUNT_INCOMPLETE')
    if(line.unit!==line.product.unit)throw new AccessError(409,'COUNT_UNIT_CHANGED')
    if(!last.quantity.eq(line.expectedQuantity)&&line.readings.length<2)throw new AccessError(409,'RECOUNT_REQUIRED','Farqli mahsulotlarni qayta sanang')
    const balance=await tx.inventoryBalance.findUniqueOrThrow({where:{storeId_productId:{storeId:count.storeId,productId:line.productId}}})
    if(!balance.quantity.eq(line.expectedQuantity))throw new AccessError(409,'COUNT_STOCK_CHANGED')
   }
  }
  await tx.stockFreeze.deleteMany({where:{countId:id}})
  let adjustmentId:string|null=null
  if(!cancel){
   const changed=count.lines.filter(l=>!l.readings.at(-1)!.quantity.eq(l.expectedQuantity))
   if(changed.length){
    const doc=await tx.stockDocument.create({data:{organizationId:context.organizationId,storeId:count.storeId,documentType:'adjustment',documentNo:'COUNT-'+id,createdBy:context.userId,note:input.reason,items:{create:changed.map(l=>({productId:l.productId,quantity:l.readings.at(-1)!.quantity.sub(l.expectedQuantity),unitCost:l.unitCost}))}}})
    for(const line of [...changed].sort((a,b)=>a.productId.localeCompare(b.productId)))await moveStock(tx,context,{storeId:count.storeId,productId:line.productId,delta:line.readings.at(-1)!.quantity.sub(line.expectedQuantity),unitCost:line.unitCost,sourceType:'stock_document',sourceId:doc.id})
    await tx.stockDocument.update({where:{id:doc.id},data:{status:'confirmed',confirmedAt:new Date(),confirmedBy:context.userId}})
    adjustmentId=doc.id
   }
  }
  await tx.stockCount.update({where:{id},data:{status:cancel?'cancelled':'approved',approvedBy:context.userId,approvedAt:new Date(),reason:input.reason,adjustmentId}})
  await audit(tx,context,'StockCount',id,cancel?'cancelled':'approved',{reason:input.reason,adjustmentId,approvedBy:context.userId,approvedRole:context.role,reviewedState:{countId:count.id,storeId:count.storeId,submittedAt:count.submittedAt,lines:count.lines.map(line=>({lineId:line.id,productId:line.productId,expectedQuantity:line.expectedQuantity,readingId:line.readings.at(-1)?.id,readingRound:line.readings.at(-1)?.round,quantity:line.readings.at(-1)?.quantity,unit:line.unit,unitCost:line.unitCost}))}})
  return countView(await lockedCount(tx,context,id))
 })
}
