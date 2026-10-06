import { Prisma } from '@prisma/client'
import { csvText } from '../customers/export'
export const EXPORT_CAP=10000
export function numeric(value:Prisma.Decimal|number|string,scale=2){return {csvNumber:new Prisma.Decimal(value).toFixed(scale)}}
export function csv(rows:unknown[][]){
 return '\uFEFF'+rows.map(row=>row.map(value=>{
  if(value&&typeof value==='object'&&'csvNumber' in value&&/^-?\d+(\.\d+)?$/.test(String(value.csvNumber)))return '"'+value.csvNumber+'"'
  return csvText(value)
 }).join(',')).join('\r\n')+'\r\n'
}

// NUMERIC(20,6) × NUMERIC(20,6) can exceed Decimal's default 20 digits.
// Keep precision local to export valuation, without changing global arithmetic.
const ExactDecimal=Prisma.Decimal.clone({precision:50,rounding:Prisma.Decimal.ROUND_HALF_UP})
export function productValue(left:Prisma.Decimal,right:Prisma.Decimal){return new ExactDecimal(left.toString()).mul(right.toString()).toFixed(2)}
export function shortage(quantity:Prisma.Decimal,minimum:Prisma.Decimal){return ExactDecimal.max(new ExactDecimal(minimum.toString()).sub(quantity.toString()),0).toFixed(6)}
