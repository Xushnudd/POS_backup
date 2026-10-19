import {Prisma} from '@prisma/client';
import {z} from 'zod';
import {prisma} from '@/lib/prisma';
import type {TokenPayload} from '@/lib/auth';
import {AccessError} from '../auth/policy';
import {runOperation,assertLiveContext,audit} from '../operations';
import {configureScheduleSchema,stopScheduleSchema,scheduleConfigurationSchema,nextReportOccurrence} from './schedule-contract';
import {plannedReport} from './planned-report';

function owner(context:TokenPayload){if(context.role!=='owner'||context.customRole)throw new AccessError(403,'OWNER_REQUIRED');}
async function ownerMembership(tx:Prisma.TransactionClient,context:TokenPayload){
  if(!await tx.organizationUser.findFirst({where:{id:context.organizationUserId,organizationId:context.organizationId,userId:context.userId,role:'owner',isActive:true,customRoleId:null,user:{isActive:true}}}))throw new AccessError(403,'OWNER_REQUIRED');
}
export async function configureSchedule(context:TokenPayload,input:z.infer<typeof configureScheduleSchema>){
  owner(context);const data=configureScheduleSchema.parse(input);
  return runOperation(context,'report.schedule.configure',data.operationId,data,async tx=>{
    await tx.$queryRaw`SELECT pg_advisory_xact_lock(hashtextextended(${'report-plans:'+context.organizationId},0))::text`;
    const org=await tx.organization.findUniqueOrThrow({where:{id:context.organizationId},select:{timezone:true,currencyCode:true}});
    if(org.timezone!=='Asia/Tashkent'||org.currencyCode!=='UZS')throw new AccessError(409,'REPORT_TIMEZONE_UNSUPPORTED');
    const previous=data.id?await tx.reportSchedule.findFirst({where:{id:data.id,organizationId:context.organizationId}}):null;
    if(data.id&&!previous)throw new AccessError(404,'NOT_FOUND');
    if(previous&&previous.revision!==data.expectedRevision)throw new AccessError(409,'REPORT_REVISION_CHANGED');
    if(!previous&&await tx.reportSchedule.count({where:{organizationId:context.organizationId}})>=20)throw new AccessError(429,'REPORT_SCHEDULE_LIMIT');
    // Validate selected tenant references even when an inactive policy is saved.
    if(data.configuration.report.storeIds.length&&await tx.store.count({where:{organizationId:context.organizationId,id:{in:data.configuration.report.storeIds}}})!==data.configuration.report.storeIds.length)throw new AccessError(404,'STORE_NOT_FOUND');
    const productIds=data.configuration.report.forecast?.productIds;
    if(productIds&&await tx.product.count({where:{organizationId:context.organizationId,id:{in:productIds}}})!==productIds.length)throw new AccessError(404,'PRODUCT_NOT_FOUND');
    const [clock]=await tx.$queryRaw<{now:Date}[]>`SELECT clock_timestamp() AS now`;
    const values={name:data.name,enabled:data.enabled,revision:previous?previous.revision+1:1,configuration:JSON.parse(JSON.stringify(data.configuration)) as Prisma.InputJsonValue,
      grantMembershipId:context.organizationUserId,timezone:org.timezone,currency:org.currencyCode,blockedCode:null,
      nextRunAt:data.enabled?nextReportOccurrence(clock.now,org.timezone,data.configuration.cadence):null};
    const schedule=previous?await tx.reportSchedule.update({where:{id:previous.id},data:values}):await tx.reportSchedule.create({data:{organizationId:context.organizationId,...values}});
    await audit(tx,context,'ReportSchedule',schedule.id,'report_schedule_configured',{...values,reason:data.reason});
    return schedule;
  },tx=>ownerMembership(tx,context));
}
export async function stopSchedule(context:TokenPayload,id:string,input:z.infer<typeof stopScheduleSchema>){
  owner(context);z.string().uuid().parse(id);const data=stopScheduleSchema.parse(input);
  return runOperation(context,'report.schedule.stop',data.operationId,{id,...data},async tx=>{
    await tx.$queryRaw`SELECT id FROM "ReportSchedule" WHERE id=${id} AND "organizationId"=${context.organizationId} FOR UPDATE`;
    const schedule=await tx.reportSchedule.findFirst({where:{id,organizationId:context.organizationId}});
    if(!schedule)throw new AccessError(404,'NOT_FOUND');if(schedule.revision!==data.expectedRevision)throw new AccessError(409,'REPORT_REVISION_CHANGED');
    if(!schedule.enabled)return schedule;
    const updated=await tx.reportSchedule.update({where:{id},data:{enabled:false,revision:schedule.revision+1,nextRunAt:null,blockedCode:null}});
    await audit(tx,context,'ReportSchedule',id,'report_schedule_stopped',{name:updated.name,enabled:false,revision:updated.revision,configuration:updated.configuration,
      grantMembershipId:updated.grantMembershipId,timezone:updated.timezone,currency:updated.currency,reason:data.reason});
    return updated;
  },tx=>ownerMembership(tx,context));
}
export async function previewSchedule(context:TokenPayload,configuration:unknown){
  owner(context);const config=scheduleConfigurationSchema.parse(configuration);
  return prisma.$transaction(async tx=>{
    await assertLiveContext(tx,context);await ownerMembership(tx,context);
    const result=await plannedReport(tx,context,config.report,new Date());
    await assertLiveContext(tx,context);return result;
  },{isolationLevel:'RepeatableRead',timeout:90000});
}
export async function listSchedules(context:TokenPayload){
  owner(context);return prisma.$transaction(async tx=>{await assertLiveContext(tx,context);await ownerMembership(tx,context);
    return tx.reportSchedule.findMany({where:{organizationId:context.organizationId},orderBy:[{createdAt:'desc'},{id:'asc'}],take:20});
  },{isolationLevel:'RepeatableRead'});
}
export async function listScheduleRuns(context:TokenPayload,id:string,page:number){
  owner(context);z.string().uuid().parse(id);if(!Number.isSafeInteger(page)||page<1||(page-1)*20>2147483647)throw new AccessError(400,'INVALID_PAGINATION');
  return prisma.$transaction(async tx=>{await assertLiveContext(tx,context);await ownerMembership(tx,context);
    if(!await tx.reportSchedule.findFirst({where:{id,organizationId:context.organizationId}}))throw new AccessError(404,'NOT_FOUND');
    const where={scheduleId:id,organizationId:context.organizationId};
    const rows=await tx.reportScheduleRun.findMany({where,orderBy:[{scheduledFor:'desc'},{id:'asc'}],skip:(page-1)*20,take:20,
      select:{id:true,scheduleId:true,revision:true,scheduledFor:true,state:true,attempts:true,lastError:true,createdAt:true,finishedAt:true,expiresAt:true,size:true}});
    return {rows,total:await tx.reportScheduleRun.count({where})};
  },{isolationLevel:'RepeatableRead'});
}
