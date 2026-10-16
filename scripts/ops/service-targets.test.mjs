import {test} from 'node:test';
import assert from 'node:assert/strict';
import {mkdtempSync,mkdirSync,writeFileSync,rmSync,readFileSync,symlinkSync} from 'node:fs';
import {tmpdir} from 'node:os';
import {join,dirname} from 'node:path';
import {createHash} from 'node:crypto';
import gate from '../release/check-service-targets.cjs';

const now=new Date('2026-10-16T10:00:00Z'),sha=bytes=>createHash('sha256').update(bytes).digest('hex');
function fixture(run){
 const root=mkdtempSync(join(tmpdir(),'pos-service-targets-'));
 const write=(file,value)=>{mkdirSync(dirname(join(root,file)),{recursive:true});writeFileSync(join(root,file),typeof value==='string'?value:JSON.stringify(value));};
 const reference=(file,value)=>{write(file,value);return {path:file,sha256:sha(readFileSync(join(root,file)))};};
 for(const file of ['src/server/service.ts','src/lib/auth.ts','src/app/api/products/route.ts','prisma/schema.prisma','prisma/migrations/fixture/migration.sql','package.json','package-lock.json','tests/performance/core-profile.ts','tests/performance/core-measure.ts','tests/performance/core-resume-seed.ts','tests/performance/retry.ts'])write(file,'synthetic source');
 write('docs/operations/release-service-targets.md','Synthetic technical-readiness documentation');
 const load={version:3,at:now.toISOString(),environment:{cpu:'Synthetic CPU',postgres:'PostgreSQL synthetic',logicalCpus:2,totalMemoryBytes:4096},databaseMigrations:[{migrationName:'fixture',checksum:sha('synthetic source')}],dataset:{products:50000,syntheticDraftItems:1000000,activeRegisters:20},concurrency:20,actorRole:'owner',checkoutItemsPerSale:1,search:{samples:100,attempted:100,failed:0,byStatus:{200:100},p95Ms:400,targetMs:500},checkout:{samples:100,attempted:100,failed:0,p95Ms:1000,targetMs:2000},draft:{attempted:100,succeeded:100,excludedFromCheckoutLatency:true},errorRate:{failed:0,denominator:200,rate:0},economicInvariants:{newCompletedSales:100,newPayments:100},errors:[]};
 load.physicalAttempts={draft:{calls:102,conflicts:2,retries:2,failed:2},checkout:{calls:103,conflicts:3,retries:3,failed:3}};
 load.retryPolicy={maxAttempts:8,deadlineMs:10000,code:'CONCURRENT_CONFLICT',originalKey:true,checkoutLatencyIncludesBackoff:true};
 load.rawErrorRate={failed:5,denominator:305,rate:5/305};
 load.fixtureOrganizationId='synthetic-fixture';
 const dataset=reference('tasks/evidence/dataset.json',{organizationId:load.fixtureOrganizationId,dataset:{products:50000,saleItems:1000000,activeRegisters:20}});
 write('scripts/ops/pitr/restore-wal.sh','synthetic recovery source');
 const recoverySource={path:'scripts/ops/pitr/restore-wal.sh',sha256:sha(readFileSync(join(root,'scripts/ops/pitr/restore-wal.sh')))};
 const recovery=reference('tasks/evidence/recovery.json',{status:'passed',files:[recoverySource],checks:[{check:'real_timestamp_restore',passed:true,targetTimestampUtc:'2026-10-16T09:50:00Z',lastReplayedCommit:'2026-10-16T09:49:59Z',committedBeforeTargetRowsLost:0,localFixtureRecoverySeconds:10}]});
 const report={version:1,task:'RELEASE-01.08',scope:'local_technical_readiness',contractualSla:false,productionVerified:false,sourceRevision:'c'.repeat(40),measuredAt:now.toISOString(),sourceHashes:gate.sourceHashes(root),load:reference('tasks/evidence/load.json',load),fixture:dataset,targets:{rpoSeconds:900,rtoSeconds:14400,status:'technical_plan_not_customer_sla',uptimePercent:null,uptimeStatus:'unapproved_and_unmeasured',support:{status:'owner_proposed_not_contractual',timezone:'Asia/Tashkent',weekdays:[1,2,3,4,5,6],opensMinute:540,closesMinute:1080,firstResponseBusinessMinutes:240,resolutionMinutes:null,emergencyContact:null}},recovery:{artifact:recovery,scope:'isolated_local_pitr',rpoStatus:'production_unmeasured_target_selection_verified',committedBeforeTargetRowsLost:0,rtoSeconds:10,productionSlaVerified:false},historical:[],documentationSha256:sha(readFileSync(join(root,'docs/operations/release-service-targets.md')))};
 try{run({root,report,load,write,reference});}finally{rmSync(root,{recursive:true,force:true});}
}
test('service-target gate accepts complete local evidence without implying uptime or contractual SLA',()=>fixture(({root,report})=>{
 assert.equal(gate.validateServiceTargets(report,{root,now}).denominator,200);
 assert.equal(gate.validateServiceTargets(report,{root,now}).contractualSla,false);
}));
test('service-target gate rejects omitted errors, incomplete sample denominators and excessive p95',()=>{
 for(const mutation of [load=>{delete load.errors;},load=>{load.rawErrorRate.failed=0;},load=>{load.physicalAttempts.checkout.calls=100;},load=>{load.retryPolicy.originalKey=false;},load=>{load.errorRate.denominator=199;},load=>{load.search.p95Ms=501;},load=>{load.checkout.failed=1;},load=>{load.economicInvariants.newPayments=99;}])fixture(({root,report,load,reference})=>{
  mutation(load);report.load=reference('tasks/evidence/load.json',load);assert.throws(()=>gate.validateServiceTargets(report,{root,now}),/LOAD_|LATENCY_/);
 });
});
test('service-target gate fails after source additions, evidence tampering, expiry or unsupported SLA claims',()=>{
 for(const mutation of [({write})=>write('src/server/new-business-rule.ts','new code'),({write})=>write('tasks/evidence/load.json','{}'),({report})=>{report.measuredAt='2026-09-01T00:00:00Z';},({report})=>{report.contractualSla=true;},({report})=>{report.targets.uptimePercent=99.99;},({write})=>write('docs/operations/release-service-targets.md','changed docs')])fixture(context=>{
  mutation(context);assert.throws(()=>gate.validateServiceTargets(context.report,{root:context.root,now}),/STALE|HASH_MISMATCH|INVALID_SCOPE|UNSUPPORTED_SERVICE_PROMISE/);
 });
});
test('service-target gate rejects missing recovery evidence, traversal and symlink evidence',()=>fixture(({root,report})=>{
 const original=report.recovery.artifact;
 report.recovery.artifact={path:'tasks/evidence/missing.json',sha256:original.sha256};assert.throws(()=>gate.validateServiceTargets(report,{root,now}),/EVIDENCE_MISSING/);
 report.recovery.artifact={path:'tasks/evidence/../../package.json',sha256:original.sha256};assert.throws(()=>gate.validateServiceTargets(report,{root,now}),/UNSAFE_EVIDENCE_PATH/);
 symlinkSync(join(root,'package.json'),join(root,'tasks/evidence/link.json'));
 report.recovery.artifact={path:'tasks/evidence/link.json',sha256:sha(readFileSync(join(root,'package.json')))};assert.throws(()=>gate.validateServiceTargets(report,{root,now}),/UNSAFE_EVIDENCE_PATH/);
}));
test('service-target gate rejects failed recovery, lost pre-target commits and stale recovery scripts',()=>{
 for(const mutation of [proof=>{proof.status='failed';},proof=>{proof.checks[0].committedBeforeTargetRowsLost=1;},proof=>{proof.checks[0].localFixtureRecoverySeconds=11;},proof=>{proof.checks[0].lastReplayedCommit='2026-10-16T09:50:01Z';},proof=>{proof.files[0].sha256='0'.repeat(64); }])fixture(({root,report,reference})=>{
  const proof=JSON.parse(readFileSync(join(root,report.recovery.artifact.path),'utf8'));mutation(proof);report.recovery.artifact=reference('tasks/evidence/recovery.json',proof);
  assert.throws(()=>gate.validateServiceTargets(report,{root,now}),/RECOVERY_ARTIFACT_FAILED|RECOVERY_SOURCE_STALE/);
 });
});
test('service-target gate rejects an unapplied or checksum-mismatched database migration',()=>{
 for(const mutation of [load=>{load.databaseMigrations=[];},load=>{load.databaseMigrations[0].checksum='0'.repeat(64);},load=>{load.databaseMigrations.push({...load.databaseMigrations[0]});}])fixture(({root,report,load,reference})=>{
  mutation(load);report.load=reference('tasks/evidence/load.json',load);assert.throws(()=>gate.validateServiceTargets(report,{root,now}),/DATABASE_MIGRATIONS_NOT_CURRENT/);
 });
});
