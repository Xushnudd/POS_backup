import {z} from 'zod'
import {Prisma} from '@prisma/client'
import {prisma} from '@/lib/prisma'
import type {TokenPayload} from '@/lib/auth'
import {AccessError} from '../auth/policy'
import {assertLiveContext,audit,runOperation} from '../operations'

export const consentPurpose=z.enum(['electronic_receipt','service_reminder','marketing'])
export const consentChannel=z.enum(['sms','email','telegram','in_person'])
export const consentSchema=z.object({
 operationId:z.string().uuid(),expectedRevision:z.number().int().min(0).max(2147483646),
 purpose:consentPurpose,channel:consentChannel,granted:z.boolean(),
 source:z.enum(['in_person','written','customer_request']),
 evidenceRef:z.string().regex(/^[A-Za-z0-9][A-Za-z0-9._:/-]{2,159}$/),
 policyVersion:z.string().regex(/^[A-Za-z0-9][A-Za-z0-9._-]{0,79}$/),
}).strict().refine(value=>value.channel!=='in_person'||value.purpose==='service_reminder','Shaxsan kanal faqat xizmat eslatmasiga tegishli')
function owner(ctx:TokenPayload){if(ctx.role!=='owner')throw new AccessError(403,'OWNER_REQUIRED')}
async function customer(tx:Prisma.TransactionClient,ctx:TokenPayload,id:string){
 const row=await tx.customer.findFirst({where:{id,organizationId:ctx.organizationId}})
 if(!row)throw new AccessError(404,'CUSTOMER_NOT_FOUND')
 return row
}
export async function recordConsent(ctx:TokenPayload,id:string,input:z.input<typeof consentSchema>){
 owner(ctx);const data=consentSchema.parse(input)
 return runOperation(ctx,data.granted?'customer.consent':'customer.consent.withdraw',data.operationId,{customerId:id,...data},async tx=>{
  await tx.$queryRaw`SELECT id FROM "Customer" WHERE id=${id} AND "organizationId"=${ctx.organizationId} FOR UPDATE`
  const card=await customer(tx,ctx,id)
  if(data.granted&&(!card.isActive||card.mergedIntoId))throw new AccessError(409,'CUSTOMER_INACTIVE')
  const last=await tx.consentEvent.findFirst({where:{customerId:id,organizationId:ctx.organizationId},orderBy:{revision:'desc'}})
  if((last?.revision??0)!==data.expectedRevision)throw new AccessError(409,'CONSENT_REVISION_CONFLICT')
  const row=await tx.consentEvent.create({data:{organizationId:ctx.organizationId,customerId:id,revision:data.expectedRevision+1,
   purpose:data.purpose,channel:data.channel,granted:data.granted,source:data.source,evidenceRef:data.evidenceRef,
   policyVersion:data.policyVersion,createdBy:ctx.userId,customerVersion:card.updatedAt,customerRevision:card.consentRevision}})
  await audit(tx,ctx,'ConsentEvent',row.id,data.granted?'consent_granted':'consent_withdrawn',{
   customerId:id,purpose:data.purpose,channel:data.channel,revision:row.revision,
   granted:data.granted,source:data.source,evidenceRef:data.evidenceRef,policyVersion:data.policyVersion,sessionId:ctx.sessionId,
  })
  return row
 })
}
export async function consentHistory(ctx:TokenPayload,id:string,before?:number){
 owner(ctx)
 if(before!==undefined&&(!Number.isSafeInteger(before)||before<1||before>2147483647))throw new AccessError(400,'INVALID_CURSOR')
 return prisma.$transaction(async tx=>{
  await assertLiveContext(tx,ctx);await customer(tx,ctx,id)
  const where={organizationId:ctx.organizationId,customerId:id}
  const latest=await tx.consentEvent.findFirst({where,orderBy:{revision:'desc'},select:{revision:true}})
  const rows=await tx.consentEvent.findMany({where:{...where,...(before?{revision:{lt:before}}:{})},orderBy:{revision:'desc'},take:51})
  return {revision:latest?.revision??0,rows:rows.slice(0,50),nextBefore:rows.length>50?rows[49].revision:null}
 },{isolationLevel:'RepeatableRead'})
}
// Future delivery workers MUST invoke this inside their dispatch transaction,
// passing the event ID captured when the message was queued. Queued consent
// never overrides a subsequent withdrawal, re-grant or customer/contact edit.
// This authorizes consent only; it does not configure or invoke a provider.
export async function assertCurrentConsent(tx:Prisma.TransactionClient,org:string,id:string,
 purpose:z.infer<typeof consentPurpose>,channel:z.infer<typeof consentChannel>,eventId:string){
 consentPurpose.parse(purpose);consentChannel.parse(channel)
 await tx.$queryRaw`SELECT id FROM "Customer" WHERE id=${id} AND "organizationId"=${org} FOR UPDATE`
 const card=await tx.customer.findFirst({where:{id,organizationId:org,isActive:true,mergedIntoId:null}})
 const event=await tx.consentEvent.findFirst({where:{organizationId:org,customerId:id,purpose,channel},orderBy:{revision:'desc'}})
 if(!card||!event?.granted||event.id!==eventId||event.customerRevision!==card.consentRevision)
  throw new AccessError(409,'CUSTOMER_CONSENT_REQUIRED')
 return event
}
