import {createHash} from 'node:crypto'
import sharp from 'sharp'
import {z} from 'zod'
import {prisma} from '@/lib/prisma'
import type {TokenPayload} from '@/lib/auth'
import {AccessError} from '../auth/policy'
import {audit,assertLiveContext,runOperation} from '../operations'
import {consumeLimit} from '../auth/rate-limit'
import {paging,pagination} from '../catalog/queries'
export const FILE_LIMIT=524288
const select={id:true,productId:true,name:true,mime:true,size:true,sha256:true,width:true,height:true,createdAt:true,expiresAt:true,deletedAt:true} as const
export const uploadSchema=z.object({operationId:z.string().uuid(),productId:z.string().uuid(),name:z.string().trim().min(1).max(120).regex(/^[^\x00-\x1f\x7f\\/]+$/),base64:z.string().min(4).max(699052).regex(/^[A-Za-z0-9+/]+={0,2}$/),expiresAt:z.iso.datetime({offset:true}).optional()}).strict()
export const deleteSchema=z.object({operationId:z.string().uuid(),reason:z.string().trim().min(3).max(2000)}).strict()
function manager(ctx:TokenPayload){if(!['owner','admin'].includes(ctx.role))throw new AccessError(403,'FORBIDDEN')}
function quota(){const value=process.env.POS_FILE_QUOTA_BYTES??'104857600';if(!/^\d+$/.test(value)||!Number.isSafeInteger(Number(value))||Number(value)<1||Number(value)>1073741824)throw new AccessError(503,'FILE_QUOTA_CONFIG_INVALID');return Number(value)}
export async function normalizeImage(base64:string){
 const input=Buffer.from(base64,'base64')
 if(!input.length||input.length>FILE_LIMIT)throw new AccessError(413,'FILE_TOO_LARGE')
 if(input.toString('base64')!==base64)throw new AccessError(400,'FILE_ENCODING_INVALID')
 const png=input.subarray(0,8).equals(Buffer.from([137,80,78,71,13,10,26,10])),jpeg=input[0]===255&&input[1]===216&&input[2]===255,webp=input.subarray(0,4).toString()==='RIFF'&&input.subarray(8,12).toString()==='WEBP'
 if(!png&&!jpeg&&!webp)throw new AccessError(415,'FILE_TYPE_UNSUPPORTED')
 try{
  const image=sharp(input,{failOn:'warning',limitInputPixels:16777216,limitInputChannels:4}).timeout({seconds:5}),meta=await image.metadata()
  if(!['jpeg','png','webp'].includes(meta.format??'')||(meta.pages??1)>1)throw new AccessError(415,'FILE_TYPE_UNSUPPORTED','Faqat static JPEG, PNG yoki WebP rasm qabul qilinadi')
  const {data,info}=await image.rotate().resize({width:2048,height:2048,fit:'inside',withoutEnlargement:true}).webp({quality:85}).toBuffer({resolveWithObject:true})
  if(data.length>FILE_LIMIT)throw new AccessError(413,'FILE_TOO_LARGE')
  return {data,width:info.width,height:info.height,size:data.length,mime:'image/webp',sha256:createHash('sha256').update(data).digest('hex')}
 }catch(e){if(e instanceof AccessError)throw e;throw new AccessError(400,'FILE_IMAGE_INVALID','Rasm buzilgan yoki xavfsiz o‘lcham chegarasidan oshgan')}
}
export async function uploadAsset(ctx:TokenPayload,input:z.infer<typeof uploadSchema>){
 manager(ctx);await consumeLimit('file.upload',ctx.organizationId+':'+ctx.userId,10,60000);await consumeLimit('file.upload.org',ctx.organizationId,60,60000)
 // Check authorization before spending decoder resources. Posting rechecks inside runOperation.
 if(!await prisma.product.findFirst({where:{id:input.productId,organizationId:ctx.organizationId,isActive:true}}))throw new AccessError(404,'PRODUCT_NOT_FOUND')
 const image=await normalizeImage(input.base64),expiresAt=input.expiresAt?new Date(input.expiresAt):null
 if(expiresAt&&(expiresAt.getTime()<Date.now()+60000||expiresAt.getTime()>Date.now()+30*86400000))throw new AccessError(400,'FILE_EXPIRY_INVALID')
 return runOperation(ctx,'file.upload',input.operationId,input,async tx=>{
  await tx.$queryRaw`SELECT pg_advisory_xact_lock(hashtextextended(${ctx.organizationId+':files'},0))::text`
  if(!await tx.product.findFirst({where:{id:input.productId,organizationId:ctx.organizationId,isActive:true}}))throw new AccessError(404,'PRODUCT_NOT_FOUND')
  const total=await tx.fileAsset.aggregate({where:{organizationId:ctx.organizationId,deletedAt:null},_sum:{size:true}})
  if((total._sum.size??0)+image.size>quota())throw new AccessError(413,'FILE_QUOTA_EXCEEDED','Tashkilot fayl kvotasi tugadi; kerakmas yoki muddati o‘tgan rasmlarni o‘chiring')
  const result=await tx.fileAsset.create({data:{organizationId:ctx.organizationId,productId:input.productId,createdBy:ctx.userId,name:input.name,expiresAt,...image},select})
  await tx.product.update({where:{id:input.productId},data:{imageUrl:'/api/files/'+result.id}})
  await audit(tx,ctx,'FileAsset',result.id,'file_uploaded',{productId:input.productId,size:image.size,sha256:image.sha256,mime:image.mime})
  return {...result,url:'/api/files/'+result.id}
 })
}
export async function readAsset(ctx:TokenPayload,id:string){
 return prisma.$transaction(async tx=>{await assertLiveContext(tx,ctx);const asset=await tx.fileAsset.findFirst({where:{id,organizationId:ctx.organizationId}});if(!asset)throw new AccessError(404,'FILE_NOT_FOUND');if(asset.deletedAt||!asset.data||asset.expiresAt&&asset.expiresAt<=new Date())throw new AccessError(410,'FILE_UNAVAILABLE');return asset;},{isolationLevel:'RepeatableRead'})
}
export async function deleteAsset(ctx:TokenPayload,id:string,input:z.infer<typeof deleteSchema>){
 manager(ctx)
 return runOperation(ctx,'file.delete',input.operationId,{id,...input},async tx=>{
  await tx.$queryRaw`SELECT pg_advisory_xact_lock(hashtextextended(${ctx.organizationId+':files'},0))::text`
  const asset=await tx.fileAsset.findFirst({where:{id,organizationId:ctx.organizationId},select});if(!asset)throw new AccessError(404,'FILE_NOT_FOUND')
  if(asset.deletedAt)return asset
  const result=await tx.fileAsset.update({where:{id},data:{data:null,deletedAt:new Date()},select})
  await audit(tx,ctx,'FileAsset',id,'file_deleted',{reason:input.reason,sha256:asset.sha256});return result
 })
}
export async function listAssets(ctx:TokenPayload,q:URLSearchParams){
 manager(ctx);const {page,limit,skip}=paging(q),productId=z.string().uuid().parse(q.get('productId'))
 return prisma.$transaction(async tx=>{await assertLiveContext(tx,ctx);if(!await tx.product.findFirst({where:{id:productId,organizationId:ctx.organizationId}}))throw new AccessError(404,'PRODUCT_NOT_FOUND');const where={organizationId:ctx.organizationId,productId},total=await tx.fileAsset.count({where});const usage=await tx.fileAsset.aggregate({where:{organizationId:ctx.organizationId,deletedAt:null},_sum:{size:true}});return {success:true,data:(await tx.fileAsset.findMany({where,select,orderBy:[{createdAt:'desc'},{id:'asc'}],skip,take:limit})).map(r=>({...r,url:'/api/files/'+r.id})),pagination:pagination(page,limit,total),summary:{usedBytes:usage._sum.size??0,quotaBytes:quota()}};},{isolationLevel:'RepeatableRead'})
}
