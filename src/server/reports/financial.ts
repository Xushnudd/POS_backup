import { Prisma } from '@prisma/client'
import { z } from 'zod'
import type { TokenPayload } from '@/lib/auth'
import { AccessError, tenantScope } from '../auth/policy'
import { dateRange } from './dates'
import { reportDecimal as decimal } from './numeric'

export async function financialFilter(tx:Prisma.TransactionClient,context:TokenPayload,params:URLSearchParams) {
 const org=await tx.organization.findUniqueOrThrow({where:{id:context.organizationId},select:{timezone:true,currencyCode:true}})
 const storeId=params.get('storeId')
 if(storeId&&!await tx.store.findFirst({where:{id:storeId,AND:tenantScope('Store',context)},select:{id:true}}))throw new AccessError(404,'NOT_FOUND')
 const supplied=params.get('asOf'),asOf=supplied?new Date(supplied):new Date()
 if((supplied&&!z.iso.datetime({offset:true}).safeParse(supplied).success)||!Number.isFinite(asOf.getTime())||asOf.getTime()>Date.now())throw new AccessError(400,'INVALID_REPORT_CUTOFF')
 const startDate=params.get('startDate'),endDate=params.get('endDate'),range=dateRange(startDate,endDate,org.timezone)
 const scope:Prisma.SaleWhereInput={AND:tenantScope('Sale',context),...(storeId?{storeId}:{})}
 const sales:Prisma.SaleWhereInput={...scope,status:{in:['completed','partially_returned','returned']},createdAt:{lte:asOf},completedAt:{...range,lte:asOf}}
 const returns:Prisma.SaleReturnWhereInput={sale:scope,status:'completed',createdAt:{lte:asOf},returnedAt:{...range,lte:asOf}}
 const payments:Prisma.PaymentWhereInput={AND:tenantScope('Payment',context),...(storeId?{storeId}:{}),status:'recorded',createdAt:{lte:asOf},paidAt:{...range,lte:asOf}}
 return {scope,sales,returns,payments,range,asOf,storeId,meta:{asOf:asOf.toISOString(),timezone:org.timezone,currency:org.currencyCode,startDate,endDate,storeId}}
}
export type FinancialFilter=Awaited<ReturnType<typeof financialFilter>>
export async function financialSummary(tx:Prisma.TransactionClient,context:TokenPayload,filter:FinancialFilter) {
 const [total,sums,itemCount,returned]=await Promise.all([
  tx.sale.count({where:filter.sales}),tx.sale.aggregate({where:filter.sales,_sum:{totalAmount:true,discountAmount:true}}),
  tx.saleItem.count({where:{sale:filter.sales}}),tx.saleReturn.aggregate({where:filter.returns,_sum:{refundAmount:true}}),
 ])
 const branches=context.role==='owner'?Prisma.empty:context.storeIds.length?Prisma.sql`AND p."storeId" IN (${Prisma.join(context.storeIds)})`:Prisma.sql`AND FALSE`
 const cash=await tx.$queryRaw<{cashSales:Prisma.Decimal;cashDebtCollections:Prisma.Decimal;cashRefunds:Prisma.Decimal;creditSales:Prisma.Decimal;cashPayments:Prisma.Decimal;cardPayments:Prisma.Decimal;transferPayments:Prisma.Decimal}[]>(Prisma.sql`SELECT
  COALESCE(SUM(CASE WHEN p."paymentType"='cash' AND p.direction='in' AND p."saleId" IS NOT NULL AND COALESCE(p.note,'')<>'debt_collection' THEN p.amount ELSE 0 END),0) AS "cashSales",
  COALESCE(SUM(CASE WHEN p."paymentType"='cash' AND p.direction='in' AND p.note='debt_collection' THEN p.amount ELSE 0 END),0) AS "cashDebtCollections",
  COALESCE(SUM(CASE WHEN p."paymentType"='cash' AND p.direction='out' AND p.note LIKE 'return:%' THEN p.amount ELSE 0 END),0) AS "cashRefunds",
  COALESCE(SUM(CASE WHEN p."paymentType"='credit' AND p.direction='in' THEN p.amount ELSE 0 END),0) AS "creditSales",
  COALESCE(SUM(CASE WHEN p."paymentType"='cash' THEN CASE WHEN p.direction='in' THEN p.amount ELSE -p.amount END ELSE 0 END),0) AS "cashPayments",
  COALESCE(SUM(CASE WHEN p."paymentType"='card' THEN CASE WHEN p.direction='in' THEN p.amount ELSE -p.amount END ELSE 0 END),0) AS "cardPayments",
  COALESCE(SUM(CASE WHEN p."paymentType"='transfer' THEN CASE WHEN p.direction='in' THEN p.amount ELSE -p.amount END ELSE 0 END),0) AS "transferPayments"
  FROM "Payment" p WHERE p."organizationId"=${context.organizationId} AND p.status='recorded' AND p."createdAt"<=${filter.asOf} AND p."paidAt"<=${filter.asOf}
  ${branches} ${filter.storeId?Prisma.sql`AND p."storeId"=${filter.storeId}`:Prisma.empty}
  ${filter.range.gte?Prisma.sql`AND p."paidAt">=${filter.range.gte}`:Prisma.empty} ${filter.range.lt?Prisma.sql`AND p."paidAt"<${filter.range.lt}`:Prisma.empty}`)
 const grossRevenue=decimal(sums._sum.totalAmount??0),refundAmount=decimal(returned._sum.refundAmount??0),totalRevenue=grossRevenue.sub(refundAmount)
 return {total,summary:{grossRevenue,refundAmount,totalRevenue,totalDiscount:decimal(sums._sum.discountAmount??0),totalItems:itemCount,averageSale:total?totalRevenue.div(total).toDecimalPlaces(2).toString():'0.00',...cash[0]}}
}
