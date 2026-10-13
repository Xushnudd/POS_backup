import {z} from 'zod';
import {prisma} from '@/lib/prisma';
import type {TokenPayload} from '@/lib/auth';
import {AccessError} from '../auth/policy';
import {assertLiveContext} from '../operations';
import {csv,numeric} from '../exports/csv';
import {reportArtifact,type ReportFormat} from '../exports/report-formats';
import {KPI_METRICS} from './planned-report';
import {scheduleDefinitionSchema} from './schedule-contract';
const date=z.string().regex(/^\d{4}-\d{2}-\d{2}$/);
const quantity=z.string().regex(/^\d+(?:\.\d{1,6})?$/).max(50);
const amount=z.string().regex(/^-?\d+(?:\.\d{1,6})?$/).max(50);
const metricsSchema=z.object({backtestDays:z.number().int().min(7).max(90),mae:quantity,rmse:quantity,wapePercent:quantity.nullable(),zeroBaselineMae:quantity,beatsZeroBaseline:z.boolean(),horizonEvaluated:z.literal(1)}).strict();
const forecastSchema=z.object({status:z.enum(['insufficient_history','measured_baseline']),method:z.enum(['moving_average','weekday_average']),observedDays:z.number().int().min(0).max(365),requiredDays:z.number().int().min(1),
  forecast:z.array(z.object({date,quantity}).strict()).max(30),metrics:metricsSchema.nullable(),
  backtest:z.array(z.object({date,actual:quantity,predicted:quantity}).strict()).max(90).optional(),basis:z.string().max(2000),
}).strict();
export const plannedResultSchema=z.object({version:z.literal(1),organizationId:z.string().uuid(),scheduledFor:z.iso.datetime(),asOf:z.iso.datetime(),timezone:z.literal('Asia/Tashkent'),currency:z.literal('UZS'),startDate:date,endDate:date,
  period:z.enum(['complete_days','through_now']),window:z.enum(['rolling_days','previous_iso_week','previous_month']),forecastEndDate:date,
  metrics:z.array(z.enum(KPI_METRICS)).min(1).max(KPI_METRICS.length),
  branches:z.array(z.object({storeId:z.string().uuid(),storeName:z.string().max(1000),metrics:z.partialRecord(z.enum(KPI_METRICS),amount.nullable())}).strict()).max(20),
  forecasts:z.array(z.object({storeId:z.string().uuid(),storeName:z.string().max(1000),productId:z.string().uuid(),productName:z.string().max(1000),baseUnit:z.string().max(100),result:forecastSchema}).strict()).max(100),basis:z.string().max(4000),
}).strict().refine(value=>new Set(value.metrics).size===value.metrics.length&&value.branches.every(branch=>{
  const keys=Object.keys(branch.metrics);return keys.length===value.metrics.length&&value.metrics.every(key=>Object.prototype.hasOwnProperty.call(branch.metrics,key));
}),'Selected KPI keys must exactly match every branch');
export type PlannedResult=z.infer<typeof plannedResultSchema>;
export async function scheduledArtifact(context:TokenPayload,id:string,format:ReportFormat|'json',view:'kpi'|'forecast'|'backtest'='kpi'){
  z.enum(['csv','xlsx','pdf','json']).parse(format);z.enum(['kpi','forecast','backtest']).parse(view);
  if(context.role!=='owner'||context.customRole)throw new AccessError(403,'OWNER_REQUIRED');z.string().uuid().parse(id);
  const source=await prisma.$transaction(async tx=>{
    await assertLiveContext(tx,context);
    const run=await tx.reportScheduleRun.findFirst({where:{id,organizationId:context.organizationId}});if(!run)throw new AccessError(404,'NOT_FOUND');
    if(run.state!=='succeeded')throw new AccessError(409,'REPORT_NOT_READY');if(run.expiresAt<=new Date()||run.result===null)throw new AccessError(410,'REPORT_EXPIRED');
    const parsed=plannedResultSchema.safeParse(run.result),definition=scheduleDefinitionSchema.safeParse(run.definition);
    if(!parsed.success||!definition.success||parsed.data.organizationId!==context.organizationId||parsed.data.scheduledFor!==run.scheduledFor.toISOString())throw new AccessError(409,'EXPORT_CORRUPTED');
    await tx.auditLog.create({data:{organizationId:context.organizationId,actorId:context.userId,entityType:'ReportScheduleRun',entityId:id,action:'report_export_requested',afterData:{format,view,revision:run.revision}}});
    return {run,result:parsed.data,title:definition.data.name};
  },{isolationLevel:'RepeatableRead'});
  if(format==='json'){
    const data=Buffer.from(JSON.stringify(source.result,null,2));return {data,mime:'application/json; charset=utf-8',filename:'report-'+id+'.json'};
  }
  const result=source.result;
  const rows:(string|ReturnType<typeof numeric>)[][]=[['Hisob holati UTC',result.asOf],['Jadval vaqti UTC',result.scheduledFor],['Timezone',result.timezone],['Valyuta',result.currency],['Davr',result.startDate+' — '+result.endDate],['Hisob asosi',result.basis]];
  if(view==='kpi'){
    rows.push(['Filial ID','Filial',...result.metrics]);
    for(const branch of result.branches)rows.push([branch.storeId,branch.storeName,...result.metrics.map(key=>branch.metrics[key]===null?'N/A':numeric(branch.metrics[key]!,key==='saleCount'?0:key==='grossMarginPercent'?6:2))]);
  }else if(view==='forecast'){
    rows.push(['Filial','Mahsulot','Asosiy birlik','Holat','Baseline','Sana','Kutilgan gross sotuv miqdori','MAE','RMSE','WAPE %','Nol baseline MAE']);
    for(const item of result.forecasts){
      const quality=item.result.metrics;
      if(!item.result.forecast.length)rows.push([item.storeName,item.productName,item.baseUnit,item.result.status,item.result.method,'','N/A','N/A','N/A','N/A','N/A']);
      for(const prediction of item.result.forecast)rows.push([item.storeName,item.productName,item.baseUnit,item.result.status,item.result.method,prediction.date,numeric(prediction.quantity,6),quality?numeric(quality.mae,6):'N/A',quality?numeric(quality.rmse,6):'N/A',quality?.wapePercent===null?'N/A':quality?numeric(quality.wapePercent!,6):'N/A',quality?numeric(quality.zeroBaselineMae,6):'N/A']);
    }
  }else{
    rows.push(['Filial','Mahsulot','Asosiy birlik','Sana','Haqiqiy gross sotuv miqdori','Faqat oldingi tarixdan hisoblangan baseline']);
    for(const item of result.forecasts)for(const row of item.result.backtest??[])rows.push([item.storeName,item.productName,item.baseUnit,row.date,numeric(row.actual,6),numeric(row.predicted,6)]);
  }
  return reportArtifact({filename:'report-'+id+'-'+view+'.csv',content:csv(rows),title:source.title},format,result.asOf);
}
