import {test,after} from 'node:test'
import assert from 'node:assert/strict'
import {randomUUID,randomBytes} from 'node:crypto'
import {readFileSync,mkdtempSync,writeFileSync,rmSync} from 'node:fs'
import {tmpdir} from 'node:os'
import {join} from 'node:path'
import {execFileSync} from 'node:child_process'
import {URI,TOTP} from 'otpauth'
import {NextRequest} from 'next/server'
import {prisma} from '@/lib/prisma'
import {hashPassword} from '@/lib/auth'
import {createSession,verifySession,sessionHash} from '@/server/auth/session'
import {assertLiveContext} from '@/server/operations'
import {beginTotpEnrollment,confirmTotpEnrollment,createTotpProof} from '@/server/auth/totp-service'
import {createInvitation} from '@/server/users/invitations'
import {GET as readyGET} from '@/app/api/health/ready/route'
import {POST as loginPOST} from '@/app/api/auth/login/route'
const connection=new URL(process.env.DATABASE_URL??'')
if(connection.hostname!=='127.0.0.1'||connection.port!=='55439'||connection.pathname!=='/pos_test')throw new Error('Isolated pos_test only')
const testContainer=process.env.POS_TEST_PSQL_CONTAINER??'pos-plan-test-db'
if(!/^[a-zA-Z0-9][a-zA-Z0-9_.-]{0,127}$/.test(testContainer))throw new Error('Isolated test PostgreSQL container required')
const organizations:string[]=[],users:string[]=[],checkpoints:string[]=[],oldKey=process.env.AUTH_CHALLENGE_SECRET
function review(environment:Record<string,string>={}){
 const directory=mkdtempSync(join(tmpdir(),'pos-auth-review-test-'))
 try{
  writeFileSync(join(directory,'psql'),`#!/usr/bin/env bash\nset -euo pipefail\nexec docker exec -i -e PGHOST -e PGUSER -e PGPASSWORD -e PGDATABASE -e PGPORT=5432 ${testContainer} psql "$@"\n`,{mode:0o700})
  return execFileSync('bash',['scripts/ops/review-restored-auth.sh'],{env:{...process.env,PATH:directory+':'+process.env.PATH,RESTORE_DATABASE_URL:process.env.DATABASE_URL,RESTORE_CONFIRM_DATABASE:'pos_test',AUTH_RESTORE_REVIEWER:'Isolated operator',AUTH_RESTORE_REVIEW_EVIDENCE:'Synthetic generated password and owner only, no PIN or platform grants',AUTH_RESTORE_CREDENTIALS_RECONCILED:'yes',AUTH_RESTORE_ACCESS_RECONCILED:'yes',...environment},stdio:['pipe','pipe','pipe']})
 }finally{rmSync(directory,{recursive:true,force:true})}
}
process.env.AUTH_CHALLENGE_SECRET='c'.repeat(64)
after(async()=>{
 // The production DELETE guard is tested below; cleanup only our own records
 // inside one disposable-DB DDL transaction, preserving unrelated provenance.
 if(checkpoints.length)await prisma.$transaction(async tx=>{
  await tx.$executeRawUnsafe('ALTER TABLE "AuthRestoreCheckpoint" DISABLE TRIGGER auth_restore_checkpoint_guard')
  await tx.authRestoreCheckpoint.deleteMany({where:{id:{in:checkpoints}}})
  await tx.$executeRawUnsafe('ALTER TABLE "AuthRestoreCheckpoint" ENABLE TRIGGER auth_restore_checkpoint_guard')
 })
 await prisma.organization.deleteMany({where:{id:{in:organizations}}});await prisma.user.deleteMany({where:{id:{in:users}}});await prisma.$disconnect()
 if(oldKey===undefined)delete process.env.AUTH_CHALLENGE_SECRET;else process.env.AUTH_CHALLENGE_SECRET=oldKey
})
test('Restore quarantine blocks old/new sessions and readiness, invalidates one-time credentials, preserves business history and requires immutable operator review',async()=>{
 assert.equal(await prisma.authRestoreCheckpoint.count(),0)
 const org=await prisma.organization.create({data:{name:'Restore auth test',phone:randomUUID()}});organizations.push(org.id)
 const password='restore-test-password',user=await prisma.user.create({data:{fullName:'Restore owner',phone:randomUUID(),passwordHash:await hashPassword(password)}});users.push(user.id)
 const member=await prisma.organizationUser.create({data:{organizationId:org.id,userId:user.id,role:'owner'}})
 const store=await prisma.store.create({data:{organizationId:org.id,name:'Restore branch'}})
 const token=await prisma.$transaction(tx=>createSession(tx,user.id,org.id)),ctx=(await verifySession(token))!
 const start=await beginTotpEnrollment(ctx,{password}),totp=URI.parse(start.provisioningUri) as TOTP
 await confirmTotpEnrollment(ctx,{factorId:start.factorId,code:totp.generate({timestamp:Date.now()-30000})})
 const invitation=await createInvitation(ctx,{phone:'+998'+String(Date.now()),role:'cashier',storeIds:[store.id]})
 const before=await Promise.all([prisma.sale.count(),prisma.payment.count(),prisma.inventoryMovement.count(),prisma.debtEntry.count()])
 const checkpoint=await prisma.authRestoreCheckpoint.create({data:{}})
 checkpoints.push(checkpoint.id)
 assert.equal(await verifySession(token),null)
 await assert.rejects(prisma.$transaction(tx=>createSession(tx,user.id,org.id)),{code:'AUTH_RESTORE_REVIEW_REQUIRED'})
 await assert.rejects(prisma.$transaction(tx=>assertLiveContext(tx,ctx)),{code:'SESSION_CHANGED'})
 assert.equal((await readyGET()).status,503)
 const request=new NextRequest('http://localhost:3000/api/auth/login',{method:'POST',headers:{origin:'http://localhost:3000','content-type':'application/json'},body:JSON.stringify({phone:user.phone,password})})
 assert.equal((await loginPOST(request,undefined)).status,503)
 await assert.rejects(prisma.authRestoreCheckpoint.update({where:{id:checkpoint.id},data:{reviewedAt:new Date(),reviewer:'Operator',reviewEvidence:'isolated-review-proof'}}))
 await assert.rejects(prisma.session.create({data:{userId:user.id,organizationId:org.id,tokenHash:sessionHash(randomBytes(32).toString('base64url')),expiresAt:new Date(Date.now()+3600000),idleExpiresAt:new Date(Date.now()+3600000)}}))
 const sql=readFileSync('scripts/ops/auth-restore-quarantine.sql','utf8')
 execFileSync('docker',['exec','-i',testContainer,'psql','-X','-U','pos_test','-d','pos_test','-v','ON_ERROR_STOP=1'],{input:sql,stdio:['pipe','pipe','pipe']})
 assert.equal(await prisma.authRestoreCheckpoint.count(),1)
 assert.ok((await prisma.session.findUniqueOrThrow({where:{id:ctx.sessionId}})).revokedAt)
 const factor=await prisma.totpFactor.findUniqueOrThrow({where:{id:start.factorId}});assert.ok(factor.revokedAt);assert.equal(factor.sealedSecret,null)
 assert.ok((await prisma.invitation.findUniqueOrThrow({where:{id:invitation.id}})).revokedAt)
 await assert.rejects(createTotpProof(ctx,{code:totp.generate(),action:'test.restore',operationKey:randomUUID(),payloadHash:'a'.repeat(64)}))
 await assert.rejects(prisma.authRestoreCheckpoint.update({where:{id:checkpoint.id},data:{reviewedAt:new Date()}}))
 await assert.rejects(prisma.authRestoreCheckpoint.delete({where:{id:checkpoint.id}}))
 assert.throws(()=>review({RESTORE_CONFIRM_DATABASE:'unconfirmed_target'}))
 assert.throws(()=>review({AUTH_RESTORE_ACCESS_RECONCILED:''}))
 assert.equal((await prisma.authRestoreCheckpoint.findUniqueOrThrow({where:{id:checkpoint.id}})).reviewedAt,null)
 review()
 assert.throws(()=>review())
 assert.equal(await verifySession(token),null)
 const fresh=await prisma.$transaction(tx=>createSession(tx,user.id,org.id));assert.ok(await verifySession(fresh))
 assert.equal((await readyGET()).status,200)
 await assert.rejects(prisma.authRestoreCheckpoint.update({where:{id:checkpoint.id},data:{reviewEvidence:'changed history evidence'}}))
 assert.deepEqual(await Promise.all([prisma.sale.count(),prisma.payment.count(),prisma.inventoryMovement.count(),prisma.debtEntry.count()]),before)
 assert.equal((await prisma.organizationUser.findUniqueOrThrow({where:{id:member.id}})).role,'owner')
 assert.equal((await prisma.user.findUniqueOrThrow({where:{id:user.id}})).isActive,true)
})

