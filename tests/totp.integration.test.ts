import { test, after } from 'node:test'
import assert from 'node:assert/strict'
import { createHash, randomUUID, randomBytes } from 'node:crypto'
import { URI, TOTP } from 'otpauth'
import bcrypt from 'bcryptjs'
import { NextRequest } from 'next/server'
import { GET as totpGET } from '@/app/api/auth/totp/route'
import { POST as totpEnrollPOST } from '@/app/api/auth/totp/enroll/route'
import { POST as totpConfirmPOST } from '@/app/api/auth/totp/confirm/route'
import { POST as totpProofPOST } from '@/app/api/auth/totp/proof/route'
import { POST as totpRecoverPOST } from '@/app/api/auth/totp/recover/route'
import { prisma } from '@/lib/prisma'
import { hashPassword } from '@/lib/auth'
import { sessionHash, verifySession } from '@/server/auth/session'
import { assertStepUp } from '@/server/auth/challenges'
import { runOperation, payloadHash, audit } from '@/server/operations'
import {CRITICAL_ACTIONS} from '@/server/auth/critical-actions'
import {assignPlan} from '@/server/billing/service'
import {platformOverview,platformOverviewSchema} from '@/server/platform/overview'
import {POST as platformOverviewPOST} from '@/app/api/platform/overview/route'
import {updateMember,transferOwnership,respondOwnership} from '@/server/users/service'
import {createSession} from '@/server/auth/session'
import {createInvitation} from '@/server/users/invitations'
import {POST as createStaffPOST} from '@/app/api/organizations/[id]/users/route'
import {POST as changePasswordPOST} from '@/app/api/auth/change-password/route'
import { beginTotpEnrollment, confirmTotpEnrollment, createTotpProof, assertTotpStepUp, recoverTotpFactor, rotateTotpRecoveryCodes, totpStatus } from '@/server/auth/totp-service'
const connection = new URL(process.env.DATABASE_URL ?? '')
if (connection.hostname !== '127.0.0.1' || connection.port !== '55439' || connection.pathname !== '/pos_test') throw new Error('Isolated DB only')
const organizations: string[] = [], users: string[] = [], password = 'test-only-password', oldKey = process.env.AUTH_CHALLENGE_SECRET
process.env.AUTH_CHALLENGE_SECRET = 'c'.repeat(64)
after(async () => {
  await prisma.organization.deleteMany({ where: { id: { in: organizations } } })
  await prisma.user.deleteMany({ where: { id: { in: users } } }); await prisma.$disconnect()
  if (oldKey === undefined) delete process.env.AUTH_CHALLENGE_SECRET
  else process.env.AUTH_CHALLENGE_SECRET = oldKey
})
async function fixture() {
  const org = await prisma.organization.create({ data: { name: 'TOTP isolated', phone: randomUUID() } }); organizations.push(org.id)
  const user = await prisma.user.create({ data: { fullName: 'TOTP owner', phone: randomUUID(), passwordHash: await hashPassword(password) } }); users.push(user.id)
  await prisma.organizationUser.create({ data: { organizationId: org.id, userId: user.id, role: 'owner' } })
  const token = randomBytes(32).toString('base64url')
  await prisma.session.create({ data: { userId: user.id, organizationId: org.id, tokenHash: sessionHash(token), expiresAt: new Date(Date.now() + 3600000), idleExpiresAt: new Date(Date.now() + 3600000) } })
  const ctx = (await verifySession(token))!
  return { ctx, user, org, token }
}
async function enrolled() {
  const f = await fixture(), start = await beginTotpEnrollment(f.ctx, { password }), totp = URI.parse(start.provisioningUri) as TOTP
  const confirmation = await confirmTotpEnrollment(f.ctx, { factorId: start.factorId, code: totp.generate({ timestamp: Date.now() - 30000 }) })
  return { ...f, start, totp, recoveryCodes: confirmation.recoveryCodes }
}
test('Central critical-action policy fails closed before writes/replay even when authenticator availability is off', async () => {
 const f = await fixture(), original = process.env.AUTH_CRITICAL_MFA_REQUIRED, totp = process.env.AUTH_TOTP_ENABLED
 try {
  process.env.AUTH_CRITICAL_MFA_REQUIRED = 'true'; delete process.env.AUTH_TOTP_ENABLED
  for (const action of CRITICAL_ACTIONS) {
   const key = randomUUID(), body = {operationId:key, name:'critical guarded'}
   await assert.rejects(runOperation(f.ctx, action, key, body, async tx => tx.category.create({data:{organizationId:f.org.id,name:body.name}})), (error: unknown) => {
    const failure = error as {code:string;details:unknown}
    assert.equal(failure.code, 'STEP_UP_REQUIRED'); assert.deepEqual(failure.details, {action,operationKey:key,payloadHash:payloadHash(body)}); return true
   })
  }
  assert.equal(await prisma.category.count({where:{organizationId:f.org.id}}),0)
  assert.equal(await prisma.operation.count({where:{organizationId:f.org.id}}),0)
  process.env.AUTH_CRITICAL_MFA_REQUIRED='TRUE'
  await assert.rejects(runOperation(f.ctx,'retention.closure.request',randomUUID(),{},async()=>({unsafe:true})),{code:'TOTP_UNAVAILABLE'})
 } finally {
  if(original===undefined)delete process.env.AUTH_CRITICAL_MFA_REQUIRED;else process.env.AUTH_CRITICAL_MFA_REQUIRED=original
  if(totp===undefined)delete process.env.AUTH_TOTP_ENABLED;else process.env.AUTH_TOTP_ENABLED=totp
 }
})
test('Central MFA binds critical execution and replay to the approved payload and preserves late failure rollback', async () => {
 const f = await enrolled(), original = process.env.AUTH_CRITICAL_MFA_REQUIRED, flag = process.env.AUTH_TOTP_ENABLED
 const action = 'retention.closure.request', key=randomUUID(), body={operationId:key,name:'critical rollback'}, hash=payloadHash(body)
 try {
  process.env.AUTH_CRITICAL_MFA_REQUIRED='true';process.env.AUTH_TOTP_ENABLED='true'
  await createTotpProof(f.ctx,{code:f.totp.generate(),action,operationKey:key,payloadHash:hash})
  await assert.rejects(runOperation(f.ctx,action,key,body,async tx=>{await tx.category.create({data:{organizationId:f.org.id,name:body.name}});throw new Error('isolated late failure')}))
  assert.equal(await prisma.category.count({where:{organizationId:f.org.id}}),0)
  assert.equal((await prisma.totpProof.findFirstOrThrow({where:{userId:f.user.id}})).approvedOperationAt,null)
  const work=(tx:Parameters<Parameters<typeof runOperation>[4]>[0])=>tx.category.create({data:{organizationId:f.org.id,name:body.name}})
  const created=await runOperation(f.ctx,action,key,body,work)
  assert.equal((await runOperation(f.ctx,action,key,body,work)).id,created.id)
  await assert.rejects(runOperation(f.ctx,action,key,{...body,name:'changed'},work),{code:'STEP_UP_REQUIRED'})
  delete process.env.AUTH_TOTP_ENABLED
  await assert.rejects(runOperation(f.ctx,action,key,body,work),{code:'STEP_UP_REQUIRED'})
  assert.equal(await prisma.category.count({where:{organizationId:f.org.id}}),1)
  assert.equal(await prisma.operation.count({where:{organizationId:f.org.id}}),1)
 } finally {
  if(original===undefined)delete process.env.AUTH_CRITICAL_MFA_REQUIRED;else process.env.AUTH_CRITICAL_MFA_REQUIRED=original
  if(flag===undefined)delete process.env.AUTH_TOTP_ENABLED;else process.env.AUTH_TOTP_ENABLED=flag
 }
})
test('A valid MFA proof never grants platform privileges; revoked platform access denies a stored-result replay', async () => {
 const f=await enrolled(), previous=process.env.AUTH_CRITICAL_MFA_REQUIRED, flag=process.env.AUTH_TOTP_ENABLED
 const command={operationId:randomUUID(),targetOrganizationId:f.org.id,planCode:'pro',reason:'Isolated platform MFA assignment'}
 try {
  process.env.AUTH_CRITICAL_MFA_REQUIRED='true';process.env.AUTH_TOTP_ENABLED='true'
  await createTotpProof(f.ctx,{code:f.totp.generate(),action:'billing.plan.assign',operationKey:command.operationId,payloadHash:payloadHash(command)})
  await assert.rejects(assignPlan(f.ctx,command),{code:'PLATFORM_ADMIN_REQUIRED'})
  assert.equal(await prisma.operation.count({where:{organizationId:f.org.id}}),0)
  assert.equal((await prisma.totpProof.findFirstOrThrow({where:{userId:f.user.id}})).approvedOperationAt,null)
  await prisma.platformOperator.create({data:{userId:f.user.id,role:'platform_admin'}})
  const result=await assignPlan(f.ctx,command)
  assert.equal((await assignPlan(f.ctx,command)).planVersionId,result.planVersionId)
  await prisma.platformOperator.update({where:{userId:f.user.id},data:{isActive:false}})
  await assert.rejects(assignPlan(f.ctx,command),{code:'PLATFORM_ADMIN_REQUIRED'})
  assert.equal(await prisma.operation.count({where:{organizationId:f.org.id,type:'billing.plan.assign'}}),1)
 } finally {
  if(previous===undefined)delete process.env.AUTH_CRITICAL_MFA_REQUIRED;else process.env.AUTH_CRITICAL_MFA_REQUIRED=previous
  if(flag===undefined)delete process.env.AUTH_TOTP_ENABLED;else process.env.AUTH_TOTP_ENABLED=flag
 }
})
test('Platform overview requires independent live admin and MFA, paginates safe tenant metadata and audits reads without storing cross-tenant results',async()=>{
 const f=await enrolled(),foreign=await fixture(),group='platform-safe-'+randomUUID(),flag=process.env.AUTH_TOTP_ENABLED,origin=process.env.APP_ORIGIN
 const command={operationId:randomUUID(),page:1,search:group},hash=payloadHash(platformOverviewSchema.parse(command))
 try{
  process.env.AUTH_TOTP_ENABLED='true';delete process.env.APP_ORIGIN
  await prisma.organization.update({where:{id:f.org.id},data:{name:group+' A'}})
  await prisma.organization.update({where:{id:foreign.org.id},data:{name:group+' B'}})
  await prisma.user.update({where:{id:foreign.user.id},data:{email:'private-'+randomUUID()+'@example.invalid'}})
  await prisma.incident.create({data:{organizationId:foreign.org.id,kind:'inventory',entityKey:randomUUID(),severity:'critical',evidence:{privateContact:'do-not-disclose-platform-evidence'}}})
  for(let index=0;index<21;index++){const extra=await prisma.organization.create({data:{name:group+' C'+String(index).padStart(2,'0'),phone:randomUUID()}});organizations.push(extra.id)}
  await assert.rejects(platformOverview(f.ctx,command),{code:'PLATFORM_ADMIN_REQUIRED'})
  await prisma.platformOperator.create({data:{userId:f.user.id,role:'platform_admin'}})
  await assert.rejects(platformOverview(f.ctx,command),{code:'STEP_UP_REQUIRED'})
  await createTotpProof(f.ctx,{code:f.totp.generate(),action:'platform.overview',operationKey:command.operationId,payloadHash:hash})
  const result=await platformOverview(f.ctx,command)
  assert.equal(result.total,23);assert.equal(result.organizations.length,20);assert.equal(result.organizations[1].id,foreign.org.id)
  assert.equal(result.health.database,'reachable');assert.ok(result.plans.length>=3)
  assert.equal(result.integrations.realPaymentAvailable,false)
  const encoded=JSON.stringify(result)
  for(const secret of ['do-not-disclose-platform-evidence',foreign.user.phone,foreign.user.passwordHash,f.recoveryCodes[0]])assert.ok(!encoded.includes(secret))
  assert.equal(await prisma.operation.count({where:{organizationId:f.org.id}}),0)
  assert.equal(await prisma.auditLog.count({where:{organizationId:f.org.id,entityType:'PlatformOverview',entityId:command.operationId}}),1)
  const request=new NextRequest('http://localhost:3000/api/platform/overview',{method:'POST',headers:{cookie:'pos_session='+f.token,origin:'http://localhost:3000','content-type':'application/json'},body:JSON.stringify(command)})
  const response=await platformOverviewPOST(request,undefined)
  assert.equal(response.status,200);assert.equal(response.headers.get('cache-control'),'private, no-store')
  const emptyCommand={...command,operationId:randomUUID(),page:3}
  await createTotpProof(f.ctx,{code:f.totp.generate({timestamp:Date.now()+30000}),action:'platform.overview',operationKey:emptyCommand.operationId,payloadHash:payloadHash(platformOverviewSchema.parse(emptyCommand))})
  const empty=await platformOverview(f.ctx,emptyCommand)
  assert.equal(empty.total,23);assert.equal(empty.organizations.length,0);assert.equal(empty.page,3)
  await assert.rejects(platformOverview(f.ctx,{...command,search:'changed'}),{code:'STEP_UP_REQUIRED'})
  await prisma.platformOperator.update({where:{userId:f.user.id},data:{isActive:false}})
  await assert.rejects(platformOverview(f.ctx,command),{code:'PLATFORM_ADMIN_REQUIRED'})
 }finally{
  if(flag===undefined)delete process.env.AUTH_TOTP_ENABLED;else process.env.AUTH_TOTP_ENABLED=flag
  if(origin===undefined)delete process.env.APP_ORIGIN;else process.env.APP_ORIGIN=origin
 }
})
test('TOTP enrollment requires live session and fresh password; secrets never enter audit', async () => {
  const f = await fixture()
  await assert.rejects(beginTotpEnrollment(f.ctx, { password: 'wrong' }), { code: 'REAUTHENTICATION_FAILED' })
  assert.equal(await prisma.totpFactor.count({ where: { userId: f.user.id } }), 0)
  const start = await beginTotpEnrollment(f.ctx, { password }), secret = (URI.parse(start.provisioningUri) as TOTP).secret.base32
  const row = await prisma.totpFactor.findUniqueOrThrow({ where: { id: start.factorId } })
  assert.ok(!row.sealedSecret!.includes(secret)); assert.equal(row.confirmedAt, null)
  const history = JSON.stringify(await prisma.auditLog.findMany({ where: { organizationId: f.org.id } }))
  assert.ok(!history.includes(secret)); assert.ok(!history.includes(start.provisioningUri)); assert.ok(!history.includes(password))
  await prisma.session.update({ where: { id: f.ctx.sessionId }, data: { revokedAt: new Date() } })
  await assert.rejects(beginTotpEnrollment(f.ctx, { password }), { code: 'SESSION_CHANGED' })
})
test('Five incorrect enrollment attempts commit and revoke the pending secret; foreign identity cannot confirm', async () => {
  const f = await fixture(), foreign = await fixture(), start = await beginTotpEnrollment(f.ctx, { password }), totp = URI.parse(start.provisioningUri) as TOTP
  await assert.rejects(confirmTotpEnrollment(foreign.ctx, { factorId: start.factorId, code: totp.generate() }), { code: 'TOTP_CODE_INVALID' })
  const possible = new Set([-1,0,1].map(delta => totp.generate({ timestamp: Date.now() + delta * 30000 })))
  const wrong = ['000000','000001','000002','000003'].find(code => !possible.has(code))!
  for (let i = 0; i < 5; i++) await assert.rejects(confirmTotpEnrollment(f.ctx, { factorId: start.factorId, code: wrong }), { code: 'TOTP_CODE_INVALID' })
  const row = await prisma.totpFactor.findUniqueOrThrow({ where: { id: start.factorId } })
  assert.equal(row.attempts, 5); assert.ok(row.revokedAt); assert.equal(row.sealedSecret, null)
  await assert.rejects(confirmTotpEnrollment(f.ctx, { factorId: start.factorId, code: totp.generate() }), { code: 'TOTP_CODE_INVALID' })
})
test('Concurrent TOTP validation accepts one proof; action/key/hash/session binding and counter replay are enforced', async () => {
  const f = await enrolled(), operationKey = randomUUID(), payloadHash = createHash('sha256').update('reviewed payload').digest('hex'), action = 'test.critical'
  const input = { code: f.totp.generate(), action, operationKey, payloadHash }
  const results = await Promise.allSettled([createTotpProof(f.ctx, input), createTotpProof(f.ctx, input)])
  assert.equal(results.filter(r => r.status === 'fulfilled').length, 1)
  assert.equal(await prisma.totpProof.count({ where: { userId: f.user.id } }), 1)
  await prisma.$transaction(tx => assertTotpStepUp(tx, f.ctx, action, operationKey, payloadHash))
  await prisma.$transaction(tx => assertTotpStepUp(tx, f.ctx, action, operationKey, payloadHash))
  for (const [a,k,h] of [['test.other',operationKey,payloadHash],[action,randomUUID(),payloadHash],[action,operationKey,'0'.repeat(64)]]) await assert.rejects(prisma.$transaction(tx => assertTotpStepUp(tx, f.ctx, a,k,h)), { code: 'STEP_UP_REQUIRED' })
  const foreign = await fixture()
  await assert.rejects(prisma.$transaction(tx => assertTotpStepUp(tx, foreign.ctx, action, operationKey, payloadHash)), { code: 'STEP_UP_REQUIRED' })
  const row = await prisma.totpFactor.findUniqueOrThrow({ where: { id: f.start.factorId } })
  await assert.rejects(prisma.totpFactor.update({ where: { id: row.id }, data: { lastCounter: row.lastCounter! - BigInt(1) } }))
  await prisma.user.update({ where: { id: f.user.id }, data: { passwordHash: await hashPassword('changed-test-password') } })
  await assert.rejects(prisma.$transaction(tx => assertTotpStepUp(tx, f.ctx, action, operationKey, payloadHash)), { code: 'STEP_UP_REQUIRED' })
})
test('Late audit failure rolls back enrollment confirmation and consumed counter/proof together', async () => {
  const f = await fixture(), start = await beginTotpEnrollment(f.ctx, { password }), totp = URI.parse(start.provisioningUri) as TOTP
  const trigger = 'totp_audit_fault_' + randomUUID().replaceAll('-', '')
  await prisma.$executeRawUnsafe(`CREATE FUNCTION ${trigger}() RETURNS trigger LANGUAGE plpgsql AS $$ BEGIN IF NEW."entityType" IN ('TotpFactor','TotpProof') THEN RAISE EXCEPTION 'isolated audit fault'; END IF; RETURN NEW; END $$`)
  await prisma.$executeRawUnsafe(`CREATE TRIGGER ${trigger} BEFORE INSERT ON "AuditLog" FOR EACH ROW EXECUTE FUNCTION ${trigger}()`)
  try {
    await assert.rejects(confirmTotpEnrollment(f.ctx, { factorId: start.factorId, code: totp.generate({ timestamp: Date.now() - 30000 }) }))
    const row = await prisma.totpFactor.findUniqueOrThrow({ where: { id: start.factorId } })
    assert.equal(row.confirmedAt, null); assert.equal(row.lastCounter, null)
  } finally { await prisma.$executeRawUnsafe(`DROP TRIGGER ${trigger} ON "AuditLog"`); await prisma.$executeRawUnsafe(`DROP FUNCTION ${trigger}()` ) }
  await confirmTotpEnrollment(f.ctx, { factorId: start.factorId, code: totp.generate({ timestamp: Date.now() - 30000 }) })
  const before = await prisma.totpFactor.findUniqueOrThrow({ where: { id: start.factorId } })
  await prisma.$executeRawUnsafe(`CREATE FUNCTION ${trigger}() RETURNS trigger LANGUAGE plpgsql AS $$ BEGIN IF NEW."entityType"='TotpProof' THEN RAISE EXCEPTION 'isolated audit fault'; END IF; RETURN NEW; END $$`)
  await prisma.$executeRawUnsafe(`CREATE TRIGGER ${trigger} BEFORE INSERT ON "AuditLog" FOR EACH ROW EXECUTE FUNCTION ${trigger}()`)
  const input = { action: 'test.critical', operationKey: randomUUID(), payloadHash: '0'.repeat(64), code: totp.generate() }
  try {
    await assert.rejects(createTotpProof(f.ctx, input))
    assert.equal(await prisma.totpProof.count({ where: { userId: f.user.id } }), 0)
    assert.equal((await prisma.totpFactor.findUniqueOrThrow({ where: { id: start.factorId } })).lastCounter, before.lastCounter)
  } finally { await prisma.$executeRawUnsafe(`DROP TRIGGER ${trigger} ON "AuditLog"`); await prisma.$executeRawUnsafe(`DROP FUNCTION ${trigger}()` ) }
  await createTotpProof(f.ctx, input)
  assert.equal(await prisma.totpProof.count({ where: { userId: f.user.id } }), 1)
})
test('An actual cashier PIN session cannot enroll a factor, and a second password session cannot confirm the first enrollment', async () => {
  const f = await fixture(), start = await beginTotpEnrollment(f.ctx, { password }), totp = URI.parse(start.provisioningUri) as TOTP
  const secondToken = randomBytes(32).toString('base64url')
  await prisma.session.create({ data: { userId: f.user.id, organizationId: f.org.id, tokenHash: sessionHash(secondToken), expiresAt: new Date(Date.now()+3600000), idleExpiresAt: new Date(Date.now()+3600000) } })
  const second = (await verifySession(secondToken))!
  await assert.rejects(confirmTotpEnrollment(second, { factorId: start.factorId, code: totp.generate() }), { code: 'TOTP_CODE_INVALID' })
  const store = await prisma.store.create({ data: { organizationId: f.org.id, name: 'PIN branch' } })
  const cashier = await prisma.user.create({ data: { fullName: 'PIN cashier', phone: randomUUID(), passwordHash: await hashPassword(password) } }); users.push(cashier.id)
  await prisma.organizationUser.create({ data: { organizationId: f.org.id, userId: cashier.id, role: 'cashier', pinHash: await bcrypt.hash('123456', 12), userStores: { create: { storeId: store.id } } } })
  const pinToken = randomBytes(32).toString('base64url')
  await prisma.session.create({ data: { userId: cashier.id, organizationId: f.org.id, authenticationMethod: 'pin', pinStoreId: store.id, tokenHash: sessionHash(pinToken), expiresAt: new Date(Date.now()+3600000), idleExpiresAt: new Date(Date.now()+3600000) } })
  const pin = (await verifySession(pinToken))!; assert.ok(pin)
  await assert.rejects(beginTotpEnrollment(pin, { password }), { code: 'PASSWORD_SESSION_REQUIRED' })
  assert.equal(await prisma.totpFactor.count({ where: { userId: cashier.id } }), 0)
})
test('Revoking a factor invalidates unconsumed proofs in both service and direct DB approval', async () => {
  const f = await enrolled(), input = { code: f.totp.generate(), action: 'test.critical', operationKey: randomUUID(), payloadHash: '0'.repeat(64) }
  const proof = await createTotpProof(f.ctx, input)
  await prisma.totpFactor.update({ where: { id: f.start.factorId }, data: { revokedAt: new Date(), sealedSecret: null } })
  await assert.rejects(prisma.$transaction(tx => assertTotpStepUp(tx, f.ctx, input.action, input.operationKey, input.payloadHash)), { code: 'STEP_UP_REQUIRED' })
  await assert.rejects(prisma.totpProof.update({ where: { id: proof.proofId }, data: { approvedOperationAt: new Date() } }))
  assert.equal((await prisma.totpProof.findUniqueOrThrow({ where: { id: proof.proofId } })).approvedOperationAt, null)
})
test('Recovery codes are hashed, own-account and one-use; recovery revokes the factor and all password/PIN sessions', async () => {
  const f = await enrolled(), foreign = await fixture()
  assert.equal(f.recoveryCodes.length, 10); assert.equal(new Set(f.recoveryCodes).size, 10)
  const rows = await prisma.totpRecoveryCode.findMany({ where: { factorId: f.start.factorId } })
  assert.equal(rows.length, 10)
  const stored = JSON.stringify(rows), history = JSON.stringify(await prisma.auditLog.findMany({ where: { organizationId: f.org.id } }))
  for (const code of f.recoveryCodes) { assert.match(code, /^[0-9a-f]{32}$/); assert.ok(!stored.includes(code)); assert.ok(!history.includes(code)) }
  const input = { password, factorId: f.start.factorId, recoveryCode: f.recoveryCodes[0] }
  await assert.rejects(recoverTotpFactor(foreign.ctx, input), { code: 'TOTP_RECOVERY_INVALID' })
  await assert.rejects(recoverTotpFactor(f.ctx, { ...input, password: 'wrong-password' }), { code: 'REAUTHENTICATION_FAILED' })
  await assert.rejects(recoverTotpFactor(f.ctx, { ...input, recoveryCode: '0'.repeat(32) }), { code: 'TOTP_RECOVERY_INVALID' })
  assert.deepEqual(await recoverTotpFactor(f.ctx, input), { recovered: true, loginRequired: true })
  assert.equal(await prisma.session.count({ where: { userId: f.user.id, revokedAt: null } }), 0)
  assert.equal(await prisma.totpRecoveryCode.count({ where: { factorId: f.start.factorId, usedAt: { not: null } } }), 1)
  const factor = await prisma.totpFactor.findUniqueOrThrow({ where: { id: f.start.factorId } }); assert.ok(factor.revokedAt); assert.equal(factor.sealedSecret, null)
  await assert.rejects(recoverTotpFactor(f.ctx, input), { code: 'SESSION_CHANGED' })
  await assert.rejects(prisma.totpRecoveryCode.update({ where: { id: rows[0].id }, data: { secretHash: 'f'.repeat(64) } }))
})
test('Recovery audit failure rolls back code consumption, factor revocation and all-session logout', async () => {
  const f = await enrolled(), trigger = 'totp_recovery_fault_' + randomUUID().replaceAll('-', '')
  await prisma.$executeRawUnsafe(`CREATE FUNCTION ${trigger}() RETURNS trigger LANGUAGE plpgsql AS $$ BEGIN IF NEW.action='factor_recovered' THEN RAISE EXCEPTION 'isolated recovery audit fault'; END IF; RETURN NEW; END $$`)
  await prisma.$executeRawUnsafe(`CREATE TRIGGER ${trigger} BEFORE INSERT ON "AuditLog" FOR EACH ROW EXECUTE FUNCTION ${trigger}()`)
  const input = { password, factorId: f.start.factorId, recoveryCode: f.recoveryCodes[0] }
  try {
    await assert.rejects(recoverTotpFactor(f.ctx, input))
    assert.equal(await prisma.totpRecoveryCode.count({ where: { factorId: f.start.factorId, usedAt: { not: null } } }), 0)
    assert.equal((await prisma.totpFactor.findUniqueOrThrow({ where: { id: f.start.factorId } })).revokedAt, null)
    assert.equal(await prisma.session.count({ where: { userId: f.user.id, revokedAt: null } }), 1)
  } finally { await prisma.$executeRawUnsafe(`DROP TRIGGER ${trigger} ON "AuditLog"`); await prisma.$executeRawUnsafe(`DROP FUNCTION ${trigger}()` ) }
  await recoverTotpFactor(f.ctx, input)
})
test('Recovery rotation requires a fresh TOTP counter and password, replaces old codes, and status exposes only safe metadata', async () => {
  const f = await enrolled(), foreign = await fixture()
  const rotationCode = f.totp.generate()
  const rotated = await rotateTotpRecoveryCodes(f.ctx, { password, code: rotationCode })
  assert.equal(rotated.recoveryCodes.length, 10)
  assert.equal(await prisma.totpRecoveryCode.count({ where: { factorId: f.start.factorId, usedAt: null } }), 10)
  assert.equal(await prisma.totpRecoveryCode.count({ where: { factorId: f.start.factorId, usedAt: { not: null } } }), 10)
  await assert.rejects(recoverTotpFactor(f.ctx, { password, factorId: f.start.factorId, recoveryCode: f.recoveryCodes[0] }), { code: 'TOTP_RECOVERY_INVALID' })
  const status = await totpStatus(f.ctx)
  assert.equal(status.enabled, true); assert.equal(status.recoveryCodesRemaining, 10); assert.equal(status.factorId, f.start.factorId)
  assert.equal((await totpStatus(foreign.ctx)).enabled, false)
  const publicMetadata = JSON.stringify(status)
  assert.ok(!publicMetadata.includes(f.totp.secret.base32))
  for (const code of rotated.recoveryCodes) assert.ok(!publicMetadata.includes(code))
  await assert.rejects(rotateTotpRecoveryCodes(f.ctx, { password, code: rotationCode }), { code: 'TOTP_CODE_INVALID' })
  await recoverTotpFactor(f.ctx, { password, factorId: f.start.factorId, recoveryCode: rotated.recoveryCodes[0] })
})
test('Rotation audit failure preserves original backup codes and the unused TOTP counter', async () => {
  const f = await enrolled(), trigger = 'totp_rotation_fault_' + randomUUID().replaceAll('-', '')
  const before = await prisma.totpFactor.findUniqueOrThrow({ where: { id: f.start.factorId } })
  await prisma.$executeRawUnsafe(`CREATE FUNCTION ${trigger}() RETURNS trigger LANGUAGE plpgsql AS $$ BEGIN IF NEW.action='recovery_codes_rotated' THEN RAISE EXCEPTION 'isolated rotation audit fault'; END IF; RETURN NEW; END $$`)
  await prisma.$executeRawUnsafe(`CREATE TRIGGER ${trigger} BEFORE INSERT ON "AuditLog" FOR EACH ROW EXECUTE FUNCTION ${trigger}()`)
  const input = { password, code: f.totp.generate() }
  try {
    await assert.rejects(rotateTotpRecoveryCodes(f.ctx, input))
    assert.equal((await prisma.totpFactor.findUniqueOrThrow({ where: { id: f.start.factorId } })).lastCounter, before.lastCounter)
    assert.equal(await prisma.totpRecoveryCode.count({ where: { factorId: f.start.factorId } }), 10)
    assert.equal(await prisma.totpRecoveryCode.count({ where: { factorId: f.start.factorId, usedAt: { not: null } } }), 0)
  } finally { await prisma.$executeRawUnsafe(`DROP TRIGGER ${trigger} ON "AuditLog"`); await prisma.$executeRawUnsafe(`DROP FUNCTION ${trigger}()` ) }
  await rotateTotpRecoveryCodes(f.ctx, input)
})
test('After a password change, a new password session plus backup code can recover exactly once under concurrency', async () => {
  const f = await enrolled(), newPassword = 'new-test-password'
  await prisma.user.update({ where: { id: f.user.id }, data: { passwordHash: await hashPassword(newPassword) } })
  await prisma.session.updateMany({ where: { userId: f.user.id }, data: { revokedAt: new Date() } })
  const token = randomBytes(32).toString('base64url')
  await prisma.session.create({ data: { userId: f.user.id, organizationId: f.org.id, tokenHash: sessionHash(token), expiresAt: new Date(Date.now()+3600000), idleExpiresAt: new Date(Date.now()+3600000) } })
  const current = (await verifySession(token))!
  assert.equal((await totpStatus(current)).passwordRebindRequired, true)
  const input = { password: newPassword, factorId: f.start.factorId, recoveryCode: f.recoveryCodes[0] }
  const results = await Promise.allSettled([recoverTotpFactor(current, input), recoverTotpFactor(current, input)])
  assert.equal(results.filter(r => r.status === 'fulfilled').length, 1)
  assert.equal(await prisma.totpRecoveryCode.count({ where: { factorId: f.start.factorId, usedAt: { not: null } } }), 1)
  assert.equal(await prisma.session.count({ where: { userId: f.user.id, revokedAt: null } }), 0)
  assert.equal(await prisma.auditLog.count({ where: { organizationId: f.org.id, entityId: f.start.factorId, action: 'factor_recovered' } }), 1)
})
test('HTTP TOTP is opt-in, scoped, no-store and presents only one-time provisioning/recovery DTOs', async () => {
 const f=await fixture(),oldFlag=process.env.AUTH_TOTP_ENABLED,oldOrigin=process.env.APP_ORIGIN,oldEncryptionKey=process.env.AUTH_CHALLENGE_SECRET
 const request=(path:string,body?:unknown,cookie=f.token)=>new NextRequest('http://localhost:3000/api/auth/totp'+path,{method:body===undefined?'GET':'POST',headers:{cookie:'pos_session='+cookie,origin:'http://localhost:3000','content-type':'application/json'},...(body===undefined?{}:{body:JSON.stringify(body)})})
 try {
  delete process.env.APP_ORIGIN;delete process.env.AUTH_TOTP_ENABLED
  const disabled=await totpGET(request(''),undefined);assert.equal(disabled.status,200);assert.deepEqual((await disabled.json()).data,{available:false})
  assert.equal((await totpEnrollPOST(request('/enroll',{password}),undefined)).status,503)
  process.env.AUTH_TOTP_ENABLED='true'
  assert.equal((await totpGET(request('',undefined,''),undefined)).status,401)
  const begin=await totpEnrollPOST(request('/enroll',{password}),undefined);assert.equal(begin.status,200);assert.equal(begin.headers.get('cache-control'),'private, no-store')
  const source=(await begin.json()).data,totp=URI.parse(source.provisioningUri) as TOTP
  const confirm=await totpConfirmPOST(request('/confirm',{factorId:source.factorId,code:totp.generate({timestamp:Date.now()-30000})}),undefined);assert.equal(confirm.status,200)
  const confirmed=(await confirm.json()).data;assert.equal(confirmed.recoveryCodes.length,10)
  const status=await totpGET(request(''),undefined);assert.equal(status.status,200)
  const statusData=(await status.json()).data;assert.equal(statusData.available,true);assert.equal(statusData.enabled,true);assert.equal(statusData.recoveryCodesRemaining,10)
  assert.ok(!JSON.stringify(statusData).includes(totp.secret.base32));assert.equal(statusData.recoveryCodes,undefined)
  const command={operationId:randomUUID(),name:'TOTP gated category'},action='test.critical',hash=payloadHash(command)
  const proof=await totpProofPOST(request('/proof',{code:totp.generate(),action,operationKey:command.operationId,payloadHash:hash}),undefined);assert.equal(proof.status,200)
  const proofData=(await proof.json()).data;assert.ok(proofData.proofId);assert.equal(proofData.recoveryCodes,undefined);assert.equal(proofData.secretHash,undefined)
  const work=async(tx:Parameters<typeof assertStepUp>[0])=>{const row=await tx.category.create({data:{organizationId:f.org.id,name:command.name}});await audit(tx,f.ctx,'Category',row.id,'totp_protected_test',{});return {id:row.id}}
  const authorize=(tx:Parameters<typeof assertStepUp>[0])=>assertStepUp(tx,f.ctx,action,command.operationId,hash)
  const fault='totp_operation_fault_'+randomUUID().replaceAll('-','')
  await prisma.$executeRawUnsafe(`CREATE FUNCTION ${fault}() RETURNS trigger LANGUAGE plpgsql AS $$ BEGIN IF NEW.action='totp_protected_test' THEN RAISE EXCEPTION 'isolated protected audit fault'; END IF; RETURN NEW; END $$`)
  await prisma.$executeRawUnsafe(`CREATE TRIGGER ${fault} BEFORE INSERT ON "AuditLog" FOR EACH ROW EXECUTE FUNCTION ${fault}()`)
  try {
   await assert.rejects(runOperation(f.ctx,action,command.operationId,command,work,authorize))
   assert.equal((await prisma.totpProof.findUniqueOrThrow({where:{id:proofData.proofId}})).approvedOperationAt,null)
   assert.equal(await prisma.category.count({where:{organizationId:f.org.id,name:command.name}}),0)
  } finally {await prisma.$executeRawUnsafe(`DROP TRIGGER ${fault} ON "AuditLog"`);await prisma.$executeRawUnsafe(`DROP FUNCTION ${fault}()`)}
  const first=await runOperation(f.ctx,action,command.operationId,command,work,authorize)
  assert.deepEqual(await runOperation(f.ctx,action,command.operationId,command,work,authorize),first)
  assert.equal(await prisma.category.count({where:{organizationId:f.org.id,name:command.name}}),1)
  assert.equal(await prisma.operation.count({where:{organizationId:f.org.id,type:action,key:command.operationId}}),1)
  delete process.env.AUTH_CHALLENGE_SECRET;delete process.env.AUTH_TOTP_ENABLED
  const unavailable=await totpGET(request(''),undefined),unavailableData=(await unavailable.json()).data
  assert.equal(unavailableData.available,false);assert.equal(unavailableData.enabled,true);assert.equal(unavailableData.recoveryAvailable,true)
  assert.equal((await totpProofPOST(request('/proof',{code:totp.generate(),action,operationKey:randomUUID(),payloadHash:hash}),undefined)).status,503)
  const recovered=await totpRecoverPOST(request('/recover',{password,factorId:source.factorId,recoveryCode:confirmed.recoveryCodes[0]}),undefined)
  assert.equal(recovered.status,200);assert.equal(await prisma.session.count({where:{userId:f.user.id,revokedAt:null}}),0)
 } finally {
  if(oldEncryptionKey===undefined)delete process.env.AUTH_CHALLENGE_SECRET;else process.env.AUTH_CHALLENGE_SECRET=oldEncryptionKey
  if(oldFlag===undefined)delete process.env.AUTH_TOTP_ENABLED;else process.env.AUTH_TOTP_ENABLED=oldFlag
  if(oldOrigin===undefined)delete process.env.APP_ORIGIN;else process.env.APP_ORIGIN=oldOrigin
 }
})

