import {randomUUID} from 'node:crypto'
import {Prisma} from '@prisma/client'
import {z} from 'zod'
import {prisma} from '@/lib/prisma'
import type {TokenPayload} from '@/lib/auth'
import {AccessError} from '../auth/policy'
import {assertLiveContext,audit,runOperation} from '../operations'
import {lockAccounts,postAccountEntry} from '../finance/accounts'
import {positiveAmountSchema,requireOpenShift} from '../sales/service'
import {decimal,money} from '../sales/calculations'
import {debtTargets} from './targets'
const reason=z.string().trim().min(3).max(2000)
export const receiveAdvanceSchema=z.object({operationId:z.string().uuid(),accountId:z.string().uuid(),shiftId:z.string().uuid(),amount:positiveAmountSchema,reason}).strict()
export const allocateAdvanceSchema=z.object({operationId:z.string().uuid(),advanceId:z.string().uuid(),targetKey:z.string().regex(/^(sale|document):[0-9a-f-]{36}$/),amount:positiveAmountSchema,reason}).strict()
export const refundAdvanceSchema=z.object({operationId:z.string().uuid(),advanceId:z.string().uuid(),accountId:z.string().uuid(),shiftId:z.string().uuid(),amount:positiveAmountSchema,reason}).strict()
function owner(ctx:TokenPayload){if(ctx.role!=='owner')throw new AccessError(403,'OWNER_REQUIRED')}
async function customerLock(tx:Prisma.TransactionClient,ctx:TokenPayload,id:string){
 await tx.$queryRaw`SELECT id FROM "Customer" WHERE id=${id} AND "organizationId"=${ctx.organizationId} FOR UPDATE`
 const row=await tx.customer.findFirst({where:{id,organizationId:ctx.organizationId,isActive:true,mergedIntoId:null}})
 if(!row)throw new AccessError(404,'CUSTOMER_NOT_FOUND')
}
export async function unusedAdvance(tx:Pick<Prisma.TransactionClient,'$queryRaw'>,org:string,customerId:string){const [row]=await tx.$queryRaw<{amount:Prisma.Decimal}[]>`SELECT COALESCE(sum(available),0) AS amount FROM "CustomerAdvanceBalance" WHERE "organizationId"=${org} AND "customerId"=${customerId}`;return decimal(row.amount)}
async function source(tx:Prisma.TransactionClient,ctx:TokenPayload,customerId:string,id:string){
 await tx.$queryRaw`SELECT id FROM "CustomerAdvance" WHERE id=${id} AND "organizationId"=${ctx.organizationId} AND "customerId"=${customerId} FOR UPDATE`
 const [row]=await tx.$queryRaw<{id:string;available:Prisma.Decimal;documentId:string}[]>`SELECT id,available,"documentId" FROM "CustomerAdvanceBalance" WHERE id=${id} AND "organizationId"=${ctx.organizationId} AND "customerId"=${customerId}`
 if(!row)throw new AccessError(404,'ADVANCE_NOT_FOUND');return row
}
async function cashAccount(tx:Prisma.TransactionClient,ctx:TokenPayload,accountId:string,shiftId:string){
 // Existing finance transfers lock accounts before shifts; sale returns lock
 // shifts before customers. Match both orders before taking any customer lock.
 const [account]=await lockAccounts(tx,ctx,[accountId])
 if(account.kind!=='cash')throw new AccessError(409,'ADVANCE_CASH_ONLY')
 const shift=await requireOpenShift(tx,ctx,shiftId)
 if(shift.registerId!==account.registerId)throw new AccessError(409,'ACCOUNT_SHIFT_MISMATCH')
 return account
}
export async function receiveAdvance(ctx:TokenPayload,customerId:string,input:z.infer<typeof receiveAdvanceSchema>){owner(ctx);return runOperation(ctx,'customer.advance.receive',input.operationId,{customerId,...input},async tx=>{
 const account=await cashAccount(tx,ctx,input.accountId,input.shiftId);await customerLock(tx,ctx,customerId)
 const amount=money(input.amount),document=await tx.financialDocument.create({data:{organizationId:ctx.organizationId,storeId:account.storeId,kind:'customer_advance',amount,reason:input.reason,actorId:ctx.userId}})
 await postAccountEntry(tx,ctx,account,document.id,amount,input.reason,input.shiftId)
 const row=await tx.customerAdvance.create({data:{organizationId:ctx.organizationId,customerId,documentId:document.id,amount}})
 await audit(tx,ctx,'CustomerAdvance',row.id,'advance_received',{customerId,documentId:document.id,accountId:account.id,amount,reason:input.reason});return row
})}
export async function allocateAdvance(ctx:TokenPayload,customerId:string,input:z.infer<typeof allocateAdvanceSchema>){owner(ctx);return runOperation(ctx,'customer.advance.allocate',input.operationId,{customerId,...input},async tx=>{
 // Sale-before-customer matches refund/collection lock ordering. Never acquire a
 // customer lock and then wait for a sale held by a concurrent return.
 const [kind,id]=input.targetKey.split(':')
 if(kind==='sale')await tx.$queryRaw`SELECT id FROM "Sale" WHERE id=${id} AND "organizationId"=${ctx.organizationId} FOR UPDATE`
 await customerLock(tx,ctx,customerId);const original=await source(tx,ctx,customerId,input.advanceId),amount=money(input.amount)
 if(amount.gt(original.available))throw new AccessError(409,'ADVANCE_BALANCE_EXCEEDED')
 const target=(await debtTargets(tx,ctx.organizationId,customerId)).find(t=>t.key===input.targetKey)
 if(!target||target.legacyUnallocated||!target.balance.gt(0))throw new AccessError(409,'DEBT_TARGET_REQUIRED')
 if(amount.gt(target.balance))throw new AccessError(409,'DEBT_REDUCTION_EXCEEDED')
 const allocationId=randomUUID(),debtEntryId=randomUUID()
 // Deferred FK permits the allocation source to exist before the guarded entry.
 const row=await tx.customerAdvanceAllocation.create({data:{id:allocationId,advanceId:original.id,debtEntryId,amount}})
 await tx.debtEntry.create({data:{id:debtEntryId,organizationId:ctx.organizationId,customerId,saleId:target.saleId,debtOriginId:target.debtOriginId,sourceType:'advance_allocation',sourceId:row.id,amount:amount.negated(),note:input.reason,actorId:ctx.userId}})
 await audit(tx,ctx,'CustomerAdvanceAllocation',row.id,'advance_allocated',{customerId,advanceId:original.id,targetKey:target.key,amount,reason:input.reason});return row
})}
export async function refundAdvance(ctx:TokenPayload,customerId:string,input:z.infer<typeof refundAdvanceSchema>){owner(ctx);return runOperation(ctx,'customer.advance.refund',input.operationId,{customerId,...input},async tx=>{
 const account=await cashAccount(tx,ctx,input.accountId,input.shiftId);await customerLock(tx,ctx,customerId);const original=await source(tx,ctx,customerId,input.advanceId),amount=money(input.amount)
 if(amount.gt(original.available))throw new AccessError(409,'ADVANCE_BALANCE_EXCEEDED')
 const document=await tx.financialDocument.create({data:{organizationId:ctx.organizationId,storeId:account.storeId,kind:'customer_refund',amount,reason:input.reason,actorId:ctx.userId}})
 await postAccountEntry(tx,ctx,account,document.id,amount.negated(),input.reason,input.shiftId)
 const row=await tx.customerAdvanceRefund.create({data:{advanceId:original.id,documentId:document.id,amount}})
 await audit(tx,ctx,'CustomerAdvanceRefund',row.id,'advance_refunded',{customerId,advanceId:original.id,originalDocumentId:original.documentId,documentId:document.id,accountId:account.id,amount,reason:input.reason});return row
})}
export async function listAdvances(ctx:TokenPayload,customerId:string,options:{page:number;limit:number}){owner(ctx);const {page,limit}=options
 if(!Number.isSafeInteger(page)||page<1||!Number.isSafeInteger(limit)||limit<1||limit>200)throw new AccessError(400,'INVALID_PAGINATION')
 return prisma.$transaction(async tx=>{await assertLiveContext(tx,ctx)
 if(!await tx.customer.findFirst({where:{id:customerId,organizationId:ctx.organizationId}}))throw new AccessError(404,'CUSTOMER_NOT_FOUND')
 const [totals]=await tx.$queryRaw<{total:bigint;received:Prisma.Decimal;available:Prisma.Decimal}[]>`SELECT count(*) AS total,COALESCE(sum(amount),0) AS received,COALESCE(sum(available),0) AS available FROM "CustomerAdvanceBalance" WHERE "organizationId"=${ctx.organizationId} AND "customerId"=${customerId}`
 const rows=await tx.$queryRaw<{id:string;documentId:string;amount:Prisma.Decimal;available:Prisma.Decimal;allocated:Prisma.Decimal;refunded:Prisma.Decimal;createdAt:Date}[]>`SELECT a.id,a."documentId",a.amount,a.available,a."createdAt",COALESCE((SELECT sum(x.amount) FROM "CustomerAdvanceAllocation" x WHERE x."advanceId"=a.id),0) AS allocated,COALESCE((SELECT sum(x.amount) FROM "CustomerAdvanceRefund" x WHERE x."advanceId"=a.id),0) AS refunded FROM "CustomerAdvanceBalance" a WHERE a."organizationId"=${ctx.organizationId} AND a."customerId"=${customerId} ORDER BY a."createdAt",a.id LIMIT ${limit} OFFSET ${(page-1)*limit}`
 return {rows,summary:{received:totals.received,available:totals.available},pagination:{page,limit,total:Number(totals.total),totalPages:Math.ceil(Number(totals.total)/limit)}}
 },{isolationLevel:'RepeatableRead'})
}
