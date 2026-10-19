import {test} from 'node:test'
import assert from 'node:assert/strict'
import {discountAmount} from '@/server/sales/discounts'
test('Discount percentages conserve cents at zero/full/fractional boundaries and cannot override reviewed amount',()=>{
 assert.equal(discountAmount('0.03','0','50').toString(),'0.02');assert.equal(discountAmount('99.99',0,'0').toString(),'0');assert.equal(discountAmount('99.99',0,'100').toString(),'99.99');assert.equal(discountAmount('112','13.44','12').toString(),'13.44');assert.equal(discountAmount('112','5').toString(),'5');
 for(const rate of ['-1','100.01','1.001'])assert.throws(()=>discountAmount(100,0,rate),{code:'INVALID_DISCOUNT_PERCENT'});assert.throws(()=>discountAmount(100,99,10),{code:'DISCOUNT_AMOUNT_CHANGED'});
});
