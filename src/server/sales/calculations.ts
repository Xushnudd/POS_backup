import { Prisma } from '@prisma/client'

const Exact=Prisma.Decimal.clone({precision:50,rounding:Prisma.Decimal.ROUND_HALF_UP})
export type DecimalInput = Prisma.Decimal | number | string
export function decimal(value: DecimalInput): Prisma.Decimal {
  const result = new Exact(value)
  if (!result.isFinite()) throw new Error('INVALID_DECIMAL')
  return result
}
export function money(value: DecimalInput): Prisma.Decimal {
  return decimal(value).toDecimalPlaces(2, Prisma.Decimal.ROUND_HALF_UP)
}
export function debtClosingBalance(opening:DecimalInput,increases:DecimalInput,settlements:DecimalInput){
 const debits=money(increases),credits=money(settlements);
 if(debits.lt(0)||credits.lt(0))throw new Error('INVALID_DEBT_AMOUNT');
 return money(opening).add(debits).sub(credits);
}
export function lineTotal(quantity: DecimalInput, price: DecimalInput, discount: DecimalInput = 0) {
  const qty = decimal(quantity), unitPrice = decimal(price), off = money(discount)
  if (qty.lte(0) || unitPrice.lt(0) || off.lt(0)) throw new Error('INVALID_AMOUNT')
  const gross = money(qty.mul(unitPrice))
  if (off.gt(gross)) throw new Error('INVALID_DISCOUNT')
  return gross.sub(off)
}
export function draftTotals(items: { quantity: DecimalInput; unitPrice: DecimalInput; discountAmount: DecimalInput }[], discount: DecimalInput) {
  const subtotal = items.reduce((sum, item) => sum.add(lineTotal(item.quantity, item.unitPrice, item.discountAmount)), decimal(0))
  if (subtotal.gte('1000000000000')) throw new Error('INVALID_AMOUNT')
  const off = money(discount)
  if (off.lt(0) || off.gt(subtotal)) throw new Error('INVALID_DISCOUNT')
  return { subtotal, discountAmount: off, totalAmount: subtotal.sub(off) }
}

// Largest remainder in integer cents; allocations always sum exactly to total.
export function allocateMoney(total: DecimalInput, lines: { id: string; weight: DecimalInput }[]) {
  const cents=money(total).mul(100)
  const weights=lines.map(x=>decimal(x.weight)), sum=weights.reduce((a,b)=>a.add(b),decimal(0))
  if (cents.lt(0) || weights.some(x=>x.lt(0)) || (cents.gt(0) && sum.lte(0))) throw new Error('INVALID_ALLOCATION')
  const rows=lines.map((line,i)=>{
    const exact=sum.gt(0)?cents.mul(weights[i]).div(sum):decimal(0)
    const floor=exact.floor()
    return {id:line.id,cents:floor,remainder:exact.sub(floor)}
  })
  let remaining=cents.sub(rows.reduce((sum,x)=>sum.add(x.cents),decimal(0))).toNumber()
  const ranked=[...rows].sort((a,b)=>b.remainder.comparedTo(a.remainder)||a.id.localeCompare(b.id))
  for (const row of ranked) if (remaining-->0) row.cents=row.cents.add(1)
  return Object.fromEntries(rows.map(row=>[row.id,row.cents.div(100)])) as Record<string,Prisma.Decimal>
}

// Pure tax arithmetic; a business must configure its tax policy separately.
export function taxAmounts(amount:DecimalInput,rate:DecimalInput,included:boolean){
 const value=money(amount),percent=decimal(rate);
 if(value.lt(0)||percent.lt(0)||percent.gt(100))throw new Error('INVALID_TAX');
 const base=included?money(value.div(decimal(1).add(percent.div(100)))):value;
 const tax=included?value.sub(base):money(base.mul(percent).div(100));
 return {base,tax,total:included?value:base.add(tax)};
}
export function partialReturnAmount(net:DecimalInput,sold:DecimalInput,returned:DecimalInput,alreadyRefunded:DecimalInput,requested:DecimalInput){
 const amount=money(net),quantity=decimal(sold),previous=decimal(returned),refunded=money(alreadyRefunded),request=decimal(requested),remaining=quantity.sub(previous);
 if(quantity.lte(0)||previous.lt(0)||previous.gt(quantity)||request.lte(0)||request.gt(remaining)||refunded.lt(0)||refunded.gt(amount)||amount.lt(0))throw new Error('INVALID_RETURN');
 const refund=request.eq(remaining)?amount.sub(refunded):money(amount.mul(request).div(quantity));
 if(refund.add(refunded).gt(amount))throw new Error('INVALID_RETURN');
 return refund;
}
