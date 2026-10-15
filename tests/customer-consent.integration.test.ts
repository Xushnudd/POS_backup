import test,{after} from 'node:test'
import assert from 'node:assert/strict'
import {randomUUID,randomBytes} from 'node:crypto'
import {prisma} from '@/lib/prisma'
import {sessionHash,verifySession} from '@/server/auth/session'
import {recordConsent,consentHistory,assertCurrentConsent,consentSchema} from '@/server/customers/consent'
import {assertExportCoverage} from '@/server/jobs/tenant-export'
const u=new URL(process.env.DATABASE_URL??'');if(u.hostname!=='127.0.0.1'||u.port!=='55439'||u.pathname!=='/pos_test')throw Error('Isolated DB only')
const orgs:string[]=[],users:string[]=[]
after(async()=>{await prisma.organization.deleteMany({where:{id:{in:orgs}}});await prisma.user.deleteMany({where:{id:{in:users}}});await prisma.$disconnect()})
const code=(value:string)=>(e:unknown)=>!!e&&typeof e==='object'&&'code'in e&&e.code===value
async function fixture(legacy=false){
 const data={name:'Consent isolated',phone:randomUUID()}
 const org=legacy?await prisma.$transaction(async tx=>{
  await tx.$executeRawUnsafe('ALTER TABLE "Organization" DISABLE TRIGGER billing_enroll_new_org')
  const row=await tx.organization.create({data})
  await tx.$executeRawUnsafe('ALTER TABLE "Organization" ENABLE TRIGGER billing_enroll_new_org');return row
 }):await prisma.organization.create({data});orgs.push(org.id)
 const user=await prisma.user.create({data:{fullName:'Consent owner',phone:randomUUID(),passwordHash:'not-a-login'}});users.push(user.id)
 await prisma.organizationUser.create({data:{organizationId:org.id,userId:user.id,role:'owner'}})
 const token=randomBytes(32).toString('base64url'),session=await prisma.session.create({data:{userId:user.id,organizationId:org.id,tokenHash:sessionHash(token),expiresAt:new Date(Date.now()+3600000),idleExpiresAt:new Date(Date.now()+3600000)}})
 const ctx=(await verifySession(token))!,customer=await prisma.customer.create({data:{organizationId:org.id,fullName:'Consent customer',phone:randomUUID()}})
 return {org,user,session,ctx,customer,token}
}
const input=(revision=0)=>consentSchema.parse({operationId:randomUUID(),expectedRevision:revision,purpose:'electronic_receipt',channel:'sms',granted:true,source:'written',evidenceRef:'document:synthetic-001',policyVersion:'synthetic-v1'})
test('Purpose/channel consent is absent by default, distinct, append-only, timestamped and tenant exported',async()=>{
 const f=await fixture();assertExportCoverage()
 const check=(purpose:'electronic_receipt'|'service_reminder'|'marketing',channel:'sms'|'email',id:string)=>prisma.$transaction(tx=>assertCurrentConsent(tx,f.org.id,f.customer.id,purpose,channel,id))
 await assert.rejects(()=>check('electronic_receipt','sms',randomUUID()),code('CUSTOMER_CONSENT_REQUIRED'))
 const a=await recordConsent(f.ctx,f.customer.id,input());assert.equal(a.source,'written');assert.equal(a.policyVersion,'synthetic-v1');assert.ok(new Date(a.createdAt).getTime()<=Date.now())
 assert.equal((await check('electronic_receipt','sms',a.id)).id,a.id)
 await assert.rejects(()=>check('marketing','sms',a.id),code('CUSTOMER_CONSENT_REQUIRED'))
 await assert.rejects(()=>check('electronic_receipt','email',a.id),code('CUSTOMER_CONSENT_REQUIRED'))
 const b=await recordConsent(f.ctx,f.customer.id,{...input(1),purpose:'service_reminder'})
 const c=await recordConsent(f.ctx,f.customer.id,{...input(2),purpose:'marketing',channel:'email'})
 assert.equal(b.revision,2);assert.equal(c.revision,3)
 await assert.rejects(()=>prisma.consentEvent.update({where:{id:a.id},data:{granted:false}}))
 await assert.rejects(()=>prisma.consentEvent.delete({where:{id:a.id}}))
 const history=await consentHistory(f.ctx,f.customer.id);assert.equal(history.revision,3);assert.equal(history.rows.length,3)
 assert.equal(await prisma.auditLog.count({where:{organizationId:f.org.id,entityType:'ConsentEvent'}}),3)
})
test('Withdrawals invalidate queued consent, re-grants cannot revive old messages, contact edits and inactive cards fail closed',async()=>{
 const f=await fixture(),a=await recordConsent(f.ctx,f.customer.id,input())
 const check=(id:string)=>prisma.$transaction(tx=>assertCurrentConsent(tx,f.org.id,f.customer.id,'electronic_receipt','sms',id))
 const withdrawn=await recordConsent(f.ctx,f.customer.id,{...input(1),granted:false,source:'customer_request'})
 assert.equal(withdrawn.granted,false);await assert.rejects(()=>check(a.id),code('CUSTOMER_CONSENT_REQUIRED'))
 const again=await recordConsent(f.ctx,f.customer.id,input(2));await assert.rejects(()=>check(a.id),code('CUSTOMER_CONSENT_REQUIRED'));assert.equal((await check(again.id)).id,again.id)
 // Preserve the exact previous timestamp: correctness must not depend on
 // millisecond clock resolution, ORM timestamp updates or clock progression.
 await prisma.customer.update({where:{id:f.customer.id},data:{phone:randomUUID(),updatedAt:new Date(again.customerVersion),consentRevision:0}})
 assert.equal((await prisma.customer.findUniqueOrThrow({where:{id:f.customer.id}})).consentRevision,1)
 await assert.rejects(()=>check(again.id),code('CUSTOMER_CONSENT_REQUIRED'))
 const refreshed=await recordConsent(f.ctx,f.customer.id,input(3));assert.equal((await check(refreshed.id)).id,refreshed.id)
 await prisma.customer.update({where:{id:f.customer.id},data:{isActive:false}})
 await assert.rejects(()=>recordConsent(f.ctx,f.customer.id,input(4)),code('CUSTOMER_INACTIVE'))
 assert.equal((await recordConsent(f.ctx,f.customer.id,{...input(4),granted:false})).granted,false)
})
test('Idempotency preserves one event; stale and parallel revisions cannot overwrite decisions',async()=>{
 const f=await fixture(),a=input(),event=await recordConsent(f.ctx,f.customer.id,a)
 assert.equal((await recordConsent(f.ctx,f.customer.id,a)).id,event.id)
 await assert.rejects(()=>recordConsent(f.ctx,f.customer.id,{...a,evidenceRef:'document:different'}),code('OPERATION_PAYLOAD_CONFLICT'))
 await assert.rejects(()=>recordConsent(f.ctx,f.customer.id,input()),code('CONSENT_REVISION_CONFLICT'))
 const decisions=await Promise.allSettled([recordConsent(f.ctx,f.customer.id,input(1)),recordConsent(f.ctx,f.customer.id,{...input(1),granted:false})])
 assert.equal(decisions.filter(r=>r.status==='fulfilled').length,1)
 const rejected=decisions.find(r=>r.status==='rejected') as PromiseRejectedResult
 assert.ok(code('CONSENT_REVISION_CONFLICT')(rejected.reason)||code('CONCURRENT_CONFLICT')(rejected.reason),'Concurrent decision must return a recoverable business conflict')
 assert.equal(await prisma.consentEvent.count({where:{customerId:f.customer.id}}),2)
})
test('Cross-tenant writes/read, forged role, revoked-session replay and DB-level mismatched roots are denied',async()=>{
 const f=await fixture(),foreign=await fixture(),a=input(),event=await recordConsent(f.ctx,f.customer.id,a)
 await assert.rejects(()=>consentHistory(foreign.ctx,f.customer.id),code('CUSTOMER_NOT_FOUND'))
 await assert.rejects(()=>recordConsent(foreign.ctx,f.customer.id,input()),code('CUSTOMER_NOT_FOUND'))
 await assert.rejects(()=>consentHistory({...f.ctx,role:'admin'},f.customer.id),code('OWNER_REQUIRED'))
 await assert.rejects(()=>prisma.consentEvent.create({data:{...event,id:randomUUID(),organizationId:foreign.org.id,createdBy:foreign.user.id,revision:2}}))
 await assert.rejects(()=>prisma.consentEvent.create({data:{...event,id:randomUUID(),revision:2}}))
 assert.equal(await prisma.consentEvent.count({where:{customerId:f.customer.id}}),1)
 await prisma.session.update({where:{id:f.session.id},data:{revokedAt:new Date()}})
 await assert.rejects(()=>recordConsent(f.ctx,f.customer.id,a),code('SESSION_CHANGED'))
 await assert.rejects(()=>consentHistory(f.ctx,f.customer.id),code('SESSION_CHANGED'))
})
test('Consent HTTP validates strict payload/cursor, idempotency and anonymous/foreign access',async()=>{
 const f=await fixture(),foreign=await fixture(),{GET,POST}=await import('@/app/api/customers/[id]/consents/route'),{NextRequest}=await import('next/server')
 const url='http://localhost:3000/api/customers/'+f.customer.id+'/consents',params={params:Promise.resolve({id:f.customer.id})},headers={cookie:'pos_session='+f.token,origin:'http://localhost:3000','content-type':'application/json'}
 const post=(data:unknown)=>POST(new NextRequest(url,{method:'POST',headers,body:JSON.stringify(data)}),params)
 const body=input();assert.equal((await post({...body,createdAt:'2020-01-01'})).status,400);assert.equal((await post({...body,evidenceRef:'phone +998 token'})).status,400)
 assert.equal((await post(body)).status,200);assert.equal((await post(body)).status,200)
 assert.equal((await GET(new NextRequest(url,{headers}),params)).status,200)
 assert.equal((await GET(new NextRequest(url+'?before=NaN',{headers}),params)).status,400)
 assert.equal((await GET(new NextRequest(url+'?before=2147483648',{headers}),params)).status,400)
 assert.equal((await GET(new NextRequest(url),params)).status,401)
 assert.equal((await GET(new NextRequest(url,{headers:{cookie:'pos_session='+foreign.token}}),params)).status,404)
})
test('Expired subscriptions can withdraw consent but cannot grant; history pagination retains every original event',async()=>{
 const f=await fixture(true)
 for(let revision=0;revision<51;revision++)await recordConsent(f.ctx,f.customer.id,input(revision))
 const first=await consentHistory(f.ctx,f.customer.id);assert.equal(first.rows.length,50);assert.equal(first.revision,51);assert.equal(first.nextBefore,2)
 const last=await consentHistory(f.ctx,f.customer.id,first.nextBefore!);assert.equal(last.rows.length,1);assert.equal(last.rows[0].revision,1);assert.equal(last.nextBefore,null)
 const ends=new Date(Date.now()-8*86400000)
 await prisma.organizationSubscription.create({data:{organizationId:f.org.id,planVersionId:'initial-pro-v1',trialStartedAt:new Date(ends.getTime()-14*86400000),trialEndsAt:ends}})
 await assert.rejects(()=>recordConsent(f.ctx,f.customer.id,input(51)))
 const withdrawn=await recordConsent(f.ctx,f.customer.id,{...input(51),granted:false})
 assert.equal(withdrawn.granted,false);assert.equal(withdrawn.revision,52)
 assert.equal((await consentHistory(f.ctx,f.customer.id)).revision,52)
})
