import { test,after } from 'node:test'
import assert from 'node:assert/strict'
import { randomUUID,randomBytes } from 'node:crypto'
import { prisma } from '@/lib/prisma'
import { sessionHash,verifySession } from '@/server/auth/session'
import { createTicket,listTickets,getTicket,commandTicket,publishSupportPolicy,getSupportPolicy } from '@/server/support/tickets'
const url=new URL(process.env.DATABASE_URL??'')
if(url.hostname!=='127.0.0.1'||url.port!=='55439'||url.pathname!=='/pos_test')throw new Error('Isolated DB only')
const orgs:string[]=[],users:string[]=[]
after(async()=>{await prisma.organization.deleteMany({where:{id:{in:orgs}}});await prisma.user.deleteMany({where:{id:{in:users}}});await prisma.$disconnect()})
async function member(org:string,role='owner',platform?:'support'|'platform_admin'){
 const user=await prisma.user.create({data:{fullName:'Ticket test actor',phone:randomUUID(),passwordHash:'not-a-login'}});users.push(user.id)
 await prisma.organizationUser.create({data:{organizationId:org,userId:user.id,role}})
 if(platform)await prisma.platformOperator.create({data:{userId:user.id,role:platform}})
 const token=randomBytes(32).toString('base64url');await prisma.session.create({data:{userId:user.id,organizationId:org,tokenHash:sessionHash(token),expiresAt:new Date(Date.now()+3600000),idleExpiresAt:new Date(Date.now()+3600000)}})
 return {user,context:(await verifySession(token))!}
}
async function fixture(platform?:'support'|'platform_admin'){
 const org=await prisma.organization.create({data:{name:'Support ticket test',phone:randomUUID()}});orgs.push(org.id)
 return {org,...await member(org.id,'owner',platform)}
}
const ticketInput=()=>({operationId:randomUUID(),title:'Printer boundary question',description:'Internal test ticket; no real device or provider call',severity:'normal' as const,diagnostics:{page:'/pos' as const,errorCode:'TEST_ONLY'}})
test('Tenant ticket replay creates one event; cashier reads only own submissions and platform scope never follows a business role',async()=>{
 const f=await fixture(),foreign=await fixture(),input=ticketInput()
 const [a,b]=await Promise.all([createTicket(f.context,input),createTicket(f.context,input)])
 assert.equal(a.id,b.id);assert.equal(await prisma.supportTicketEvent.count({where:{ticketId:a.id}}),1)
 await assert.rejects(getTicket(foreign.context,a.id,'tenant'),{code:'NOT_FOUND'})
 await assert.rejects(listTickets(f.context,{scope:'platform'}),{code:'PLATFORM_OPERATOR_REQUIRED'})
 const cashier=await member(f.org.id,'cashier'),own=await createTicket(cashier.context,{...ticketInput(),title:'Cashier own question'})
 assert.equal((await listTickets(cashier.context,{})).total,1)
 await assert.rejects(getTicket(cashier.context,a.id,'tenant'),{code:'NOT_FOUND'})
 assert.equal((await listTickets(f.context,{})).total,2)
 assert.equal((await getTicket(cashier.context,own.id,'tenant')).policy.status,'draft')
 assert.equal((await getTicket(f.context,a.id,'tenant')).metrics.emergencyContact,null)
})
test('Support assignment and actual reply track first response once; revoked operator cannot replay a cross-tenant result',async()=>{
 const f=await fixture(),support=await fixture('support'),row=await createTicket(f.context,ticketInput())
 await commandTicket(f.context,row.id,{operationId:randomUUID(),action:'reply',message:'Requester follow-up; not a support response'})
 assert.equal((await prisma.supportTicket.findUniqueOrThrow({where:{id:row.id}})).firstRespondedAt,null)
 await commandTicket(support.context,row.id,{operationId:randomUUID(),scope:'platform',action:'assignment',assignedTo:support.user.id,message:'Real test operator self-assignment'})
 const command={operationId:randomUUID(),scope:'platform' as const,action:'reply' as const,message:'Test operator response inside the ticket system'}
 const [a,b]=await Promise.all([commandTicket(support.context,row.id,command),commandTicket(support.context,row.id,command)])
 assert.equal(a.id,b.id);assert.ok(a.firstRespondedAt)
 assert.equal(await prisma.supportTicketEvent.count({where:{ticketId:row.id,kind:'reply'}}),2)
 await assert.rejects(prisma.supportTicket.update({where:{id:row.id},data:{firstRespondedAt:new Date()}}))
 await prisma.platformOperator.update({where:{userId:support.user.id},data:{isActive:false}})
 await assert.rejects(commandTicket(support.context,row.id,command),{code:'PLATFORM_OPERATOR_REQUIRED'})
 assert.equal((await listTickets(f.context,{})).rows[0].assigneeActive,false)
 assert.equal(await prisma.payment.count({where:{organizationId:f.org.id}}),0)
})
test('Resolve/reopen preserves first resolution and immutable events; raw mutation without history fails',async()=>{
 const f=await fixture(),row=await createTicket(f.context,ticketInput())
 const resolved=await commandTicket(f.context,row.id,{operationId:randomUUID(),action:'state',state:'resolved',message:'Requester confirms own question resolved'})
 assert.ok(resolved.firstResolvedAt);assert.equal(resolved.firstRespondedAt,null)
 await commandTicket(f.context,row.id,{operationId:randomUUID(),action:'state',state:'closed',message:'Requester closes resolved ticket'})
 await assert.rejects(commandTicket(f.context,row.id,{operationId:randomUUID(),action:'reply',message:'Closed ticket cannot silently reopen'}),{code:'TICKET_CLOSED'})
 await commandTicket(f.context,row.id,{operationId:randomUUID(),action:'state',state:'open',message:'Explicit request to reopen original ticket'})
 const next=await commandTicket(f.context,row.id,{operationId:randomUUID(),action:'state',state:'resolved',message:'Resolved again with the original history retained'})
 assert.equal(new Date(next.firstResolvedAt!).getTime(),new Date(resolved.firstResolvedAt!).getTime())
 await assert.rejects(prisma.supportTicket.update({where:{id:row.id},data:{severity:'critical'}}))
 await assert.rejects(prisma.supportTicket.update({where:{id:row.id},data:{title:'Rewritten historical title'}}))
 await assert.rejects(prisma.supportTicketEvent.deleteMany({where:{ticketId:row.id}}))
 const detail=await getTicket(f.context,row.id,'tenant')
 assert.equal(detail.total,5);assert.ok(!JSON.stringify(detail).includes('passwordHash'))
})
test('Late ticket audit failure rolls back ticket/event/operation; original-key retry commits exactly once',async()=>{
 const f=await fixture(),input=ticketInput(),fault='ticket_fault_'+randomUUID().replaceAll('-','')
 await prisma.$executeRawUnsafe(`CREATE FUNCTION ${fault}() RETURNS trigger LANGUAGE plpgsql AS $$ BEGIN RAISE EXCEPTION 'Ticket audit fault'; END $$`)
 try{
  await prisma.$executeRawUnsafe(`CREATE TRIGGER ${fault} BEFORE INSERT ON "AuditLog" FOR EACH ROW WHEN (NEW."organizationId"='${f.org.id}' AND NEW.action='support_ticket_created') EXECUTE FUNCTION ${fault}()`)
  await assert.rejects(createTicket(f.context,input))
  assert.equal(await prisma.supportTicket.count({where:{organizationId:f.org.id}}),0)
  assert.equal(await prisma.supportTicketEvent.count({where:{organizationId:f.org.id}}),0)
  assert.equal(await prisma.operation.count({where:{organizationId:f.org.id,type:'support.ticket.create'}}),0)
 }finally{await prisma.$executeRawUnsafe(`DROP TRIGGER IF EXISTS ${fault} ON "AuditLog"`);await prisma.$executeRawUnsafe(`DROP FUNCTION ${fault}()`)}
 await createTicket(f.context,input);await createTicket(f.context,input)
 assert.equal(await prisma.supportTicket.count({where:{organizationId:f.org.id}}),1)
})
test('Draft policy publication requires current platform admin and existing ticket targets remain immutable',async()=>{
 const f=await fixture(),admin=await fixture('platform_admin'),row=await createTicket(f.context,ticketInput()),original=await getSupportPolicy(f.context)
 const input={operationId:randomUUID(),timezone:'Asia/Tashkent' as const,weekdays:[1,2,3,4,5,6],opensMinute:540,closesMinute:1080,firstResponseMinutes:120,escalationMinutes:120,reason:'Internal draft configuration test, never official SLA'}
 await assert.rejects(publishSupportPolicy(f.context,input),{code:'PLATFORM_ADMIN_REQUIRED'})
 const [a,b]=await Promise.all([publishSupportPolicy(admin.context,input),publishSupportPolicy(admin.context,input)])
 assert.equal(a.id,b.id);assert.equal(a.status,'draft');assert.equal(a.emergencyContact,null)
 assert.equal((await getTicket(f.context,row.id,'tenant')).policy.id,original.id)
 assert.equal((await prisma.supportTicket.findUniqueOrThrow({where:{id:row.id}})).firstResponseDueAt.getTime(),new Date(row.firstResponseDueAt).getTime())
 await assert.rejects(prisma.supportPolicyVersion.update({where:{id:a.id},data:{status:'official'}}))
 await publishSupportPolicy(admin.context,{...input,operationId:randomUUID(),firstResponseMinutes:240,escalationMinutes:240,reason:'Restore owner-proposed internal draft defaults after isolated test'})
 await prisma.platformOperator.update({where:{userId:admin.user.id},data:{isActive:false}})
 await assert.rejects(publishSupportPolicy(admin.context,input),{code:'PLATFORM_ADMIN_REQUIRED'})
})
