import test,{after} from 'node:test';
import assert from 'node:assert/strict';
import {randomUUID,randomBytes} from 'node:crypto';
import {type ReportSchedule} from '@prisma/client';
import {prisma} from '@/lib/prisma';
import {sessionHash} from '@/server/auth/session';
import type {TokenPayload} from '@/lib/auth';
import {configureSchedule,stopSchedule} from '@/server/reports/schedules';
import {latestReportOccurrence,type ScheduleConfiguration} from '@/server/reports/schedule-contract';
import {enqueueDueReports,claimReportRun,executeReportRun,recoverReportRuns} from '@/server/reports/schedule-worker';
import {scheduledArtifact} from '@/server/reports/schedule-artifact';
const url=new URL(process.env.DATABASE_URL??'');
if(url.hostname!=='127.0.0.1'||url.port!=='55439'||url.pathname!=='/pos_test'||url.username!=='pos_test')throw Error('Isolated pos_test only');
const orgs:string[]=[],users:string[]=[];
after(async()=>{await prisma.organization.deleteMany({where:{id:{in:orgs}}});await prisma.user.deleteMany({where:{id:{in:users}}});await prisma.$disconnect();});
const config:ScheduleConfiguration={cadence:{frequency:'daily',hour:0,minute:0},retentionHours:24,missedRunPolicy:'latest_only',
  report:{storeIds:[],rangeDays:1,period:'through_now',window:'rolling_days',metrics:['saleCount','netSales','grossProfit']}};
