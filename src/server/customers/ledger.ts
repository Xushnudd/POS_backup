import {unusedAdvance} from './advances'
import { debtTargets } from './targets'
import { Prisma } from '@prisma/client'
import { z } from 'zod'
import { prisma } from '@/lib/prisma'
import type { TokenPayload } from '@/lib/auth'
import { AccessError, tenantScope } from '../auth/policy'
import { audit, runOperation } from '../operations'
import { amountSchema } from '../sales/service'
import { decimal, money, debtClosingBalance } from '../sales/calculations'
import { debtAging } from './aging'
import { dateRange } from '../reports/dates'
function manager(context:TokenPayload){if(context.role!=='owner')throw new AccessError(403,'OWNER_REQUIRED','Qarz ko‘chirmasi va tuzatishlar tashkilot egasi vakolatida')}
export const debtDocumentSchema=z.object({operationId:z.string().uuid(),kind:z.enum(['opening','increase','decrease','write_off']),amount:amountSchema.refine(v=>decimal(v).gt(0)),reason:z.string().trim().min(3).max(2000),saleId:z.string().uuid().optional(),debtOriginId:z.string().uuid().optional(),effectiveAt:z.iso.datetime({offset:true}).optional(),dueAt:z.iso.datetime({offset:true}).optional()}).strict().refine(x=>!x.saleId||x.kind==='write_off','Savdoga faqat write-off bog‘lanadi').refine(x=>!x.debtOriginId||(['decrease','write_off'].includes(x.kind)&&!x.saleId),'Hujjat targeti faqat umumiy qarzni kamaytirish uchun').refine(x=>x.kind==='opening'||(!x.effectiveAt&&!x.dueAt),'Sanalar faqat boshlang‘ich hujjat uchun')
export async function postDebtDocument(context:TokenPayload,customerId:string,input:z.infer<typeof debtDocumentSchema>){
 manager(context)
 return runOperation(context,'debt.document',input.operationId,{customerId,...input},async tx=>{
  if(input.saleId){
   await tx.$queryRaw`SELECT id FROM "Sale" WHERE id=${input.saleId} FOR UPDATE`
   const sale=await tx.sale.findFirst({where:{id:input.saleId,customerId,AND:tenantScope('Sale',context)}})
   if(!sale||!['completed','partially_returned'].includes(sale.status))throw new AccessError(404,'SALE_NOT_FOUND')
  }
  await tx.$queryRaw`SELECT id FROM "Customer" WHERE id=${customerId} FOR UPDATE`
  const customer=await tx.customer.findFirst({where:{id:customerId,organizationId:context.organizationId,isActive:true}})
  if(!customer)throw new AccessError(404,'CUSTOMER_NOT_FOUND')
  const effectiveAt=input.effectiveAt?new Date(input.effectiveAt):new Date(),dueAt=input.dueAt?new Date(input.dueAt):undefined
  if(effectiveAt.getTime()>Date.now()+300000||(dueAt&&dueAt<effectiveAt))throw new AccessError(400,'INVALID_DOCUMENT_DATE')
  const amount=money(input.amount),reducing=['decrease','write_off'].includes(input.kind)
  let debtOriginId=input.debtOriginId
  if(reducing){
   if(!input.saleId){
    const targets=(await debtTargets(tx,context.organizationId,customerId)).filter(row=>!row.saleId&&row.balance.gt(0))
    const target=debtOriginId?targets.find(row=>row.debtOriginId===debtOriginId):targets.length===1?targets[0]:null
    if(!target)throw new AccessError(409,'DEBT_TARGET_REQUIRED','Kamaytiriladigan boshlang‘ich hujjatni tanlang')
    debtOriginId=target.debtOriginId??undefined
    if(amount.gt(target.balance))throw new AccessError(409,'DEBT_REDUCTION_EXCEEDED')
   }
   const balance=await tx.debtEntry.aggregate({where:{organizationId:context.organizationId,customerId,saleId:input.saleId??null},_sum:{amount:true}})
   if(amount.gt(balance._sum.amount??0))throw new AccessError(409,'DEBT_REDUCTION_EXCEEDED','Kamaytirish tanlangan qarz qoldig‘idan oshmasligi kerak')
  }
  const sourceType=input.kind==='opening'?'opening_debt':input.kind==='write_off'?'write_off':'debt_adjustment'
  const result=await tx.debtEntry.create({data:{organizationId:context.organizationId,customerId,saleId:input.saleId,debtOriginId,sourceType,sourceId:input.operationId,amount:reducing?amount.negated():amount,note:input.reason,actorId:context.userId,effectiveAt,dueAt}})
  await audit(tx,context,'DebtEntry',result.id,'debt_document_posted',{kind:input.kind,customerId,saleId:input.saleId,amount:result.amount,reason:input.reason})
  return result
 })
}
export async function customerStatement(context:TokenPayload,customerId:string,options:{page?:number;limit?:number;from?:string|null;to?:string|null;exportAll?:boolean}={}){
 manager(context)
 const page=options.exportAll?1:(options.page??1),limit=options.exportAll?10000:(options.limit??50)
 if(!Number.isSafeInteger(page)||page<1||!Number.isSafeInteger(limit)||limit<1||limit>(options.exportAll?10000:200))throw new AccessError(400,'INVALID_PAGINATION')
 return prisma.$transaction(async tx=>{
  const customer=await tx.customer.findFirst({where:{id:customerId,organizationId:context.organizationId}})
  if(!customer)throw new AccessError(404,'CUSTOMER_NOT_FOUND')
  const organization=await tx.organization.findUniqueOrThrow({where:{id:context.organizationId}})
  const dates=dateRange(options.from??null,options.to??null,organization.timezone)
  const scope=Prisma.sql`d."organizationId"=${context.organizationId} AND d."customerId"=${customerId}`
  const range=Prisma.sql`${scope} ${dates.gte?Prisma.sql`AND d."effectiveAt">=${dates.gte}`:Prisma.empty} ${dates.lt?Prisma.sql`AND d."effectiveAt"<${dates.lt}`:Prisma.empty}`
  const opening=dates.gte?await tx.debtEntry.aggregate({where:{organizationId:context.organizationId,customerId,effectiveAt:{lt:dates.gte}},_sum:{amount:true}}):null
  const openingBalance=decimal(opening?._sum.amount??0)
  const [totals]=await tx.$queryRaw<{total:bigint;increases:Prisma.Decimal;reductions:Prisma.Decimal}[]>`SELECT count(*) AS total,COALESCE(sum(d.amount) FILTER(WHERE d.amount>0),0) AS increases,COALESCE(-sum(d.amount) FILTER(WHERE d.amount<0),0) AS reductions FROM "DebtEntry" d WHERE ${range}`
  if(options.exportAll&&totals.total>BigInt(10000))throw new AccessError(413,'EXPORT_TOO_LARGE','Eksport 10000 yozuvdan oshdi; davrni qisqartiring')
  const entries=await tx.$queryRaw<{id:string;sourceType:string;sourceId:string;saleId:string|null;debtOriginId:string|null;receiptNo:string|null;amount:Prisma.Decimal;balance:Prisma.Decimal;effectiveAt:Date;dueAt:Date|null;createdAt:Date;note:string|null;actorId:string|null;actorName:string|null}[]>`
   SELECT statement.* FROM (SELECT d.id,d."sourceType",d."sourceId",d."saleId",d."debtOriginId",s."receiptNo",d.amount,d."effectiveAt",d."dueAt",d."createdAt",d.note,d."actorId",u."fullName" AS "actorName",${openingBalance}::numeric+sum(d.amount) OVER(ORDER BY d."effectiveAt",d.id ROWS UNBOUNDED PRECEDING) AS balance
   FROM "DebtEntry" d LEFT JOIN "Sale" s ON s.id=d."saleId" AND s."organizationId"=d."organizationId" LEFT JOIN "User" u ON u.id=d."actorId" WHERE ${range}) statement
   ORDER BY statement."effectiveAt",statement.id LIMIT ${limit} OFFSET ${(page-1)*limit}`
  const all=await tx.debtEntry.aggregate({where:{organizationId:context.organizationId,customerId},_sum:{amount:true}})
  const aging=await debtAging(tx,context.organizationId,customerId,new Date())
  return {advanceAvailable:await unusedAdvance(tx,context.organizationId,customerId),aging,timezone:organization.timezone,customer:{id:customer.id,fullName:customer.fullName},entries,summary:{openingBalance,increases:totals.increases,reductions:totals.reductions,closingBalance:debtClosingBalance(openingBalance,totals.increases,totals.reductions),currentBalance:decimal(all._sum.amount??0)},pagination:{page,limit,total:Number(totals.total),totalPages:Math.ceil(Number(totals.total)/limit)}}
 },{isolationLevel:Prisma.TransactionIsolationLevel.RepeatableRead})
}
