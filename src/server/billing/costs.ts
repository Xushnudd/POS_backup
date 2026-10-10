import { Prisma } from '@prisma/client'
import { z } from 'zod'
import { prisma } from '@/lib/prisma'
import type { TokenPayload } from '@/lib/auth'
import { AccessError } from '../auth/policy'
import { audit, runOperation } from '../operations'
import { platformAdmin } from './service'
import { csv, numeric, EXPORT_CAP } from '../exports/csv'
const costKinds=['fiscal','sms','printer_agent','payment','hosting','backup','other'] as const
const measure=z.string().regex(/^(?:0|[1-9]\d{0,11})(?:\.\d{1,6})?$/)
export const costSchema=z.object({operationId:z.string().uuid(),targetOrganizationId:z.string().uuid(),kind:z.enum(costKinds),
 source:z.string().trim().min(3).max(200),currency:z.string().regex(/^[A-Z]{3}$/),periodStart:z.string().datetime({offset:true}),periodEnd:z.string().datetime({offset:true}),
 usageQuantity:measure,unitPrice:measure,estimated:z.boolean(),basis:z.string().trim().min(2).max(80),reason:z.string().trim().min(3).max(2000)}).strict().refine(value=>new Date(value.periodEnd)>new Date(value.periodStart),'Davr oxiri boshidan keyin bo‘lishi kerak')