test('Invalid rotation configuration makes HTTP enrollment unavailable without persisting a factor', async () => {
 const f = await fixture(), flag = process.env.AUTH_TOTP_ENABLED, previous = process.env.AUTH_TOTP_PREVIOUS_SECRETS, origin = process.env.APP_ORIGIN
 const request = (body?: unknown) => new NextRequest('http://localhost:3000/api/auth/totp' + (body === undefined ? '' : '/enroll'), {method: body === undefined ? 'GET' : 'POST', headers: {cookie: 'pos_session=' + f.token, origin: 'http://localhost:3000', 'content-type': 'application/json'}, ...(body === undefined ? {} : {body: JSON.stringify(body)})})
 try {
  delete process.env.APP_ORIGIN
  process.env.AUTH_TOTP_ENABLED = 'true'; process.env.AUTH_TOTP_PREVIOUS_SECRETS = 'invalid-test-configuration'
  const status = await totpGET(request(), undefined)
  assert.equal(status.status, 200); assert.deepEqual((await status.json()).data, {available: false})
  const response = await totpEnrollPOST(request({password}), undefined)
  assert.equal(response.status, 503)
  assert.equal(await prisma.totpFactor.count({where: {userId: f.user.id}}), 0)
 } finally {
  if (flag === undefined) delete process.env.AUTH_TOTP_ENABLED; else process.env.AUTH_TOTP_ENABLED = flag
  if (previous === undefined) delete process.env.AUTH_TOTP_PREVIOUS_SECRETS; else process.env.AUTH_TOTP_PREVIOUS_SECRETS = previous
  if (origin === undefined) delete process.env.APP_ORIGIN; else process.env.APP_ORIGIN = origin
 }
})
test('Member permissions require exact MFA and an operation key; approved replay does not log out a newly signed-in target',async()=>{
 const f=await enrolled(),previous=process.env.AUTH_CRITICAL_MFA_REQUIRED,flag=process.env.AUTH_TOTP_ENABLED
 const target=await prisma.user.create({data:{fullName:'MFA staff',phone:randomUUID(),passwordHash:await hashPassword(password)}});users.push(target.id)
 const member=await prisma.organizationUser.create({data:{organizationId:f.org.id,userId:target.id,role:'admin'}})
 const oldToken=await prisma.$transaction(tx=>createSession(tx,target.id,f.org.id)),input={operationId:randomUUID(),role:'cashier' as const}
 try{
  process.env.AUTH_CRITICAL_MFA_REQUIRED='true';process.env.AUTH_TOTP_ENABLED='true'
  await assert.rejects(updateMember(f.ctx,member.id,{role:'cashier'}),{code:'OPERATION_ID_REQUIRED'})
  await assert.rejects(updateMember(f.ctx,member.id,input),{code:'STEP_UP_REQUIRED'})
  assert.equal((await prisma.organizationUser.findUniqueOrThrow({where:{id:member.id}})).role,'admin')
  assert.ok(await verifySession(oldToken))
  await createTotpProof(f.ctx,{code:f.totp.generate(),action:'users.member.update',operationKey:input.operationId,payloadHash:payloadHash({id:member.id,...input})})
  assert.equal((await updateMember(f.ctx,member.id,input)).role,'cashier')
  assert.equal(await verifySession(oldToken),null)
  const newToken=await prisma.$transaction(tx=>createSession(tx,target.id,f.org.id))
  assert.equal((await updateMember(f.ctx,member.id,input)).role,'cashier');assert.ok(await verifySession(newToken))
  await assert.rejects(updateMember(f.ctx,member.id,{...input,role:'owner'}),{code:'STEP_UP_REQUIRED'})
  assert.equal(await prisma.operation.count({where:{organizationId:f.org.id,type:'users.member.update'}}),1)
  assert.equal(await prisma.auditLog.count({where:{organizationId:f.org.id,entityId:member.id,action:'membership_updated'}}),1)
 }finally{if(previous===undefined)delete process.env.AUTH_CRITICAL_MFA_REQUIRED;else process.env.AUTH_CRITICAL_MFA_REQUIRED=previous;if(flag===undefined)delete process.env.AUTH_TOTP_ENABLED;else process.env.AUTH_TOTP_ENABLED=flag}
})
test('Ownership request audit fault rolls back MFA approval; both parties require independent proof and accepted session token is never stored',async()=>{
 const f=await enrolled(),previous=process.env.AUTH_CRITICAL_MFA_REQUIRED,flag=process.env.AUTH_TOTP_ENABLED
 const target=await prisma.user.create({data:{fullName:'MFA recipient',phone:randomUUID(),passwordHash:await hashPassword(password)}});users.push(target.id)
 const member=await prisma.organizationUser.create({data:{organizationId:f.org.id,userId:target.id,role:'admin'}})
 const targetToken=await prisma.$transaction(tx=>createSession(tx,target.id,f.org.id)),recipient=(await verifySession(targetToken))!
 const enrollment=await beginTotpEnrollment(recipient,{password}),totp=URI.parse(enrollment.provisioningUri) as TOTP
 await confirmTotpEnrollment(recipient,{factorId:enrollment.factorId,code:totp.generate({timestamp:Date.now()-30000})})
 const key=randomUUID(),trigger='ownership_mfa_'+randomUUID().replaceAll('-','')
 try{
  process.env.AUTH_CRITICAL_MFA_REQUIRED='true';process.env.AUTH_TOTP_ENABLED='true'
  await assert.rejects(transferOwnership(f.ctx,member.id,key),{code:'STEP_UP_REQUIRED'})
  await createTotpProof(f.ctx,{code:f.totp.generate(),action:'users.ownership.request',operationKey:key,payloadHash:payloadHash({targetId:member.id,operationId:key})})
  try{
   await prisma.$executeRawUnsafe(`CREATE FUNCTION ${trigger}() RETURNS trigger LANGUAGE plpgsql AS $$ BEGIN RAISE EXCEPTION 'Isolated ownership audit failure'; END $$`)
   await prisma.$executeRawUnsafe(`CREATE TRIGGER ${trigger} BEFORE INSERT ON "AuditLog" FOR EACH ROW WHEN (NEW."organizationId"='${f.org.id}' AND NEW.action='ownership_requested') EXECUTE FUNCTION ${trigger}()`)
   await assert.rejects(transferOwnership(f.ctx,member.id,key))
   assert.equal(await prisma.ownershipTransfer.count({where:{organizationId:f.org.id}}),0)
   assert.equal((await prisma.totpProof.findFirstOrThrow({where:{userId:f.user.id,operationKey:key}})).approvedOperationAt,null)
  }finally{await prisma.$executeRawUnsafe(`DROP TRIGGER IF EXISTS ${trigger} ON "AuditLog"`);await prisma.$executeRawUnsafe(`DROP FUNCTION IF EXISTS ${trigger}()`)}
  const request=await transferOwnership(f.ctx,member.id,key)
  assert.equal((await transferOwnership(f.ctx,member.id,key)).id,request.id)
  const acceptKey=randomUUID()
  await assert.rejects(respondOwnership(recipient,request.id,'accept',acceptKey),{code:'STEP_UP_REQUIRED'})
  assert.equal((await prisma.organizationUser.findUniqueOrThrow({where:{id:member.id}})).role,'admin')
  await createTotpProof(recipient,{code:totp.generate(),action:'users.ownership.accept',operationKey:acceptKey,payloadHash:payloadHash({id:request.id,action:'accept',operationId:acceptKey})})
  const result=await respondOwnership(recipient,request.id,'accept',acceptKey)
  assert.equal(result.request.state,'accepted');assert.ok(result.token);assert.equal((await verifySession(result.token!))?.role,'owner')
  assert.equal(await verifySession(targetToken),null);assert.equal(await verifySession(f.token),null)
  assert.equal(await prisma.operation.count({where:{organizationId:f.org.id}}),0)
  assert.ok(!JSON.stringify(await prisma.auditLog.findMany({where:{organizationId:f.org.id}})).includes(result.token!))
 }finally{if(previous===undefined)delete process.env.AUTH_CRITICAL_MFA_REQUIRED;else process.env.AUTH_CRITICAL_MFA_REQUIRED=previous;if(flag===undefined)delete process.env.AUTH_TOTP_ENABLED;else process.env.AUTH_TOTP_ENABLED=flag}
})
test('Ownership cancellation requires its own action/hash proof and leaves original owner roles unchanged',async()=>{
 const f=await enrolled(),previous=process.env.AUTH_CRITICAL_MFA_REQUIRED,flag=process.env.AUTH_TOTP_ENABLED
 const target=await prisma.user.create({data:{fullName:'MFA cancelled recipient',phone:randomUUID(),passwordHash:await hashPassword(password)}});users.push(target.id)
 const member=await prisma.organizationUser.create({data:{organizationId:f.org.id,userId:target.id,role:'admin'}})
 try{
  process.env.AUTH_CRITICAL_MFA_REQUIRED='false'
  const request=await transferOwnership(f.ctx,member.id),key=randomUUID()
  process.env.AUTH_CRITICAL_MFA_REQUIRED='true';process.env.AUTH_TOTP_ENABLED='true'
  await assert.rejects(respondOwnership(f.ctx,request.id,'cancel',key),{code:'STEP_UP_REQUIRED'})
  await createTotpProof(f.ctx,{code:f.totp.generate(),action:'users.ownership.cancel',operationKey:key,payloadHash:payloadHash({id:request.id,action:'cancel',operationId:key})})
  const result=await respondOwnership(f.ctx,request.id,'cancel',key)
  assert.equal(result.request.state,'cancelled');assert.equal(result.token,null)
  assert.equal((await prisma.organizationUser.findUniqueOrThrow({where:{id:member.id}})).role,'admin')
  assert.equal((await prisma.organizationUser.findUniqueOrThrow({where:{id:f.ctx.organizationUserId}})).role,'owner')
 }finally{if(previous===undefined)delete process.env.AUTH_CRITICAL_MFA_REQUIRED;else process.env.AUTH_CRITICAL_MFA_REQUIRED=previous;if(flag===undefined)delete process.env.AUTH_TOTP_ENABLED;else process.env.AUTH_TOTP_ENABLED=flag}
})

