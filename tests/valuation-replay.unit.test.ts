import {test} from 'node:test'
import assert from 'node:assert/strict'
import {Prisma} from '@prisma/client'
import {planValuationFactCorrection,replayValuationFacts,type ValuationFact} from '@/server/inventory/valuation-replay'
const receipt:ValuationFact={sequence:'1',id:'receipt',kind:'receipt',storeId:'A',quantity:'10',unitCost:'2'}
const correction=(facts:ValuationFact[])=>planValuationFactCorrection(facts,'2','receipt','10.00')
function conserved(value:ReturnType<typeof correction>){assert.equal(new Prisma.Decimal(value.inventoryCorrection).add(value.cogsCorrection).add(value.roundingCorrection).add(value.varianceCorrection).toFixed(),'10')}
test('late receipt charge propagates through branch transit and subsequent receipt without rewriting facts',()=>{
 const facts:ValuationFact[]=[receipt,{sequence:'2',id:'out',kind:'transfer_out',storeId:'A',quantity:'4',transferItemId:'transfer',recordedUnitCost:'2',originalCatalogueCost:'2'},{sequence:'3',id:'second',kind:'receipt',storeId:'B',quantity:'6',unitCost:'4'},{sequence:'4',id:'sale',kind:'sale',storeId:'B',quantity:'3'},{sequence:'5',id:'in',kind:'transfer_in',storeId:'B',quantity:'2',transferItemId:'transfer'}]
 const original=JSON.stringify(facts),result=correction(facts);conserved(result)
 assert.equal(result.inventoryCorrection,'7.5');assert.equal(result.cogsCorrection,'1.5');assert.equal(result.varianceCorrection,'1');assert.equal(result.after.transitValue,'6');assert.equal(result.after.averageCost,'3.500000');assert.equal(JSON.stringify(facts),original)
})
test('absolute manual cost override retains its original value and exposes displaced charge as variance',()=>{
 const result=correction([receipt,{sequence:'2',id:'sale',kind:'sale',storeId:'A',quantity:'2'},{sequence:'3',id:'override',kind:'revalue',unitCost:'1'}]);conserved(result)
 assert.equal(result.after.averageCost,'1.000000');assert.equal(result.inventoryCorrection,'0');assert.equal(result.cogsCorrection,'2');assert.equal(result.varianceCorrection,'8')
})
test('linked customer return restores corrected issue cost and cannot return twice or to a fabricated branch',()=>{
 const facts:ValuationFact[]=[receipt,{sequence:'2',id:'sale',kind:'sale',storeId:'A',quantity:'4'},{sequence:'3',id:'return',kind:'return',storeId:'A',quantity:'1',issueId:'sale'}]
 const result=correction(facts);conserved(result);assert.equal(result.inventoryCorrection,'7');assert.equal(result.cogsCorrection,'3')
 assert.throws(()=>replayValuationFacts([...facts,{sequence:'4',id:'excess',kind:'return',storeId:'A',quantity:'4',issueId:'sale'}],'2'),{code:'VALUATION_FACT_INVALID'})
 assert.throws(()=>replayValuationFacts([receipt,{sequence:'2',id:'sale',kind:'sale',storeId:'A',quantity:'4'},{sequence:'3',id:'return',kind:'return',storeId:'B',quantity:'1',issueId:'sale'}],'2'),{code:'VALUATION_FACT_INVALID'})
})
test('supplier return and receipt reversal leave no imaginary stock; fully removed charge remains separate variance',()=>{
 for(const kind of ['supplier_return','receipt_reversal'] as const){const result=correction([receipt,{sequence:'2',id:'withdraw',kind,storeId:'A',quantity:'10',unitCost:'2'}]);conserved(result);assert.equal(result.inventoryCorrection,'0');assert.equal(result.cogsCorrection,'0');assert.equal(result.varianceCorrection,'10');assert.equal(result.after.physicalQuantity,'0')}
})
test('transit damage conserves owned stock and cannot exceed or restore an unrelated original transfer',()=>{
 const facts:ValuationFact[]=[receipt,{sequence:'2',id:'out',kind:'transfer_out',storeId:'A',quantity:'4',transferItemId:'transfer',recordedUnitCost:'2',originalCatalogueCost:'2'},{sequence:'3',id:'loss',kind:'transfer_loss',storeId:'B',quantity:'4',transferItemId:'transfer'}]
 const result=correction(facts);conserved(result);assert.equal(result.inventoryCorrection,'6');assert.equal(result.varianceCorrection,'4')
 assert.throws(()=>replayValuationFacts([...facts,{sequence:'4',id:'extra',kind:'transfer_in',storeId:'B',quantity:'1',transferItemId:'transfer'}],'2'),{code:'VALUATION_FACT_INVALID'})
 assert.throws(()=>replayValuationFacts([receipt,{sequence:'2',id:'out',kind:'transfer_out',storeId:'A',quantity:'4',transferItemId:'transfer',recordedUnitCost:'2',originalCatalogueCost:'2'},{sequence:'3',id:'wrong',kind:'transfer_return',storeId:'B',quantity:'1',transferItemId:'transfer'}],'2'),{code:'VALUATION_FACT_INVALID'})
})
test('physical adjustments expose valuation variance and reject deeper/branch-specific negative stock',()=>{
 const result=correction([receipt,{sequence:'2',id:'shrink',kind:'adjustment',storeId:'A',quantityDelta:'-3'}]);conserved(result);assert.equal(result.inventoryCorrection,'7');assert.equal(result.varianceCorrection,'3')
 assert.throws(()=>replayValuationFacts([receipt,{sequence:'2',id:'other',kind:'sale',storeId:'B',quantity:'1'}],'2'),{code:'VALUATION_FACT_INVALID'})
 assert.throws(()=>replayValuationFacts([receipt,{sequence:'2',id:'negative',kind:'adjustment',storeId:'A',quantityDelta:'-11'}],'2'),{code:'VALUATION_FACT_INVALID'})
})
test('sequence/source/precision limits and repeated charges are exact and fail closed',()=>{
 assert.throws(()=>replayValuationFacts([receipt,{...receipt,sequence:'2'}],'2'),{code:'VALUATION_FACT_INVALID'})
 assert.throws(()=>replayValuationFacts([{...receipt,quantity:'1.0000001'}],'2'),{code:'VALUATION_FACT_INVALID'})
 assert.throws(()=>replayValuationFacts([{...receipt,sequence:'9223372036854775808'}],'2'),{code:'VALUATION_FACT_INVALID'})
 assert.throws(()=>planValuationFactCorrection([receipt],'2','missing','10'),{code:'VALUATION_FACT_INVALID'})
 const result=planValuationFactCorrection([{...receipt,additionalValue:'5.00'}],'2','receipt','10.00');conserved(result);assert.equal(result.before.inventoryValue,'25');assert.equal(result.after.inventoryValue,'35')
})

