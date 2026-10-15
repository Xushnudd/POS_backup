import {test,after} from 'node:test'
import assert from 'node:assert/strict'
import {randomUUID} from 'node:crypto'
import {URI,TOTP} from 'otpauth'
import {prisma} from '@/lib/prisma'
import {hashPassword} from '@/lib/auth'
import {createSession,verifySession} from '@/server/auth/session'
import {beginTotpEnrollment,confirmTotpEnrollment,createTotpProof} from '@/server/auth/totp-service'
import {rotateTotpEnvelope} from '@/server/auth/totp-key-rotation'
import {isTotpEnvelopeCurrent,unsealTotpSecret,sealTotpSecret} from '@/server/auth/totp'
const connection=new URL(process.env.DATABASE_URL??'')
if(connection.hostname!=='127.0.0.1'||connection.port!=='55439'||connection.pathname!=='/pos_test')throw new Error('Isolated DB only')
const orgs:string[]=[],users:string[]=[],password='rotation-local-password'
const old=process.env.AUTH_CHALLENGE_SECRET,overlap=process.env.AUTH_TOTP_PREVIOUS_SECRETS
process.env.AUTH_CHALLENGE_SECRET='d'.repeat(64);delete process.env.AUTH_TOTP_PREVIOUS_SECRETS
function keys(){process.env.AUTH_CHALLENGE_SECRET='c'.repeat(64);process.env.AUTH_TOTP_PREVIOUS_SECRETS='d'.repeat(64)}
after(async()=>{await prisma.organization.deleteMany({where:{id:{in:orgs}}});await prisma.user.deleteMany({where:{id:{in:users}}});await prisma.$disconnect();if(old===undefined)delete process.env.AUTH_CHALLENGE_SECRET;else process.env.AUTH_CHALLENGE_SECRET=old;if(overlap===undefined)delete process.env.AUTH_TOTP_PREVIOUS_SECRETS;else process.env.AUTH_TOTP_PREVIOUS_SECRETS=overlap})
async function fixture(){
 process.env.AUTH_CHALLENGE_SECRET='d'.repeat(64);delete process.env.AUTH_TOTP_PREVIOUS_SECRETS
 const org=await prisma.organization.create({data:{name:'Rekey isolated',phone:randomUUID()}});orgs.push(org.id)
 const user=await prisma.user.create({data:{fullName:'Rekey operator',phone:randomUUID(),passwordHash:await hashPassword(password)}});users.push(user.id)
 await prisma.organizationUser.create({data:{organizationId:org.id,userId:user.id,role:'owner'}})
 const token=await prisma.$transaction(tx=>createSession(tx,user.id,org.id)),ctx=(await verifySession(token))!
 const enrollment=await beginTotpEnrollment(ctx,{password}),totp=URI.parse(enrollment.provisioningUri) as TOTP
 await confirmTotpEnrollment(ctx,{factorId:enrollment.factorId,code:totp.generate({timestamp:Date.now()-30000})})
 const factor=await prisma.totpFactor.findUniqueOrThrow({where:{id:enrollment.factorId}})
 const input={actorId:user.id,batchId:randomUUID(),reason:'Isolated approved key transition'}
 return {org,user,ctx,totp,factor,input}
}
test('Dry-run preserves bytes; audited apply preserves authenticator, counter and recovery; rerun writes once and works with retired key removed',async()=>{
 const f=await fixture(),before=await prisma.totpRecoveryCode.findMany({where:{factorId:f.factor.id}})
 keys()
 await assert.rejects(rotateTotpEnvelope(f.input,f.factor.id),{code:'PLATFORM_ADMIN_REQUIRED'})
 await prisma.platformOperator.create({data:{userId:f.user.id,role:'platform_admin'}})
 assert.equal((await rotateTotpEnvelope(f.input,f.factor.id)).state,'pending')
 assert.equal((await prisma.totpFactor.findUniqueOrThrow({where:{id:f.factor.id}})).sealedSecret,f.factor.sealedSecret)
 assert.equal(await prisma.totpKeyRotation.count({where:{factorId:f.factor.id}}),0)
 assert.equal((await rotateTotpEnvelope(f.input,f.factor.id,true)).state,'rotated')
 assert.equal((await rotateTotpEnvelope(f.input,f.factor.id,true)).state,'current')
 const current=await prisma.totpFactor.findUniqueOrThrow({where:{id:f.factor.id}})
 assert.notEqual(current.sealedSecret,f.factor.sealedSecret)
 assert.deepEqual({...current,sealedSecret:null},{...f.factor,sealedSecret:null})
 assert.deepEqual(await prisma.totpRecoveryCode.findMany({where:{factorId:f.factor.id}}),before)
 assert.equal(await prisma.totpKeyRotation.count({where:{factorId:f.factor.id}}),1)
 delete process.env.AUTH_TOTP_PREVIOUS_SECRETS
 assert.throws(()=>unsealTotpSecret(f.factor.sealedSecret!,f.user.id,f.factor.id),{code:'TOTP_SECRET_INVALID'})
 assert.ok(isTotpEnvelopeCurrent(current.sealedSecret!,f.user.id,f.factor.id))
 assert.equal(unsealTotpSecret(current.sealedSecret!,f.user.id,f.factor.id),f.totp.secret.base32)
 const acceptedCode=f.totp.generate()
 await createTotpProof(f.ctx,{code:acceptedCode,action:'billing.plan.assign',operationKey:randomUUID(),payloadHash:'1'.repeat(64)})
 await assert.rejects(createTotpProof(f.ctx,{code:acceptedCode,action:'billing.plan.assign',operationKey:randomUUID(),payloadHash:'1'.repeat(64)}),{code:'TOTP_CODE_INVALID'})
})
test('Concurrent apply is once; unaudited ciphertext/source changes and provenance edits fail closed',async()=>{
 const f=await fixture();keys();await prisma.platformOperator.create({data:{userId:f.user.id,role:'platform_admin'}})
 const arbitrary=sealTotpSecret(f.totp.secret.base32,f.user.id,f.factor.id)
 await assert.rejects(prisma.totpFactor.update({where:{id:f.factor.id},data:{sealedSecret:arbitrary}}))
 const states=await Promise.all([rotateTotpEnvelope(f.input,f.factor.id,true),rotateTotpEnvelope({...f.input,batchId:randomUUID()},f.factor.id,true)])
 assert.deepEqual(states.map(row=>row.state).sort(),['current','rotated'])
 const record=await prisma.totpKeyRotation.findFirstOrThrow({where:{factorId:f.factor.id}})
 await assert.rejects(prisma.totpKeyRotation.update({where:{id:record.id},data:{reason:'Forged reason'}}))
 await assert.rejects(prisma.totpKeyRotation.delete({where:{id:record.id}}))
 assert.equal(await prisma.totpKeyRotation.count({where:{factorId:f.factor.id}}),1)
})
test('Audit fault rolls back encryption; missing previous key and revoked operator never alter credentials',async()=>{
 const f=await fixture();keys();await prisma.platformOperator.create({data:{userId:f.user.id,role:'platform_admin'}})
 const name='rekey_audit_'+randomUUID().replaceAll('-','')
 try{
  await prisma.$executeRawUnsafe(`CREATE FUNCTION ${name}() RETURNS trigger LANGUAGE plpgsql AS $$ BEGIN RAISE EXCEPTION 'Isolated rekey audit fault'; END $$`)
  await prisma.$executeRawUnsafe(`CREATE TRIGGER ${name} BEFORE INSERT ON "TotpKeyRotation" FOR EACH ROW EXECUTE FUNCTION ${name}()`)
  await assert.rejects(rotateTotpEnvelope(f.input,f.factor.id,true))
  assert.equal((await prisma.totpFactor.findUniqueOrThrow({where:{id:f.factor.id}})).sealedSecret,f.factor.sealedSecret)
  assert.equal(await prisma.totpKeyRotation.count({where:{factorId:f.factor.id}}),0)
 }finally{await prisma.$executeRawUnsafe(`DROP TRIGGER IF EXISTS ${name} ON "TotpKeyRotation"`);await prisma.$executeRawUnsafe(`DROP FUNCTION IF EXISTS ${name}()`)}
 delete process.env.AUTH_TOTP_PREVIOUS_SECRETS
 await assert.rejects(rotateTotpEnvelope(f.input,f.factor.id,true),{code:'TOTP_SECRET_INVALID'})
 keys();await prisma.platformOperator.update({where:{userId:f.user.id},data:{isActive:false}})
 await assert.rejects(rotateTotpEnvelope(f.input,f.factor.id,true),{code:'PLATFORM_ADMIN_REQUIRED'})
 assert.equal((await prisma.totpFactor.findUniqueOrThrow({where:{id:f.factor.id}})).sealedSecret,f.factor.sealedSecret)
})
test('Operator CLI defaults to safe counts-only check, rejects wrong target and requires explicit valid maintenance for apply',async()=>{
 const {execFile}=await import('node:child_process'),{promisify}=await import('node:util'),{mkdtemp,writeFile,rm}=await import('node:fs/promises'),{tmpdir}=await import('node:os'),{join}=await import('node:path')
 const f=await fixture();keys();await prisma.platformOperator.create({data:{userId:f.user.id,role:'platform_admin'}})
 const env={...process.env,POS_TOTP_ROTATION_CONFIRM_DATABASE:'pos_test',POS_TOTP_ROTATION_OPERATOR_ID:f.user.id,POS_TOTP_ROTATION_REASON:'Isolated operator acceptance',POS_TOTP_ROTATION_BATCH_ID:randomUUID(),POS_DEPLOYMENT_STATE_FILE:''}
 const invoke=(mode:string,changes:Record<string,string>={})=>promisify(execFile)(process.execPath,['--require','./scripts/worker-resolver.cjs','.worker-build/scripts/workers/totp-rekey.js',mode],{env:{...env,...changes},timeout:30000,maxBuffer:65536})
 await assert.rejects(invoke('--check',{POS_TOTP_ROTATION_CONFIRM_DATABASE:'unconfirmed'}))
 await assert.rejects(invoke('--apply'))
 const before=await invoke('--check'),summary=JSON.parse(before.stdout.split('\n')[0])
 assert.ok(summary.pending>=1);assert.equal(summary.retiredKeysMayBeRemoved,false)
 for(const text of [before.stdout,before.stderr]){assert.ok(!text.includes(f.factor.sealedSecret!));assert.ok(!text.includes(f.totp.secret.base32));assert.ok(!text.includes(process.env.AUTH_CHALLENGE_SECRET!))}
 const directory=await mkdtemp(join(tmpdir(),'pos-rekey-maintenance-')),file=join(directory,'state.json')
 try{
  await writeFile(file,JSON.stringify({maintenance:true,message:'Isolated approved key rotation'}),{mode:0o600})
  const apply=await invoke('--apply',{POS_DEPLOYMENT_STATE_FILE:file}),applied=JSON.parse(apply.stdout.split('\n')[0])
  assert.ok(applied.rotated>=1);assert.equal(applied.failed,0);assert.equal(applied.retiredKeysMayBeRemoved,false)
  const after=await invoke('--check'),checked=JSON.parse(after.stdout.split('\n')[0])
  assert.equal(checked.pending,0);assert.equal(checked.failed,0);assert.equal(checked.retiredKeysMayBeRemoved,true)
 }finally{await rm(directory,{recursive:true,force:true})}
})