test('Invitation grant requires bound MFA; concurrent replay never persists or reissues the bearer token',async()=>{
 const f=await enrolled(),old=process.env.AUTH_CRITICAL_MFA_REQUIRED,flag=process.env.AUTH_TOTP_ENABLED
 const store=await prisma.store.create({data:{organizationId:f.org.id,name:'Invitation MFA'}})
 const input={operationId:randomUUID(),phone:'+998'+String(Date.now()),role:'admin' as const,storeIds:[store.id]}
 try{
  process.env.AUTH_CRITICAL_MFA_REQUIRED='true';process.env.AUTH_TOTP_ENABLED='true'
  await assert.rejects(createInvitation(f.ctx,input),{code:'STEP_UP_REQUIRED'})
  assert.equal(await prisma.invitation.count({where:{organizationId:f.org.id}}),0)
  await createTotpProof(f.ctx,{code:f.totp.generate(),action:'users.invitation.create',operationKey:input.operationId,payloadHash:payloadHash(input)})
  const results=await Promise.all([createInvitation(f.ctx,input),createInvitation(f.ctx,input)])
  assert.equal(results[0].id,results[1].id)
  const tokens=results.filter(row=>row.invitationToken)
  assert.equal(tokens.length,1)
  const token=tokens[0].invitationToken
  assert.equal((await prisma.invitation.findUniqueOrThrow({where:{id:results[0].id}})).tokenHash,sessionHash(token))
  const replay=await createInvitation(f.ctx,input)
  assert.equal(replay.invitationToken,'');assert.equal(replay.invitationTokenUnavailable,true)
  assert.equal(await prisma.invitation.count({where:{organizationId:f.org.id}}),1)
  const operations=await prisma.operation.findMany({where:{organizationId:f.org.id}})
  assert.equal(operations.length,1)
  assert.ok(!JSON.stringify(operations).includes(token))
  assert.ok(!JSON.stringify(await prisma.auditLog.findMany({where:{organizationId:f.org.id}})).includes(token))
  await assert.rejects(createInvitation(f.ctx,{...input,role:'cashier'}),{code:'STEP_UP_REQUIRED'})
 }finally{if(old===undefined)delete process.env.AUTH_CRITICAL_MFA_REQUIRED;else process.env.AUTH_CRITICAL_MFA_REQUIRED=old;if(flag===undefined)delete process.env.AUTH_TOTP_ENABLED;else process.env.AUTH_TOTP_ENABLED=flag}
})

