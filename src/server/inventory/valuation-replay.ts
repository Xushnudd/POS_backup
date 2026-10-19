import {Prisma} from '@prisma/client'
import {AccessError} from '../auth/policy'

/** Ordered, source-validated facts only. Native adapters must establish order,
 * scope and linked sources before calling this calculation boundary. */
export type ValuationFact = (
 | {sequence:string;id:string;kind:'receipt';storeId:string;quantity:string;unitCost:string;additionalValue?:string}
 | {sequence:string;id:string;kind:'sale';storeId:string;quantity:string}
 | {sequence:string;id:string;kind:'return';storeId:string;quantity:string;issueId:string;recordedUnitCost?:string}
 | {sequence:string;id:string;kind:'adjustment';storeId:string;quantityDelta:string}
 | {sequence:string;id:string;kind:'supplier_return'|'receipt_reversal';storeId:string;quantity:string;unitCost:string}
 | {sequence:string;id:string;kind:'transfer_out';storeId:string;quantity:string;transferItemId:string;recordedUnitCost:string;originalCatalogueCost:string}
 | {sequence:string;id:string;kind:'transfer_in'|'transfer_return'|'transfer_loss';storeId:string;quantity:string;transferItemId:string}
 | {sequence:string;id:string;kind:'revalue';unitCost:string;applicationId?:string}
 ) & {expectedAverageCost?:string}
const Exact=Prisma.Decimal.clone({precision:60,rounding:Prisma.Decimal.ROUND_HALF_UP})
const fixed=(value:Prisma.Decimal)=>value.toFixed()
const numberPattern=/^(?:0|[1-9]\d{0,13})(?:\.\d{1,6})?$/
export type ValuationDispositions={
 transferLosses?:readonly {id:string;transferItemId:string;quantity:string}[];
 nonStockReturns?:readonly {id:string;issueId:string;storeId:string;quantity:string;recordedUnitCost?:string}[];
}
function invalid(message='Tannarx faktlari to‘liq yoki o‘zaro mos emas'):never{throw new AccessError(409,'VALUATION_FACT_INVALID',message)}
function positive(value:string){if(!numberPattern.test(value))invalid();const parsed=new Exact(value);if(!parsed.gt(0))invalid();return parsed}
function cost(value:string){if(!numberPattern.test(value))invalid();return new Exact(value)}
/** Existing physical-stock moving average is retained. Transit carries its
 * frozen outgoing cost separately. Manual absolute revalues remain absolute;
 * their economic difference is visible rather than silently discarded.
 * This function makes no writes and cannot authorize a financial posting. */
