// Actual encrypted restore + migration + binary rollback, using only new local
// Docker resources and synthetic records. Never deploys an existing Compose project.
import assert from 'node:assert/strict'
import {spawnSync} from 'node:child_process'
import {createHash,randomBytes,randomUUID} from 'node:crypto'
import {mkdtempSync,mkdirSync,writeFileSync,readFileSync,readdirSync,rmSync,statSync} from 'node:fs'
import {tmpdir} from 'node:os'
import {join,resolve} from 'node:path'

const prefix=`pos-release-drill-${Date.now()}-${process.pid}`
const work=mkdtempSync(join(tmpdir(),'pos-release-images-')),cleanup=[],checks=[]
const pg=`${prefix}-db`,network=`${prefix}-net`,volume=`${prefix}-data`
const password=randomBytes(32).toString('hex'),authKey=randomBytes(32).toString('hex')
const source='release_source',restored='release_restored',origin='https://release-fixture.invalid'
const fixture=randomUUID()
let token=randomBytes(32).toString('base64url')
const tokenHash=createHash('sha256').update(token).digest('hex')
let app,base,sequence=0,evidence
function run(command,args,{input,env={},mayFail=false,timeout=120000}={}) {
  const result=spawnSync(command,args,{input,env:{...process.env,...env},encoding:'utf8',timeout,maxBuffer:8*1024*1024})
  if(!mayFail&&result.status!==0){
    const codes=(result.stdout||'').split('\n').flatMap(line=>{try{const row=JSON.parse(line);return typeof row.code==='string'&&/^[A-Z0-9_]{1,80}$/.test(row.code)?[row.code]:[]}catch{return []}}).slice(-5)
    throw new Error('RELEASE_DRILL_COMMAND_FAILED_'+command.replace(/[^a-z]/gi,'')+'_'+codes.join('_'))
  }
  return result
}
const docker=(args,options)=>run('docker',args,options)
function sql(database,query) {
  return docker(['exec','-i','--user','postgres',pg,'psql','-XAt','-U','postgres','-d',database,'-v','ON_ERROR_STOP=1'],{input:query}).stdout.trim()
}
async function until(callback,code,timeout=60000) {
  const deadline=Date.now()+timeout
  while(Date.now()<deadline){try{if(await callback())return}catch{/* owned service startup */}await new Promise(resolve=>setTimeout(resolve,200))}
  throw new Error(code)
}
function image(reference) {
  const data=JSON.parse(docker(['image','inspect',reference]).stdout)[0]
  assert.match(data.Id,/^sha256:[a-f0-9]{64}$/)
  return {reference,id:data.Id,repoDigests:data.RepoDigests}
}
const databaseUrl=database=>`postgresql://postgres:${password}@db:5432/${database}`
function migrate(binary,database) {
  return docker(['run','--rm','--network',network,'--user','1001:1001','--read-only','--cap-drop','ALL','--security-opt','no-new-privileges','--tmpfs','/tmp:rw,noexec,nosuid,nodev,uid=1001,gid=1001,mode=1770,size=67108864','-e',`DATABASE_URL=${databaseUrl(database)}`,'--entrypoint','node',binary.id,'node_modules/prisma/build/index.js','migrate','deploy'],{timeout:180000})
}
async function stopApp() {
  if(!app)return
  docker(['stop','--time','15',app]);docker(['rm',app]);app=undefined
}
async function startApp(binary,database) {
  await stopApp();app=`${prefix}-app-${++sequence}`
  docker(['run','-d','--name',app,'--label','pos.release.drill=true','--network',network,'-p','127.0.0.1::3000','--user','1001:1001','--read-only','--cap-drop','ALL','--security-opt','no-new-privileges','--tmpfs','/tmp:rw,noexec,nosuid,nodev,uid=1001,gid=1001,mode=1770,size=67108864','--tmpfs','/app/.next/cache:rw,noexec,nosuid,nodev,uid=1001,gid=1001,mode=0700,size=67108864','-e',`DATABASE_URL=${databaseUrl(database)}`,'-e',`APP_ORIGIN=${origin}`,'-e','NODE_ENV=production','-e','HOSTNAME=0.0.0.0','-e','PORT=3000','-e','AUTH_TOTP_ENABLED=true','-e','AUTH_CRITICAL_MFA_REQUIRED=true','-e',`AUTH_CHALLENGE_SECRET=${authKey}`,binary.id])
  await until(()=>{
    const state=JSON.parse(docker(['inspect',app]).stdout)[0]
    if(!state.State.Running)throw new Error('RELEASE_DRILL_APP_EXITED')
    return Boolean(state.NetworkSettings.Ports['3000/tcp']?.[0])
  },'RELEASE_DRILL_PUBLISHED_LOOPBACK_PORT_TIMEOUT',10000)
  const inspection=JSON.parse(docker(['inspect',app]).stdout)[0]
  const port=inspection.NetworkSettings.Ports['3000/tcp'][0]
  assert.equal(port.HostIp,'127.0.0.1');base=`http://127.0.0.1:${port.HostPort}`
  await until(async()=>{const r=await fetch(base+'/api/health/live',{signal:AbortSignal.timeout(1000)});return r.status===200},'RELEASE_DRILL_LIVENESS_TIMEOUT')
}
async function probe(expected) {
  // A separate OS process must observe failure even when the app is dead.
  const result=run(process.execPath,['scripts/ops/uptime-probe.mjs'],{env:{POS_PROBE_ORIGIN:base},mayFail:true})
  const record=JSON.parse(result.stdout.trim());assert.equal(record.code,expected)
  assert.equal(result.status,expected==='UPTIME_READY'?0:1)
  return record
}
async function api(path,body) {
  const response=await fetch(base+'/api'+path,{method:body?'POST':'GET',headers:{cookie:'pos_session='+token,origin,'content-type':'application/json'},...(body?{body:JSON.stringify(body)}:{}),signal:AbortSignal.timeout(20000)})
  const result=await response.json()
  if(response.status!==200)throw new Error('RELEASE_DRILL_HTTP_'+response.status+'_'+String(result.error?.code||'UNKNOWN'))
  return result.data
}
const draft=()=>api('/sales',{organizationId:fixture,storeId:fixture,registerId:fixture,shiftId:fixture,operationId:randomUUID(),items:[{productId:fixture,quantity:'1'}]})
const complete=id=>api('/sales/'+id+'/complete',{payments:[{paymentType:'cash',amount:'1.01'}]})
const counts=database=>JSON.parse(sql(database,`SELECT json_build_object('completed',(SELECT count(*) FROM "Sale" WHERE status='completed'),'payments',(SELECT count(*) FROM "Payment"),'movements',(SELECT count(*) FROM "InventoryMovement" WHERE "sourceType"='sale'),'cashTotal',(SELECT sum(amount)::text FROM "Payment"),'stock',(SELECT quantity::text FROM "InventoryBalance" WHERE "storeId"='${fixture}' AND "productId"='${fixture}'));`))
try {
  const previous=image(process.env.POS_DRILL_PREVIOUS_IMAGE||'pos-app:local')
  const current=image(process.env.POS_DRILL_CURRENT_IMAGE||'pos-core185-candidate:20261016')
  assert.notEqual(previous.id,current.id)
  const postgres=image('postgres:15-alpine')
  // Private bridge; only the app's ephemeral loopback port is published. Docker
  // internal bridges suppress published ports, preventing the host probe itself.
  docker(['network','create','--label','pos.release.drill=true',network]);cleanup.push(['network','rm',network])
  docker(['volume','create','--label','pos.release.drill=true',volume]);cleanup.push(['volume','rm',volume])
  docker(['run','-d','--name',pg,'--label','pos.release.drill=true','--network',network,'--network-alias','db','-v',`${volume}:/var/lib/postgresql/data`,'-e',`POSTGRES_PASSWORD=${password}`,'-e',`POSTGRES_DB=${source}`,'-e','POSTGRES_INITDB_ARGS=--auth-host=scram-sha-256 --auth-local=peer',postgres.id]);cleanup.push(['rm','-f',pg])
  await until(()=>docker(['exec','--user','postgres',pg,'pg_isready','-U','postgres','-d',source],{mayFail:true}).status===0,'RELEASE_DRILL_DB_TIMEOUT')
  // Wait past the entrypoint's temporary initialization server.
  await until(()=>sql(source,'SHOW listen_addresses;')==='*','RELEASE_DRILL_DB_INITIALIZATION_TIMEOUT')
  migrate(previous,source)
  const oldMigrationCount=Number(sql(source,'SELECT count(*) FROM "_prisma_migrations" WHERE finished_at IS NOT NULL;'))
  sql(source,`BEGIN;
    INSERT INTO "Organization"(id,name,phone)VALUES('${fixture}','Synthetic release drill','${fixture}');
    INSERT INTO "User"(id,"fullName",phone,"passwordHash")VALUES('${fixture}','Synthetic release operator','${fixture}','not-a-login');
    INSERT INTO "OrganizationUser"(id,"organizationId","userId",role)VALUES('${fixture}','${fixture}','${fixture}','owner');
    INSERT INTO "Store"(id,"organizationId",name,"updatedAt")VALUES('${fixture}','${fixture}','Synthetic branch',NOW());
    INSERT INTO "Register"(id,"storeId",name,code)VALUES('${fixture}','${fixture}','Synthetic till','RELEASE');
    INSERT INTO "Shift"(id,"registerId","organizationUserId","openingCash")VALUES('${fixture}','${fixture}','${fixture}',0);
    INSERT INTO "Product"(id,"organizationId",name,sku,barcode,unit,"salePrice","costPrice","updatedAt")VALUES('${fixture}','${fixture}','Synthetic item','RELEASE','RELEASE','dona',1.01,0.50,NOW());
    INSERT INTO "InventoryBalance"("storeId","productId",quantity,"updatedAt")VALUES('${fixture}','${fixture}',5,NOW());
    UPDATE "Product" SET "imageUrl"='https://legacy-image.invalid/synthetic.png' WHERE id='${fixture}';
    INSERT INTO "Session"(id,"organizationId","userId","tokenHash","expiresAt","idleExpiresAt")VALUES('${randomUUID()}','${fixture}','${fixture}','${tokenHash}',NOW()+INTERVAL '1 hour',NOW()+INTERVAL '1 hour');COMMIT;`)
  await startApp(previous,source);await probe('UPTIME_READY')
  const original=await draft();await complete(original.id);const held=await draft()
  assert.deepEqual(counts(source),{completed:1,payments:1,movements:1,cashTotal:'1.01',stock:'4.000000'})

  const bin=join(work,'bin'),keys=join(work,'keys'),backups=join(work,'backups')
  mkdirSync(bin,{mode:0o700});mkdirSync(keys,{mode:0o700})
  // Transport adapters for stock PostgreSQL tools only; production backup/restore
  // scripts themselves run unchanged. No SQL or financial logic is mocked.
  const shim=`#!/usr/bin/env node
const fs=require('node:fs'),path=require('node:path'),{spawnSync}=require('node:child_process');
const tool=path.basename(process.argv[1]),args=process.argv.slice(2),prefix=['exec','-i','--user','postgres','-e','PGHOST=127.0.0.1','-e','PGPORT=5432','-e','PGUSER','-e','PGPASSWORD','-e','PGDATABASE',process.env.POS_DRILL_DB_CONTAINER,tool];
let input=0,output=1;
if(tool==='pg_dump'){const i=args.findIndex(x=>x.startsWith('--file='));if(i<0)process.exit(2);output=fs.openSync(args.splice(i,1)[0].slice(7),'wx',0o600)}
if(tool==='pg_restore')input=fs.openSync(args.pop(),'r');
const r=spawnSync('docker',[...prefix,...args],{stdio:[input,output,2]});
if(input)fs.closeSync(input);if(output!==1)fs.closeSync(output);process.exit(r.status??1);
`
  for(const tool of ['pg_dump','pg_restore','psql'])writeFileSync(join(bin,tool),shim,{mode:0o700})
  const env={PATH:bin+':'+process.env.PATH,GNUPGHOME:keys,POS_DRILL_DB_CONTAINER:pg,DATABASE_URL:databaseUrl(source),BACKUP_DIRECTORY:backups,POS_BACKUP_APP_VERSION:previous.id,POS_SECRET_RECOVERY_REFERENCE:'synthetic-disposable-key-custody-only',APP_ORIGIN:origin}
  run('gpg',['--batch','--passphrase','','--quick-generate-key','POS disposable release drill','rsa2048','encr','1d'],{env})
  env.BACKUP_RECIPIENT=run('gpg',['--batch','--with-colons','--list-keys'],{env}).stdout.split('\n').find(row=>row.startsWith('fpr:')).split(':')[9]
  const backupStarted=Date.now()
  run('bash',['scripts/ops/backup.sh'],{env})
  const backupFinished=Date.now(),backup=join(backups,readdirSync(backups).find(name=>name.endsWith('.bundle-v1.dump.gpg')))
  assert.equal(statSync(backup).mode&0o777,0o600)
  const lost=await draft();await complete(lost.id)
  assert.equal(counts(source).completed,2)
  const sourceFrozenAt=Date.now();await stopApp()
  sql('postgres',`CREATE DATABASE ${restored};`)
  const restoreStarted=Date.now(),restoreEnv={...env,RESTORE_DATABASE_URL:databaseUrl(restored),RESTORE_CONFIRM_DATABASE:restored,RESTORE_CONFIGURATION_DIRECTORY:join(work,'configuration')}
  run('bash',['scripts/ops/restore.sh',backup],{env:restoreEnv})
  assert.deepEqual(counts(restored),{completed:1,payments:1,movements:1,cashTotal:'1.01',stock:'4.000000'})
  assert.equal(sql(restored,`SELECT count(*) FROM "Sale" WHERE id='${lost.id}';`),'0')
  assert.equal(sql(restored,`SELECT status FROM "Sale" WHERE id='${held.id}';`),'draft')
  assert.equal(sql(restored,`SELECT count(*) FROM "Session" WHERE "revokedAt" IS NULL;`),'0')
  assert.notEqual(run('bash',['scripts/ops/restore.sh',backup],{env:restoreEnv,mayFail:true}).status,0)
  migrate(current,restored)
  const applied=JSON.parse(sql(restored,`SELECT json_agg(json_build_object('name',migration_name,'checksum',checksum) ORDER BY migration_name) FROM "_prisma_migrations" WHERE finished_at IS NOT NULL AND rolled_back_at IS NULL;`))
  assert.ok(applied.length>oldMigrationCount)
  for(const migration of applied)assert.equal(migration.checksum,createHash('sha256').update(readFileSync(join('prisma/migrations',migration.name,'migration.sql'))).digest('hex'))
  assert.equal(sql(restored,`SELECT "imageUrl" FROM "Product" WHERE id='${fixture}';`),'https://legacy-image.invalid/synthetic.png')
  await startApp(current,restored);await probe('UPTIME_UNAVAILABLE')
  // Synthetic fixture has no real users/factors. Explicit review is confined to
  // this newly restored offline database; no real operator attestation is invented.
  run('bash',['scripts/ops/review-restored-auth.sh'],{env:{...restoreEnv,AUTH_RESTORE_REVIEWER:'synthetic-drill-operator',AUTH_RESTORE_REVIEW_EVIDENCE:'local-synthetic-fixture-no-real-identities',AUTH_RESTORE_CREDENTIALS_RECONCILED:'yes',AUTH_RESTORE_ACCESS_RECONCILED:'yes'}})
  token=randomBytes(32).toString('base64url')
  const restoredTokenHash=createHash('sha256').update(token).digest('hex')
  sql(restored,`INSERT INTO "Session"(id,"organizationId","userId","tokenHash","expiresAt","idleExpiresAt")VALUES('${randomUUID()}','${fixture}','${fixture}','${restoredTokenHash}',NOW()+INTERVAL '1 hour',NOW()+INTERVAL '1 hour');`)
  await probe('UPTIME_READY')
  assert.equal((await api('/sales/'+original.id)).totalAmount,'1.01')
  await complete(original.id);await complete(held.id);await complete(held.id)
  assert.deepEqual(counts(restored),{completed:2,payments:2,movements:2,cashTotal:'2.02',stock:'3.000000'})
  const localRestoreToVerifiedWriteSeconds=(Date.now()-restoreStarted)/1000
  checks.push({check:'encrypted_backup_actual_empty_restore_migration_and_current_binary',passed:true,sourceMigrations:oldMigrationCount,restoredMigrations:applied.length,newMigrations:applied.slice(oldMigrationCount).map(row=>row.name),backupCiphertextSha256:createHash('sha256').update(readFileSync(backup)).digest('hex'),backupBytes:statSync(backup).size,nonemptyTargetRejected:true,oldSessionsRevoked:true,quarantineReadiness503:true,heldDraftPreserved:true,originalAmount:'1.01',originalRetryCreatedPayments:0,localRestoreToVerifiedWriteSeconds})
  await startApp(previous,restored);await probe('UPTIME_READY')
  await complete(original.id);await complete(held.id)
  const rollbackSale=await draft();await complete(rollbackSale.id);await complete(rollbackSale.id)
  const final={completed:3,payments:3,movements:3,cashTotal:'3.03',stock:'2.000000'}
  assert.deepEqual(counts(restored),final)
  await startApp(current,restored);await probe('UPTIME_READY');await complete(rollbackSale.id)
  assert.deepEqual(counts(restored),final)
  assert.equal(counts(source).completed,2)
  checks.push({check:'actual_previous_binary_on_additive_current_schema_then_forward_again',passed:true,previousImageId:previous.id,currentImageId:current.id,final,duplicateFinancialEffects:0,sourceDatabaseUnchangedByRestore:true,databaseDownMigration:false})
  const shareKey=randomUUID()
  await api('/sales/'+original.id+'/receipt-links',{operationId:shareKey,consent:true})
  const share=(await api('/sales/'+original.id+'/receipt-links')).rows.find(row=>row.operationId===shareKey)
  const [receiptOrganizationId,receiptOperationId,receiptCapability]=new URL(share.url).hash.slice(1).split('.')
  const receiptProof={organizationId:receiptOrganizationId,operationId:receiptOperationId,capability:receiptCapability}
  const customer=await api('/customers',{organizationId:fixture,fullName:'Synthetic recovery customer',phone:'000000000',creditLimit:100})
  await api('/customers/'+customer.id+'/ledger',{operationId:randomUUID(),kind:'opening',amount:'1.01',reason:'Synthetic recovery debt',effectiveAt:new Date(Date.now()-3*86400000).toISOString(),dueAt:new Date(Date.now()-86400000).toISOString()})
  const consent=await api('/customers/'+customer.id+'/consents',{operationId:randomUUID(),expectedRevision:0,purpose:'service_reminder',channel:'in_person',granted:true,source:'customer_request',evidenceRef:'synthetic-recovery-request',policyVersion:'service-in-person-v1'})
  await api('/customers/'+customer.id+'/reminders',{operationId:randomUUID(),consentEventId:consent.id})
  docker(['run','--rm','--network',network,'--user','1001:1001','--read-only','--cap-drop','ALL','--security-opt','no-new-privileges','--tmpfs','/tmp:rw,noexec,nosuid,nodev,uid=1001,gid=1001,mode=1770,size=67108864','-e',`DATABASE_URL=${databaseUrl(restored)}`,'-e',`APP_ORIGIN=${origin}`,'-e','NODE_ENV=production','-e','AUTH_TOTP_ENABLED=true','-e','AUTH_CRITICAL_MFA_REQUIRED=true','-e',`AUTH_CHALLENGE_SECRET=${authKey}`,'--entrypoint','node',current.id,'--require','./scripts/worker-resolver.cjs','.worker-build/scripts/workers/jobs.js','--once'])
  const reminder=(await api('/customers/'+customer.id+'/reminders')).rows[0]
  assert.equal(reminder.available,true)
  const [reminderOrganizationId,reminderJobId,reminderCapability]=new URL(reminder.url).hash.slice(1).split('.')
  const reminderProof={organizationId:reminderOrganizationId,jobId:reminderJobId,capability:reminderCapability}
  async function publicView(path,body,status){const response=await fetch(base+'/api'+path,{method:'POST',headers:{origin,'content-type':'application/json'},body:JSON.stringify(body),signal:AbortSignal.timeout(15000)});assert.equal(response.status,status);return response.json()}
  assert.equal((await publicView('/receipt-view',receiptProof,200)).data.totalAmount,'1.01')
  assert.equal((await publicView('/reminder-view',reminderProof,200)).data.debtTotal,'1.01')
  await stopApp()
  const secondBackups=join(work,'capability-backups')
  run('bash',['scripts/ops/backup.sh'],{env:{...env,DATABASE_URL:databaseUrl(restored),BACKUP_DIRECTORY:secondBackups,POS_BACKUP_APP_VERSION:current.id}})
  const secondBackup=join(secondBackups,readdirSync(secondBackups).find(name=>name.endsWith('.bundle-v1.dump.gpg'))),capabilityDatabase='release_capability_restored'
  sql('postgres',`CREATE DATABASE ${capabilityDatabase};`)
  const secondEnv={...env,RESTORE_DATABASE_URL:databaseUrl(capabilityDatabase),RESTORE_CONFIRM_DATABASE:capabilityDatabase,RESTORE_CONFIGURATION_DIRECTORY:join(work,'capability-configuration')}
  run('bash',['scripts/ops/restore.sh',secondBackup],{env:secondEnv})
  run('bash',['scripts/ops/review-restored-auth.sh'],{env:{...secondEnv,AUTH_RESTORE_REVIEWER:'synthetic-drill-operator',AUTH_RESTORE_REVIEW_EVIDENCE:'second-local-synthetic-restore-no-real-identities',AUTH_RESTORE_CREDENTIALS_RECONCILED:'yes',AUTH_RESTORE_ACCESS_RECONCILED:'yes'}})
  await startApp(current,capabilityDatabase);await probe('UPTIME_READY')
  await publicView('/receipt-view',receiptProof,404);await publicView('/reminder-view',reminderProof,404)
  token=randomBytes(32).toString('base64url')
  const reviewedTokenHash=createHash('sha256').update(token).digest('hex')
  sql(capabilityDatabase,`INSERT INTO "Session"(id,"organizationId","userId","tokenHash","expiresAt","idleExpiresAt")VALUES('${randomUUID()}','${fixture}','${fixture}','${reviewedTokenHash}',NOW()+INTERVAL '1 hour',NOW()+INTERVAL '1 hour');`)
  assert.equal((await api('/sales/'+original.id+'/receipt-links')).rows[0].available,false)
  assert.equal((await api('/sales/'+original.id+'/receipt-links',{operationId:shareKey,consent:true})).available,false)
  assert.equal((await api('/customers/'+customer.id+'/reminders')).rows[0].available,false)
  assert.deepEqual(counts(capabilityDatabase),final)
  checks.push({check:'real_receipt_and_worker_prepared_reminder_fenced_after_second_encrypted_restore_and_review',passed:true,beforeRestoreStatuses:{receipt:200,reminder:200},afterRestoreStatuses:{receipt:404,reminder:404},authenticationReviewed:true,ownerListsAndOldKeyReplayAlsoUnavailable:true,financialEffectsPreserved:final,legacyRemoteImageMetadataPreserved:true})
  const uptimeReady=await probe('UPTIME_READY')
  await stopApp();const uptimeStopped=await probe('UPTIME_UNREACHABLE')
  await startApp(current,'nonexistent_database');const uptimeDependency=await probe('UPTIME_UNAVAILABLE')
  await stopApp()
  const diskReady=JSON.parse(run(process.execPath,['scripts/ops/host-health.mjs'],{env:{POS_DATA_DIRECTORY:work,POS_DISK_MIN_FREE_BYTES:'0',POS_DISK_MIN_FREE_PERCENT:'0'}}).stdout)
  assert.equal(diskReady.code,'HOST_DISK_READY')
  const diskLow=JSON.parse(run(process.execPath,['scripts/ops/host-health.mjs'],{env:{POS_DATA_DIRECTORY:work,POS_DISK_MIN_FREE_BYTES:(BigInt(diskReady.totalBytes)+1n).toString(),POS_DISK_MIN_FREE_PERCENT:'0'},mayFail:true}).stdout)
  assert.equal(diskLow.code,'HOST_DISK_LOW')
  checks.push({check:'independent_real_application_and_filesystem_fault_observation',passed:true,uptimeReady,uptimeStopped,uptimeDependency,disk:{ready:diskReady.code,low:diskLow.code,realStatfs:true,method:'threshold set above actual capacity; no disk filled'},limits:'Independent local OS process, not an independent physical hosting provider or real on-call delivery.'})
  const files=['scripts/ops/test-release-images.mjs','scripts/ops/backup.sh','scripts/ops/restore.sh','scripts/ops/backup-manifest.mjs','scripts/ops/auth-restore-quarantine.sql','scripts/ops/review-restored-auth.sh','scripts/ops/uptime-probe.mjs','scripts/ops/host-health.mjs']
  evidence={task:'RELEASE-01.06',status:'local_release_image_acceptance_passed',executedAtUtc:new Date().toISOString(),command:'node scripts/ops/test-release-images.mjs',sourceRevision:run('git',['rev-parse','HEAD']).stdout.trim(),scope:'Actual local immutable images, PostgreSQL migrations, GPG encrypted backup and restore; synthetic data only; no real staging/production/pilot.',images:{previous,current,postgres},migrationChecksums:applied,recovery:{backupDurationSeconds:(backupFinished-backupStarted)/1000,localBackupToSourceStopSeconds:(sourceFrozenAt-backupStarted)/1000,localRestoreToVerifiedWriteSeconds,committedBeforeBackupSalesLost:0,intentionallyCreatedAfterBackupSalesAbsent:1,observedRestoredFinancialEffects:final,technicalTargets:{rpoMinutes:15,rtoHours:4},productionRpoRtoMeasured:false},checks,files:files.map(path=>({path,sha256:createHash('sha256').update(readFileSync(path)).digest('hex')})),limits:['Physical host loss, actual off-host recovery, production timing and operator custody require separate external acceptance.','The intentionally committed post-backup sale is absent after restore; RPO loss is not claimed to be zero.','Test sessions are seeded only in the private disposable fixture. This does not attest real customer login/MFA recovery or production access review.','External provider/hardware calls and real production deployment were not performed.']}
} finally {
  if(app)docker(['rm','-f',app],{mayFail:true})
  const failed=cleanup.reverse().filter(args=>docker(args,{mayFail:true}).status!==0)
  run('gpgconf',['--homedir',join(work,'keys'),'--kill','gpg-agent'],{mayFail:true})
  rmSync(work,{recursive:true,force:true})
  if(failed.length)throw new Error('RELEASE_DRILL_CLEANUP_FAILED')
}
evidence.cleanup='all disposable app/DB containers, networks, volumes, plaintext, ciphertext and private GPG/auth/database keys removed'
const output=resolve(process.env.POS_RELEASE_DRILL_EVIDENCE||'tasks/evidence/release-images-20261016.json')
writeFileSync(output,JSON.stringify(evidence,null,2)+'\n')
console.log('PASS: encrypted restore, migration, actual image rollback/forward, exact retries, external-process outage and real disk alerts. Evidence: '+output)
