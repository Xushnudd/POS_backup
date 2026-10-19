import {createHash,createHmac,timingSafeEqual} from 'node:crypto'
import {Prisma,type BackgroundJob} from '@prisma/client'
import {z} from 'zod'
import bwipjs from 'bwip-js/node'
import {prisma} from '@/lib/prisma'
import type {TokenPayload} from '@/lib/auth'
import {AccessError} from '../auth/policy'
import {totpKeyConfiguration} from '../auth/totp-keys'
import {assertLiveContext} from '../operations'
import {assertCurrentConsent} from './consent'
import {customerStatementTx} from './ledger'
export const reminderInputSchema=z.object({customerId:z.string().uuid(),consentEventId:z.string().uuid()}).strict()
export const reminderPayloadSchema=reminderInputSchema.extend({noticeDate:z.string().regex(/^\d{4}-\d{2}-\d{2}$/)}).strict()
const amount=z.string().regex(/^-?\d+(?:\.\d+)?$/)
export const reminderSnapshotSchema=z.object({customerName:z.string(),organizationName:z.string(),currency:z.string(),timezone:z.string(),asOf:z.string(),debtTotal:amount,overdue:amount,upcoming:amount,noDueDate:amount,unallocated:amount,requiresReconciliation:z.boolean(),entries:z.array(z.object({date:z.string(),dueAt:z.string().nullable(),receiptNo:z.string().nullable(),sourceType:z.string(),amount,balance:amount}).strict()).max(10000)}).strict()
export type ReminderSnapshot=z.infer<typeof reminderSnapshotSchema>
const savedSchema=z.object({version:z.literal(1),customerId:z.string().uuid(),consentEventId:z.string().uuid(),keyId:z.string().regex(/^[a-f0-9]{64}$/),tokenHash:z.string().regex(/^[a-f0-9]{64}$/),expiresAt:z.string().datetime(),snapshot:reminderSnapshotSchema}).strict()
export const reminderViewSchema=z.object({organizationId:z.string().uuid(),jobId:z.string().uuid(),capability:z.string().regex(/^[A-Za-z0-9_-]{43}$/)}).strict()
const hash=(value:string)=>createHash('sha256').update(value).digest('hex')
function keys(){const config=totpKeyConfiguration();if(!config)throw new AccessError(503,'REMINDER_UNAVAILABLE');return [config.current,...config.previous].map(key=>({id:hash(Buffer.from(key,'hex').toString('hex')),key:Buffer.from(key,'hex')}))}
const proof=(key:Buffer,org:string,id:string)=>createHmac('sha256',key).update('pos:in-person-debt-reminder:v1\0'+org+'\0'+id).digest('base64url')
export async function prepareCustomerReminder(tx:Prisma.TransactionClient,ctx:TokenPayload,job:BackgroundJob,payload:z.infer<typeof reminderPayloadSchema>){
 await assertCurrentConsent(tx,ctx.organizationId,payload.customerId,'service_reminder','in_person',payload.consentEventId)
 const statement=await customerStatementTx(tx,ctx,payload.customerId,{exportAll:true})
 if(statement.aging.debtTotal.lte(0))throw new AccessError(409,'NO_CUSTOMER_DEBT')
 if(!statement.summary.currentBalance.equals(statement.summary.closingBalance)||(statement.entries.at(-1)?.balance??new Prisma.Decimal(0)).comparedTo(statement.summary.closingBalance)!==0)throw new AccessError(409,'STATEMENT_CHANGED')
 const org=await tx.organization.findUniqueOrThrow({where:{id:ctx.organizationId}}),key=keys()[0]
 const snapshot=reminderSnapshotSchema.parse({customerName:statement.customer.fullName,organizationName:org.name,currency:org.currencyCode,timezone:statement.timezone,asOf:statement.aging.asOf.toISOString(),debtTotal:statement.aging.debtTotal.toFixed(2),overdue:statement.aging.overdue.toFixed(2),upcoming:statement.aging.upcoming.toFixed(2),noDueDate:statement.aging.noDueDate.toFixed(2),unallocated:statement.aging.unallocated.toFixed(2),requiresReconciliation:statement.aging.requiresReconciliation,entries:statement.entries.map(entry=>({date:entry.effectiveAt.toISOString(),dueAt:entry.dueAt?.toISOString()??null,receiptNo:entry.receiptNo,sourceType:entry.sourceType,amount:entry.amount.toFixed(2),balance:entry.balance.toFixed(2)}))})
 const saved=savedSchema.parse({version:1,customerId:payload.customerId,consentEventId:payload.consentEventId,keyId:key.id,tokenHash:hash(proof(key.key,ctx.organizationId,job.id)),expiresAt:job.expiresAt.toISOString(),snapshot})
 if(Buffer.byteLength(JSON.stringify(saved))>850000)throw new AccessError(413,'EXPORT_TOO_LARGE')
 return saved
}
async function usable(tx:Prisma.TransactionClient,job:BackgroundJob){
 if(job.type!=='customer_reminder'||job.state!=='succeeded')return null
 const parsed=savedSchema.safeParse(job.result);if(!parsed.success)return null
 const saved=parsed.data
 const [clock]=await tx.$queryRaw<{now:Date;ready:boolean}[]>`SELECT clock_timestamp() AS now,auth_restore_ready() AS ready`
 if(!clock.ready||new Date(saved.expiresAt)<=clock.now||!keys().some(key=>key.id===saved.keyId))return null
 if(await tx.authRestoreCheckpoint.findFirst({where:{createdAt:{gte:job.createdAt}},select:{id:true}}))return null
 try{await assertCurrentConsent(tx,job.organizationId,saved.customerId,'service_reminder','in_person',saved.consentEventId)}catch(error){if(error instanceof AccessError)return null;throw error}
 return saved
}
export async function listCustomerReminders(ctx:TokenPayload,customerId:string,page:number){
 if(ctx.role!=='owner')throw new AccessError(403,'OWNER_REQUIRED')
 if(!Number.isSafeInteger(page)||page<1||(page-1)*20>2147483647)throw new AccessError(400,'INVALID_PAGINATION')
 return prisma.$transaction(async tx=>{
  await assertLiveContext(tx,ctx)
  const customer=await tx.customer.findFirst({where:{id:customerId,organizationId:ctx.organizationId}})
  if(!customer)throw new AccessError(404,'CUSTOMER_NOT_FOUND')
  const consent=await tx.consentEvent.findFirst({where:{organizationId:ctx.organizationId,customerId,purpose:'service_reminder',channel:'in_person'},orderBy:{revision:'desc'}})
  const consentEventId=consent?.granted&&customer.isActive&&!customer.mergedIntoId&&consent.customerRevision===customer.consentRevision?consent.id:null
  const where={organizationId:ctx.organizationId,type:'customer_reminder',payload:{path:['reminder','customerId'],equals:customerId}}
  const total=await tx.backgroundJob.count({where}),jobs=await tx.backgroundJob.findMany({where,orderBy:[{createdAt:'desc'},{id:'desc'}],take:20,skip:(page-1)*20})
  const rows=[]
  for(const job of jobs){
   const saved=await usable(tx,job),key=saved?keys().find(key=>key.id===saved.keyId):null
   let url:string|null=null,qrDataUrl:string|null=null
   if(saved&&key){const link=new URL('/d',process.env.APP_ORIGIN);link.hash=[ctx.organizationId,job.id,proof(key.key,ctx.organizationId,job.id)].join('.');url=link.href;qrDataUrl='data:image/svg+xml;base64,'+Buffer.from(bwipjs.toSVG({bcid:'qrcode',text:url,scale:3,padding:4})).toString('base64')}
   rows.push({id:job.id,state:job.state,lastError:job.lastError,expiresAt:job.expiresAt.toISOString(),available:Boolean(saved),url,qrDataUrl,delivery:'in_person_not_confirmed'})
  }
  return {rows,total,totalPages:Math.ceil(total/20),consentEventId}
 },{isolationLevel:'RepeatableRead'})
}
export async function viewCustomerReminder(input:unknown):Promise<ReminderSnapshot>{
 const parsed=reminderViewSchema.parse(input),unavailable=()=>new AccessError(404,'REMINDER_UNAVAILABLE')
 return prisma.$transaction(async tx=>{
  const job=await tx.backgroundJob.findFirst({where:{id:parsed.jobId,organizationId:parsed.organizationId,type:'customer_reminder'}})
  if(!job)throw unavailable()
  const saved=await usable(tx,job)
  if(!saved||!timingSafeEqual(Buffer.from(saved.tokenHash,'hex'),Buffer.from(hash(parsed.capability),'hex')))throw unavailable()
  return saved.snapshot
 },{isolationLevel:'Serializable'})
}
