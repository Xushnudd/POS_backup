import {reportSaleList} from '@/server/reports/sale-list'
import {cursorExport,EXPORT_PAGE_SIZE} from './cursor'
import { reportDecimal } from '../reports/numeric'
import type { TokenPayload } from '@/lib/auth'
import { prisma } from '@/lib/prisma'
import { AccessError } from '../auth/policy'
import { consumeLimit } from '../auth/rate-limit'
import { financialFilter, financialSummary } from '../reports/financial'
import { csv, numeric, EXPORT_CAP } from './csv'
export async function salesReportCsv(context:TokenPayload,params:URLSearchParams){
 if(context.role==='cashier')throw new AccessError(403,'FORBIDDEN')
 const list=reportSaleList(params),db=prisma
 await consumeLimit('report.export',context.organizationId+':'+context.userId,10,60000)
 return db.$transaction(async tx=>{
  const filter=await financialFilter(tx,context,params),where={AND:[filter.sales,list.searchFilter]},returnsWhere={...filter.returns,sale:{AND:[filter.scope,list.searchFilter]}}
  const {timezone}=filter.meta
  const count=await tx.sale.count({where}),returnCount=await tx.saleReturn.count({where:returnsWhere})
  if(count+returnCount>EXPORT_CAP)throw new AccessError(413,'EXPORT_TOO_LARGE','Eksport 10000 hodisadan oshdi; davrni toraytiring')
  const sales=await cursorExport(cursor=>tx.sale.findMany({where,take:EXPORT_PAGE_SIZE,...(cursor?{cursor:{id:cursor},skip:1}:{}),orderBy:params.has('sort')?list.orderBy:[{completedAt:'asc'},{id:'asc'}],select:{id:true,receiptNo:true,completedAt:true,totalAmount:true,discountAmount:true,status:true,customer:{select:{fullName:true}},cashier:{select:{fullName:true}},store:{select:{name:true}}}}))
  const returns=await cursorExport(cursor=>tx.saleReturn.findMany({where:returnsWhere,take:EXPORT_PAGE_SIZE,...(cursor?{cursor:{id:cursor},skip:1}:{}),orderBy:[{returnedAt:'asc'},{id:'asc'}],select:{id:true,returnReceiptNo:true,returnedAt:true,refundAmount:true,sale:{select:{receiptNo:true,store:{select:{name:true}}}}}}))
  const {summary}=await financialSummary(tx,context,filter)
  const gross=reportDecimal(summary.grossRevenue),refund=reportDecimal(summary.refundAmount)
  return {filename:'sales-report-'+context.organizationId+'.csv',meta:{...filter.meta,search:list.search,sort:list.sort,summaryScope:'complete_period_before_row_search'},summary,content:csv([
   ['Vaqt zonasi',timezone],['Hisob holati UTC',filter.meta.asOf],[list.search?'Filtrga mos savdolar soni':'Savdolar soni',numeric(count,0)],['Davr boshi',params.get('startDate')],['Davr oxiri',params.get('endDate')],['Yalpi savdo',numeric(gross)],['Qaytarilgan tovar qiymati',numeric(refund)],['Sof tovar tushumi',numeric(gross.sub(refund))],['Naqd savdo',numeric(summary.cashSales)],['Naqd qarz undirish',numeric(summary.cashDebtCollections)],['Naqd refund',numeric(summary.cashRefunds)],['Nasiya savdo',numeric(summary.creditSales)],['Sof naqd to‘lovlar',numeric(summary.cashPayments)],
   ['Hodisa','ID','Chek','Original chek','Sana UTC','Filial','Mijoz','Kassir','Holat','Savdo qiymati','Qaytarilgan tovar qiymati','Chegirma'],
   ...(list.search?[['Chek qidiruvi',list.search],['Yig‘indilar doirasi','Tanlangan davrning barcha ruxsatli savdo va pul hodisalari']]:[]),
   ...sales.map(row=>['sale',row.id,row.receiptNo,null,row.completedAt?.toISOString(),row.store.name,row.customer?.fullName,row.cashier.fullName,row.status,numeric(row.totalAmount),numeric(0),numeric(row.discountAmount)]),
   ...returns.map(row=>['return',row.id,row.returnReceiptNo,row.sale.receiptNo,row.returnedAt.toISOString(),row.sale.store.name,null,null,'completed',numeric(0),numeric(row.refundAmount),numeric(0)]),
  ])}
 },{isolationLevel:'RepeatableRead',timeout:15000})
}
