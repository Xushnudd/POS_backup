import {randomUUID} from 'node:crypto';
import {Prisma,type ReportSchedule,type ReportScheduleRun} from '@prisma/client';
import {prisma} from '@/lib/prisma';
import {AccessError,type TenantScopeContext} from '../auth/policy';
import {payloadHash} from '../operations';
import {scheduleConfigurationSchema,scheduleDefinitionSchema,nextReportOccurrence,latestReportOccurrence} from './schedule-contract';
import {plannedReport} from './planned-report';

function definition(schedule:ReportSchedule){return {name:schedule.name,configuration:schedule.configuration,grantMembershipId:schedule.grantMembershipId,timezone:schedule.timezone,currency:schedule.currency};}
async function event(tx:Prisma.TransactionClient,organizationId:string,id:string,action:string,details:Prisma.InputJsonObject){
  await tx.auditLog.create({data:{organizationId,actorId:null,entityType:'ReportScheduleRun',entityId:id,action,afterData:details}});
}
async function reportGrant(tx:Prisma.TransactionClient,run:ReportScheduleRun,lock=false):Promise<TenantScopeContext>{
  const snapshot=scheduleDefinitionSchema.parse(run.definition);
  if(lock)await tx.$queryRaw`SELECT s.id FROM "ReportSchedule" s JOIN "OrganizationUser" m ON m.id=s."grantMembershipId" JOIN "User" u ON u.id=m."userId" JOIN "Organization" o ON o.id=s."organizationId" WHERE s.id=${run.scheduleId} AND s."organizationId"=${run.organizationId} FOR SHARE OF s,m,u,o`;
  const schedule=await tx.reportSchedule.findFirst({where:{id:run.scheduleId,organizationId:run.organizationId},include:{grant:{include:{user:{select:{id:true,isActive:true}}}},organization:{select:{timezone:true,currencyCode:true}}}});
  const [auth]=await tx.$queryRaw<{ready:boolean}[]>`SELECT auth_restore_ready() AS ready`;
  if(!schedule||!auth.ready||!schedule.enabled||schedule.revision!==run.revision||payloadHash(definition(schedule))!==payloadHash(snapshot)||schedule.grant.organizationId!==run.organizationId||
    !schedule.grant.isActive||schedule.grant.role!=='owner'||schedule.grant.customRoleId!==null||!schedule.grant.user.isActive||
    schedule.organization.timezone!==snapshot.timezone||schedule.organization.currencyCode!==snapshot.currency)throw new AccessError(403,'AUTHORIZATION_CHANGED');
  return {organizationId:run.organizationId,organizationUserId:schedule.grant.id,userId:schedule.grant.userId,role:schedule.grant.role,storeIds:[]};
}
export async function enqueueDueReports(){
  return prisma.$transaction(async tx=>{
    const [clock]=await tx.$queryRaw<{now:Date}[]>`SELECT clock_timestamp() AS now`;
    const due=await tx.$queryRaw<ReportSchedule[]>`SELECT * FROM "ReportSchedule" WHERE enabled AND "blockedCode" IS NULL AND "nextRunAt"<=NOW() ORDER BY "nextRunAt",id FOR UPDATE SKIP LOCKED LIMIT 20`;
    let queued=0,skipped=0;
    for(let schedule of due){
      const parsed=scheduleConfigurationSchema.safeParse(schedule.configuration);
      if(!parsed.success){await tx.reportSchedule.update({where:{id:schedule.id},data:{blockedCode:'CONFIGURATION_CHANGED'}});continue;}
      const config=parsed.data;
      await tx.$queryRaw`SELECT pg_advisory_xact_lock(hashtextextended(${'report-runs:'+schedule.organizationId},0))::text`;
      if(await tx.reportScheduleRun.count({where:{organizationId:schedule.organizationId,state:{in:['queued','running']}}})>=20)continue;
      // A skipped old occurrence is still recorded, so restoring/retrying the
      // worker cannot silently re-enqueue it as a second delivery.
      const latest=latestReportOccurrence(clock.now,schedule.timezone,config.cadence);
      if(config.missedRunPolicy==='latest_only'&&schedule.nextRunAt!<latest){
        const old=await tx.reportScheduleRun.create({data:{organizationId:schedule.organizationId,scheduleId:schedule.id,revision:schedule.revision,scheduledFor:schedule.nextRunAt!,
          definition:JSON.parse(JSON.stringify(definition(schedule))),expiresAt:new Date(clock.now.getTime()+config.retentionHours*3600000)}});
        await tx.reportScheduleRun.update({where:{id:old.id},data:{state:'cancelled',lastError:'MISSED_PERIOD_SKIPPED',finishedAt:clock.now}});
        await event(tx,schedule.organizationId,old.id,'report_period_skipped',{revision:schedule.revision,code:'MISSED_PERIOD_SKIPPED'});skipped++;
        schedule=await tx.reportSchedule.update({where:{id:schedule.id},data:{nextRunAt:latest}});
      }
      const run=await tx.reportScheduleRun.create({data:{organizationId:schedule.organizationId,scheduleId:schedule.id,revision:schedule.revision,scheduledFor:schedule.nextRunAt!,
        definition:JSON.parse(JSON.stringify(definition(schedule))),expiresAt:new Date(clock.now.getTime()+config.retentionHours*3600000)}});
      let blockedCode:string|null=null;
      try{await reportGrant(tx,run);}catch{blockedCode='AUTHORIZATION_CHANGED';await tx.reportScheduleRun.update({where:{id:run.id},data:{state:'cancelled',lastError:blockedCode,finishedAt:clock.now}});}
      await tx.reportSchedule.update({where:{id:schedule.id},data:{nextRunAt:nextReportOccurrence(schedule.nextRunAt!,schedule.timezone,config.cadence),blockedCode}});
      await event(tx,schedule.organizationId,run.id,blockedCode?'report_cancelled':'report_queued',{revision:schedule.revision,...(blockedCode?{code:blockedCode}:{})});
      if(!blockedCode)queued++;
    }
    return {queued,skipped};
  },{timeout:15000});
}
export async function recoverReportRuns(){
  return prisma.$transaction(async tx=>{
    const [clock]=await tx.$queryRaw<{now:Date}[]>`SELECT clock_timestamp() AS now`;
    const rows=await tx.$queryRaw<ReportScheduleRun[]>`SELECT * FROM "ReportScheduleRun" WHERE (state='running' AND "leaseUntil"<=NOW()) OR (state='queued' AND "expiresAt"<=NOW()) ORDER BY "createdAt",id FOR UPDATE SKIP LOCKED LIMIT 20`;
    for(const run of rows){
      const expired=run.expiresAt<=clock.now,state=expired?'cancelled':run.attempts>=3?'dead':'queued',code=expired?'REPORT_EXPIRED':'LEASE_EXPIRED';
      await tx.reportScheduleRun.update({where:{id:run.id},data:{state,leaseToken:null,leaseUntil:null,nextAttemptAt:new Date(clock.now.getTime()+1000),lastError:code,...(state!=='queued'?{finishedAt:clock.now}:{})}});
      await event(tx,run.organizationId,run.id,'report_'+state,{attempts:run.attempts,code});
    }
    return rows.length;
  });
}
export async function claimReportRun(){
  return prisma.$transaction(async tx=>{
    const token=randomUUID();
    const rows=await tx.$queryRaw<ReportScheduleRun[]>`UPDATE "ReportScheduleRun" SET state='running',attempts=attempts+1,"leaseToken"=${token},"leaseUntil"=NOW()+INTERVAL '30 seconds' WHERE id=(SELECT id FROM "ReportScheduleRun" WHERE state='queued' AND "nextAttemptAt"<=NOW() AND "expiresAt">NOW() AND attempts<3 ORDER BY "nextAttemptAt",id FOR UPDATE SKIP LOCKED LIMIT 1) RETURNING *`;
    const run=rows[0];if(run)await event(tx,run.organizationId,run.id,'report_claimed',{attempts:run.attempts});return run??null;
  });
}
async function heartbeat(run:ReportScheduleRun){return(await prisma.reportScheduleRun.updateMany({where:{id:run.id,state:'running',leaseToken:run.leaseToken,leaseUntil:{gt:new Date()},expiresAt:{gt:new Date()}},data:{leaseUntil:new Date(Date.now()+30000)}})).count===1;}
async function fail(run:ReportScheduleRun,code:string){
  return prisma.$transaction(async tx=>{
    await tx.$queryRaw`SELECT id FROM "ReportScheduleRun" WHERE id=${run.id} FOR UPDATE`;
    const current=await tx.reportScheduleRun.findFirst({where:{id:run.id,state:'running',leaseToken:run.leaseToken}});if(!current)return false;
    const fatal=code!=='WORK_FAILED',state=fatal?(code==='AUTHORIZATION_CHANGED'?'cancelled':'dead'):current.attempts>=3?'dead':'queued';
    await tx.reportScheduleRun.update({where:{id:run.id},data:{state,leaseToken:null,leaseUntil:null,lastError:code,nextAttemptAt:new Date(Date.now()+1000*Math.min(300,2**current.attempts)),...(state!=='queued'?{finishedAt:new Date()}:{})}});
    await event(tx,run.organizationId,run.id,'report_'+state,{attempts:current.attempts,code});return true;
  });
}
export async function executeReportRun(run:ReportScheduleRun){
  let ticking:Promise<boolean>|undefined;
  const timer=setInterval(()=>{if(!ticking){ticking=heartbeat(run).catch(()=>false);void ticking.finally(()=>{ticking=undefined;});}},5000);
  try{
    const snapshot=scheduleDefinitionSchema.parse(run.definition);
    // One consistent financial snapshot, then a separate fresh authorization
    // transaction. Revoking a grant during calculation cannot publish a file.
    const result=await prisma.$transaction(async tx=>{
      const scope=await reportGrant(tx,run);
      return plannedReport(tx,scope,snapshot.configuration.report,run.scheduledFor);
    },{isolationLevel:'RepeatableRead',timeout:90000});
    const encoded=JSON.parse(JSON.stringify(result)) as Prisma.InputJsonValue;
    if(Buffer.byteLength(JSON.stringify(encoded))>4*1024*1024)throw new AccessError(413,'EXPORT_TOO_LARGE');
    await prisma.$transaction(async tx=>{
      await tx.$queryRaw`SELECT id FROM "ReportScheduleRun" WHERE id=${run.id} FOR UPDATE`;
      const current=await tx.reportScheduleRun.findFirst({where:{id:run.id,state:'running',leaseToken:run.leaseToken,leaseUntil:{gt:new Date()},expiresAt:{gt:new Date()}}});
      if(!current)throw new AccessError(409,'JOB_LEASE_LOST');
      await reportGrant(tx,current,true);
      await tx.$queryRaw`SELECT pg_advisory_xact_lock(hashtextextended(${'exports:'+run.organizationId},0))::text`;
      const [size]=await tx.$queryRaw<{bytes:number}[]>`SELECT octet_length(CAST(${JSON.stringify(encoded)} AS jsonb)::text) AS bytes`;
      if(size.bytes>4*1024*1024)throw new AccessError(413,'EXPORT_TOO_LARGE');
      const [used]=await tx.$queryRaw<{bytes:bigint}[]>`SELECT (COALESCE((SELECT sum(size) FROM "ReportScheduleRun" WHERE "organizationId"=${run.organizationId} AND result IS NOT NULL AND "expiresAt">NOW()),0)+COALESCE((SELECT sum(size) FROM "JobExport" WHERE "organizationId"=${run.organizationId} AND data IS NOT NULL AND "expiresAt">NOW()),0))::bigint AS bytes`;
      if(used.bytes+BigInt(size.bytes)>BigInt(32*1024*1024))throw new AccessError(413,'EXPORT_QUOTA');
      const saved=await tx.reportScheduleRun.updateMany({where:{id:run.id,state:'running',leaseToken:run.leaseToken,leaseUntil:{gt:new Date()},expiresAt:{gt:new Date()}},data:{state:'succeeded',result:encoded,leaseToken:null,leaseUntil:null,lastError:null,finishedAt:new Date()}});
      if(saved.count!==1)throw new AccessError(409,'JOB_LEASE_LOST');
      await event(tx,run.organizationId,run.id,'report_succeeded',{revision:run.revision,attempts:run.attempts});
    });
    return {succeeded:true};
  }catch(error){
    const fatalCodes=['AUTHORIZATION_CHANGED','EXPORT_TOO_LARGE','EXPORT_QUOTA','REPORT_BRANCH_LIMIT','REPORT_DEMAND_LIMIT','STORE_NOT_FOUND','PRODUCT_NOT_FOUND','INVALID_REPORT_CUTOFF'];
    const code=error instanceof AccessError&&fatalCodes.includes(error.code)?error.code:'WORK_FAILED';
    await fail(run,code);return {succeeded:false};
  }finally{clearInterval(timer);if(ticking)await ticking;}
}
export async function pruneReportSnapshots(){
  return prisma.reportScheduleRun.updateMany({where:{state:'succeeded',expiresAt:{lte:new Date()},result:{not:Prisma.DbNull}},data:{result:Prisma.DbNull}});
}
