import {test} from 'node:test'
import assert from 'node:assert/strict'
import {convertQuantity,snapshotQuantity} from '@/server/catalog/conversion-math'
test('Box/base and fractional conversion use exact decimal arithmetic without rounding stock',()=>{
 assert.equal(convertQuantity('1','12',0).toString(),'12');assert.equal(convertQuantity('0.125','8',0).toString(),'1');assert.equal(convertQuantity('3','0.001',6).toString(),'0.003');assert.equal(convertQuantity('-2','12',0).toString(),'-24');
 assert.throws(()=>convertQuantity('0.1','0.01',2),{code:'CONVERSION_PRECISION'});assert.throws(()=>convertQuantity('1','0',6),{code:'INVALID_CONVERSION'});assert.throws(()=>convertQuantity('99999999999999','12',6),{code:'CONVERSION_PRECISION'});
});
test('Return uses immutable original ratio and rejects incompatible base-unit snapshot',()=>{
 const old={baseUnit:'dona',tradeUnit:'quti',ratio:'12',tradeQuantity:'2'};assert.equal(snapshotQuantity(old,'0.5','dona').toString(),'6');assert.throws(()=>snapshotQuantity(old,'1','kg'),{code:'CONVERSION_SNAPSHOT_INVALID'});
});
