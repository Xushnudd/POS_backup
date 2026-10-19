import {test} from 'node:test'
import assert from 'node:assert/strict'
import {cumulativeRefundComponent,priceTaxLines,ROUNDING_VERSION} from '@/server/taxes/calculations'
import {decimal} from '@/server/sales/calculations'
test('Cumulative tax on repeated cent refunds never exceeds a refund and restores the exact original tax',()=>{
 for(let cents=1;cents<=100;cents++)for(let taxCents=0;taxCents<=cents;taxCents++){const gross=decimal(cents).div(100),tax=decimal(taxCents).div(100);let refunded=decimal(0),taxReturned=decimal(0);for(let i=0;i<cents;i++){const next=cumulativeRefundComponent(tax,gross,refunded,taxReturned,'0.01');assert.ok(next.gte(0)&&next.lte('0.01'));refunded=refunded.add('0.01');taxReturned=taxReturned.add(next);}assert.equal(taxReturned.toString(),tax.toString());}
 assert.equal(cumulativeRefundComponent(0,0,0,0,0).toString(),'0');assert.throws(()=>cumulativeRefundComponent('0.02','0.01',0,0,'0.01'));
});
test('Mixed included and excluded lines allocate receipt discount exactly, retain rounding version and do not use binary arithmetic',()=>{
 const lines=priceTaxLines([{id:'A',quantity:'1',unitPrice:'112',discountAmount:'0',lineTotal:'112',taxMode:'included',taxRate:'12'},{id:'B',quantity:'1',unitPrice:'100',discountAmount:'0',lineTotal:'100',taxMode:'excluded',taxRate:'12'}],'12');assert.equal(lines.reduce((s,r)=>s.add(r.receiptDiscount),decimal(0)).toString(),'12');for(const r of lines){assert.equal(r.roundingVersion,ROUNDING_VERSION);assert.ok(r.taxBase.add(r.taxAmount).eq(r.payableAmount));assert.ok(r.taxBase.decimalPlaces()<=2&&r.taxAmount.decimalPlaces()<=2);}const reversed=priceTaxLines([...lines].reverse(),'12');assert.equal(reversed.reduce((s,r)=>s.add(r.payableAmount),decimal(0)).toString(),lines.reduce((s,r)=>s.add(r.payableAmount),decimal(0)).toString());
});
