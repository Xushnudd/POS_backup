import {fixed} from '@/lib/money';
import {INTL_LOCALES,type Locale} from './locale';
function grouped(value:bigint,locale:Locale){
 return new Intl.NumberFormat(INTL_LOCALES[locale],{numberingSystem:'latn',maximumFractionDigits:0}).format(value).replace(/[\u00a0\u202f]/g,' ');
}
function decimalText(value:bigint,scale:number,locale:Locale){
 const negative=value<BigInt(0),absolute=negative?-value:value,power=BigInt(10)**BigInt(scale);
 const fraction=(absolute%power).toString().padStart(scale,'0').replace(/0+$/,'');
 return (negative?'-':'')+grouped(absolute/power,locale)+(fraction?(locale==='ru'?',':'.')+fraction:'');
}
/** Display only: source money, form values and operation bodies stay canonical.
 * Fractional money always keeps two places, matching the existing Uzbek UI. */
export function formatLocaleMoney(value:number|string|null|undefined,locale:Locale){
 let cents:bigint;try{cents=fixed(value??0)}catch{cents=BigInt(0)}
 const negative=cents<BigInt(0),absolute=negative?-cents:cents,fraction=absolute%BigInt(100);
 return (negative?'-':'')+grouped(absolute/BigInt(100),locale)+(fraction?(locale==='ru'?',':'.')+fraction.toString().padStart(2,'0'):'')+(locale==='ru'?' сум':' so‘m');
}
export function formatLocaleNumber(value:number|string|null|undefined,locale:Locale){
 try{return decimalText(fixed(value??0,3),3,locale)}catch{return '0'}
}
export function formatLocaleDate(value:string|Date|null|undefined,locale:Locale,includeTime=false,timeZone?:string){
 if(!value)return '-';
 try{
  const date=value instanceof Date?value:new Date(value);if(!Number.isFinite(date.getTime()))return '-';
  const parts=new Intl.DateTimeFormat(INTL_LOCALES[locale],{calendar:'gregory',numberingSystem:'latn',...(timeZone?{timeZone}:{}),year:'numeric',month:'2-digit',day:'2-digit',...(includeTime?{hour:'2-digit',minute:'2-digit',hourCycle:'h23'}:{})}).formatToParts(date);
  const part=(type:string)=>parts.find(item=>item.type===type)?.value??'';
  return `${part('day')}.${part('month')}.${part('year')}`+(includeTime?` ${part('hour')}:${part('minute')}`:'');
 }catch{return '-'}
}
