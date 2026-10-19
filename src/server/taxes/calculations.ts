import type {Prisma} from '@prisma/client'
import {allocateMoney,decimal,money,taxAmounts, type DecimalInput} from '../sales/calculations'
export const ROUNDING_VERSION='money-half-up-2-v1'
export type TaxMode='unconfigured'|'included'|'excluded'|'exempt'
export type TaxLine={id:string;quantity:DecimalInput;unitPrice:DecimalInput;discountAmount:DecimalInput;lineTotal:DecimalInput;taxMode:TaxMode;taxRate:DecimalInput}
export function priceTaxLines<T extends TaxLine>(rows:T[],receiptDiscount:DecimalInput){
 const allocation=allocateMoney(receiptDiscount,rows.map(row=>({id:row.id,weight:row.lineTotal})))
 return rows.map(row=>{const net=money(row.lineTotal).sub(allocation[row.id]);const calculated=taxAmounts(net,row.taxMode==='included'||row.taxMode==='excluded'?row.taxRate:0,row.taxMode==='included');return {...row,receiptDiscount:allocation[row.id],taxBase:calculated.base,taxAmount:calculated.tax,payableAmount:calculated.total,roundingVersion:ROUNDING_VERSION};})
}
// Cumulative cents allocation makes every partial/final return exact. Allocating
// tax independently by quantity can produce tax greater than a zero-cent refund.
export function cumulativeRefundComponent(original:DecimalInput,total:DecimalInput,alreadyReturned:DecimalInput,alreadyComponent:DecimalInput,current:DecimalInput):Prisma.Decimal{
 const component=money(original),gross=decimal(total),prior=decimal(alreadyReturned),previous=money(alreadyComponent),next=decimal(current);
 if(component.lt(0)||gross.lt(0)||component.gt(gross)||prior.lt(0)||next.lt(0)||prior.add(next).gt(gross)||previous.lt(0)||previous.gt(component))throw new Error('INVALID_REFUND_COMPONENT');
 const target=gross.eq(0)?decimal(0):prior.add(next).eq(gross)?component:money(component.mul(prior.add(next)).div(gross));
 const result=target.sub(previous);if(result.lt(0)||result.gt(next))throw new Error('INVALID_REFUND_COMPONENT');return result;
}
