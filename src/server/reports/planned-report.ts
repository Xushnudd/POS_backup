import {Prisma} from '@prisma/client';
import {z} from 'zod';
import {AccessError,tenantScope,type TenantScopeContext} from '../auth/policy';
import {dateBoundary,localDate} from './dates';
import {financialFilter,financialSummary} from './financial';
import {profitSummary} from './profit';
import {reportDecimal} from './numeric';
import {demandForecast,forecastConfigSchema,type DemandDay} from './forecast';
import {REPORT_KPI_METRICS} from '@/lib/report-plan-metrics';

export const KPI_METRICS=REPORT_KPI_METRICS;
export const plannedReportSchema=z.object({
  storeIds:z.array(z.string().uuid()).max(20).refine(ids=>new Set(ids).size===ids.length).default([]),
  rangeDays:z.number().int().min(1).max(366),
  period:z.enum(['complete_days','through_now']),
  window:z.enum(['rolling_days','previous_iso_week','previous_month']),
  metrics:z.array(z.enum(KPI_METRICS)).min(1).max(KPI_METRICS.length).refine(values=>new Set(values).size===values.length),
  forecast:z.object({productIds:z.array(z.string().uuid()).min(1).max(20).refine(ids=>new Set(ids).size===ids.length),config:forecastConfigSchema}).strict().optional(),
}).strict().refine(input=>input.window==='rolling_days'||input.period==='complete_days','Kalendardagi oldingi hafta/oy faqat tugagan davr bo‘lsin');
export type PlannedReportInput=z.infer<typeof plannedReportSchema>;
function moveDay(value:string,delta:number){const day=new Date(value+'T00:00:00Z');day.setUTCDate(day.getUTCDate()+delta);return day.toISOString().slice(0,10);}
export {moveDay as reportCalendarDay};

