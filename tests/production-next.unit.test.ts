import {test} from 'node:test'
import assert from 'node:assert/strict'
import {allocateMoney,draftTotals,lineTotal,partialReturnAmount,taxAmounts} from '@/server/sales/calculations'
import {errorGuidance} from '@/lib/error-guidance'
import {logRecord,requestTrace,safeAudit} from '@/server/observability/context'
test('Exact decimal strings: zero, fractional quantities, discounts and half-up ties',()=>{
 assert.equal(lineTotal('0.333333','0.03').toString(),'0.01')
 assert.equal(draftTotals([{quantity:'1',unitPrice:'999999999999.99',discountAmount:'0.01'}],'0.01').totalAmount.toString(),'999999999999.97')
 assert.equal(lineTotal('1','0','0').toString(),'0')
 assert.throws(()=>draftTotals([{quantity:'1',unitPrice:'0',discountAmount:'0'}],'0.01'))
 assert.throws(()=>lineTotal('NaN','1'));assert.throws(()=>lineTotal('1','1','-0.01'))
})
test('Tax pure arithmetic supports included/excluded, zero and rounding without imposing a legal rate',()=>{
 const included=taxAmounts('112','12',true);assert.equal(included.base.toString(),'100');assert.equal(included.tax.toString(),'12');assert.equal(included.total.toString(),'112')
 const excluded=taxAmounts('100','12',false);assert.equal(excluded.base.toString(),'100');assert.equal(excluded.tax.toString(),'12');assert.equal(excluded.total.toString(),'112')
 assert.equal(taxAmounts('0','0',true).total.toString(),'0')
 assert.equal(taxAmounts('0.05','10',false).tax.toString(),'0.01')
 const rounded=taxAmounts('0.05','12',true);assert.equal(rounded.base.add(rounded.tax).toString(),'0.05')
 assert.throws(()=>taxAmounts('10','-1',true));assert.throws(()=>taxAmounts('10','101',false))
})
test('Partial returns preserve the last cent and reject over-return or past over-refund',()=>{
 assert.equal(partialReturnAmount('0.10','3','0','0','1').toString(),'0.03')
 assert.equal(partialReturnAmount('0.10','3','1','0.03','1').toString(),'0.03')
 assert.equal(partialReturnAmount('0.10','3','2','0.06','1').toString(),'0.04')
 assert.equal(partialReturnAmount('0','2','0','0','2').toString(),'0')
 assert.throws(()=>partialReturnAmount('1','2','1','0.50','2'))
 assert.throws(()=>partialReturnAmount('1','2','0','1.01','1'))
})
test('Allocation deterministic tie order and large totals conserve every cent',()=>{
 const result=allocateMoney('999999999999.99',[{id:'b',weight:'1'},{id:'a',weight:'1'},{id:'c',weight:'1'}])
 assert.equal(result.a.add(result.b).add(result.c).toString(),'999999999999.99')
 assert.equal(Object.values(allocateMoney('0',[{id:'zero',weight:'0'}]))[0].toString(),'0')
 assert.throws(()=>allocateMoney('0.01',[{id:'zero',weight:'0'}]))
})
test('Errors offer safe next actions for validation, network, permission, conflict and unknown',()=>{
 for(const code of ['VALIDATION_ERROR','NETWORK_ERROR','FORBIDDEN','PRICE_CHANGED','INSUFFICIENT_STOCK','INTERNAL_ERROR']){const value=errorGuidance(code);assert.ok(value.message.length>10);assert.ok(value.nextAction.length>10);assert.doesNotMatch(value.message,/stack|passwordHash/)}
 assert.match(errorGuidance('NETWORK_ERROR').nextAction,/Yangi kalit/)
})
test('Structured log allowlist drops secrets, PII, paths, nested errors and maintains async correlations',async()=>{
 const secret='test-only-secret-canary'
 const rows=await Promise.all(['tenant-a','tenant-b'].map(organizationId=>requestTrace.run({requestId:organizationId+'-request',organizationId},async()=>{await new Promise(r=>setTimeout(r,1));return logRecord({event:'test',code:'FORBIDDEN',password:secret,email:secret,headers:{authorization:secret},url:secret,error:secret})})))
 for(const [i,row] of rows.entries()){assert.equal(row.organizationId,i?'tenant-b':'tenant-a');assert.equal(row.requestId,row.organizationId+'-request');assert.doesNotMatch(JSON.stringify(row),new RegExp(secret));assert.deepEqual(Object.keys(row).sort(),['code','event','organizationId','requestId'])}
 assert.deepEqual(safeAudit({amount:'1.01',passwordHash:secret,customer:{phone:secret,email:secret,id:'c'},items:[{secret,quantity:'2'}]}),{amount:'1.01',customer:{id:'c'},items:[{quantity:'2'}]})
})
