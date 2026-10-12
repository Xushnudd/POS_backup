import {Prisma} from '@prisma/client'
import {AccessError} from '../auth/policy'
// Input order must be an authoritative, committed product valuation sequence.
// Timestamps or UUID ordering are deliberately not accepted as a substitute.
type Receipt={sequence:string;id:string;kind:'receipt';quantity:string;unitCost:string;additionalValue?:string}
type Issue={sequence:string;id:string;kind:'issue';quantity:string}
type Return={sequence:string;id:string;kind:'return';quantity:string;issueId:string}
export type CostReplayEvent=Receipt|Issue|Return
const Exact=Prisma.Decimal.clone({precision:60,rounding:Prisma.Decimal.ROUND_HALF_UP})
function reject():never{throw new AccessError(409,'COST_HISTORY_INVALID','Tannarx tarixidagi tartib, miqdor yoki manba bog‘lanishini tekshiring')}
/** Replay moving average without mutating receipts or sale snapshots. A late
 * receipt charge propagates through later issues, receipts and linked returns.
 * This is a calculation boundary, not a financial posting or legacy backfill.
 */
export function replayMovingAverage(events:readonly CostReplayEvent[]){
 let quantity=new Exact(0),value=new Exact(0),cost=new Exact(0),cogs=new Exact(0),receipts=new Exact(0),rounding=new Exact(0),previous=BigInt(0)
 const seen=new Set<string>(),issues=new Map<string,{quantity:Prisma.Decimal;returned:Prisma.Decimal;unitCost:Prisma.Decimal}>()
 const rows=[]
 for(const event of events){
  if(!/^[1-9]\d*$/.test(event.sequence)||BigInt(event.sequence)<=previous||!event.id||seen.has(event.id))reject()
  previous=BigInt(event.sequence);seen.add(event.id)
  if(!/^(?:0|[1-9]\d*)(?:\.\d{1,6})?$/.test(event.quantity))reject()
  const amount=new Exact(event.quantity);if(amount.lte(0))reject()
  let entryValue=new Exact(0)
  if(event.kind==='receipt'){
   if(!/^(?:0|[1-9]\d*)(?:\.\d{1,6})?$/.test(event.unitCost)||!/^(?:0|[1-9]\d*)(?:\.\d{1,2})?$/.test(event.additionalValue??'0'))reject()
   entryValue=amount.mul(event.unitCost).add(event.additionalValue??'0');receipts=receipts.add(entryValue)
   const nextQuantity=quantity.add(amount),unrounded=value.add(entryValue)
   cost=unrounded.div(nextQuantity).toDecimalPlaces(6)
   const nextValue=nextQuantity.mul(cost)
   rounding=rounding.add(unrounded.sub(nextValue));quantity=nextQuantity;value=nextValue
  }else if(event.kind==='issue'){
   if(amount.gt(quantity))throw new AccessError(409,'COST_HISTORY_NEGATIVE','Manfiy tarix uchun tasdiqlangan alohida valuation siyosati kerak')
   entryValue=amount.mul(cost);quantity=quantity.sub(amount);value=value.sub(entryValue);cogs=cogs.add(entryValue)
   issues.set(event.id,{quantity:new Prisma.Decimal(amount.toFixed()),returned:new Prisma.Decimal(0),unitCost:new Prisma.Decimal(cost.toFixed())})
  }else if(event.kind==='return'){
   const issue=issues.get(event.issueId);if(!issue)reject();if(issue.returned.add(amount.toFixed()).gt(issue.quantity))reject()
   issue.returned=issue.returned.add(amount.toFixed());entryValue=amount.mul(issue.unitCost.toString());cogs=cogs.sub(entryValue)
   // Returned units carry their original replayed issue cost. Re-average the
   // remaining stock, rather than applying a current catalogue price.
   const nextQuantity=quantity.add(amount),unrounded=value.add(entryValue)
   cost=unrounded.div(nextQuantity).toDecimalPlaces(6)
   const nextValue=nextQuantity.mul(cost);rounding=rounding.add(unrounded.sub(nextValue));quantity=nextQuantity;value=nextValue
  }else reject()
  rows.push({id:event.id,sequence:event.sequence,kind:event.kind,entryValue:entryValue.toFixed(),quantity:quantity.toFixed(),inventoryValue:value.toFixed(),averageCost:cost.toFixed(6)})
 }
 // Includes explicit rounding; no monetary value silently disappears.
 if(!value.add(cogs).add(rounding).eq(receipts))reject()
 return {rows,quantity:quantity.toFixed(),inventoryValue:value.toFixed(),averageCost:cost.toFixed(6),cogsValue:cogs.toFixed(),receiptValue:receipts.toFixed(),roundingValue:rounding.toFixed()}
}

/** Differences to be persisted as separate immutable value entries by a caller
 * that has locked and validated the receipt, expense and valuation history. */
export function planReceiptCostCorrection(events:readonly CostReplayEvent[],receiptId:string,additionalValue:string){
 if(!/^(?:0|[1-9]\d{0,11})(?:\.\d{1,2})?$/.test(additionalValue)||new Exact(additionalValue).lte(0))reject()
 const target=events.find(event=>event.id===receiptId)
 if(!target||target.kind!=='receipt')reject()
 const before=replayMovingAverage(events)
 const after=replayMovingAverage(events.map(event=>event.id===receiptId&&event.kind==='receipt'?{...event,additionalValue:new Exact(event.additionalValue??'0').add(additionalValue).toFixed(2)}:event))
 const difference=(left:string,right:string)=>new Exact(right).sub(left).toFixed()
 const cogsEntries=after.rows.flatMap((row,index)=>row.kind==='receipt'?[]:[{eventId:row.id,sequence:row.sequence,kind:row.kind,amount:new Exact(difference(before.rows[index].entryValue,row.entryValue)).mul(row.kind==='return'?-1:1).toFixed()}]).filter(row=>!new Exact(row.amount).eq(0))
 const inventoryCorrection=difference(before.inventoryValue,after.inventoryValue),cogsCorrection=difference(before.cogsValue,after.cogsValue),roundingCorrection=difference(before.roundingValue,after.roundingValue)
 if(!new Exact(inventoryCorrection).add(cogsCorrection).add(roundingCorrection).eq(additionalValue)||!cogsEntries.reduce((sum,row)=>sum.add(row.amount),new Exact(0)).eq(cogsCorrection))reject()
 return {receiptId,additionalValue:new Exact(additionalValue).toFixed(2),quantity:after.quantity,beforeAverageCost:before.averageCost,afterAverageCost:after.averageCost,inventoryCorrection,cogsCorrection,roundingCorrection,cogsEntries}
}