// Authentication is the caller's responsibility: an HTTP live session or an
// explicit, revalidated owner background grant. Never fabricate a Session.
export async function plannedReport(tx:Prisma.TransactionClient,scope:TenantScopeContext,input:PlannedReportInput,scheduledFor:Date){
  const config=plannedReportSchema.parse(input);
  if(scope.role!=='owner')throw new AccessError(403,'OWNER_REQUIRED');
  const org=await tx.organization.findUniqueOrThrow({where:{id:scope.organizationId},select:{timezone:true,currencyCode:true}});
  const [clock]=await tx.$queryRaw<{now:Date}[]>`SELECT clock_timestamp() AS now`;
  if(!Number.isFinite(scheduledFor.getTime())||scheduledFor>clock.now)throw new AccessError(400,'INVALID_REPORT_CUTOFF');
  const forecastEndDay=moveDay(localDate(scheduledFor,org.timezone),-1);
  let endDay=config.period==='complete_days'?forecastEndDay:localDate(scheduledFor,org.timezone),startDay=moveDay(endDay,1-config.rangeDays);
  if(config.window==='previous_iso_week'){
    const date=localDate(scheduledFor,org.timezone),weekday=new Date(date+'T00:00:00Z').getUTCDay();
    endDay=moveDay(date,-(weekday===0?6:weekday-1)-1);startDay=moveDay(endDay,-6);
  }else if(config.window==='previous_month'){
    const anchor=new Date(localDate(scheduledFor,org.timezone)+'T00:00:00Z');anchor.setUTCDate(0);endDay=anchor.toISOString().slice(0,10);anchor.setUTCDate(1);startDay=anchor.toISOString().slice(0,10);
  }
  const where:Prisma.StoreWhereInput={AND:tenantScope('Store',scope),...(config.storeIds.length?{id:{in:config.storeIds}}:{})};
  const stores=await tx.store.findMany({where,orderBy:{id:'asc'},take:21,select:{id:true,name:true,createdAt:true}});
  if(stores.length>20)throw new AccessError(413,'REPORT_BRANCH_LIMIT','Hisobot uchun ko‘pi20 filialni tanlang');
  if(config.storeIds.length&&stores.length!==config.storeIds.length)throw new AccessError(404,'STORE_NOT_FOUND');
  const branches=[];
  for(const store of stores){
    const params=new URLSearchParams({storeId:store.id,startDate:startDay,endDate:endDay,asOf:scheduledFor.toISOString()});
    const filter=await financialFilter(tx,scope,params),financial=await financialSummary(tx,scope,filter),profit=await profitSummary(tx,scope,params);
    const grossMargin=reportDecimal(profit.summary.netSales).gt(0)?reportDecimal(profit.summary.grossProfit).div(profit.summary.netSales).mul(100).toFixed(6):null;
    const available:Record<typeof KPI_METRICS[number],string|null>={saleCount:String(financial.total),grossRevenue:financial.summary.grossRevenue.toFixed(2),refundAmount:financial.summary.refundAmount.toFixed(2),
      netSales:profit.summary.netSales.toFixed(2),cogs:profit.summary.cogs.toFixed(2),grossProfit:profit.summary.grossProfit.toFixed(2),grossMarginPercent:grossMargin,
      operatingExpenses:profit.summary.operatingExpenses.toFixed(2),operatingProfit:profit.summary.operatingProfit.toFixed(2),averageSale:financial.total?reportDecimal(profit.summary.netSales).div(financial.total).toFixed(2):null};
    branches.push({storeId:store.id,storeName:store.name,metrics:Object.fromEntries(config.metrics.map(key=>[key,available[key]]))});
  }
  const forecasts=[];
  if(config.forecast){
    const products=await tx.product.findMany({where:{organizationId:scope.organizationId,id:{in:config.forecast.productIds}},select:{id:true,name:true,unit:true,createdAt:true}});
    if(products.length!==config.forecast.productIds.length)throw new AccessError(404,'PRODUCT_NOT_FOUND');
    if(stores.length*products.length>100)throw new AccessError(413,'REPORT_DEMAND_LIMIT','Bir hisobotda ko‘pi100 filial/mahsulot juftligini tanlang');
    const from=moveDay(forecastEndDay,1-config.forecast.config.historyDays),until=dateBoundary(forecastEndDay,org.timezone,true),fromTime=dateBoundary(from,org.timezone);
    if(stores.length){
      const daily=await tx.$queryRaw<{storeId:string;productId:string;date:string;quantity:Prisma.Decimal}[]>`SELECT s."storeId",i."productId",to_char(s."completedAt" AT TIME ZONE 'UTC' AT TIME ZONE ${org.timezone},'YYYY-MM-DD') AS date,sum(i.quantity) AS quantity
        FROM "SaleItem" i JOIN "Sale" s ON s.id=i."saleId" WHERE s."organizationId"=${scope.organizationId} AND s."storeId" IN (${Prisma.join(stores.map(row=>row.id))}) AND i."productId" IN (${Prisma.join(products.map(row=>row.id))})
        AND s.status IN ('completed','partially_returned','returned') AND s."createdAt"<=${scheduledFor} AND s."completedAt">=${fromTime} AND s."completedAt"<${until}
        GROUP BY s."storeId",i."productId",date ORDER BY s."storeId",i."productId",date LIMIT 50001`;
      if(daily.length>50000)throw new AccessError(413,'REPORT_DEMAND_LIMIT','Filial/mahsulot yoki tarix oralig‘ini qisqartiring');
      const quantities=new Map(daily.map(row=>[row.storeId+':'+row.productId+':'+row.date,row.quantity.toFixed(6)]));
      for(const store of stores)for(const product of products){
        // Absence after a known source inception is zero observed sales;
        // absence before that inception is unavailable history, not zero.
        const inception=localDate(new Date(Math.max(store.createdAt.getTime(),product.createdAt.getTime())),org.timezone);
        const first=inception>from?inception:from,series:DemandDay[]=[];
        for(let day=first;day<=forecastEndDay;day=moveDay(day,1))series.push({date:day,quantity:quantities.get(store.id+':'+product.id+':'+day)??'0'});
        forecasts.push({storeId:store.id,storeName:store.name,productId:product.id,productName:product.name,baseUnit:product.unit,
          result:demandForecast(series,config.forecast.config)});
      }
    }
  }
  return {version:1,organizationId:scope.organizationId,scheduledFor:scheduledFor.toISOString(),asOf:scheduledFor.toISOString(),timezone:org.timezone,currency:org.currencyCode,startDate:startDay,endDate:endDay,
    period:config.period,window:config.window,forecastEndDate:forecastEndDay,metrics:config.metrics,branches,forecasts,basis:'Internal management KPI. complete_days uses closed local calendar days; through_now includes a partial final day at asOf. Gross revenue/refunds include tax; net sales and profit exclude tax. Average sale is net receipt revenue divided by completed receipt count. Late-cost corrections use application date. Demand uses closed days of observed gross sold base units, not unconstrained demand.'};
}
