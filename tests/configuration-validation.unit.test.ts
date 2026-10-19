import {test} from 'node:test'
import assert from 'node:assert/strict'
import {conversionSchema} from '../src/server/catalog/conversions'
import {taxVersionSchema} from '../src/server/taxes/service'
import {priceRuleSchema} from '../src/server/catalog/price-rules'
import {signedQuantitySchema,nonnegativeQuantitySchema} from '../src/server/catalog/service'
import {relocationSchema} from '../src/server/inventory/reservations'
const operationId='aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa'
test('invalid unit ratios return validation issues before Decimal parsing and retain exact limits',()=>{
 const input={operationId,tradeUnit:'quti',ratio:'12',isActive:true,reason:'Verified original boxes'}
 for(const ratio of ['invalid','','NaN','Infinity','1e2','0','-1','100000000','0.0000001'])assert.equal(conversionSchema.safeParse({...input,ratio}).success,false,ratio)
 assert.equal(conversionSchema.parse({...input,ratio:'99999999.999999'}).ratio,'99999999.999999')
 assert.equal(conversionSchema.parse({...input,ratio:'0.000001'}).ratio,'0.000001')
})
test('malformed tax rate is a validation error in every mode, including exemption, without arithmetic exceptions',()=>{
 const input={operationId,mode:'excluded',rate:'12.34',effectiveAt:'2026-10-12T00:00:00.000Z',exemptionReason:'Verified exemption'}
 for(const mode of ['included','excluded','exempt'])for(const rate of ['invalid','','NaN','Infinity','1e2','-1','100.01','1.001'])assert.equal(taxVersionSchema.safeParse({...input,mode,rate}).success,false,mode+':'+rate)
 assert.equal(taxVersionSchema.safeParse({...input,mode:'exempt',rate:'0'}).success,true)
 assert.equal(taxVersionSchema.safeParse({...input,rate:'100'}).success,true)
})

test('malformed price and stock inputs fail closed without arithmetic exceptions or coercion',()=>{
 const price={operationId,productId:operationId,kind:'retail',minimumQuantity:'1',unitPrice:'1.00',startsAt:'2026-10-12T00:00:00.000Z',reason:'Reviewed rule'}
 const relocation={operationId,storeId:operationId,productId:operationId,fromLocationId:null,toLocationId:operationId,quantity:'1',reason:'Actual movement'}
 for(const value of ['invalid','','NaN','Infinity','1e2','0.0000001']){
  assert.equal(priceRuleSchema.safeParse({...price,minimumQuantity:value}).success,false)
  assert.equal(priceRuleSchema.safeParse({...price,unitPrice:value}).success,false)
  assert.equal(relocationSchema.safeParse({...relocation,quantity:value}).success,false)
  assert.equal(signedQuantitySchema.safeParse(value).success,false)
  assert.equal(nonnegativeQuantitySchema.safeParse(value).success,false)
 }
 for(const value of [NaN,Infinity,-Infinity]){
  assert.equal(signedQuantitySchema.safeParse(value).success,false)
  assert.equal(nonnegativeQuantitySchema.safeParse(value).success,false)
 }
 assert.equal(signedQuantitySchema.parse('-0.000001'),'-0.000001')
 assert.equal(nonnegativeQuantitySchema.parse('0'),'0')
 assert.equal(priceRuleSchema.parse({...price,minimumQuantity:'0.000001'}).minimumQuantity,'0.000001')
 assert.equal(relocationSchema.parse({...relocation,quantity:'0.000001'}).quantity,'0.000001')
})
