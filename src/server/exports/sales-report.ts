import { Prisma } from '@prisma/client'
import type { TokenPayload } from '@/lib/auth'
import { scopedPrisma } from '../auth/scoped-prisma'
import { AccessError } from '../auth/policy'
import { consumeLimit } from '../auth/rate-limit'
import { dateRange } from '../reports/dates'
import { csv, numeric, EXPORT_CAP } from './csv'
export async function salesReportCsv(context:TokenPayload,params:URLSearchParams){
 if(context.role==='cashier')throw new AccessError(403,'FORBIDDEN')
 const db=scopedPrisma(context),storeId=params.get('storeId')
 const org=await db.organization.findUniqueOrThrow({where:{id:context.organizationId},select:{timezone:true}})
 const range=dateRange(params.get('startDate'),params.get('endDate'),org.timezone)
 const scope={organizationId:context.organizationId,...(storeId&&{storeId})}
 const where={...scope,status:{in:['completed','partially_returned','returned']},...(Object.keys(range).length&&{completedAt:range})}
 const returnsWhere={status:'completed',...(Object.keys(range).length&&{returnedAt:range}),sale:scope}
 await consumeLimit('report.export',context.organizationId+':'+context.userId,10,60000)
 return db.$transaction(async tx=>{
  const count=await tx.sale.count({where}),returnCount=await tx.saleReturn.count({where:returnsWhere})
  if(count+returnCount>EXPORT_CAP)throw new AccessError(413,'EXPORT_TOO_LARGE','Eksport 10000 hodisadan oshdi; davrni toraytiring')
  const sales=await tx.sale.findMany({where,orderBy:[{completedAt:'asc'},{id:'asc'}],select:{id:true,receiptNo:true,completedAt:true,totalAmount:true,discountAmount:true,status:true,customer:{select:{fullName:true}},cashier:{select:{fullName:true}},store:{select:{name:true}}}})
  const returns=await tx.saleReturn.findMany({where:returnsWhere,orderBy:[{returnedAt:'asc'},{id:'asc'}],select:{id:true,returnReceiptNo:true,returnedAt:true,refundAmount:true,sale:{select:{receiptNo:true,store:{select:{name:true}}}}}})
  const gross=sales.reduce((sum,row)=>sum.add(row.totalAmount),new Prisma.Decimal(0)),refund=returns.reduce((sum,row)=>sum.add(row.refundAmount),new Prisma.Decimal(0))
  return {filename:'sales-report-'+context.organizationId+'.csv',content:csv([
   ['Vaqt zonasi',org.timezone],['Davr boshi',params.get('startDate')],['Davr oxiri',params.get('endDate')],['Yalpi savdo',numeric(gross)],['Qaytarilgan tovar qiymati',numeric(refund)],['Sof tovar tushumi',numeric(gross.sub(refund))],
   ['Hodisa','ID','Chek','Original chek','Sana UTC','Filial','Mijoz','Kassir','Holat','Savdo qiymati','Qaytarilgan tovar qiymati','Chegirma'],
   ...sales.map(row=>['sale',row.id,row.receiptNo,null,row.completedAt?.toISOString(),row.store.name,row.customer?.fullName,row.cashier.fullName,row.status,numeric(row.totalAmount),numeric(0),numeric(row.discountAmount)]),
   ...returns.map(row=>['return',row.id,row.returnReceiptNo,row.sale.receiptNo,row.returnedAt.toISOString(),row.sale.store.name,null,null,'completed',numeric(0),numeric(row.refundAmount),numeric(0)]),
  ])}
 },{isolationLevel:'RepeatableRead'})
}
