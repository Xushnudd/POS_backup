import { test, after } from 'node:test'
import assert from 'node:assert/strict'
import { randomBytes, randomUUID } from 'node:crypto'
import { NextRequest } from 'next/server'
import { prisma } from '@/lib/prisma'
import { sessionHash, verifySession } from '@/server/auth/session'
import { enqueueJob } from '@/server/jobs/service'
import { tenantMonitoring } from '@/server/monitoring/health'
import { apiMetrics } from '@/server/monitoring/metrics'
import { GET } from '@/app/api/monitoring/route'
import { enqueueProviderIntentTx, claimProviderIntent, executeProviderClaim, bindingKey, type ProviderBinding } from '@/server/integrations/outbox'
import { runOperation } from '@/server/operations'
const url = new URL(process.env.DATABASE_URL ?? '')
if (url.hostname !== '127.0.0.1' || url.port !== '55439' || url.pathname !== '/pos_test') throw new Error('Isolated DB only')
const orgs: string[] = [], users: string[] = []
after(async () => { await prisma.organization.deleteMany({ where: { id: { in: orgs } } }); await prisma.user.deleteMany({ where: { id: { in: users } } }); await prisma.$disconnect() })
async function fixture() {
  const org = await prisma.organization.create({ data: { name: 'Monitoring scope', phone: randomUUID() } }); orgs.push(org.id)
  const user = await prisma.user.create({ data: { fullName: 'Monitor owner', phone: randomUUID(), passwordHash: 'not-a-login' } }); users.push(user.id)
  await prisma.organizationUser.create({ data: { userId: user.id, organizationId: org.id, role: 'owner' } })
  const store = await prisma.store.create({ data: { organizationId: org.id, name: 'Monitor branch' } })
  const token = randomBytes(32).toString('base64url')
  const session = await prisma.session.create({ data: { userId: user.id, organizationId: org.id, tokenHash: sessionHash(token), expiresAt: new Date(Date.now() + 3600000), idleExpiresAt: new Date(Date.now() + 3600000) } })
  return { org, store, session, token, context: (await verifySession(token))! }
}
test('Owner monitoring exposes only own counters/queues and overdue alert, without payloads or revoked/manager access', async () => {
  const own = await fixture(), foreign = await fixture()
  const job = await enqueueJob(own.context, { operationId: randomUUID(), type: 'reconciliation', storeId: own.store.id, reason: 'Monitoring test authorization' })
  await prisma.backgroundJob.update({ where: { id: job.id }, data: { nextRunAt: new Date(Date.now() - 360000) } })
  apiMetrics.record(own.org.id, 503, 3000)
  apiMetrics.record(foreign.org.id, 200, 1)
  const result = await tenantMonitoring(own.context)
  assert.ok(result.alerts.includes('JOB_QUEUE_OVERDUE'))
  assert.ok(result.alerts.includes('API_SERVER_ERRORS'))
  assert.ok(result.alerts.includes('API_SLOW_RESPONSES'))
  assert.equal(result.queues.jobs[0].count, '1')
  assert.equal((await tenantMonitoring(foreign.context)).queues.jobs.length, 0)
  assert.equal((await tenantMonitoring(foreign.context)).api.serverErrors, 0)
  assert.ok(!JSON.stringify(result).includes(job.id))
  for (const role of ['admin','cashier']) await assert.rejects(tenantMonitoring({ ...own.context, role }), { code: 'OWNER_REQUIRED' })
  const request = (suffix = '', cookie = 'pos_session=' + own.token) => new NextRequest('http://localhost:3000/api/monitoring' + suffix, { headers: { cookie } })
  assert.equal((await GET(request(), undefined)).status, 200)
  assert.equal((await GET(request('?organizationId=' + foreign.org.id), undefined)).status, 403)
  assert.equal((await GET(request('', ''), undefined)).status, 401)
  await prisma.session.update({ where: { id: own.session.id }, data: { revokedAt: new Date() } })
  await assert.rejects(tenantMonitoring(own.context), { code: 'SESSION_CHANGED' })
})
test('Real blocked DB query and expired provider lease generate scoped alerts without financial writes', async () => {
  const f=await fixture()
  const register=await prisma.register.create({data:{storeId:f.store.id,name:'Monitor terminal',code:'MONITOR'}})
  const shift=await prisma.shift.create({data:{registerId:register.id,organizationUserId:f.context.organizationUserId,openingCash:0}})
  const sale=await prisma.sale.create({data:{organizationId:f.org.id,storeId:f.store.id,registerId:register.id,shiftId:shift.id,cashierId:f.context.userId,receiptNo:randomUUID(),subtotal:'1.00',totalAmount:'1.00'}})
  const key=randomUUID()
  const intent=await runOperation(f.context,'monitoring.test.source',key,{},tx=>enqueueProviderIntentTx(tx,f.context,{type:'monitoring.test.source',key},{storeId:f.store.id,provider:'monitor-test',capability:'payment',request:{businessType:'sale',businessId:sale.id,amount:'1.00',currency:'UZS'},reason:'Test-only scoped provider monitoring'}))
  const binding:ProviderBinding={supportsCompensation:false,transport:{execute:async()=>{throw new Error('Must not execute')},lookup:async()=>{throw new Error('Must not lookup')}},confirmed:async()=>{throw new Error('Must not post')},failed:async()=>{throw new Error('Must not post')}}
  const claim=await claimProviderIntent(new Map([[bindingKey('monitor-test','payment'),binding]]));assert.ok(claim)
  await prisma.providerOutbox.update({where:{intentId:intent.id},data:{leaseUntil:new Date(Date.now()-1000)}})
  let ready!:()=>void,release!:()=>void
  const locked=new Promise<void>(resolve=>{ready=resolve}),gate=new Promise<void>(resolve=>{release=resolve})
  const locker=prisma.$transaction(async tx=>{await tx.$executeRawUnsafe('LOCK TABLE "BackgroundJob" IN ACCESS EXCLUSIVE MODE');ready();await gate},{timeout:5000})
  await locked
  const reading=tenantMonitoring(f.context)
  try{await new Promise(resolve=>setTimeout(resolve,650))}finally{release();await locker}
  const status=await reading
  assert.ok(status.alerts.includes('DATABASE_SLOW_ROUND_TRIP'))
  assert.ok(status.alerts.includes('PROVIDER_LEASE_EXPIRED'))
  assert.equal(await prisma.payment.count({where:{organizationId:f.org.id}}),0)
})
test('Test-only rejected transport and dead job alert without leaking payloads; broken telemetry cannot alter settlement', async () => {
  const f=await fixture()
  const register=await prisma.register.create({data:{storeId:f.store.id,name:'Failure terminal',code:'FAIL'}})
  const shift=await prisma.shift.create({data:{registerId:register.id,organizationUserId:f.context.organizationUserId,openingCash:0}})
  const sale=await prisma.sale.create({data:{organizationId:f.org.id,storeId:f.store.id,registerId:register.id,shiftId:shift.id,cashierId:f.context.userId,receiptNo:randomUUID(),subtotal:'1.00',totalAmount:'1.00'}})
  const job=await enqueueJob(f.context,{operationId:randomUUID(),type:'reconciliation',storeId:f.store.id,reason:'Synthetic failure monitoring'})
  await prisma.backgroundJob.update({where:{id:job.id},data:{state:'dead'}})
  const binding:ProviderBinding={supportsCompensation:false,transport:{execute:async()=>{await new Promise(resolve=>setTimeout(resolve,20));return {state:'failed',code:'PRIVATE_PROVIDER_CODE'}},lookup:async()=>{throw new Error('must not lookup')}},confirmed:async()=>{throw new Error('must not confirm')},failed:async()=>{}}
  const registry=new Map([[bindingKey('monitor-failure-test','payment'),binding]])
  async function enqueue() {
    const key=randomUUID()
    return runOperation(f.context,'monitoring.failure',key,{},tx=>enqueueProviderIntentTx(tx,f.context,{type:'monitoring.failure',key},{storeId:f.store.id,provider:'monitor-failure-test',capability:'payment',request:{businessType:'sale',businessId:sale.id,amount:'1.00',currency:'UZS'},reason:'Synthetic provider failure; not a vendor API'}))
  }
  const intent=await enqueue(),claim=await claimProviderIntent(registry);assert.equal(claim?.intentId,intent.id)
  const messages:string[]=[],original=console.info
  try {
    console.info=(value:unknown)=>{messages.push(String(value))}
    assert.equal((await executeProviderClaim(claim!,registry)).state,'failed')
    const log=JSON.parse(messages.find(row=>JSON.parse(row).event==='provider_transport')!)
    assert.equal(log.organizationId,f.org.id);assert.equal(log.operationId,intent.id)
    assert.equal(log.kind,'payment.submit');assert.equal(log.code,'PROVIDER_FAILED');assert.ok(log.durationMs>=15)
    assert.doesNotMatch(JSON.stringify(log),/PRIVATE_PROVIDER_CODE|businessId|amount|externalId|secret|leaseToken/)
    await enqueue();const next=await claimProviderIntent(registry);assert.ok(next)
    console.info=()=>{throw new Error('Synthetic log sink failure')}
    assert.equal((await executeProviderClaim(next,registry)).state,'failed')
  } finally {console.info=original}
  const status=await tenantMonitoring(f.context)
  assert.ok(status.alerts.includes('JOB_FAILURES'))
  assert.ok(status.alerts.includes('PROVIDER_RECONCILIATION_REQUIRED'))
  assert.equal(status.queues.providers.find(row=>row.state==='failed')?.count,'2')
  assert.equal(await prisma.payment.count({where:{organizationId:f.org.id}}),0)
  assert.equal(await prisma.inventoryMovement.count({where:{organizationId:f.org.id}}),0)
})
