import {test} from 'node:test'
import assert from 'node:assert/strict'
import {posFailure} from '@/lib/pos-failure'
test('Sale, integration boundary and print errors retain different recovery instructions',()=>{
 const sale=posFailure({code:'PRICE_CHANGED',message:'Narx o‘zgardi'})
 assert.equal(sale.stage,'sale');assert.match(sale.nextAction,/qayta tasdiqlang/)
 const integration=posFailure({code:'INTEGRATION_UNAVAILABLE',message:'Sozlanmagan'})
 assert.equal(integration.stage,'integration');assert.match(integration.nextAction,/yangi kalit bilan takrorlamang/)
 const print=posFailure(new Error('Print blocked'),'print')
 assert.equal(print.stage,'print');assert.equal(print.code,'PRINT_FAILED');assert.match(print.nextAction,/Savdo saqlangan/);assert.match(print.nextAction,/yangi savdo yaratmang/)
 const unknown=posFailure(new Error('Transport interrupted'))
 assert.equal(unknown.code,'RESULT_UNKNOWN');assert.equal(unknown.stage,'sale')
})
