import {test} from 'node:test'
import assert from 'node:assert/strict'
import {replayMovingAverage,planReceiptCostCorrection,type CostReplayEvent} from '../src/server/inventory/cost-replay'
test('late receipt cost propagates through later weighted receipts and linked returns without changing input',()=>{
 const events:CostReplayEvent[]=[{id:'a',sequence:'1',kind:'receipt',quantity:'10',unitCost:'10'},{id:'s1',sequence:'2',kind:'issue',quantity:'4'},{id:'b',sequence:'3',kind:'receipt',quantity:'6',unitCost:'20'},{id:'s2',sequence:'4',kind:'issue',quantity:'6'},{id:'r',sequence:'5',kind:'return',quantity:'1',issueId:'s1'}]
 const before=JSON.stringify(events),baseline=replayMovingAverage(events),corrected=replayMovingAverage(events.map(event=>event.id==='a'?{...event,additionalValue:'20'} as CostReplayEvent:event))
 assert.equal(JSON.stringify(events),before)
 assert.equal(baseline.cogsValue,'120');assert.equal(corrected.cogsValue,'132')
 assert.equal(corrected.quantity,'7');assert.equal(corrected.inventoryValue,'107.999997');assert.equal(corrected.roundingValue,'0.000003')
 assert.equal(corrected.rows[3].entryValue,'96');assert.equal(corrected.rows[4].entryValue,'12')
})
test('fractional moving average tracks rounding and exact charge residuals',()=>{
 const result=replayMovingAverage([{sequence:'1',id:'r',kind:'receipt',quantity:'3',unitCost:'0',additionalValue:'0.01'},{sequence:'2',id:'s',kind:'issue',quantity:'1'}])
 assert.equal(result.averageCost,'0.003333');assert.equal(result.inventoryValue,'0.006666');assert.equal(result.cogsValue,'0.003333');assert.equal(result.roundingValue,'0.000001')
})
test('replay refuses guessed order, duplicate identity, negative history and unrelated or excess returns',()=>{
 const receipt:CostReplayEvent={sequence:'1',id:'r',kind:'receipt',quantity:'1',unitCost:'2'}
 for(const history of [[{...receipt,sequence:'0'}],[receipt,receipt],[receipt,{sequence:'2',id:'s',kind:'issue',quantity:'2'}],[receipt,{sequence:'2',id:'t',kind:'return',quantity:'1',issueId:'absent'}],[receipt,{sequence:'2',id:'s',kind:'issue',quantity:'1'},{sequence:'3',id:'t',kind:'return',quantity:'2',issueId:'s'}]] as CostReplayEvent[][])assert.throws(()=>replayMovingAverage(history))
})
test('correction plan separates remaining stock, two sales, original linked return and rounding journals',()=>{
 const events:CostReplayEvent[]=[{id:'a',sequence:'1',kind:'receipt',quantity:'10',unitCost:'10'},{id:'s1',sequence:'2',kind:'issue',quantity:'4'},{id:'b',sequence:'3',kind:'receipt',quantity:'6',unitCost:'20'},{id:'s2',sequence:'4',kind:'issue',quantity:'6'},{id:'r',sequence:'5',kind:'return',quantity:'1',issueId:'s1'}]
 const plan=planReceiptCostCorrection(events,'a','20')
 assert.equal(plan.inventoryCorrection,'7.999999');assert.equal(plan.cogsCorrection,'12');assert.equal(plan.roundingCorrection,'0.000001')
 assert.deepEqual(plan.cogsEntries.map(row=>[row.eventId,row.amount]),[['s1','8'],['s2','6'],['r','-2']])
 assert.equal(events[0].kind==='receipt'&&events[0].additionalValue,undefined)
})
test('fully sold receipt correction goes to COGS and missing or nonreceipt source is refused',()=>{
 const events:CostReplayEvent[]=[{sequence:'1',id:'r',kind:'receipt',quantity:'2',unitCost:'1'},{sequence:'2',id:'s',kind:'issue',quantity:'2'}]
 const plan=planReceiptCostCorrection(events,'r','0.10');assert.equal(plan.inventoryCorrection,'0');assert.equal(plan.cogsCorrection,'0.1');assert.equal(plan.roundingCorrection,'0')
 for(const [id,value] of [['absent','1'],['s','1'],['r','0'],['r','1.001']])assert.throws(()=>planReceiptCostCorrection(events,id,value))
})
