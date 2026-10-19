import {createHash,createHmac,timingSafeEqual} from 'node:crypto'
import {z} from 'zod'
import bwipjs from 'bwip-js/node'
import {Prisma} from '@prisma/client'
import {prisma} from '@/lib/prisma'
import type {TokenPayload} from '@/lib/auth'
import {AccessError,tenantScope} from '../auth/policy'
import {totpKeyConfiguration} from '../auth/totp-keys'
import {assertLiveContext,audit,runOperation} from '../operations'

export const receiptLinkSchema=z.object({operationId:z.string().uuid(),consent:z.literal(true)}).strict()
export const receiptRevokeSchema=z.object({operationId:z.string().uuid()}).strict()
export const receiptViewSchema=z.object({organizationId:z.string().uuid(),operationId:z.string().uuid(),capability:z.string().regex(/^[A-Za-z0-9_-]{43}$/)}).strict()
const money=z.string().regex(/^-?\d+(?:\.\d+)?$/)
export const electronicReceiptSchema=z.object({
 receiptNo:z.string(),completedAt:z.string(),organizationName:z.string().nullable(),storeName:z.string().nullable(),currency:z.string().nullable(),timezone:z.string(),
 subtotal:money,discountAmount:money,totalAmount:money,taxAmount:money.nullable(),
 items:z.array(z.object({name:z.string(),unit:z.string().nullable(),quantity:money,unitPrice:money,discountAmount:money,totalPrice:money}).strict()).max(1000),
 payments:z.array(z.object({paymentType:z.string(),direction:z.string(),amount:money}).strict()),
}).strict()
export type ElectronicReceipt=z.infer<typeof electronicReceiptSchema>
const savedSchema=z.object({version:z.literal(1),saleId:z.string().uuid(),expiresAt:z.string().datetime(),keyId:z.string().regex(/^[a-f0-9]{64}$/),tokenHash:z.string().regex(/^[a-f0-9]{64}$/),snapshot:electronicReceiptSchema}).strict()
const hash=(value:string)=>createHash('sha256').update(value).digest('hex')
function keys(){
 const config=totpKeyConfiguration()
 if(!config)throw new AccessError(503,'RECEIPT_LINK_UNAVAILABLE')
 return [config.current,...config.previous].map(value=>({id:hash(Buffer.from(value,'hex').toString('hex')),key:Buffer.from(value,'hex')}))
}
function capability(key:Buffer,organizationId:string,operationId:string){
 return createHmac('sha256',key).update('pos:in-person-receipt:v1\0'+organizationId+'\0'+operationId).digest('base64url')
}
async function scopedSale(tx:Prisma.TransactionClient,ctx:TokenPayload,id:string){
 const sale=await tx.sale.findFirst({where:{id,AND:tenantScope('Sale',ctx)},include:{items:{orderBy:{id:'asc'}},payments:{orderBy:{id:'asc'}}}})
 if(!sale)throw new AccessError(404,'NOT_FOUND')
 if(!sale.completedAt||sale.status==='draft')throw new AccessError(409,'RECEIPT_NOT_POSTED')
 return sale
}
function present(ctx:TokenPayload,operationId:string,saved:z.infer<typeof savedSchema>,revoked:boolean){
 const key=keys().find(key=>key.id===saved.keyId)
 const available=!revoked&&new Date(saved.expiresAt).getTime()>Date.now()&&Boolean(key)
 if(!available)return {operationId,expiresAt:saved.expiresAt,available:false,url:null,qrDataUrl:null}
 const proof=capability(key!.key,ctx.organizationId,operationId)
 const url=new URL('/r',process.env.APP_ORIGIN)
 // Fragment is never sent in HTTP request paths, proxy/access logs or referrers.
 url.hash=[ctx.organizationId,operationId,proof].join('.')
 const svg=bwipjs.toSVG({bcid:'qrcode',text:url.href,scale:3,padding:4})
 return {operationId,expiresAt:saved.expiresAt,available:true,url:url.href,qrDataUrl:'data:image/svg+xml;base64,'+Buffer.from(svg).toString('base64')}
}
export async function createReceiptLink(ctx:TokenPayload,id:string,input:unknown){
 const parsed=receiptLinkSchema.parse(input),key=keys()[0]
 const saved=await runOperation(ctx,'receipt.share',parsed.operationId,{saleId:id,...parsed},async tx=>{
  const sale=await scopedSale(tx,ctx,id)
  const identity=sale.receiptSnapshot as {organizationName?:string;storeName?:string;currencyCode?:string;timezone?:string}|null
  const snapshot=electronicReceiptSchema.parse({receiptNo:sale.receiptNo,completedAt:sale.completedAt!.toISOString(),organizationName:identity?.organizationName??null,storeName:identity?.storeName??null,currency:identity?.currencyCode??null,timezone:identity?.timezone??'UTC',subtotal:sale.subtotal.toString(),discountAmount:sale.discountAmount.toString(),totalAmount:sale.totalAmount.toString(),taxAmount:sale.taxAmount?.toString()??null,items:sale.items.map(item=>({name:item.productName,unit:item.unit,quantity:item.quantity.toString(),unitPrice:item.unitPrice.toString(),discountAmount:item.discountAmount.toString(),totalPrice:item.lineTotal.toString()})),payments:sale.payments.filter(payment=>payment.direction==='in'&&payment.createdAt<=sale.completedAt!).map(payment=>({paymentType:payment.paymentType,direction:payment.direction,amount:payment.amount.toString()}))})
  const [clock]=await tx.$queryRaw<{now:Date}[]>`SELECT clock_timestamp() AS now`
  const result=savedSchema.parse({version:1,saleId:id,expiresAt:new Date(clock.now.getTime()+3600000).toISOString(),keyId:key.id,tokenHash:hash(capability(key.key,ctx.organizationId,parsed.operationId)),snapshot})
  if(Buffer.byteLength(JSON.stringify(result))>230000)throw new AccessError(413,'EXPORT_TOO_LARGE')
  await audit(tx,ctx,'Sale',id,'receipt_link_granted',{operationId:parsed.operationId,channel:'in_person',source:'customer_request',consent:true,policyVersion:'direct-receipt-v1',expiresAt:result.expiresAt,sessionId:ctx.sessionId})
  return result
 },async tx=>{await scopedSale(tx,ctx,id)})
 const revoked=await prisma.operation.findUnique({where:{organizationId_type_key:{organizationId:ctx.organizationId,type:'receipt.share.revoke',key:parsed.operationId}},select:{id:true}})
 const operation=await prisma.operation.findUniqueOrThrow({where:{organizationId_type_key:{organizationId:ctx.organizationId,type:'receipt.share',key:parsed.operationId}},select:{createdAt:true}})
 const restored=await prisma.authRestoreCheckpoint.findFirst({where:{createdAt:{gte:operation.createdAt}},select:{id:true}})
 return present(ctx,parsed.operationId,savedSchema.parse(saved),Boolean(revoked||restored))
}
export async function revokeReceiptLink(ctx:TokenPayload,id:string,input:unknown){
 const {operationId}=receiptRevokeSchema.parse(input)
 return runOperation(ctx,'receipt.share.revoke',operationId,{saleId:id,operationId},async tx=>{
  const share=await tx.operation.findUnique({where:{organizationId_type_key:{organizationId:ctx.organizationId,type:'receipt.share',key:operationId}}})
  if(!share||savedSchema.parse(share.result).saleId!==id)throw new AccessError(404,'NOT_FOUND')
  await audit(tx,ctx,'Sale',id,'receipt_link_revoked',{operationId,sessionId:ctx.sessionId})
  return {operationId,saleId:id,revoked:true}
 },async tx=>{await scopedSale(tx,ctx,id)})
}
export async function listReceiptLinks(ctx:TokenPayload,id:string,page=1){
 if(!Number.isSafeInteger(page)||page<1||(page-1)*20>2147483647)throw new AccessError(400,'INVALID_PAGINATION')
 return prisma.$transaction(async tx=>{
  await assertLiveContext(tx,ctx);await scopedSale(tx,ctx,id)
  const where={organizationId:ctx.organizationId,type:'receipt.share',result:{path:['saleId'],equals:id}}
  const total=await tx.operation.count({where})
  const shares=await tx.operation.findMany({where,orderBy:[{createdAt:'desc'},{id:'desc'}],take:20,skip:(page-1)*20})
  const revokes=await tx.operation.findMany({where:{organizationId:ctx.organizationId,type:'receipt.share.revoke',key:{in:shares.map(row=>row.key)}},select:{key:true}})
  const checkpoint=await tx.authRestoreCheckpoint.findFirst({orderBy:{createdAt:'desc'},select:{createdAt:true}})
  return {rows:shares.map(row=>present(ctx,row.key,savedSchema.parse(row.result),revokes.some(revoke=>revoke.key===row.key)||Boolean(checkpoint&&row.createdAt<=checkpoint.createdAt))),page,total,totalPages:Math.ceil(total/20)}
 },{isolationLevel:'RepeatableRead'})
}
export async function viewReceipt(input:unknown):Promise<ElectronicReceipt>{
 const parsed=receiptViewSchema.parse(input)
 const unavailable=()=>new AccessError(404,'RECEIPT_UNAVAILABLE')
 return prisma.$transaction(async tx=>{
  const [ready]=await tx.$queryRaw<{ready:boolean}[]>`SELECT auth_restore_ready() AS ready`
  if(!ready.ready)throw unavailable()
  const row=await tx.operation.findUnique({where:{organizationId_type_key:{organizationId:parsed.organizationId,type:'receipt.share',key:parsed.operationId}}})
  if(!row||row.state!=='completed')throw unavailable()
  const saved=savedSchema.safeParse(row.result)
  if(!saved.success||!keys().some(key=>key.id===saved.data.keyId))throw unavailable()
  const [clock]=await tx.$queryRaw<{now:Date}[]>`SELECT clock_timestamp() AS now`
  if(new Date(saved.data.expiresAt)<=clock.now||!timingSafeEqual(Buffer.from(saved.data.tokenHash,'hex'),Buffer.from(hash(parsed.capability),'hex')))throw unavailable()
  if(await tx.operation.findUnique({where:{organizationId_type_key:{organizationId:parsed.organizationId,type:'receipt.share.revoke',key:parsed.operationId}},select:{id:true}}))throw unavailable()
  // A restore may resurrect a capability revoked after the backup. All shares
  // created before any restore checkpoint are permanently fenced, even after review.
  if(await tx.authRestoreCheckpoint.findFirst({where:{createdAt:{gte:row.createdAt}},select:{id:true}}))throw unavailable()
  return saved.data.snapshot
 },{isolationLevel:'Serializable'})
}