test('A failed restore credential sweep commits its quarantine first and rolls back credential writes until exact retry',async()=>{
 const org=await prisma.organization.create({data:{name:'Restore failure test',phone:randomUUID()}});organizations.push(org.id)
 const password='restore-failure-password',user=await prisma.user.create({data:{fullName:'Restore failure owner',phone:randomUUID(),passwordHash:await hashPassword(password)}});users.push(user.id)
 await prisma.organizationUser.create({data:{organizationId:org.id,userId:user.id,role:'owner'}})
 const token=await prisma.$transaction(tx=>createSession(tx,user.id,org.id)),ctx=(await verifySession(token))!
 const factor=await beginTotpEnrollment(ctx,{password})
 const fault='restore_fault_'+randomUUID().replaceAll('-',''),sql=readFileSync('scripts/ops/auth-restore-quarantine.sql','utf8')
 const sweep=()=>execFileSync('docker',['exec','-i',testContainer,'psql','-X','-U','pos_test','-d','pos_test','-v','ON_ERROR_STOP=1'],{input:sql,stdio:['pipe','pipe','pipe']})
 try{
  await prisma.$executeRawUnsafe(`CREATE FUNCTION ${fault}() RETURNS trigger LANGUAGE plpgsql AS $$ BEGIN RAISE EXCEPTION 'isolated restore sweep failure'; END $$`)
  await prisma.$executeRawUnsafe(`CREATE TRIGGER ${fault} BEFORE UPDATE ON "TotpFactor" FOR EACH ROW WHEN (OLD.id='${factor.factorId}') EXECUTE FUNCTION ${fault}()`)
  assert.throws(sweep)
  const pending=await prisma.authRestoreCheckpoint.findFirstOrThrow({where:{reviewedAt:null}});checkpoints.push(pending.id)
  assert.equal(await verifySession(token),null);assert.equal((await readyGET()).status,503)
  assert.equal((await prisma.session.findUniqueOrThrow({where:{id:ctx.sessionId}})).revokedAt,null)
  assert.equal((await prisma.totpFactor.findUniqueOrThrow({where:{id:factor.factorId}})).revokedAt,null)
 }finally{await prisma.$executeRawUnsafe(`DROP TRIGGER IF EXISTS ${fault} ON "TotpFactor"`);await prisma.$executeRawUnsafe(`DROP FUNCTION IF EXISTS ${fault}()`)}
 sweep()
 const pending=await prisma.authRestoreCheckpoint.findFirstOrThrow({where:{reviewedAt:null}})
 assert.equal(await prisma.authRestoreCheckpoint.count({where:{reviewedAt:null}}),1)
 assert.ok((await prisma.session.findUniqueOrThrow({where:{id:ctx.sessionId}})).revokedAt)
 assert.ok((await prisma.totpFactor.findUniqueOrThrow({where:{id:factor.factorId}})).revokedAt)
 await prisma.authRestoreCheckpoint.update({where:{id:pending.id},data:{reviewedAt:new Date(),reviewer:'Isolated failure operator',reviewEvidence:'Synthetic new owner only, no PIN/platform grants, current generated password'}})
 assert.equal(await verifySession(token),null)
})