test('HTTP staff creation binds the password privately and replays exactly one safe member result',async()=>{
 const f=await enrolled(),old=process.env.AUTH_CRITICAL_MFA_REQUIRED,flag=process.env.AUTH_TOTP_ENABLED,origin=process.env.APP_ORIGIN
 const input={operationId:randomUUID(),fullName:'Bound staff',phone:'+998'+String(Date.now()),password:'staff-test-password',role:'admin'}
 const send=(body:unknown)=>createStaffPOST(new NextRequest('http://localhost:3000/api/organizations/'+f.org.id+'/users',{method:'POST',headers:{cookie:'pos_session='+f.token,origin:'http://localhost:3000','content-type':'application/json'},body:JSON.stringify(body)}),{params:Promise.resolve({id:f.org.id})})
 try{
  delete process.env.APP_ORIGIN;process.env.AUTH_CRITICAL_MFA_REQUIRED='true';process.env.AUTH_TOTP_ENABLED='true'
  const denied=await send(input);assert.equal(denied.status,403)
  const failure=(await denied.json()).error;assert.equal(failure.code,'STEP_UP_REQUIRED')
  assert.equal(await prisma.user.count({where:{phone:input.phone}}),0)
  await createTotpProof(f.ctx,{code:f.totp.generate(),...failure.details})
  const response=await send(input);assert.equal(response.status,200)
  const first=(await response.json()).data;users.push(first.user.id)
  assert.equal(first.user.passwordHash,undefined)
  const replay=await send(input);assert.equal(replay.status,200);assert.equal((await replay.json()).data.id,first.id)
  assert.equal(await prisma.user.count({where:{phone:input.phone}}),1)
  assert.equal(await prisma.operation.count({where:{organizationId:f.org.id,type:'users.member.create'}}),1)
  const saved=JSON.stringify(await prisma.operation.findMany({where:{organizationId:f.org.id}}))
  assert.ok(!saved.includes(input.password));assert.ok(!saved.includes('passwordHash'))
  const changed=await send({...input,password:'different-test-password'});assert.equal(changed.status,403);assert.equal((await changed.json()).error.code,'STEP_UP_REQUIRED')
 }finally{if(old===undefined)delete process.env.AUTH_CRITICAL_MFA_REQUIRED;else process.env.AUTH_CRITICAL_MFA_REQUIRED=old;if(flag===undefined)delete process.env.AUTH_TOTP_ENABLED;else process.env.AUTH_TOTP_ENABLED=flag;if(origin===undefined)delete process.env.APP_ORIGIN;else process.env.APP_ORIGIN=origin}
})

