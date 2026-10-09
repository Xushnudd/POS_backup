import {createHash} from 'node:crypto'
import {Prisma,type PrismaClient} from '@prisma/client'
import {z} from 'zod'
import {prisma} from '@/lib/prisma'
import type {TokenPayload} from '@/lib/auth'
import {AccessError} from '../auth/policy'
import {assertLiveContext,audit} from '../operations'
import {csv,numeric} from '../exports/csv'
export const exportFilter=z.object({search:z.string().trim().max(200).optional(),categoryId:z.string().uuid().optional(),active:z.enum(['all','active','archived']).default('all')}).strict()
export const MAX_EXPORT_BYTES=16*1024*1024
export async function catalogExport(organizationId:string,input:unknown,db:Pick<PrismaClient,'$transaction'>=prisma){
 const filter=exportFilter.parse(input)
 return db.$transaction(async tx=>{
  const [snapshot]=await tx.$queryRaw<{asOf:Date}[]>`SELECT transaction_timestamp() AS "asOf"`
  if(filter.categoryId&&!await tx.category.findFirst({where:{id:filter.categoryId,organizationId}}))throw new AccessError(404,'CATEGORY_NOT_FOUND')
  const where:Prisma.ProductWhereInput={organizationId,...(filter.active==='all'?{}:{isActive:filter.active==='active'}),...(filter.categoryId?{categoryId:filter.categoryId}:{}),...(filter.search?{OR:[{name:{contains:filter.search,mode:'insensitive'}},{sku:{contains:filter.search,mode:'insensitive'}},{barcode:{contains:filter.search,mode:'insensitive'}},{barcodes:{some:{value:{contains:filter.search,mode:'insensitive'}}}}]}:{})}
  const total=await tx.product.count({where});if(total>100000)throw new AccessError(413,'EXPORT_TOO_LARGE')
  const chunks:Buffer[]=[Buffer.from(csv([['ID','Mahsulot','SKU','Asosiy barkod','Qo‘shimcha barkodlar','Birlik','Kategoriya','Sotuv narxi','Tannarx','Minimal qoldiq','Faol']]))];let bytes=chunks[0].length,cursor:string|undefined,rows=0
  for(;;){
   const page=await tx.product.findMany({where,orderBy:{id:'asc'},take:500,...(cursor?{cursor:{id:cursor},skip:1}:{}),select:{id:true,name:true,sku:true,barcode:true,unit:true,salePrice:true,costPrice:true,minStock:true,isActive:true,category:{select:{name:true}},barcodes:{select:{value:true},orderBy:{value:'asc'}}}})
   if(!page.length)break
   const chunk=Buffer.from(csv(page.map(p=>[p.id,p.name,p.sku,p.barcode,p.barcodes.map(b=>b.value).join(' | '),p.unit,p.category?.name,numeric(p.salePrice),numeric(p.costPrice,6),numeric(p.minStock,6),p.isActive?'ha':'yo‘q'])).replace(/^\uFEFF/,''));bytes+=chunk.length;if(bytes>MAX_EXPORT_BYTES)throw new AccessError(413,'EXPORT_TOO_LARGE');chunks.push(chunk);rows+=page.length;cursor=page[page.length-1].id
  }
  if(rows!==total)throw new AccessError(409,'EXPORT_SNAPSHOT_CHANGED')
  const data=Buffer.concat(chunks),sha256=createHash('sha256').update(data).digest('hex')
  return {data,size:data.length,sha256,rowCount:rows,filename:'products-'+organizationId+'.csv',mime:'text/csv; charset=utf-8',asOf:snapshot.asOf.toISOString()}
 },{isolationLevel:'RepeatableRead',timeout:60000})
}
export async function readJobExport(ctx:TokenPayload,id:string){
 if(ctx.role!=='owner')throw new AccessError(403,'OWNER_REQUIRED')
 return prisma.$transaction(async tx=>{await assertLiveContext(tx,ctx);const row=await tx.jobExport.findFirst({where:{jobId:id,organizationId:ctx.organizationId,job:{state:'succeeded'}}});if(!row)throw new AccessError(404,'NOT_FOUND');if(!row.data||row.expiresAt<=new Date())throw new AccessError(410,'EXPORT_EXPIRED','Eksport faylining24soatlik muddati tugagan; yangi eksportni navbatga qo‘ying');if(row.size!==row.data.length||createHash('sha256').update(row.data).digest('hex')!==row.sha256)throw new AccessError(503,'EXPORT_CORRUPTED');await audit(tx,ctx,'BackgroundJob',id,'export_downloaded',{size:row.size,sha256:row.sha256});return row},{isolationLevel:'RepeatableRead'})
}
export async function pruneJobExports(){return prisma.jobExport.updateMany({where:{expiresAt:{lte:new Date()},data:{not:null}},data:{data:null}})}