async function fixture(legacy=false){
  const org=legacy?await prisma.$transaction(async tx=>{
    await tx.$executeRawUnsafe('ALTER TABLE "Organization" DISABLE TRIGGER billing_enroll_new_org');
    const row=await tx.organization.create({data:{name:'Synthetic legacy schedule fixture',phone:randomUUID()}});
    await tx.$executeRawUnsafe('ALTER TABLE "Organization" ENABLE TRIGGER billing_enroll_new_org');return row;
  }):await prisma.organization.create({data:{name:'Schedule fixture',phone:randomUUID()}});orgs.push(org.id);
  const user=await prisma.user.create({data:{fullName:'Schedule owner',phone:randomUUID(),passwordHash:'not-a-login'}});users.push(user.id);
  const member=await prisma.organizationUser.create({data:{organizationId:org.id,userId:user.id,role:'owner'}});
  const session=await prisma.session.create({data:{organizationId:org.id,userId:user.id,tokenHash:sessionHash(randomBytes(32).toString('base64url')),expiresAt:new Date(Date.now()+3600000),idleExpiresAt:new Date(Date.now()+3600000)}});
  const store=await prisma.store.create({data:{organizationId:org.id,name:'=Private schedule branch'}});
  const ctx:TokenPayload={organizationId:org.id,organizationUserId:member.id,userId:user.id,role:'owner',storeIds:[store.id],sessionId:session.id};
  return {org,user,member,ctx,store};
}
// Synthetic restored/overdue definition. Production configureSchedule always
// starts strictly in the future; no production clock override is introduced.
async function overdue(f:Awaited<ReturnType<typeof fixture>>,days=0,configuration=config){
  const due=latestReportOccurrence(new Date(), 'Asia/Tashkent', configuration.cadence);due.setUTCDate(due.getUTCDate()-days);
  return prisma.$transaction(async tx=>{
    const schedule=await tx.reportSchedule.create({data:{organizationId:f.org.id,name:'Synthetic restored report',enabled:true,revision:1,configuration:JSON.parse(JSON.stringify(configuration)),grantMembershipId:f.member.id,timezone:'Asia/Tashkent',currency:'UZS',nextRunAt:due}});
    await tx.auditLog.create({data:{organizationId:f.org.id,actorId:f.user.id,entityType:'ReportSchedule',entityId:schedule.id,action:'report_schedule_configured',afterData:{name:schedule.name,enabled:true,revision:1,configuration:schedule.configuration,grantMembershipId:f.member.id,timezone:schedule.timezone,currency:schedule.currency}}});
    return schedule;
  });
}
async function currentRun(schedule:ReportSchedule){return prisma.reportScheduleRun.findFirstOrThrow({where:{scheduleId:schedule.id,state:'queued'}});}
test('Owner configuration is disabled by default choice, idempotent, revision-safe and native-proof protected',async()=>{
  const f=await fixture(),input={operationId:randomUUID(),expectedRevision:0,name:'Configured business report',enabled:false,configuration:config,reason:'Owner reviewed internal report policy'};
  const first=await configureSchedule(f.ctx,input),replay=await configureSchedule(f.ctx,input);assert.equal(first.id,replay.id);assert.equal(await prisma.reportSchedule.count({where:{organizationId:f.org.id}}),1);
  assert.equal(first.enabled,false);assert.equal(first.nextRunAt,null);
  await assert.rejects(configureSchedule(f.ctx,{...input,name:'Changed old intent'}),{code:'OPERATION_PAYLOAD_CONFLICT'});
  const enabled=await configureSchedule(f.ctx,{...input,operationId:randomUUID(),id:first.id,expectedRevision:1,enabled:true});
  assert.equal(enabled.revision,2);assert.ok(new Date(enabled.nextRunAt!)>new Date());
  await assert.rejects(configureSchedule(f.ctx,{...input,operationId:randomUUID(),id:first.id,expectedRevision:1,enabled:true}),{code:'REPORT_REVISION_CHANGED'});
  await assert.rejects(prisma.reportSchedule.update({where:{id:first.id},data:{name:'Forged policy',revision:3}}));
  const stopped=await stopSchedule(f.ctx,first.id,{operationId:randomUUID(),expectedRevision:2,reason:'Owner revoked automatic report grant'});assert.equal(stopped.enabled,false);assert.equal(stopped.revision,3);
});
test('Concurrent scheduler/claims publish one private original artifact and full scoped CSV/JSON',async()=>{
  const f=await fixture(),schedule=await overdue(f);
  await Promise.all([enqueueDueReports(),enqueueDueReports()]);assert.equal(await prisma.reportScheduleRun.count({where:{scheduleId:schedule.id}}),1);
  const claims=await Promise.all([claimReportRun(),claimReportRun()]),run=claims.find(Boolean)!;assert.equal(claims.filter(Boolean).length,1);assert.equal(run.scheduleId,schedule.id);
  assert.equal((await executeReportRun(run)).succeeded,true);assert.equal((await executeReportRun(run)).succeeded,false);
  const original=await prisma.reportScheduleRun.findUniqueOrThrow({where:{id:run.id}});assert.equal(original.state,'succeeded');assert.equal(original.attempts,1);assert.ok(original.size>0);
  assert.equal(await prisma.auditLog.count({where:{entityId:run.id,action:'report_succeeded'}}),1);
  const json=await scheduledArtifact(f.ctx,run.id,'json');assert.equal(JSON.parse(json.data.toString()).organizationId,f.org.id);
  const csv=await scheduledArtifact(f.ctx,run.id,'csv');assert.ok(csv.data.toString().includes("'=Private schedule branch"));
  const workbook=await scheduledArtifact(f.ctx,run.id,'xlsx');assert.equal(workbook.data.subarray(0,2).toString(),'PK');
  const print=await scheduledArtifact(f.ctx,run.id,'pdf');assert.ok(print.mime.startsWith('text/html'));assert.ok(print.data.toString().includes('Private schedule branch'));
  for(const view of ['forecast','backtest'] as const){const file=await scheduledArtifact(f.ctx,run.id,'csv',view);assert.ok(file.data.length>0);}
  const foreign=await fixture();await assert.rejects(scheduledArtifact(foreign.ctx,run.id,'json'),{code:'NOT_FOUND'});
  await assert.rejects(scheduledArtifact({...f.ctx,role:'cashier'},run.id,'json'),{code:'OWNER_REQUIRED'});
  await assert.rejects(prisma.reportScheduleRun.update({where:{id:run.id},data:{result:{fabricated:true}}}));
  await enqueueDueReports();assert.equal(await prisma.reportScheduleRun.count({where:{scheduleId:schedule.id}}),1);
});
test('Missed-run policy explicitly skips old periods; stopping a grant cancels an already queued original',async()=>{
  const f=await fixture(),schedule=await overdue(f,3);await enqueueDueReports();
  const rows=await prisma.reportScheduleRun.findMany({where:{scheduleId:schedule.id}});assert.equal(rows.length,2);assert.equal(rows.filter(row=>row.state==='cancelled'&&row.lastError==='MISSED_PERIOD_SKIPPED').length,1);
  const queued=await currentRun(schedule);await stopSchedule(f.ctx,schedule.id,{operationId:randomUUID(),expectedRevision:1,reason:'Stop original queued automatic grant'});
  const run=await claimReportRun();assert.equal(run?.id,queued.id);assert.equal((await executeReportRun(run!)).succeeded,false);
  const terminal=await prisma.reportScheduleRun.findUniqueOrThrow({where:{id:queued.id}});assert.equal(terminal.state,'cancelled');assert.equal(terminal.result,null);assert.equal(terminal.lastError,'AUTHORIZATION_CHANGED');
});
test('Late publish audit failure rolls back the result; original retry cannot create a second occurrence',async()=>{
  const f=await fixture(),schedule=await overdue(f);await enqueueDueReports();const run=(await claimReportRun())!;
  const name='report_fault_'+randomUUID().replaceAll('-','');
  await prisma.$executeRawUnsafe(`CREATE FUNCTION ${name}() RETURNS trigger LANGUAGE plpgsql AS $$ BEGIN IF NEW."organizationId"='${f.org.id}' AND NEW.action='report_succeeded' THEN RAISE EXCEPTION 'test-only report audit fault';END IF;RETURN NEW;END $$`);
  await prisma.$executeRawUnsafe(`CREATE TRIGGER ${name} BEFORE INSERT ON "AuditLog" FOR EACH ROW EXECUTE FUNCTION ${name}()`);
  try{assert.equal((await executeReportRun(run)).succeeded,false);}finally{await prisma.$executeRawUnsafe(`DROP TRIGGER ${name} ON "AuditLog"`);await prisma.$executeRawUnsafe(`DROP FUNCTION ${name}()`);}
  const unknown=await prisma.reportScheduleRun.findUniqueOrThrow({where:{id:run.id}});assert.equal(unknown.state,'queued');assert.equal(unknown.result,null);assert.equal(unknown.size,0);
  await new Promise(resolve=>setTimeout(resolve,2200));const retried=(await claimReportRun())!;assert.equal(retried.id,run.id);assert.equal(retried.attempts,2);assert.equal((await executeReportRun(retried)).succeeded,true);
  assert.equal(await prisma.reportScheduleRun.count({where:{scheduleId:schedule.id}}),1);assert.equal(await prisma.auditLog.count({where:{entityId:run.id,action:'report_succeeded'}}),1);
});
test('A real elapsed lease recovers the same original run with a new nonce; stale worker cannot publish',async()=>{
  const f=await fixture(),schedule=await overdue(f);await enqueueDueReports();const old=(await claimReportRun())!;
  await new Promise(resolve=>setTimeout(resolve,31000));assert.equal(await recoverReportRuns(),1);await new Promise(resolve=>setTimeout(resolve,1100));
  const current=(await claimReportRun())!;assert.equal(current.id,old.id);assert.notEqual(current.leaseToken,old.leaseToken);
  assert.equal((await executeReportRun(old)).succeeded,false);assert.equal((await executeReportRun(current)).succeeded,true);
  assert.equal(await prisma.reportScheduleRun.count({where:{scheduleId:schedule.id}}),1);
});
test('Persistent owner grant survives logout, but a role revoked during calculation prevents publication',async()=>{
  const f=await fixture();await overdue(f);await enqueueDueReports();const run=(await claimReportRun())!;
  await prisma.session.update({where:{id:f.ctx.sessionId},data:{revokedAt:new Date()}});
  assert.equal((await executeReportRun(run)).succeeded,true);
  const g=await fixture(),pendingSchedule=await overdue(g);await enqueueDueReports();const pending=(await claimReportRun())!;
  let release!:()=>void,locked!:()=>void;
  const lockedPromise=new Promise<void>(resolve=>{locked=resolve;});
  const releasedPromise=new Promise<void>(resolve=>{release=resolve;});
  const revocation=prisma.$transaction(async tx=>{
    await tx.organizationUser.update({where:{id:g.member.id},data:{role:'admin'}});locked();await releasedPromise;
  },{timeout:15000});
  await lockedPromise;const work=executeReportRun(pending);
  try{
    // Observe only the aggregate lock count: never return SQL text or credentials.
    let waiting=false;
    for(let i=0;i<100;i++){
      const [row]=await prisma.$queryRaw<{count:bigint}[]>`SELECT count(*)::bigint AS count FROM pg_stat_activity WHERE datname=current_database() AND wait_event_type='Lock' AND query LIKE '%ReportSchedule%FOR SHARE%'`;
      if(row.count>BigInt(0)){waiting=true;break;}await new Promise(resolve=>setTimeout(resolve,50));
    }
    assert.equal(waiting,true,'Fresh publication must wait for the concurrent grant change');
  }finally{release();await revocation;}
  assert.equal((await work).succeeded,false);
  const cancelled=await prisma.reportScheduleRun.findUniqueOrThrow({where:{id:pending.id}});
  assert.equal(cancelled.state,'cancelled');assert.equal(cancelled.result,null);assert.equal(cancelled.size,0);
  assert.equal(await prisma.auditLog.count({where:{entityId:pending.id,action:'report_succeeded'}}),0);
  assert.equal(await prisma.reportScheduleRun.count({where:{scheduleId:pendingSchedule.id}}),1);
});
test('Read-only expiry preserves private exports and stopping grants, while rejecting new configuration',async()=>{
  const f=await fixture(true),schedule=await overdue(f);await enqueueDueReports();const run=(await claimReportRun())!;
  assert.equal((await executeReportRun(run)).succeeded,true);
  const end=new Date(Date.now()-8*86400000);
  await prisma.organizationSubscription.create({data:{organizationId:f.org.id,planVersionId:'initial-pro-v1',trialStartedAt:new Date(end.getTime()-14*86400000),trialEndsAt:end}});
  assert.equal(JSON.parse((await scheduledArtifact(f.ctx,run.id,'json')).data.toString()).organizationId,f.org.id);
  await assert.rejects(configureSchedule(f.ctx,{operationId:randomUUID(),id:schedule.id,expectedRevision:1,name:'Read-only denied policy',enabled:true,configuration:config,reason:'New operation after expired entitlement'}),{code:'SUBSCRIPTION_EXPIRED'});
  const stopped=await stopSchedule(f.ctx,schedule.id,{operationId:randomUUID(),expectedRevision:1,reason:'Revoke future work in read-only business'});
  assert.equal(stopped.enabled,false);assert.equal(stopped.revision,2);
  assert.equal((await prisma.reportScheduleRun.findUniqueOrThrow({where:{id:run.id}})).state,'succeeded');
});
test('Catch-up records each original period once and a stop fences every remaining queued period',async()=>{
  const f=await fixture(),schedule=await overdue(f,3,{...config,missedRunPolicy:'catch_up'});
  for(let i=0;i<5;i++)await enqueueDueReports();
  const rows=await prisma.reportScheduleRun.findMany({where:{scheduleId:schedule.id},orderBy:{scheduledFor:'asc'}});
  assert.equal(rows.length,4);assert.equal(new Set(rows.map(row=>row.scheduledFor.toISOString())).size,4);
  assert.ok(rows.every(row=>row.state==='queued'));
  await stopSchedule(f.ctx,schedule.id,{operationId:randomUUID(),expectedRevision:1,reason:'Stop all original catch-up periods'});
  for(let i=0;i<4;i++){const run=(await claimReportRun())!;assert.equal(run.scheduleId,schedule.id);assert.equal((await executeReportRun(run)).succeeded,false);}
  assert.equal(await prisma.reportScheduleRun.count({where:{scheduleId:schedule.id,state:'cancelled'}}),4);
});
