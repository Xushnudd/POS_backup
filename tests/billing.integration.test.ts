import { test, after } from 'node:test'
import assert from 'node:assert/strict'
import { randomBytes, randomUUID } from 'node:crypto'
import { prisma } from '@/lib/prisma'
import { sessionHash, verifySession } from '@/server/auth/session'
import { assignPlan, billingStatus, publishPlan } from '@/server/billing/service'
import { createInvoice, cancelInvoice, confirmBillingPayment, cancelSubscription, listInvoices } from '@/server/billing/invoices'
import { billingDatabaseError } from '@/server/billing/errors'
import { NextRequest } from 'next/server'
import { POST as createStoreAPI } from '@/app/api/stores/route'
import { GET as billingAPI } from '@/app/api/billing/route'
import { GET as productsAPI } from '@/app/api/products/route'
import { POST as registersAPI } from '@/app/api/stores/[id]/registers/route'
const url = new URL(process.env.DATABASE_URL ?? '')
if (url.hostname !== '127.0.0.1' || url.port !== '55439' || url.pathname !== '/pos_test') throw new Error('Isolated DB only')
const orgs: string[] = [], users: string[] = []
after(async () => {
  await prisma.organization.deleteMany({ where: { id: { in: orgs } } })
  // Immutable global plan versions retain their author; isolated fixture authors
  // have no usable password and are disabled after the test, never real accounts.
  for (const id of users) {
    if (await prisma.billingPlanVersion.count({ where: { createdBy: id } })) {
      await prisma.platformOperator.deleteMany({ where: { userId: id } })
      await prisma.user.update({ where: { id }, data: { isActive: false } })
    } else await prisma.user.delete({ where: { id } })
  }
  await prisma.$disconnect()
})
async function fixture(legacy = false) {
  const org = legacy ? await prisma.$transaction(async tx => {
    // Isolated fixture only: reproduce pre-migration organization enrollment.
    await tx.$executeRawUnsafe('ALTER TABLE "Organization" DISABLE TRIGGER billing_enroll_new_org')
    const row = await tx.organization.create({ data: { name: 'Legacy SaaS fixture', phone: randomUUID() } })
    await tx.$executeRawUnsafe('ALTER TABLE "Organization" ENABLE TRIGGER billing_enroll_new_org')
    return row
  }) : await prisma.organization.create({ data: { name: 'SaaS fixture', phone: randomUUID() } }); orgs.push(org.id)
  const user = await prisma.user.create({ data: { fullName: 'SaaS owner', phone: randomUUID(), passwordHash: 'not-a-login' } }); users.push(user.id)
  await prisma.organizationUser.create({ data: { organizationId: org.id, userId: user.id, role: 'owner' } })
  const token = randomBytes(32).toString('base64url')
  const session = await prisma.session.create({ data: { userId: user.id, organizationId: org.id, tokenHash: sessionHash(token), expiresAt: new Date(Date.now() + 3600000), idleExpiresAt: new Date(Date.now() + 3600000) } })
  return { org, user, session, token, context: (await verifySession(token))! }
}
async function invoiceInput(code='start') { const plan=await prisma.billingPlan.findUniqueOrThrow({where:{code}});return {operationId:randomUUID(),planCode:code,planVersionId:plan.currentVersionId} }
test('New organization receives one immutable Pro trial; private billing does not cross tenants or grant platform access', async () => {
  const f = await fixture(), foreign = await fixture()
  const status = await billingStatus(f.context)
  assert.equal(status.state, 'trial'); assert.equal(status.subscription?.planVersion.code, 'pro')
  assert.equal(status.subscription!.trialEndsAt.getTime() - status.subscription!.trialStartedAt.getTime(), 14 * 86400000)
  assert.equal(status.subscription!.planVersion.graceDays, 7)
  assert.equal(status.usage.staff, 1); assert.equal((await billingStatus(foreign.context)).subscription!.organizationId, foreign.org.id)
  const idleExpiresAt=new Date(Date.now()+60000)
  await prisma.session.update({where:{id:f.session.id},data:{idleExpiresAt}})
  assert.equal((await billingAPI(new NextRequest('http://localhost:3000/api/billing',{headers:{cookie:'pos_session='+f.token}}),undefined)).status,200)
  assert.equal((await prisma.session.findUniqueOrThrow({where:{id:f.session.id}})).idleExpiresAt.getTime(),idleExpiresAt.getTime())
  await assert.rejects(prisma.organizationSubscription.update({ where: { organizationId: f.org.id }, data: { trialEndsAt: new Date(Date.now() + 30 * 86400000) } }))
  await assert.rejects(prisma.organizationSubscription.delete({ where: { organizationId: f.org.id } }))
  await assert.rejects(assignPlan(f.context, { operationId: randomUUID(), targetOrganizationId: foreign.org.id, planCode: 'start', reason: 'Unauthorized cross-tenant assignment' }), { code: 'PLATFORM_ADMIN_REQUIRED' })
  await prisma.session.update({ where: { id: f.session.id }, data: { revokedAt: new Date() } })
  await assert.rejects(billingStatus(f.context), { code: 'SESSION_CHANGED' })
})
test('Approved plan assignment replays once; concurrent raw/API-independent creates cannot bypass quota or erase existing data', async () => {
  const f = await fixture()
  await prisma.platformOperator.create({ data: { userId: f.user.id, role: 'platform_admin' } })
  const first = await prisma.store.create({ data: { organizationId: f.org.id, name: 'Preserved branch' } })
  const second = await prisma.store.create({ data: { organizationId: f.org.id, name: 'Also preserved' } })
  const command = { operationId: randomUUID(), targetOrganizationId: f.org.id, planCode: 'start', reason: 'Explicit lower plan with existing data retained' }
  const [a,b] = await Promise.all([assignPlan(f.context, command), assignPlan(f.context, command)])
  assert.equal(a.planVersionId, b.planVersionId)
  assert.equal(await prisma.auditLog.count({ where: { organizationId: f.org.id, action: 'billing_plan_assigned' } }), 1)
  await assert.rejects(prisma.store.create({ data: { organizationId: f.org.id, name: 'Over quota' } }), error => billingDatabaseError(error)?.code === 'PLAN_LIMIT_REACHED')
  assert.equal(await prisma.store.count({ where: { organizationId: f.org.id } }), 2)
  const races = await Promise.allSettled([first,second].map(store => prisma.register.create({ data: { storeId: store.id, name: 'Concurrent register', code: randomUUID() } })))
  assert.equal(races.filter(result => result.status === 'fulfilled').length, 1)
  assert.equal(await prisma.register.count({ where: { store: { organizationId: f.org.id } } }), 1)
  const registerDenied=await registersAPI(new NextRequest(`http://localhost:3000/api/stores/${first.id}/registers`,{method:'POST',headers:{cookie:'pos_session='+f.token,origin:'http://localhost:3000','content-type':'application/json'},body:JSON.stringify({name:'HTTP register over quota',code:randomUUID()})}),{params:Promise.resolve({id:first.id})})
  assert.equal(registerDenied.status,409);assert.equal((await registerDenied.json()).error.code,'PLAN_LIMIT_REACHED')
  const candidates=await Promise.all(Array.from({length:3},()=>prisma.user.create({data:{fullName:'Staff quota race',phone:randomUUID(),passwordHash:'not-a-login'}})))
  users.push(...candidates.map(user=>user.id))
  const staffRace=await Promise.allSettled(candidates.map(user=>prisma.organizationUser.create({data:{organizationId:f.org.id,userId:user.id,role:'cashier'}})))
  assert.equal(staffRace.filter(row=>row.status==='fulfilled').length,2)
  assert.equal(await prisma.organizationUser.count({where:{organizationId:f.org.id}}),3)
  await prisma.store.update({ where: { id: first.id }, data: { isActive: false } })
  await assert.rejects(prisma.store.create({ data: { organizationId: f.org.id, name: 'Archived quota bypass' } }))
  const denied = await createStoreAPI(new NextRequest('http://localhost:3000/api/stores',{method:'POST',headers:{cookie:'pos_session='+f.token,origin:'http://localhost:3000','content-type':'application/json'},body:JSON.stringify({organizationId:f.org.id,name:'HTTP quota bypass'})}),undefined)
  assert.equal(denied.status,409);assert.equal((await denied.json()).error.code,'PLAN_LIMIT_REACHED')
  assert.equal((await billingStatus(f.context)).newSalesAllowed, true)
})
test('Payment proof cannot commit without settlement; late audit failure rolls back paid invoice, period and proof together', async () => {
  const f=await fixture(), foreign=await fixture()
  await prisma.platformOperator.create({data:{userId:f.user.id,role:'platform_admin'}})
  const invoice=await createInvoice(f.context,await invoiceInput())
  await assert.rejects(prisma.billingInvoice.update({where:{id:invoice.id},data:{state:'paid'}}))
  await assert.rejects(prisma.billingPayment.create({data:{organizationId:f.org.id,invoiceId:invoice.id,amount:invoice.amount,currency:'UZS',channel:'manual_bank',proofHash:'a'.repeat(64),confirmedBy:f.user.id,reason:'Raw orphan proof forbidden'}}))
  const input={operationId:randomUUID(),billingInvoiceId:invoice.id,proofReference:'PROOF-'+randomUUID(),reason:'Manual original bank statement checked'}
  const functionName='billing_payment_fault_'+randomUUID().replaceAll('-','')
  await prisma.$executeRawUnsafe(`CREATE FUNCTION ${functionName}() RETURNS trigger LANGUAGE plpgsql AS $$ BEGIN RAISE EXCEPTION 'Billing payment audit fault';END $$`)
  try{
    await prisma.$executeRawUnsafe(`CREATE TRIGGER ${functionName} BEFORE INSERT ON "AuditLog" FOR EACH ROW WHEN (NEW."organizationId"='${f.org.id}' AND NEW.action='billing_payment_confirmed') EXECUTE FUNCTION ${functionName}()`)
    await assert.rejects(confirmBillingPayment(f.context,input))
    assert.equal(await prisma.billingPayment.count({where:{invoiceId:invoice.id}}),0)
    assert.equal((await prisma.billingInvoice.findUniqueOrThrow({where:{id:invoice.id}})).state,'open')
    assert.equal((await prisma.organizationSubscription.findUniqueOrThrow({where:{organizationId:f.org.id}})).paidThrough,null)
    assert.equal(await prisma.operation.count({where:{organizationId:f.org.id,type:'billing.payment.confirm'}}),0)
  }finally{
    await prisma.$executeRawUnsafe(`DROP TRIGGER IF EXISTS ${functionName} ON "AuditLog"`)
    await prisma.$executeRawUnsafe(`DROP FUNCTION ${functionName}()`)
  }
  await confirmBillingPayment(f.context,input)
  const other=await createInvoice(foreign.context,await invoiceInput())
  await assert.rejects(confirmBillingPayment(f.context,{...input,operationId:randomUUID(),billingInvoiceId:other.id}),{code:'BILLING_PROOF_REUSED'})
  assert.equal((await prisma.billingInvoice.findUniqueOrThrow({where:{id:other.id}})).state,'open')
  assert.equal((await listInvoices(foreign.context,1)).rows.length,1)
  assert.equal((await listInvoices(foreign.context,1)).rows[0].payment,null)
})
test('Expired trial denies new sale/object, preserves reads and restores paid entitlement atomically without POS cash postings', async () => {
  const f = await fixture(true), foreign = await fixture()
  assert.equal((await billingStatus(f.context)).state, 'legacy_unmanaged')
  const store = await prisma.store.create({ data: { organizationId: f.org.id, name: 'Existing data retained' } })
  const register = await prisma.register.create({ data: { storeId: store.id, name: 'Existing terminal', code: 'BILLING' } })
  const shift = await prisma.shift.create({ data: { registerId: register.id, organizationUserId: f.context.organizationUserId, openingCash: 0 } })
  const retained=await prisma.product.create({data:{organizationId:f.org.id,name:'Export after expiry',sku:randomUUID(),barcode:randomUUID(),unit:'dona',salePrice:'10',costPrice:'3'}})
  await prisma.organizationSubscription.create({ data: { organizationId: f.org.id, planVersionId: 'initial-pro-v1',
    trialStartedAt: new Date(Date.now() - 30 * 86400000), trialEndsAt: new Date(Date.now() - 8 * 86400000) } })
  const expired = await billingStatus(f.context)
  assert.equal(expired.state, 'expired'); assert.equal(expired.newSalesAllowed, false)
  const exported=await productsAPI(new NextRequest(`http://localhost:3000/api/products?organizationId=${f.org.id}&format=csv`,{headers:{cookie:'pos_session='+f.token}}),undefined)
  assert.equal(exported.status,200);assert.ok(JSON.stringify(await exported.json()).includes(retained.name))
  await assert.rejects(prisma.store.create({ data: { organizationId: f.org.id, name: 'Denied new branch' } }), error => billingDatabaseError(error)?.code === 'SUBSCRIPTION_EXPIRED')
  await assert.rejects(prisma.sale.create({ data: { organizationId: f.org.id, storeId: store.id, registerId: register.id, shiftId: shift.id, receiptNo: randomUUID(), cashierId: f.user.id, subtotal: 0, totalAmount: 0 } }), error => billingDatabaseError(error)?.code === 'SUBSCRIPTION_EXPIRED')
  const input = await invoiceInput()
  const [a,b] = await Promise.all([createInvoice(f.context, input), createInvoice(f.context, input)])
  assert.equal(a.id,b.id); assert.equal(await prisma.billingInvoice.count({ where: { organizationId: f.org.id } }),1)
  assert.equal(a.amount.toString(),'99000')
  await assert.rejects(createInvoice(f.context,await invoiceInput('pro')),{code:'BILLING_INVOICE_OPEN'})
  await assert.rejects(cancelInvoice(foreign.context,a.id,{operationId:randomUUID(),reason:'Foreign invoice cancellation'}),{code:'NOT_FOUND'})
  await assert.rejects(prisma.organizationSubscription.update({where:{organizationId:f.org.id},data:{paidThrough:new Date(Date.now()+86400000)}}))
  await prisma.platformOperator.create({data:{userId:f.user.id,role:'platform_admin'}})
  const payment = {operationId:randomUUID(),billingInvoiceId:a.id,proofReference:'MANUAL-TEST-'+randomUUID(),reason:'Operator verified original bank statement, test only'}
  const [paid,replayed] = await Promise.all([confirmBillingPayment(f.context,payment),confirmBillingPayment(f.context,payment)])
  assert.equal(paid.id,replayed.id)
  assert.equal(await prisma.billingPayment.count({where:{organizationId:f.org.id}}),1)
  assert.equal((await billingStatus(f.context)).state,'active')
  assert.equal((await billingStatus(f.context)).subscription!.planVersion.code,'start')
  assert.equal(await prisma.payment.count({where:{organizationId:f.org.id}}),0)
  assert.equal(await prisma.cashMovement.count({where:{shift:{register:{store:{organizationId:f.org.id}}}}}),0)
  assert.equal((await listInvoices(f.context,1)).rows[0].payment!.channel,'manual_bank')
  await assert.rejects(confirmBillingPayment(f.context,{...payment,operationId:randomUUID()}),{code:'BILLING_INVOICE_FINAL'})
  await assert.rejects(cancelInvoice(f.context,a.id,{operationId:randomUUID(),reason:'Paid invoice cannot cancel'}),{code:'BILLING_INVOICE_FINAL'})
  await assert.rejects(prisma.billingPayment.update({where:{id:paid.id},data:{reason:'Modified proof'}}))
  const cancel={operationId:randomUUID(),cancelAtPeriodEnd:true,reason:'Owner stops manual renewal after current paid period'}
  await cancelSubscription(f.context,cancel);await cancelSubscription(f.context,cancel)
  assert.equal((await billingStatus(f.context)).newSalesAllowed,true)
  assert.equal((await billingStatus(f.context)).subscription!.cancelAtPeriodEnd,true)
  const renewal=await createInvoice(f.context,await invoiceInput())
  assert.equal(new Date(renewal.periodStart).getTime(),new Date(paid.paidThrough).getTime())
  await assert.rejects(confirmBillingPayment(f.context,{...payment,operationId:randomUUID(),billingInvoiceId:renewal.id}),{code:'BILLING_PROOF_REUSED'})
  const cancelled=await cancelInvoice(f.context,renewal.id,{operationId:randomUUID(),reason:'No payment; cancel pending renewal'})
  assert.equal(cancelled.state,'cancelled')
  assert.equal(await prisma.store.count({where:{organizationId:f.org.id}}),1)
})
test('Plan publishing requires platform admin and rolls back immutable version/current pointer/Operation on audit failure', async () => {
  const f = await fixture()
  const input = { operationId: randomUUID(), code: 'start', name: 'Start', monthlyPrice: '99000.00', currency: 'UZS' as const,
    branchLimit: 1, registerLimit: 1, staffLimit: 3, trialDays: 14, graceDays: 7, reason: 'Version publication rollback acceptance' }
  await assert.rejects(publishPlan(f.context, input), { code: 'PLATFORM_ADMIN_REQUIRED' })
  await prisma.platformOperator.create({ data: { userId: f.user.id, role: 'platform_admin' } })
  const previous = await prisma.billingPlan.findUniqueOrThrow({ where: { code: 'start' } })
  const originalQuote = await invoiceInput()
  const functionName = 'billing_fault_' + randomUUID().replaceAll('-', '')
  await prisma.$executeRawUnsafe(`CREATE FUNCTION ${functionName}() RETURNS trigger LANGUAGE plpgsql AS $$ BEGIN RAISE EXCEPTION 'Billing audit fault';END $$`)
  try {
    await prisma.$executeRawUnsafe(`CREATE TRIGGER ${functionName} BEFORE INSERT ON "AuditLog" FOR EACH ROW WHEN (NEW."organizationId"='${f.org.id}' AND NEW.action='billing_plan_published') EXECUTE FUNCTION ${functionName}()`)
    await assert.rejects(publishPlan(f.context, input))
    assert.equal((await prisma.billingPlan.findUniqueOrThrow({ where: { code: 'start' } })).currentVersionId, previous.currentVersionId)
    assert.equal(await prisma.billingPlanVersion.count({ where: { createdBy: f.user.id } }), 0)
    assert.equal(await prisma.operation.count({ where: { organizationId: f.org.id, type: 'billing.plan.publish' } }), 0)
    await assert.rejects(prisma.billingPlanVersion.update({ where: { id: previous.currentVersionId }, data: { monthlyPrice: '1' } }))
  } finally {
    await prisma.$executeRawUnsafe(`DROP TRIGGER IF EXISTS ${functionName} ON "AuditLog"`)
    await prisma.$executeRawUnsafe(`DROP FUNCTION ${functionName}()`)
  }
  const [published,replayed] = await Promise.all([publishPlan(f.context,input),publishPlan(f.context,input)])
  assert.equal(published.id,replayed.id)
  assert.equal(await prisma.billingPlanVersion.count({where:{createdBy:f.user.id}}),1)
  assert.equal((await prisma.billingPlan.findUniqueOrThrow({where:{code:'start'}})).currentVersionId,published.id)
  assert.equal((await prisma.billingPlanVersion.findUniqueOrThrow({where:{id:previous.currentVersionId}})).monthlyPrice.toString(),'99000')
  assert.equal(await prisma.auditLog.count({where:{organizationId:f.org.id,action:'billing_plan_published'}}),1)
  await assert.rejects(createInvoice(f.context,originalQuote),{code:'BILLING_PLAN_CHANGED'})
  assert.equal(await prisma.billingInvoice.count({where:{organizationId:f.org.id}}),0)
  const fresh=await createInvoice(f.context,await invoiceInput())
  assert.equal(fresh.planVersionId,published.id)
  await prisma.platformOperator.update({where:{userId:f.user.id},data:{isActive:false}})
  await assert.rejects(publishPlan(f.context,input),{code:'PLATFORM_ADMIN_REQUIRED'})
})
