import {test,after} from 'node:test'
import assert from 'node:assert/strict'
import {randomUUID,randomBytes} from 'node:crypto'
import {prisma} from '@/lib/prisma'
import {sessionHash,verifySession} from '@/server/auth/session'
import {recordConsent} from '@/server/customers/consent'
import {postDebtDocument} from '@/server/customers/ledger'
import {enqueueJob,jobSchema,claimJob,executeJob,retryJob} from '@/server/jobs/service'
import {listCustomerReminders,viewCustomerReminder} from '@/server/customers/reminders'
const url=new URL(process.env.DATABASE_URL??'');if(url.hostname!=='127.0.0.1'||url.port!=='55439'||url.pathname!=='/pos_test')throw new Error('Isolated DB only')
const orgs:string[]=[],users:string[]=[]
after(async()=>{await prisma.organization.deleteMany({where:{id:{in:orgs}}});await prisma.user.deleteMany({where:{id:{in:users}}});await prisma.$disconnect()})
async function fixture(){
 const org=await prisma.organization.create({data:{name:'Reminder merchant',phone:randomUUID()}});orgs.push(org.id)
 const user=await prisma.user.create({data:{fullName:'Private owner',phone:randomUUID(),passwordHash:'not-a-login'}});users.push(user.id)
 await prisma.organizationUser.create({data:{organizationId:org.id,userId:user.id,role:'owner'}})
 const token=randomBytes(32).toString('base64url');await prisma.session.create({data:{organizationId:org.id,userId:user.id,tokenHash:sessionHash(token),expiresAt:new Date(Date.now()+3600000),idleExpiresAt:new Date(Date.now()+3600000)}})
 const ctx=(await verifySession(token))!,customer=await prisma.customer.create({data:{organizationId:org.id,fullName:'Statement customer',phone:randomUUID(),creditLimit:'100'}})
 await postDebtDocument(ctx,customer.id,{operationId:randomUUID(),kind:'opening',amount:'1.01',reason:'Synthetic opening debt',effectiveAt:new Date(Date.now()-3*86400000).toISOString(),dueAt:new Date(Date.now()-86400000).toISOString()})
 return {org,user,ctx,customer}
}
const consent=(revision:number,granted=true,channel='in_person')=>({operationId:randomUUID(),expectedRevision:revision,purpose:'service_reminder' as const,channel:channel as 'in_person',granted,source:'customer_request' as const,evidenceRef:'synthetic-in-person-request',policyVersion:'service-in-person-v1'})
const queue=(customerId:string,consentEventId:string,operationId=randomUUID())=>jobSchema.parse({operationId,type:'customer_reminder',reminder:{customerId,consentEventId},reason:'Customer requested personal statement'})
function proof(url:string){const [organizationId,jobId,capability]=new URL(url).hash.slice(1).split('.');return {organizationId,jobId,capability}}
test('Daily consented queue and concurrent worker replay prepare one exact statement; withdrawal immediately invalidates the link',async()=>{
 const f=await fixture()
 await assert.rejects(enqueueJob(f.ctx,queue(f.customer.id,randomUUID())),{code:'CUSTOMER_CONSENT_REQUIRED'})
 const granted=await recordConsent(f.ctx,f.customer.id,consent(0))
 const input=queue(f.customer.id,granted.id)
 const a=await enqueueJob(f.ctx,input),same=await enqueueJob(f.ctx,input),b=await enqueueJob(f.ctx,queue(f.customer.id,granted.id))
 assert.equal(a.id,same.id);assert.equal(a.id,b.id)
 assert.equal(await prisma.backgroundJob.count({where:{organizationId:f.org.id}}),1)
 const claimed=await claimJob();assert.equal(claimed?.id,a.id)
 const outcomes=await Promise.all([executeJob(claimed!),executeJob(claimed!)])
 assert.equal(outcomes.filter(result=>result.succeeded).length,1)
 assert.equal(await prisma.jobEvent.count({where:{jobId:a.id,event:'succeeded'}}),1)
 assert.equal((await executeJob(claimed!)).succeeded,false)
 const listing=await listCustomerReminders(f.ctx,f.customer.id,1),link=listing.rows[0]
 assert.equal(link.available,true);assert.equal(link.delivery,'in_person_not_confirmed');assert.ok(link.url)
 const capability=proof(link.url!),view=await viewCustomerReminder(capability)
 assert.equal(view.debtTotal,'1.01');assert.equal(view.overdue,'1.01');assert.equal(view.entries.length,1);assert.equal(view.entries[0].balance,'1.01')
 assert.doesNotMatch(JSON.stringify(view),/phone|actorId|actorName|note|tokenHash|keyId|sessionId/)
 const stored=await prisma.backgroundJob.findUniqueOrThrow({where:{id:a.id}});assert.ok(!JSON.stringify(stored).includes(capability.capability))
 await assert.rejects(viewCustomerReminder({...capability,capability:'x'.repeat(43)}),{code:'REMINDER_UNAVAILABLE'})
 await recordConsent(f.ctx,f.customer.id,consent(1,false))
 await assert.rejects(viewCustomerReminder(capability),{code:'REMINDER_UNAVAILABLE'})
 assert.equal((await listCustomerReminders(f.ctx,f.customer.id,1)).rows[0].available,false)
 assert.equal(await prisma.debtEntry.count({where:{organizationId:f.org.id}}),1)
 assert.equal(await prisma.payment.count({where:{organizationId:f.org.id}}),0)
})
test('Withdrawn queued consent, stale contact, other channel and foreign tenant cannot prepare or read a reminder',async()=>{
 const f=await fixture(),foreign=await fixture()
 const sms=await recordConsent(f.ctx,f.customer.id,consent(0,true,'sms'))
 await assert.rejects(enqueueJob(f.ctx,queue(f.customer.id,sms.id)),{code:'CUSTOMER_CONSENT_REQUIRED'})
 const granted=await recordConsent(f.ctx,f.customer.id,consent(1)),queued=await enqueueJob(f.ctx,queue(f.customer.id,granted.id))
 await assert.rejects(enqueueJob(foreign.ctx,queue(f.customer.id,granted.id)),{code:'CUSTOMER_CONSENT_REQUIRED'})
 await prisma.customer.update({where:{id:f.customer.id},data:{phone:randomUUID()}})
 const claimed=await claimJob();assert.equal(claimed?.id,queued.id)
 assert.equal((await executeJob(claimed!)).succeeded,false)
 const stopped=await prisma.backgroundJob.findUniqueOrThrow({where:{id:queued.id}})
 assert.equal(stopped.state,'dead');assert.equal(stopped.lastError,'AUTHORIZATION_CHANGED')
 await assert.rejects(retryJob(f.ctx,queued.id,{operationId:randomUUID(),reason:'Attempt stale consent retry'}),{code:'CUSTOMER_CONSENT_REQUIRED'})
 assert.equal((await listCustomerReminders(f.ctx,f.customer.id,1)).consentEventId,null)
 const fresh=await recordConsent(f.ctx,f.customer.id,consent(2)),next=await enqueueJob(f.ctx,queue(f.customer.id,fresh.id))
 assert.notEqual(next.id,queued.id)
 await recordConsent(f.ctx,f.customer.id,consent(3,false))
 const nextClaim=await claimJob();assert.equal(nextClaim?.id,next.id)
 assert.equal((await executeJob(nextClaim!)).succeeded,false)
 assert.equal(await prisma.backgroundJob.count({where:{organizationId:f.org.id,state:'succeeded'}}),0)
 await assert.rejects(listCustomerReminders(foreign.ctx,f.customer.id,1),{code:'CUSTOMER_NOT_FOUND'})
 await assert.rejects(prisma.backgroundJob.create({data:{organizationId:foreign.org.id,type:'customer_reminder',payload:{reminder:{customerId:f.customer.id,consentEventId:fresh.id,noticeDate:new Date().toISOString().slice(0,10)}},expiresAt:new Date(Date.now()+3600000)}}))
})
