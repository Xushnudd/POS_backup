#!/usr/bin/env node
// Read-only documentation gate. It never opens an environment file or database.
const fs=require('node:fs');
const path=require('node:path');
const {createHash}=require('node:crypto');
const SOURCE_DIRECTORIES=['src/server','src/lib','src/app/api','prisma'];
const SOURCE_FILES=['package.json','package-lock.json','tests/performance/core-profile.ts','tests/performance/core-measure.ts','tests/performance/core-resume-seed.ts','tests/performance/retry.ts'];
const RECOVERY_FILES=new Set(['scripts/ops/pitr/archive-wal.sh','scripts/ops/pitr/restore-wal.sh','scripts/ops/pitr/base-backup.sh','scripts/ops/pitr/prepare-restore.sh','scripts/ops/pitr/retention-plan.mjs','scripts/ops/pitr-retention.test.mjs','scripts/ops/pitr-shell.test.mjs','scripts/ops/test-pitr.mjs','ops/postgresql/pitr-policy.json','ops/postgresql/pitr.conf','docker-compose.pitr.yml','docs/operations/pitr.md']);
function fail(code){throw new Error(code);}
function read(root,file){
 if(typeof file!=='string'||path.isAbsolute(file)||file.split('/').some(part=>!part||part==='..'||part==='.'))fail('UNSAFE_EVIDENCE_PATH');
 let cursor=root;
 try{for(const part of file.split('/')){cursor=path.join(cursor,part);if(fs.lstatSync(cursor).isSymbolicLink())fail('UNSAFE_EVIDENCE_PATH');}}
 catch(error){if(error.code==='ENOENT')fail('EVIDENCE_MISSING');throw error;}
 return fs.readFileSync(cursor);
}
const sha=bytes=>createHash('sha256').update(bytes).digest('hex');
function sourceHashes(root){
 const files=[...SOURCE_FILES];
 function walk(directory){
  for(const entry of fs.readdirSync(path.join(root,directory),{withFileTypes:true})){
   const file=directory+'/'+entry.name;
   if(entry.isSymbolicLink())fail('SOURCE_SYMLINK_REJECTED');
   if(entry.isDirectory())walk(file);else if(entry.isFile()){
    if(!/\.(?:ts|tsx|js|cjs|mjs|json|sql|prisma|toml)$/.test(entry.name))fail('UNEXPECTED_SOURCE_FILE');
    files.push(file);
   }
  }
 }
 SOURCE_DIRECTORIES.forEach(walk);
 return Object.fromEntries(files.sort().map(file=>[file,sha(read(root,file))]));
}
function artifact(root,reference){
 if(!reference||typeof reference.path!=='string'||!/^tasks\/evidence\/[A-Za-z0-9._/-]+\.json$/.test(reference.path)||!/^[a-f0-9]{64}$/.test(reference.sha256))fail('INVALID_ARTIFACT_REFERENCE');
 const bytes=read(root,reference.path);if(sha(bytes)!==reference.sha256)fail('ARTIFACT_HASH_MISMATCH');
 return JSON.parse(bytes);
}
function validateServiceTargets(report,{root=process.cwd(),now=new Date()}={}){
 if(report?.version!==1||report.task!=='RELEASE-01.08'||report.scope!=='local_technical_readiness'||report.contractualSla!==false||report.productionVerified!==false||!/^[a-f0-9]{40}$/.test(report.sourceRevision))fail('INVALID_SCOPE');
 const timestamp=Date.parse(report.measuredAt);
 if(!Number.isFinite(timestamp)||timestamp>now.getTime()+300000||now.getTime()-timestamp>14*86400000)fail('CURRENT_MEASUREMENT_STALE');
 const current=sourceHashes(root);
 if(JSON.stringify(current)!==JSON.stringify(report.sourceHashes))fail('SOURCE_EVIDENCE_STALE');
 const load=artifact(root,report.load);
 const fixture=artifact(root,report.fixture);
 if(fixture.organizationId!==load.fixtureOrganizationId||fixture.dataset?.products!==50000||fixture.dataset?.saleItems!==1000000||fixture.dataset?.activeRegisters!==20)fail('FIXTURE_EVIDENCE_MISMATCH');
 const migrationFiles=Object.keys(current).filter(file=>/^prisma\/migrations\/[^/]+\/migration\.sql$/.test(file));
 if(!Array.isArray(load.databaseMigrations)||load.databaseMigrations.length!==migrationFiles.length||new Set(load.databaseMigrations.map(row=>row.migrationName)).size!==migrationFiles.length||load.databaseMigrations.some(row=>!/^[A-Za-z0-9_-]+$/.test(row.migrationName)||current['prisma/migrations/'+row.migrationName+'/migration.sql']!==row.checksum))fail('DATABASE_MIGRATIONS_NOT_CURRENT');
 if(load.version!==3||load.at!==report.measuredAt||load.dataset?.products!==50000||load.dataset?.syntheticDraftItems!==1000000||load.dataset?.activeRegisters!==20||load.concurrency!==20||load.actorRole!=='owner'||load.checkoutItemsPerSale!==1)fail('LOAD_PROFILE_INCOMPLETE');
 if(load.errors?.length!==0||load.search?.samples!==100||load.search?.attempted!==100||load.search?.failed!==0||load.search?.byStatus?.['200']!==100||Object.keys(load.search.byStatus).length!==1||load.checkout?.samples!==100||load.checkout?.attempted!==100||load.checkout?.failed!==0||load.draft?.attempted!==100||load.draft?.succeeded!==100||load.draft?.excludedFromCheckoutLatency!==true)fail('LOAD_ERRORS_OR_MISSING_SAMPLES');
 const physical=load.physicalAttempts,policy=load.retryPolicy;
 if(!physical||policy?.maxAttempts!==8||policy?.deadlineMs!==10000||policy?.code!=='CONCURRENT_CONFLICT'||policy?.originalKey!==true||policy?.checkoutLatencyIncludesBackoff!==true)fail('LOAD_RETRY_PROTOCOL_INVALID');
 for(const key of ['draft','checkout']){
  const counts=physical[key];
  if(!counts||!Number.isSafeInteger(counts.calls)||!Number.isSafeInteger(counts.conflicts)||counts.conflicts<0||counts.failed!==counts.conflicts||counts.calls!==100+counts.conflicts||counts.retries!==counts.conflicts||counts.calls>800)fail('LOAD_PHYSICAL_ATTEMPTS_INVALID');
 }
 const rawDenominator=100+physical.draft.calls+physical.checkout.calls,rawFailed=physical.draft.conflicts+physical.checkout.conflicts;
 if(load.rawErrorRate?.denominator!==rawDenominator||load.rawErrorRate?.failed!==rawFailed||load.rawErrorRate?.rate!==rawFailed/rawDenominator)fail('LOAD_RAW_ERRORS_OMITTED');
 if(load.errorRate?.denominator!==200||load.errorRate?.failed!==0||load.errorRate?.rate!==0||load.economicInvariants?.newCompletedSales!==100||load.economicInvariants?.newPayments!==100)fail('LOAD_DENOMINATOR_OR_INVARIANTS_INVALID');
 for(const [key,target] of [['search',500],['checkout',2000]])if(!Number.isFinite(load[key].p95Ms)||load[key].p95Ms<0||load[key].p95Ms>target||load[key].targetMs!==target)fail('LATENCY_TARGET_FAILED');
 if(!load.environment?.cpu||!load.environment?.postgres||!Number.isSafeInteger(load.environment?.logicalCpus)||load.environment.logicalCpus<1||!Number.isSafeInteger(load.environment?.totalMemoryBytes)||load.environment.totalMemoryBytes<1)fail('HARDWARE_NOT_RECORDED');
 if(report.targets?.rpoSeconds!==900||report.targets?.rtoSeconds!==14400||report.targets?.status!=='technical_plan_not_customer_sla'||report.targets?.uptimePercent!==null||report.targets?.uptimeStatus!=='unapproved_and_unmeasured')fail('UNSUPPORTED_SERVICE_PROMISE');
 const support=report.targets?.support;
 if(support?.status!=='owner_proposed_not_contractual'||support?.timezone!=='Asia/Tashkent'||JSON.stringify(support?.weekdays)!=='[1,2,3,4,5,6]'||support?.opensMinute!==540||support?.closesMinute!==1080||support?.firstResponseBusinessMinutes!==240||support?.resolutionMinutes!==null||support?.emergencyContact!==null)fail('SUPPORT_TARGET_MISMATCH');
 if(!report.recovery)fail('RECOVERY_TARGET_NOT_EVIDENCED');
 const recovery=artifact(root,report.recovery.artifact),restore=recovery.checks?.find(check=>check.check==='real_timestamp_restore');
 if(recovery.status!=='passed'||!Array.isArray(recovery.checks)||recovery.checks.some(check=>check.passed!==true)||!Number.isFinite(Date.parse(restore?.targetTimestampUtc))||!Number.isFinite(Date.parse(restore?.lastReplayedCommit))||Date.parse(restore.lastReplayedCommit)>Date.parse(restore.targetTimestampUtc)||restore?.committedBeforeTargetRowsLost!==0||restore?.localFixtureRecoverySeconds!==report.recovery.rtoSeconds)fail('RECOVERY_ARTIFACT_FAILED');
 if(!Array.isArray(recovery.files)||!recovery.files.length)fail('RECOVERY_SOURCE_MISSING');
 for(const reference of recovery.files){
  if(!RECOVERY_FILES.has(reference.path)||sha(read(root,reference.path))!==reference.sha256)fail('RECOVERY_SOURCE_STALE');
 }
 if(report.recovery.scope!=='isolated_local_pitr'||report.recovery.rpoStatus!=='production_unmeasured_target_selection_verified'||report.recovery.committedBeforeTargetRowsLost!==0||!Number.isFinite(report.recovery.rtoSeconds)||report.recovery.rtoSeconds<=0||report.recovery.rtoSeconds>14400||report.recovery.productionSlaVerified!==false)fail('RECOVERY_TARGET_NOT_EVIDENCED');
 for(const reference of report.historical??[])artifact(root,reference);
 const documentation=read(root,'docs/operations/release-service-targets.md').toString();
 if(sha(Buffer.from(documentation))!==report.documentationSha256)fail('DOCUMENTATION_STALE');
 return {task:report.task,currentSearchP95Ms:load.search.p95Ms,currentCheckoutP95Ms:load.checkout.p95Ms,failed:0,denominator:200,rawFailed,rawDenominator,sourceFiles:Object.keys(current).length,scope:report.scope,contractualSla:false};
}
if(require.main===module){
 try{const report=JSON.parse(read(process.cwd(),'tasks/evidence/release-service-targets-20261016-core185.json'));console.info(JSON.stringify(validateServiceTargets(report)));}
 catch(error){console.error('SERVICE_TARGETS_'+(error.message??'CHECK_FAILED'));process.exitCode=1;}
}
module.exports={sourceHashes,validateServiceTargets};