export function replayValuationFacts(facts:readonly ValuationFact[],baselineUnitCost:string,dispositions:ValuationDispositions={}){
 let average=cost(baselineUnitCost),receiptValue=new Exact(0),cogsValue=new Exact(0),roundingValue=new Exact(0)
 const stores=new Map<string,Prisma.Decimal>(),transit=new Map<string,{remaining:Prisma.Decimal;unitCost:Prisma.Decimal;fromStoreId:string}>(),issues=new Map<string,{quantity:Prisma.Decimal;returned:Prisma.Decimal;unitCost:Prisma.Decimal;storeId:string}>(),seen=new Set<string>()
 let previous=BigInt(0)
 const physicalQuantity=()=>[...stores.values()].reduce((sum,value)=>sum.add(value),new Exact(0))
 const move=(storeId:string,delta:Prisma.Decimal)=>{if(!storeId)invalid();const next=(stores.get(storeId)??new Exact(0)).add(delta);if(next.lt(0)||next.gt('99999999999999.999999'))invalid('Fizik qoldiq yoki filial ketma-ketligi chegaradan tashqarida');stores.set(storeId,next)}
 const reaverage=(nextQuantity:Prisma.Decimal,unroundedValue:Prisma.Decimal)=>{if(unroundedValue.lt('-0.000001'))invalid('Qolgan qoldiq qiymati manfiy');if(nextQuantity.gt(0)){const available=Exact.max(unroundedValue,0);average=available.div(nextQuantity).toDecimalPlaces(6);roundingValue=roundingValue.add(unroundedValue.sub(nextQuantity.mul(average)))}}
 const rows:{id:string;sequence:string;kind:ValuationFact['kind'];averageCost:string;physicalQuantity:string;entryValue:string}[]=[]
 for(const fact of facts){
  if(!/^[1-9]\d{0,18}$/.test(fact.sequence)||BigInt(fact.sequence)>BigInt('9223372036854775807')||BigInt(fact.sequence)<=previous||!fact.id||seen.has(fact.id))invalid()
  previous=BigInt(fact.sequence);seen.add(fact.id);let entryValue=new Exact(0)
  if(fact.kind==='revalue'){average=cost(fact.unitCost)}
  else if(fact.kind==='receipt'){
   const qty=positive(fact.quantity),unitCost=cost(fact.unitCost),charge=fact.additionalValue??'0'
   if(!/^(?:0|[1-9]\d{0,11})(?:\.\d{1,2})?$/.test(charge))invalid()
   entryValue=qty.mul(unitCost).add(charge);receiptValue=receiptValue.add(entryValue)
   const oldQuantity=physicalQuantity();reaverage(oldQuantity.add(qty),oldQuantity.mul(average).add(entryValue));move(fact.storeId,qty)
  }else if(fact.kind==='sale'){
   const qty=positive(fact.quantity);entryValue=qty.mul(average);move(fact.storeId,qty.negated());cogsValue=cogsValue.add(entryValue)
   issues.set(fact.id,{quantity:qty,returned:new Exact(0),unitCost:average,storeId:fact.storeId})
  }else if(fact.kind==='return'){
   const qty=positive(fact.quantity),issue=issues.get(fact.issueId);if(!issue||issue.storeId!==fact.storeId||issue.returned.add(qty).gt(issue.quantity))invalid()
   issue.returned=issue.returned.add(qty);entryValue=qty.mul(fact.recordedUnitCost===undefined?issue.unitCost:cost(fact.recordedUnitCost));cogsValue=cogsValue.sub(entryValue)
   const oldQuantity=physicalQuantity();reaverage(oldQuantity.add(qty),oldQuantity.mul(average).add(entryValue));move(fact.storeId,qty)
  }else if(fact.kind==='adjustment'){
   if(!/^-?(?:0|[1-9]\d{0,13})(?:\.\d{1,6})?$/.test(fact.quantityDelta))invalid()
   const qty=new Exact(fact.quantityDelta);if(qty.eq(0))invalid();entryValue=qty.mul(average);move(fact.storeId,qty)
  }else if(fact.kind==='supplier_return'||fact.kind==='receipt_reversal'){
   const qty=positive(fact.quantity);entryValue=qty.mul(cost(fact.unitCost));const oldQuantity=physicalQuantity()
   if(oldQuantity.lt(qty))invalid();reaverage(oldQuantity.sub(qty),oldQuantity.mul(average).sub(entryValue));move(fact.storeId,qty.negated());receiptValue=receiptValue.sub(entryValue)
  }else if(fact.kind==='transfer_out'){
   if(!fact.transferItemId||transit.has(fact.transferItemId))invalid()
   const qty=positive(fact.quantity)
   // Preserve the real draft-to-send cost variance, while propagating the
   // difference produced by a retroactive receipt charge into transit.
   const corrected=cost(fact.recordedUnitCost).add(average.sub(cost(fact.originalCatalogueCost)))
   if(corrected.lt(0)||corrected.gt('99999999999999.999999'))invalid('Transfer tannarxi chegaradan tashqarida')
   move(fact.storeId,qty.negated());transit.set(fact.transferItemId,{remaining:qty,unitCost:corrected,fromStoreId:fact.storeId});entryValue=qty.mul(corrected)
  }else if(fact.kind==='transfer_in'||fact.kind==='transfer_return'||fact.kind==='transfer_loss'){
   const qty=positive(fact.quantity),original=transit.get(fact.transferItemId)
   if(!original||original.remaining.lt(qty)||(fact.kind==='transfer_return'&&original.fromStoreId!==fact.storeId))invalid()
   original.remaining=original.remaining.sub(qty);entryValue=qty.mul(original.unitCost)
   if(fact.kind!=='transfer_loss')move(fact.storeId,qty)
  }else invalid()
  if(average.gt('99999999999999.999999'))invalid('Tannarx NUMERIC(20,6) chegarasidan oshdi')
  if(fact.expectedAverageCost!==undefined&&!average.eq(cost(fact.expectedAverageCost)))invalid('Hisoblangan tannarx original native snapshotga mos emas')
  rows.push({id:fact.id,sequence:fact.sequence,kind:fact.kind,averageCost:average.toFixed(6),physicalQuantity:fixed(physicalQuantity()),entryValue:fixed(entryValue)})
 }
 // These immutable dispositions have no physical stock movement and do not
 // change moving average. Validate their terminal totals against original
 // sources separately; never fabricate timestamps or native sequences.
 const dispositionIds=new Set<string>(),dispositionRows:{id:string;kind:'transfer_loss'|'nonstock_return';entryValue:string}[]=[]
 for(const loss of dispositions.transferLosses??[]){
  if(!loss.id||dispositionIds.has(loss.id)||seen.has(loss.id))invalid();dispositionIds.add(loss.id)
  const qty=positive(loss.quantity),original=transit.get(loss.transferItemId)
  if(!original||original.remaining.lt(qty))invalid();original.remaining=original.remaining.sub(qty)
  dispositionRows.push({id:loss.id,kind:'transfer_loss',entryValue:fixed(qty.mul(original.unitCost))})
 }
 for(const returned of dispositions.nonStockReturns??[]){
  if(!returned.id||dispositionIds.has(returned.id)||seen.has(returned.id))invalid();dispositionIds.add(returned.id)
  const qty=positive(returned.quantity),issue=issues.get(returned.issueId)
  if(!issue||issue.storeId!==returned.storeId||issue.returned.add(qty).gt(issue.quantity))invalid()
  issue.returned=issue.returned.add(qty);const value=qty.mul(returned.recordedUnitCost===undefined?issue.unitCost:cost(returned.recordedUnitCost));cogsValue=cogsValue.sub(value)
  dispositionRows.push({id:returned.id,kind:'nonstock_return',entryValue:fixed(value)})
 }
 const physicalValue=physicalQuantity().mul(average),transitValue=[...transit.values()].reduce((sum,row)=>sum.add(row.remaining.mul(row.unitCost)),new Exact(0)),inventoryValue=physicalValue.add(transitValue)
 const varianceValue=receiptValue.sub(inventoryValue).sub(cogsValue).sub(roundingValue)
 return {averageCost:average.toFixed(6),physicalQuantity:fixed(physicalQuantity()),physicalValue:fixed(physicalValue),transitValue:fixed(transitValue),inventoryValue:fixed(inventoryValue),receiptValue:fixed(receiptValue),cogsValue:fixed(cogsValue),roundingValue:fixed(roundingValue),varianceValue:fixed(varianceValue),rows,dispositionRows,stores:[...stores].sort(([a],[b])=>a.localeCompare(b)).map(([storeId,quantity])=>({storeId,quantity:fixed(quantity),value:fixed(quantity.mul(average))})),transit:[...transit].map(([transferItemId,row])=>({transferItemId,remainingQuantity:fixed(row.remaining),unitCost:row.unitCost.toFixed(6),value:fixed(row.remaining.mul(row.unitCost))}))}
}