test('terminal loss/unsellable return totals use original sources without fabricated inventory order',()=>{
 const facts:ValuationFact[]=[receipt,{sequence:'2',id:'sale',kind:'sale',storeId:'A',quantity:'4'},{sequence:'3',id:'out',kind:'transfer_out',storeId:'A',quantity:'2',transferItemId:'T',recordedUnitCost:'2',originalCatalogueCost:'2'}]
 const dispositions={transferLosses:[{id:'actual-loss',transferItemId:'T',quantity:'1'}],nonStockReturns:[{id:'actual-damage-return',issueId:'sale',storeId:'A',quantity:'2'}]}
 const result=planValuationFactCorrection(facts,'2','receipt','10',dispositions);conserved(result)
 assert.equal(result.inventoryCorrection,'5');assert.equal(result.cogsCorrection,'2');assert.equal(result.varianceCorrection,'3');assert.equal(result.after.physicalQuantity,'4')
 assert.throws(()=>replayValuationFacts(facts,'2',{nonStockReturns:[{id:'fake',issueId:'sale',storeId:'A',quantity:'5'}]}),{code:'VALUATION_FACT_INVALID'})
 assert.throws(()=>replayValuationFacts(facts,'2',{transferLosses:[{id:'fake',transferItemId:'T',quantity:'3'}]}),{code:'VALUATION_FACT_INVALID'})
})

test('original native average expectations are checked before correction and removed only for its recalculation',()=>{
 const facts:ValuationFact[]=[{...receipt,expectedAverageCost:'2.000000'},{sequence:'2',id:'sale',kind:'sale',storeId:'A',quantity:'2',expectedAverageCost:'2.000000'}]
 const result=correction(facts);conserved(result);assert.equal(result.after.averageCost,'3.000000')
 assert.throws(()=>correction([{...receipt,expectedAverageCost:'2.500000'}]),{code:'VALUATION_FACT_INVALID'})
})

test('zero-stock inverse cannot hide a negative remaining value or exceed native branch decimal capacity',()=>{
 assert.throws(()=>replayValuationFacts([receipt,{sequence:'2',id:'inverse',kind:'receipt_reversal',storeId:'A',quantity:'10',unitCost:'3'}],'2'),{code:'VALUATION_FACT_INVALID'})
 assert.throws(()=>replayValuationFacts([{...receipt,quantity:'99999999999999.999999'},{sequence:'2',id:'overflow',kind:'adjustment',storeId:'A',quantityDelta:'0.000001'}],'2'),{code:'VALUATION_FACT_INVALID'})
})