export async function recordCost(context:TokenPayload,input:z.input<typeof costSchema>){
 const parsed=costSchema.parse(input)
 const D=Prisma.Decimal.clone({precision:50}),quantity=new D(parsed.usageQuantity),price=new D(parsed.unitPrice)
 if(!quantity.gt(0))throw new AccessError(400,'INVALID_COST_QUANTITY')
 const amount=quantity.mul(price).toDecimalPlaces(2,Prisma.Decimal.ROUND_HALF_UP)
 if(amount.gt('999999999999.99'))throw new AccessError(400,'COST_AMOUNT_LIMIT')
 return runOperation(context,'billing.cost.record',parsed.operationId,parsed,async tx=>{
  await platformAdmin(tx,context)
  if(!await tx.organization.findUnique({where:{id:parsed.targetOrganizationId}}))throw new AccessError(404,'NOT_FOUND')
  const source=parsed.source.normalize('NFKC').toLowerCase()
  const result=await tx.integrationCost.create({data:{organizationId:parsed.targetOrganizationId,kind:parsed.kind,source,currency:parsed.currency,
   periodStart:new Date(parsed.periodStart),periodEnd:new Date(parsed.periodEnd),usageQuantity:parsed.usageQuantity,unitPrice:parsed.unitPrice,amount:amount.toFixed(2),
   estimated:parsed.estimated,basis:parsed.basis,reason:parsed.reason,createdBy:context.userId}})
  await audit(tx,context,'IntegrationCost',result.id,'integration_cost_recorded',{targetOrganizationId:parsed.targetOrganizationId,kind:parsed.kind,source,amount:result.amount,currency:parsed.currency,estimated:parsed.estimated,financialPosting:false})
  return result
 }, tx => platformAdmin(tx,context))
}
export const cancelCostSchema=z.object({operationId:z.string().uuid(),reason:z.string().trim().min(3).max(2000)}).strict()
export async function cancelCost(context:TokenPayload,id:string,input:z.input<typeof cancelCostSchema>){
 const parsed=cancelCostSchema.parse(input)
 return runOperation(context,'billing.cost.cancel',parsed.operationId,{id,...parsed},async tx=>{
  await platformAdmin(tx,context)
  await tx.$queryRaw`SELECT id FROM "IntegrationCost" WHERE id=${id} FOR UPDATE`
  const row=await tx.integrationCost.findUnique({where:{id}})
  if(!row)throw new AccessError(404,'NOT_FOUND')
  if(row.cancelledAt)throw new AccessError(409,'COST_ALREADY_CANCELLED')
  const result=await tx.integrationCost.update({where:{id},data:{cancelledAt:new Date(),cancelledBy:context.userId,cancellationReason:parsed.reason}})
  await audit(tx,context,'IntegrationCost',id,'integration_cost_cancelled',{targetOrganizationId:row.organizationId,reason:parsed.reason,financialPosting:false});return result
 }, tx => platformAdmin(tx,context))
}
export const costReportSchema=z.object({targetOrganizationId:z.string().uuid(),from:z.string().datetime({offset:true}),to:z.string().datetime({offset:true}),page:z.coerce.number().int().min(1).max(100000).default(1)}).strict().refine(value=>new Date(value.to)>new Date(value.from),'Davr oxiri noto‘g‘ri')
export async function costReport(context:TokenPayload,input:z.input<typeof costReportSchema>,exportCsv=false){
 const parsed=costReportSchema.parse(input)
 return prisma.$transaction(async tx=>{
  await platformAdmin(tx,context)
  if(!await tx.organization.findUnique({where:{id:parsed.targetOrganizationId}}))throw new AccessError(404,'NOT_FOUND')
  // Only whole source periods inside the requested interval; overlapping partial
  // periods are explicitly counted, never silently prorated into fake costs.
  const where={organizationId:parsed.targetOrganizationId,periodStart:{gte:new Date(parsed.from)},periodEnd:{lte:new Date(parsed.to)},cancelledAt:null}
  const grouped=await tx.integrationCost.groupBy({by:['kind','currency','estimated'],where,_sum:{amount:true,usageQuantity:true},_count:{_all:true}})
  const overlapping=await tx.integrationCost.count({where:{organizationId:parsed.targetOrganizationId,cancelledAt:null,periodStart:{lt:new Date(parsed.to)},periodEnd:{gt:new Date(parsed.from)},NOT:{periodStart:{gte:new Date(parsed.from)},periodEnd:{lte:new Date(parsed.to)}}}})
  const revenue=await tx.billingPayment.aggregate({where:{organizationId:parsed.targetOrganizationId,createdAt:{gte:new Date(parsed.from),lt:new Date(parsed.to)}},_sum:{amount:true}})
  const D=Prisma.Decimal.clone({precision:50}),costUZS=grouped.filter(row=>row.currency==='UZS').reduce((sum,row)=>sum.add(row._sum.amount?.toString()??'0'),new D(0))
  const seen=new Set(grouped.map(row=>row.kind)),missingKinds=costKinds.filter(kind=>kind!=='other'&&!seen.has(kind))
  const complete=missingKinds.length===0&&overlapping===0&&!grouped.some(row=>row.currency!=='UZS'||row.estimated)
  const total=await tx.integrationCost.count({where})
  if(exportCsv&&total>EXPORT_CAP)throw new AccessError(413,'EXPORT_TOO_LARGE')
  const rows=await tx.integrationCost.findMany({where,take:exportCsv?EXPORT_CAP:20,skip:exportCsv?0:(parsed.page-1)*20,orderBy:[{periodStart:'desc'},{id:'asc'}]})
  const file=exportCsv?{filename:'integration-costs.csv',content:csv([['kind','source','currency','periodStart','periodEnd','usageQuantity','unitPrice','amount','estimated','basis'],...rows.map(row=>[row.kind,row.source,row.currency,row.periodStart.toISOString(),row.periodEnd.toISOString(),numeric(row.usageQuantity,6),numeric(row.unitPrice,6),numeric(row.amount,2),row.estimated?'estimated':'source_confirmed',row.basis])])}:null
  return {rows:exportCsv?[]:rows,total,file,
   grouped:grouped.map(row=>({kind:row.kind,currency:row.currency,estimated:row.estimated,amount:row._sum.amount?.toFixed(2)??'0.00',usageQuantity:row._sum.usageQuantity?.toString()??'0',records:row._count._all})),
   period:{from:parsed.from,to:parsed.to},overlappingPeriodsExcluded:overlapping,missingKinds,marginComplete:complete,
   recordedRevenueUZS:revenue._sum.amount?.toFixed(2)??'0.00',recordedCostUZS:costUZS.toFixed(2),recordedContributionUZS:new D(revenue._sum.amount?.toString()??'0').sub(costUZS).toFixed(2),
   policy:'RECORDED_PREPAID_REVENUE_MINUS_WHOLE_PERIOD_COSTS_NOT_ACCOUNTING_PROFIT'}
 },{isolationLevel:'RepeatableRead',timeout:10000})
}
