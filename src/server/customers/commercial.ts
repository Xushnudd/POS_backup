import {unusedAdvance} from './advances'
import { Prisma } from '@prisma/client'
import { prisma } from '@/lib/prisma'
import type { TokenPayload } from '@/lib/auth'
import { AccessError } from '../auth/policy'
import { dateRange } from '../reports/dates'
import { csvText } from './export'
export async function commercialStatementCsv(context:TokenPayload,customerId:string,period:{from:string|null;to:string|null}) {
 if(context.role!=='owner')throw new AccessError(403,'OWNER_REQUIRED')
 return prisma.$transaction(async tx=>{
  const customer=await tx.customer.findFirst({where:{id:customerId,organizationId:context.organizationId}})
  if(!customer)throw new AccessError(404,'CUSTOMER_NOT_FOUND')
  const organization=await tx.organization.findUniqueOrThrow({where:{id:context.organizationId}})
  const dates=dateRange(period.from,period.to,organization.timezone)
  // Sale/return/payment rows describe activity. Only immutable debt entries
  // affect debt: credit payments and sale totals must never count it twice.
  const events=Prisma.sql`
   SELECT s.id,'sale'::text AS kind,COALESCE(s."completedAt",s."createdAt") AS at,s."receiptNo" AS reference,s.status AS detail,s.note,NULL::timestamp AS due,s."cashierId" AS actor,s."totalAmount" AS sales,0::numeric AS returns,0::numeric AS incoming,0::numeric AS outgoing,0::numeric AS debt
   FROM "Sale" s WHERE s."organizationId"=${context.organizationId} AND s."customerId"=${customerId} AND s.status IN ('completed','partially_returned','returned')
   UNION ALL
   SELECT r.id,'return',r."returnedAt",r."returnReceiptNo",r.status,r.reason,NULL,r."processedBy",0,r."refundAmount",0,0,0 FROM "SaleReturn" r JOIN "Sale" s ON s.id=r."saleId" WHERE s."organizationId"=${context.organizationId} AND s."customerId"=${customerId} AND r.status='completed'
   UNION ALL
   SELECT p.id,'payment',p."paidAt",p."referenceNo",p."paymentType"||':'||p.direction||':'||p.status,p.note,NULL,p."receivedBy",0,0,
    CASE WHEN p."paymentType"<>'credit' AND p.status='recorded' AND p.direction='in' THEN p.amount ELSE 0 END,
    CASE WHEN p."paymentType"<>'credit' AND p.status='recorded' AND p.direction='out' THEN p.amount ELSE 0 END,0
   FROM "Payment" p LEFT JOIN "Sale" s ON s.id=p."saleId" AND s."organizationId"=p."organizationId" WHERE p."organizationId"=${context.organizationId} AND (p."customerId"=${customerId} OR s."customerId"=${customerId})
   UNION ALL
   SELECT a.id,'advance_receive',a."createdAt",a."documentId",'cash',d.reason,NULL,d."actorId",0,0,a.amount,0,0 FROM "CustomerAdvance" a JOIN "FinancialDocument" d ON d.id=a."documentId" WHERE a."organizationId"=${context.organizationId} AND a."customerId"=${customerId}
   UNION ALL
   SELECT r.id,'advance_refund',r."createdAt",r."documentId",'cash',d.reason,NULL,d."actorId",0,0,0,r.amount,0 FROM "CustomerAdvanceRefund" r JOIN "CustomerAdvance" a ON a.id=r."advanceId" JOIN "FinancialDocument" d ON d.id=r."documentId" WHERE a."organizationId"=${context.organizationId} AND a."customerId"=${customerId}
   UNION ALL
   SELECT d.id,'debt',d."effectiveAt",d."sourceId",d."sourceType",d.note,d."dueAt",d."actorId",0,0,0,0,d.amount FROM "DebtEntry" d WHERE d."organizationId"=${context.organizationId} AND d."customerId"=${customerId}`
  const range=Prisma.sql`TRUE ${dates.gte?Prisma.sql`AND e.at>=${dates.gte}`:Prisma.empty} ${dates.lt?Prisma.sql`AND e.at<${dates.lt}`:Prisma.empty}`
  const [totals]=await tx.$queryRaw<{count:bigint;sales:Prisma.Decimal;returns:Prisma.Decimal;incoming:Prisma.Decimal;outgoing:Prisma.Decimal;debt:Prisma.Decimal}[]>`SELECT count(*) AS count,COALESCE(sum(e.sales),0) AS sales,COALESCE(sum(e.returns),0) AS returns,COALESCE(sum(e.incoming),0) AS incoming,COALESCE(sum(e.outgoing),0) AS outgoing,COALESCE(sum(e.debt),0) AS debt FROM (${events}) e WHERE ${range}`
  if(totals.count>BigInt(10000))throw new AccessError(413,'EXPORT_TOO_LARGE','Eksport 10000 hodisadan oshdi; davrni qisqartiring')
  const opening=dates.gte?await tx.debtEntry.aggregate({where:{organizationId:context.organizationId,customerId,effectiveAt:{lt:dates.gte}},_sum:{amount:true}}):null
  const balance=new Prisma.Decimal(opening?._sum.amount??0)
  const rows=await tx.$queryRaw<{id:string;kind:string;at:Date;reference:string|null;detail:string;note:string|null;due:Date|null;actor:string|null;sales:Prisma.Decimal;returns:Prisma.Decimal;incoming:Prisma.Decimal;outgoing:Prisma.Decimal;debt:Prisma.Decimal;balance:Prisma.Decimal}[]>`SELECT e.*,${balance}::numeric+sum(e.debt) OVER(ORDER BY e.at,e.kind,e.id ROWS UNBOUNDED PRECEDING) AS balance FROM (${events}) e WHERE ${range} ORDER BY e.at,e.kind,e.id LIMIT 10000`
  const text=(values:unknown[])=>values.map(csvText).join(',')
  const numeric=(value:Prisma.Decimal)=>'"'+value.toFixed(2)+'"'
  const lines=[text(['Mijoz',customer.fullName,customer.id]),text(['Tashkilot vaqt zonasi',organization.timezone]),text(['Davr',period.from,period.to]),text(['Izoh','Savdo/qaytarish qiymati va pul harakati alohida. Faqat debt satri qarz qoldig‘ini o‘zgartiradi. Recorded card/transfer tashqi provayder tasdig‘i emas.'])]
  for(const [label,value] of [['Savdolar qiymati',totals.sales],['Qaytarilgan tovar qiymati',totals.returns],['Recorded pul kirimi',totals.incoming],['Recorded pul chiqimi',totals.outgoing],['Davr boshidagi qarz',balance],['Davr oxiridagi qarz',balance.add(totals.debt)]] as const)lines.push(csvText(label)+','+numeric(value))
  lines.push(csvText('Joriy ishlatilmagan avans')+','+numeric(await unusedAdvance(tx,context.organizationId,customerId)))
  lines.push('',text(['ID','Hodisa','Sana UTC','Muddat UTC','Xodim ID','Hujjat','Turi/holati','Sabab','Savdo qiymati','Qaytarish qiymati','Pul kirimi','Pul chiqimi','Qarz o‘zgarishi','Qarz qoldig‘i']))
  for(const row of rows)lines.push([...[row.id,row.kind,row.at.toISOString(),row.due?.toISOString(),row.actor,row.reference,row.detail,row.note].map(csvText),...[row.sales,row.returns,row.incoming,row.outgoing,row.debt,row.balance].map(numeric)].join(','))
  return {filename:`customer-statement-${customer.id}.csv`,content:'\uFEFF'+lines.join('\r\n')+'\r\n'}
 },{isolationLevel:Prisma.TransactionIsolationLevel.RepeatableRead})
}