test('Owner password change requires a bound second factor and atomically invalidates all sessions without storing credentials',async()=>{
 const f=await enrolled(),old=process.env.AUTH_CRITICAL_MFA_REQUIRED,flag=process.env.AUTH_TOTP_ENABLED,origin=process.env.APP_ORIGIN
 const input={operationId:randomUUID(),currentPassword:password,newPassword:'mfa-new-password'}
 const send=(body:unknown)=>changePasswordPOST(new NextRequest('http://localhost:3000/api/auth/change-password',{method:'POST',headers:{cookie:'pos_session='+f.token,origin:'http://localhost:3000','content-type':'application/json'},body:JSON.stringify(body)}),undefined)
 try{
  delete process.env.APP_ORIGIN;process.env.AUTH_CRITICAL_MFA_REQUIRED='true';process.env.AUTH_TOTP_ENABLED='true'
  const denied=await send(input);assert.equal(denied.status,403);const error=(await denied.json()).error;assert.equal(error.code,'STEP_UP_REQUIRED')
  assert.ok(await verifySession(f.token));assert.ok(await bcrypt.compare(password,(await prisma.user.findUniqueOrThrow({where:{id:f.user.id}})).passwordHash))
  await createTotpProof(f.ctx,{code:f.totp.generate(),...error.details})
  const fault='password_mfa_'+randomUUID().replaceAll('-','')
  try{
   await prisma.$executeRawUnsafe(`CREATE FUNCTION ${fault}() RETURNS trigger LANGUAGE plpgsql AS $$ BEGIN RAISE EXCEPTION 'isolated password audit failure'; END $$`)
   await prisma.$executeRawUnsafe(`CREATE TRIGGER ${fault} BEFORE INSERT ON "AuditLog" FOR EACH ROW WHEN (NEW."organizationId"='${f.org.id}' AND NEW.action='password_changed') EXECUTE FUNCTION ${fault}()`)
   assert.equal((await send(input)).status,500)
   assert.ok(await verifySession(f.token))
   assert.ok(await bcrypt.compare(password,(await prisma.user.findUniqueOrThrow({where:{id:f.user.id}})).passwordHash))
   assert.equal((await prisma.totpProof.findFirstOrThrow({where:{userId:f.user.id,operationKey:input.operationId}})).approvedOperationAt,null)
  }finally{await prisma.$executeRawUnsafe(`DROP TRIGGER IF EXISTS ${fault} ON "AuditLog"`);await prisma.$executeRawUnsafe(`DROP FUNCTION IF EXISTS ${fault}()`)}
  const changed=await send(input);assert.equal(changed.status,200)
  assert.equal(await verifySession(f.token),null)
  assert.ok(await bcrypt.compare(input.newPassword,(await prisma.user.findUniqueOrThrow({where:{id:f.user.id}})).passwordHash))
  assert.equal(await prisma.operation.count({where:{organizationId:f.org.id}}),0)
  assert.ok(!JSON.stringify(await prisma.auditLog.findMany({where:{organizationId:f.org.id}})).includes(input.newPassword))
  assert.equal((await send(input)).status,401)
 }finally{if(old===undefined)delete process.env.AUTH_CRITICAL_MFA_REQUIRED;else process.env.AUTH_CRITICAL_MFA_REQUIRED=old;if(flag===undefined)delete process.env.AUTH_TOTP_ENABLED;else process.env.AUTH_TOTP_ENABLED=flag;if(origin===undefined)delete process.env.APP_ORIGIN;else process.env.APP_ORIGIN=origin}
})

