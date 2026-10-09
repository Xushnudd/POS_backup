import {test} from 'node:test'
import assert from 'node:assert/strict'
import {fixed,clientLine} from '@/lib/money'
import {clientBaseQuantity,clientQuantitySum} from '@/lib/unit-conversion'
test('Client conversion stays exact and rejects discarded fractions before checkout',()=>{assert.equal(clientBaseQuantity('1','12',0),'12');assert.equal(clientBaseQuantity('0.5','12',0),'6');assert.equal(clientBaseQuantity('3','0.001',6),'0.003');assert.equal(clientQuantitySum('0.1','0.2'),'0.3');assert.throws(()=>clientBaseQuantity('0.1','0.01',2));assert.throws(()=>clientBaseQuantity('1','0'))});

test('Small numeric display quantities retain six decimal digits instead of scientific notation errors',()=>{assert.equal(fixed(0.000001,6),BigInt(1));assert.equal(clientLine(0.000001,1000000),1);assert.throws(()=>fixed('1e-6',6))});
