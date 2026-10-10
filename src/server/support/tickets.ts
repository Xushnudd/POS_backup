import { Prisma,type SupportPolicyVersion,type SupportTicket } from '@prisma/client'
import { z } from 'zod'
import { prisma } from '@/lib/prisma'
import type { TokenPayload } from '@/lib/auth'
import { AccessError } from '../auth/policy'
import { assertLiveContext,audit,runOperation } from '../operations'
import { platformAdmin } from '../billing/service'
import { businessMinutesBetween,supportDeadline } from './calendar'
const states=['open','in_progress','waiting_customer','resolved','closed'] as const
const severities=['normal','important','critical'] as const
const diagnosticSchema=z.object({requestId:z.string().uuid().optional(),page:z.enum(['/pos','/sales','/products','/inventory','/customers','/reports','/security','/billing','/other']).optional(),errorCode:z.string().regex(/^[A-Z0-9_]{1,80}$/).optional(),appVersion:z.string().regex(/^[a-zA-Z0-9._+-]{1,80}$/).optional()}).strict()
export const ticketSchema=z.object({operationId:z.string().uuid(),title:z.string().trim().min(3).max(160),description:z.string().trim().min(3).max(5000),severity:z.enum(severities),diagnostics:diagnosticSchema.default({})}).strict()
const policyDTO=(row:SupportPolicyVersion)=>({id:row.id,version:row.version,timezone:row.timezone,weekdays:row.weekdays,opensMinute:row.opensMinute,closesMinute:row.closesMinute,firstResponseMinutes:row.firstResponseMinutes,escalationMinutes:row.escalationMinutes,status:row.status,emergencyContact:null})
async function operator(tx:Prisma.TransactionClient,context:TokenPayload){
 await assertLiveContext(tx,context)
 if(!await tx.session.findFirst({where:{id:context.sessionId,authenticationMethod:'password'}}))throw new AccessError(403,'PASSWORD_SESSION_REQUIRED')
 const op=await tx.platformOperator.findFirst({where:{userId:context.userId,isActive:true,user:{isActive:true}}})
 if(!op)throw new AccessError(403,'PLATFORM_OPERATOR_REQUIRED')
 return op
}
const ticketWhere=(context:TokenPayload,id?:string):Prisma.SupportTicketWhereInput=>({...(id?{id}:{}),organizationId:context.organizationId,...(context.role==='owner'?{}:{requestedBy:context.userId})})
async function accessibleTicket(tx:Prisma.TransactionClient,context:TokenPayload,id:string,scope:'tenant'|'platform'){
 await assertLiveContext(tx,context)
 if(scope==='platform')await operator(tx,context)
 const ticket=await tx.supportTicket.findFirst({where:scope==='platform'?{id}:ticketWhere(context,id),include:{policy:true}})
 if(!ticket)throw new AccessError(404,'NOT_FOUND')
 return ticket
}
function metrics(row:SupportTicket,policy:SupportPolicyVersion,now:Date){return {
 firstResponseBusinessMinutes:row.firstRespondedAt?businessMinutesBetween(row.createdAt,row.firstRespondedAt,policy):null,
 firstResolutionBusinessMinutes:row.firstResolvedAt?businessMinutesBetween(row.createdAt,row.firstResolvedAt,policy):null,
 currentAgeBusinessMinutes:businessMinutesBetween(row.createdAt,now,policy),
 needsFirstResponse:!row.firstRespondedAt&&!['resolved','closed'].includes(row.state)&&now>=row.firstResponseDueAt,
 needsEscalation:!row.firstRespondedAt&&!['resolved','closed'].includes(row.state)&&now>=row.escalationDueAt,
 targetStatus:'internal_draft_not_customer_sla',emergencyContact:null,
}}
async function event(tx:Prisma.TransactionClient,context:TokenPayload,ticket:SupportTicket,kind:string,message:string,now:Date,platform=false){
 await tx.supportTicketEvent.create({data:{ticketId:ticket.id,organizationId:ticket.organizationId,actorId:context.userId,kind,message,metadata:{state:ticket.state,severity:ticket.severity,assignedTo:ticket.assignedTo,actorScope:platform?'platform':'tenant'},createdAt:now}})
 await audit(tx,{...context,organizationId:ticket.organizationId},'SupportTicket',ticket.id,'support_ticket_'+kind,{state:ticket.state,severity:ticket.severity,assignedTo:ticket.assignedTo,sourceOrganizationId:context.organizationId})
}
export async function createTicket(context:TokenPayload,input:z.input<typeof ticketSchema>){
 const parsed=ticketSchema.parse(input)
 return runOperation(context,'support.ticket.create',parsed.operationId,parsed,async tx=>{
  const policy=await tx.supportPolicyVersion.findFirstOrThrow({orderBy:{version:'desc'}})
  const [{now}]=await tx.$queryRaw<{now:Date}[]>`SELECT clock_timestamp() AT TIME ZONE 'UTC' AS now`
  const row=await tx.supportTicket.create({data:{organizationId:context.organizationId,requestedBy:context.userId,title:parsed.title,description:parsed.description,diagnostics:parsed.diagnostics,severity:parsed.severity,policyVersionId:policy.id,firstResponseDueAt:supportDeadline(now,policy.firstResponseMinutes,policy),escalationDueAt:supportDeadline(now,policy.escalationMinutes,policy),createdAt:now,updatedAt:now}})
  await event(tx,context,row,'created',parsed.description,now)
  return row
 })
}
export const ticketListSchema=z.object({scope:z.enum(['tenant','platform']).default('tenant'),page:z.coerce.number().int().min(1).max(100000).default(1),state:z.enum(states).optional(),severity:z.enum(severities).optional(),search:z.string().trim().max(100).default('')}).strict()
export async function listTickets(context:TokenPayload,input:z.input<typeof ticketListSchema>){
 const parsed=ticketListSchema.parse(input)
 return prisma.$transaction(async tx=>{
  await assertLiveContext(tx,context)
  if(parsed.scope==='platform')await operator(tx,context)
  const op=await tx.platformOperator.findFirst({where:{userId:context.userId,isActive:true,user:{isActive:true}}}),password=!!await tx.session.findFirst({where:{id:context.sessionId,authenticationMethod:'password'}})
  const where:Prisma.SupportTicketWhereInput={...(parsed.scope==='platform'?{}:ticketWhere(context)),...(parsed.state?{state:parsed.state}:{}),...(parsed.severity?{severity:parsed.severity}:{}),...(parsed.search?{title:{contains:parsed.search,mode:'insensitive'}}:{})}
  const total=await tx.supportTicket.count({where}),rows=await tx.supportTicket.findMany({where,take:20,skip:(parsed.page-1)*20,orderBy:[{severity:'asc'},{createdAt:'asc'},{id:'asc'}],include:{policy:true,assignee:{select:{fullName:true,isActive:true,platformOperator:{select:{isActive:true}}}}}})
  const [{now}]=await tx.$queryRaw<{now:Date}[]>`SELECT clock_timestamp() AT TIME ZONE 'UTC' AS now`
  if(parsed.scope==='platform')await audit(tx,context,'SupportQueue','platform','support_queue_read',{page:parsed.page,scope:'platform',purpose:'submitted_ticket_triage'})
  return {rows:rows.map(({policy,assignee,...row})=>({...row,assigneeName:assignee?.fullName??null,assigneeActive:assignee?assignee.isActive&&!!assignee.platformOperator?.isActive:null,policy:policyDTO(policy),metrics:metrics(row,policy,now)})),total,page:parsed.page,canOperate:!!op&&password,canManagePolicy:op?.role==='platform_admin'&&password}
 },{isolationLevel:'RepeatableRead',timeout:10000})
}
export async function getTicket(context:TokenPayload,id:string,scope:'tenant'|'platform',page=1){
 if(!Number.isSafeInteger(page)||page<1||page>100000)throw new AccessError(400,'INVALID_PAGINATION')
 return prisma.$transaction(async tx=>{
  const ticket=await accessibleTicket(tx,context,id,scope),total=await tx.supportTicketEvent.count({where:{ticketId:id}})
  const events=await tx.supportTicketEvent.findMany({where:{ticketId:id},take:20,skip:(page-1)*20,orderBy:[{createdAt:'desc'},{id:'desc'}],select:{id:true,kind:true,message:true,metadata:true,createdAt:true,actor:{select:{fullName:true}}}})
  const [{now}]=await tx.$queryRaw<{now:Date}[]>`SELECT clock_timestamp() AT TIME ZONE 'UTC' AS now`
  if(scope==='platform')await audit(tx,{...context,organizationId:ticket.organizationId},'SupportTicket',id,'support_ticket_read',{sourceOrganizationId:context.organizationId,page})
  return {...ticket,policy:policyDTO(ticket.policy),events,total,page,metrics:metrics(ticket,ticket.policy,now)}
 },{isolationLevel:'RepeatableRead',timeout:10000})
}
const commandBase={operationId:z.string().uuid(),scope:z.enum(['tenant','platform']).default('tenant'),message:z.string().trim().min(3).max(5000)}
export const ticketCommandSchema=z.discriminatedUnion('action',[
 z.object({...commandBase,action:z.literal('reply')}).strict(),
 z.object({...commandBase,action:z.literal('state'),state:z.enum(states)}).strict(),
 z.object({...commandBase,action:z.literal('assignment'),assignedTo:z.string().uuid().nullable()}).strict(),
 z.object({...commandBase,action:z.literal('severity'),severity:z.enum(severities)}).strict(),
])
export async function commandTicket(context:TokenPayload,id:string,input:z.input<typeof ticketCommandSchema>){
 const parsed=ticketCommandSchema.parse(input)
 return runOperation(context,'support.ticket.command',parsed.operationId,{id,...parsed},async tx=>{
  await tx.$queryRaw`SELECT id FROM "SupportTicket" WHERE id=${id} FOR UPDATE`
  const row=await accessibleTicket(tx,context,id,parsed.scope)
  const [{now}]=await tx.$queryRaw<{now:Date}[]>`SELECT clock_timestamp() AT TIME ZONE 'UTC' AS now`
  const data:Prisma.SupportTicketUpdateInput={updatedAt:now}
  if(parsed.action==='reply'){
   if(['resolved','closed'].includes(row.state))throw new AccessError(409,'TICKET_CLOSED')
   if(parsed.scope==='platform'){data.firstRespondedAt=row.firstRespondedAt??now;data.state='in_progress'}else if(row.state==='waiting_customer')data.state='open'
  }else if(parsed.action==='assignment'){
   if(parsed.scope!=='platform')throw new AccessError(403,'PLATFORM_OPERATOR_REQUIRED')
   const op=await operator(tx,context)
   if(op.role!=='platform_admin'&&(parsed.assignedTo!==context.userId&&!(parsed.assignedTo===null&&row.assignedTo===context.userId)))throw new AccessError(403,'PLATFORM_ADMIN_REQUIRED')
   if(parsed.assignedTo&&!await tx.platformOperator.findFirst({where:{userId:parsed.assignedTo,isActive:true,user:{isActive:true}}}))throw new AccessError(404,'OPERATOR_NOT_FOUND')
   data.assignee=parsed.assignedTo?{connect:{id:parsed.assignedTo}}:{disconnect:true}
  }else if(parsed.action==='severity')data.severity=parsed.severity
  else{
   if(parsed.state===row.state)throw new AccessError(409,'TICKET_STATE_UNCHANGED')
   const terminal=['resolved','closed'].includes(row.state)
   const allowed=parsed.state==='open'?terminal:parsed.state==='closed'?row.state==='resolved':!terminal
   if(!allowed)throw new AccessError(409,'INVALID_TICKET_TRANSITION')
   if(parsed.scope!=='platform'&&!['open','resolved','closed'].includes(parsed.state))throw new AccessError(403,'PLATFORM_OPERATOR_REQUIRED')
   data.state=parsed.state
   if(parsed.state==='resolved'){data.firstResolvedAt=row.firstResolvedAt??now;data.resolvedAt=now}
   else if(parsed.state==='open')data.resolvedAt=null
  }
  const result=await tx.supportTicket.update({where:{id},data})
  await event(tx,context,result,parsed.action,parsed.message,now,parsed.scope==='platform')
  return result
 },async tx=>{await accessibleTicket(tx,context,id,parsed.scope)})
}
export const supportPolicySchema=z.object({operationId:z.string().uuid(),timezone:z.literal('Asia/Tashkent'),weekdays:z.array(z.number().int().min(1).max(7)).min(1).max(7),opensMinute:z.number().int().min(0).max(1439),closesMinute:z.number().int().min(1).max(1440),firstResponseMinutes:z.number().int().min(1).max(43200),escalationMinutes:z.number().int().min(1).max(43200),reason:z.string().trim().min(3).max(2000)}).strict().refine(value=>value.closesMinute>value.opensMinute&&new Set(value.weekdays).size===value.weekdays.length,'Ish vaqti yoki kunlari noto‘g‘ri')
export async function getSupportPolicy(context:TokenPayload){return prisma.$transaction(async tx=>{await assertLiveContext(tx,context);return policyDTO(await tx.supportPolicyVersion.findFirstOrThrow({orderBy:{version:'desc'}}))})}
export async function ticketOperators(context:TokenPayload){return prisma.$transaction(async tx=>{await operator(tx,context);return tx.platformOperator.findMany({where:{isActive:true,user:{isActive:true}},take:100,orderBy:{userId:'asc'},select:{userId:true,role:true,user:{select:{fullName:true}}}})})}
export async function publishSupportPolicy(context:TokenPayload,input:z.input<typeof supportPolicySchema>){
 const parsed=supportPolicySchema.parse(input)
 return runOperation(context,'support.policy.publish',parsed.operationId,parsed,async tx=>{
  await platformAdmin(tx,context)
  await tx.$queryRaw`SELECT pg_advisory_xact_lock(hashtextextended('support-policy',0))::text`
  const current=await tx.supportPolicyVersion.findFirstOrThrow({orderBy:{version:'desc'}}),{operationId,...fields}=parsed;void operationId
  const row=await tx.supportPolicyVersion.create({data:{...fields,version:current.version+1,createdBy:context.userId,status:'draft'}})
  await audit(tx,context,'SupportPolicyVersion',row.id,'support_policy_published',{version:row.version,status:'draft',reason:parsed.reason})
  return policyDTO(row)
 },tx=>platformAdmin(tx,context))
}