test('Hyphenated offline policy proof binds the actual operation key and rejects a changed payload and action',async()=>{
 const f=await enrolled(),old=process.env.AUTH_CRITICAL_MFA_REQUIRED
 try{
  process.env.AUTH_CRITICAL_MFA_REQUIRED='true'
  const store=await prisma.store.create({data:{organizationId:f.org.id,name:'Actual offline policy branch'}})
  const {configureOfflineCash}=await import('@/server/offline/cash')
  const input={operationId:randomUUID(),storeId:store.id,enabled:true,maxAmount:'25',ttlSeconds:300,reason:'Approved exact offline policy'}
  await assert.rejects(configureOfflineCash(f.ctx,input),{code:'STEP_UP_REQUIRED'})
  const proof=await createTotpProof(f.ctx,{action:'offline-cash.policy',operationKey:input.operationId,payloadHash:payloadHash(input),code:f.totp.generate()})
  assert.ok(proof)
  await assert.rejects(configureOfflineCash(f.ctx,{...input,maxAmount:'26'}),{code:'STEP_UP_REQUIRED'})
  await assert.rejects(prisma.$transaction(tx=>assertTotpStepUp(tx,f.ctx,'offline.cash.policy',input.operationId,payloadHash(input))),{code:'STEP_UP_REQUIRED'})
  const first=await configureOfflineCash(f.ctx,input),again=await configureOfflineCash(f.ctx,input)
  assert.equal(first.id,again.id)
  assert.equal(await prisma.operation.count({where:{organizationId:f.org.id,type:'offline-cash.policy',key:input.operationId}}),1)
  assert.equal(await prisma.auditLog.count({where:{organizationId:f.org.id,entityId:first.id,action:'configured'}}),1)
  const stored=await prisma.totpProof.findFirstOrThrow({where:{userId:f.user.id,action:'offline-cash.policy'}})
  for(const action of ['offline-cash/policy','offline-cash.policy\n','offline-cash.policy;admin','-offline-cash.policy','a'.repeat(82)]){
   await assert.rejects(prisma.totpProof.create({data:{...stored,id:randomUUID(),operationKey:randomUUID(),action,approvedOperationAt:null}}),(error:unknown)=>error instanceof Error&&error.message.includes('TotpProof_action_name_check'))
  }
  assert.equal(await prisma.totpProof.count({where:{userId:f.user.id}}),1)
 }finally{if(old===undefined)delete process.env.AUTH_CRITICAL_MFA_REQUIRED;else process.env.AUTH_CRITICAL_MFA_REQUIRED=old}
})
