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
