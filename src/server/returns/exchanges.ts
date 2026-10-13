import {validateSerialSale} from '../inventory/serials'
import {Prisma} from '@prisma/client'
import {z} from 'zod'
import {prisma} from '@/lib/prisma'
import type {TokenPayload} from '@/lib/auth'
import {AccessError,tenantScope} from '../auth/policy'
import {assertLiveContext,audit,payloadHash,runOperation} from '../operations'
import {amountSchema,completeSchema,saleDraftSchema,prepareItems,createDraftTx,completeSaleTx,requireOpenShift} from '../sales/service'
import {decimal} from '../sales/calculations'
import {returnSchema,returnSaleTx} from './service'
export const exchangePreviewSchema=z.object({originalSaleId:z.string().uuid(),shiftId:z.string().uuid(),reason:z.string().trim().min(3).max(2000),
 items:returnSchema.shape.items,replacement:saleDraftSchema.omit({organizationId:true,storeId:true,registerId:true,shiftId:true,cashierId:true,operationId:true}),
 serialSelections:completeSchema.shape.serialSelections,creditAmount:amountSchema.default(0),creditDueAt:z.iso.datetime({offset:true}).optional()}).strict()
export const exchangeSchema=exchangePreviewSchema.extend({operationId:z.string().uuid(),confirmationHash:z.string().regex(/^[a-f0-9]{64}$/),cashTendered:amountSchema.default(0)}).strict()
type Input=z.infer<typeof exchangePreviewSchema>
function manager(ctx:TokenPayload){if(!['owner','admin'].includes(ctx.role))throw new AccessError(403,'MANAGER_REQUIRED')}
async function quote(tx:Prisma.TransactionClient,ctx:TokenPayload,input:Input){
 const original=await tx.sale.findFirst({where:{id:input.originalSaleId,AND:tenantScope('Sale',ctx)}});if(!original)throw new AccessError(404,'NOT_FOUND')
 const shift=await requireOpenShift(tx,ctx,input.shiftId);if(shift.register.storeId!==original.storeId)throw new AccessError(409,'INVALID_SHIFT')
 const refund=await returnSaleTx(tx,ctx,original.id,{operationId:original.id,shiftId:input.shiftId,reason:input.reason,items:input.items},true)
 if(refund.settlement.card.gt(0)||refund.settlement.transfer.gt(0))throw new AccessError(409,'EXTERNAL_REFUND_REQUIRED','Almashtirish faqat ichki naqd/nasiya uchun; tashqi qaytarishni taxmin qilmaymiz')
 const draft={...input.replacement,organizationId:ctx.organizationId,storeId:original.storeId,registerId:shift.registerId,shiftId:shift.id}
 const prepared=await prepareItems(tx,ctx,draft.items,draft.discountAmount,draft),credit=decimal(input.creditAmount),cash=prepared.totals.totalAmount.sub(credit)
 if(cash.lt(0))throw new AccessError(400,'EXCHANGE_CREDIT_EXCEEDED')
 if((credit.gt(0)||refund.settlement.debt.gt(0))&&(!original.customerId||draft.customerId!==original.customerId))throw new AccessError(409,'EXCHANGE_CUSTOMER_REQUIRED','Nasiya farqi original mijozning o‘z kartasida bo‘lishi kerak')
 const returnedSerials=input.items.filter(item=>item.disposition==='sellable').flatMap(item=>item.serialIds??[])
 for(const row of prepared.rows)await validateSerialSale(tx,ctx,row.productId,original.storeId,row.quantity,input.serialSelections?.find(s=>s.productId===row.productId)?.ids,returnedSerials)
 const proof={originalSaleId:original.id,shiftId:shift.id,refundAmount:refund.refundAmount,settlement:refund.settlement,replacementTotal:prepared.totals.totalAmount,replacementCash:cash,replacementCredit:credit,
 cashDifference:cash.sub(refund.settlement.cash),debtDifference:credit.sub(refund.settlement.debt),items:prepared.rows.map(({id,...row})=>{void id;return row}),taxFingerprint:prepared.taxFingerprint}
 const reviewProof={...proof,items:proof.items.map(row=>{const snapshot=row.priceSnapshot as Record<string,unknown>;const {asOf,...priceSnapshot}=snapshot;void asOf;return {...row,priceSnapshot}})}
 return {draft,proof,confirmationHash:payloadHash({organizationId:ctx.organizationId,input,proof:reviewProof})}
}
export async function previewExchange(ctx:TokenPayload,input:Input){manager(ctx);return prisma.$transaction(async tx=>{await assertLiveContext(tx,ctx);const q=await quote(tx,ctx,input);return {...q.proof,confirmationHash:q.confirmationHash}},{isolationLevel:'RepeatableRead'})}
export async function postExchange(ctx:TokenPayload,input:z.infer<typeof exchangeSchema>){manager(ctx);return runOperation(ctx,'sale.exchange',input.operationId,input,async tx=>{
 const {operationId,confirmationHash,cashTendered,...previewInput}=input,q=await quote(tx,ctx,previewInput)
 if(confirmationHash!==q.confirmationHash)throw new AccessError(409,'EXCHANGE_CHANGED','Almashtirish hisobi o‘zgardi; original amal holatini saqlab qayta ko‘ring')
 const tender=decimal(cashTendered),difference=q.proof.cashDifference,change=difference.gt(0)?tender.sub(difference):decimal(0)
 if(difference.gt(0)&&change.lt(0)||difference.lte(0)&&tender.gt(0))throw new AccessError(400,'EXCHANGE_TENDER_INVALID')
 const returned=await returnSaleTx(tx,ctx,input.originalSaleId,{operationId,shiftId:input.shiftId,reason:input.reason,items:input.items})
 const draft=await createDraftTx(tx,ctx,{...q.draft,expectedTotalAmount:q.proof.replacementTotal.toFixed(2),expectedTaxFingerprint:q.proof.taxFingerprint})
 const payments:Parameters<typeof completeSaleTx>[3]['payments']=[]
 if(q.proof.replacementCash.gt(0))payments.push({paymentType:'cash',amount:q.proof.replacementCash.toFixed(2)})
 if(q.proof.replacementCredit.gt(0))payments.push({paymentType:'credit',amount:q.proof.replacementCredit.toFixed(2)})
 // Gross cash journals offset one another. The exchange records the actual
 // physical tender/change; no invented full-sale cash tender is recorded.
 const sale=await completeSaleTx(tx,ctx,draft.id,{payments,creditDueAt:input.creditDueAt,serialSelections:input.serialSelections},operationId)
 const exchange=await tx.saleExchange.create({data:{organizationId:ctx.organizationId,storeId:q.draft.storeId,originalSaleId:input.originalSaleId,saleReturnId:returned.id,replacementSaleId:sale.id,actorId:ctx.userId,
 cashDifference:difference,debtDifference:q.proof.debtDifference,cashTendered:tender,cashChange:change,reason:input.reason,settlementSnapshot:JSON.parse(JSON.stringify(q.proof))}})
 await audit(tx,ctx,'SaleExchange',exchange.id,'sale_exchanged',{...q.proof,returnId:returned.id,replacementSaleId:sale.id,cashTendered:tender,cashChange:change,reason:input.reason})
 return {...exchange,refundDue:difference.lt(0)?difference.negated():decimal(0),returnReceiptNo:returned.returnReceiptNo,replacementReceiptNo:sale.receiptNo}
 })}
