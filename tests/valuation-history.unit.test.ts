import {test} from 'node:test'
import assert from 'node:assert/strict'
import {assertCompleteValuationOrder} from '../src/server/inventory/valuation-history'
const emptyBoundary={legacyMovementCount:'0',baselineQuantity:'0',baselineUnitCost:'1.25',lastSequence:'2'}
test('Valuation order requires a proven zero-stock boundary and contiguous original captures',()=>{
 assert.doesNotThrow(()=>assertCompleteValuationOrder(emptyBoundary,['1','2']))
 for(const change of [{legacyMovementCount:'1'},{baselineQuantity:'4'},{baselineQuantity:'-1'},{baselineQuantity:null,baselineUnitCost:null}])assert.throws(()=>assertCompleteValuationOrder({...emptyBoundary,...change},['1','2']),{code:'COST_HISTORY_INCOMPLETE'})
 for(const sequences of [['1'],['2','1'],['1','3'],['1','1']])assert.throws(()=>assertCompleteValuationOrder(emptyBoundary,sequences),{code:'COST_HISTORY_ORDER_INVALID'})
})
