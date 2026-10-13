import {Prisma} from '@prisma/client'
import type {TokenPayload} from '@/lib/auth'
import {AccessError} from '../auth/policy'
import {assertLiveContext} from '../operations'
/** Completeness is proven from a zero-stock boundary, not from timestamps or
 * the absence of old movement rows alone. Unjournaled legacy stock is unproven. */
export function assertCompleteValuationOrder(state:{legacyMovementCount:string;baselineQuantity:string|null;baselineUnitCost:string|null;lastSequence:string},sequences:readonly string[]){
 const validCounter=(value:string)=>/^(?:0|[1-9]\d{0,18})$/.test(value)
 const validQuantity=(value:string|null)=>value!==null&&/^-?(?:0|[1-9]\d{0,23})(?:\.\d{1,6})?$/.test(value)
 const validCost=(value:string|null)=>value!==null&&/^(?:0|[1-9]\d{0,13})(?:\.\d{1,6})?$/.test(value)
 if(!validCounter(state.legacyMovementCount)||!validCounter(state.lastSequence)||state.legacyMovementCount!=='0'||!validQuantity(state.baselineQuantity)||!validCost(state.baselineUnitCost)||state.baselineQuantity===null||state.baselineUnitCost===null||!new Prisma.Decimal(state.baselineQuantity).eq(0)||!new Prisma.Decimal(state.baselineUnitCost).isFinite()||new Prisma.Decimal(state.baselineUnitCost).lt(0))throw new AccessError(409,'COST_HISTORY_INCOMPLETE','Oldingi qoldiq yoki tarix tartibi isbotlanmagan; tannarx tuzatishi avtomatik posting qilinmaydi')
 if(BigInt(state.lastSequence)!==BigInt(sequences.length)||sequences.some((value,index)=>value!==String(index+1)))throw new AccessError(409,'COST_HISTORY_ORDER_INVALID','Tannarx ketma-ketligi to‘liq emas; original jurnalni solishtiring')
}
/** Internal owner-only reader. Caller chooses one consistent transaction and
 * must separately validate source types, receipts and financial posting rules. */
export async function readProductValuationHistory(tx:Prisma.TransactionClient,context:TokenPayload,productId:string){
 if(context.role!=='owner')throw new AccessError(403,'OWNER_REQUIRED','Barcha filiallarga ta’sir qiladigan tannarx tuzatishini egasi ko‘rib chiqadi')
 await assertLiveContext(tx,context)
 const product=await tx.product.findFirst({where:{id:productId,organizationId:context.organizationId},select:{id:true,costPrice:true}})
 if(!product)throw new AccessError(404,'NOT_FOUND')
 const state=await tx.inventoryValuationSequence.findFirst({where:{productId,organizationId:context.organizationId}})
 if(!state)throw new AccessError(409,'COST_HISTORY_INCOMPLETE','Mahsulotning tannarx tartibi hali yozilmagan')
 const count=await tx.inventoryValuationEvent.count({where:{productId,organizationId:context.organizationId}})
 if(count>100000)throw new AccessError(413,'COST_HISTORY_TOO_LARGE','Tarixni alohida background reconciliation jarayonida ko‘rib chiqing')
 const events=await tx.inventoryValuationEvent.findMany({where:{productId,organizationId:context.organizationId},orderBy:{sequence:'asc'}})
 const boundary={legacyMovementCount:state.legacyMovementCount.toString(),baselineQuantity:state.baselineQuantity?.toFixed()??null,baselineUnitCost:state.baselineUnitCost?.toFixed()??null,lastSequence:state.lastSequence.toString()}
 assertCompleteValuationOrder(boundary,events.map(event=>event.sequence.toString()))
 return {productId,averageCost:product.costPrice.toFixed(6),boundary,events:events.map(event=>({...event,sequence:event.sequence.toString(),transactionId:event.transactionId.toString(),quantityDelta:event.quantityDelta?.toFixed()??null,unitCost:event.unitCost?.toFixed(6)??null,beforeUnitCost:event.beforeUnitCost?.toFixed(6)??null,afterUnitCost:event.afterUnitCost?.toFixed(6)??null}))}
}