export function planValuationFactCorrection(facts:readonly ValuationFact[],baselineUnitCost:string,receiptId:string,amount:string,dispositions:ValuationDispositions={}){
 if(! /^-?(?:0|[1-9]\d{0,11})(?:\.\d{1,2})?$/.test(amount)||new Exact(amount).eq(0))invalid()
 const target=facts.find(fact=>fact.id===receiptId);if(!target||target.kind!=='receipt')invalid()
 if(new Exact(target.additionalValue??'0').add(amount).lt(0))invalid()
 const before=replayValuationFacts(facts,baselineUnitCost,dispositions)
 const changed=facts.map(fact=>{const corrected={...fact};delete corrected.expectedAverageCost;if(corrected.kind==='return')delete corrected.recordedUnitCost;return corrected.id===receiptId&&corrected.kind==='receipt'?{...corrected,additionalValue:new Exact(corrected.additionalValue??'0').add(amount).toFixed(2)}:corrected})
 const after=replayValuationFacts(changed,baselineUnitCost,{...dispositions,nonStockReturns:dispositions.nonStockReturns?.map(row=>{const clean={...row};delete clean.recordedUnitCost;return clean})})
 const delta=(field:'inventoryValue'|'cogsValue'|'roundingValue'|'varianceValue')=>new Exact(after[field]).sub(before[field])
 if(!delta('inventoryValue').add(delta('cogsValue')).add(delta('roundingValue')).add(delta('varianceValue')).eq(amount))invalid()
 return {before,after,inventoryCorrection:fixed(delta('inventoryValue')),cogsCorrection:fixed(delta('cogsValue')),roundingCorrection:fixed(delta('roundingValue')),varianceCorrection:fixed(delta('varianceValue'))}
}
