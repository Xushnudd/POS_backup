import uz from '@/dictionary/ui.uz.json';
import ru from '@/dictionary/ui.ru.json';
import {type Locale} from './locale';
export type MessageKey=keyof typeof uz;
export type MessageValues=Record<string,string|number|bigint|null|undefined>;
const dictionaries:Record<Locale,Record<MessageKey,string>>={uz,ru};
export function translate(key:MessageKey,locale:Locale,values:MessageValues={}):string{
 const template=dictionaries[locale][key];
 return template.replace(/\{([a-zA-Z][a-zA-Z0-9_]*)\}/g,(_match,name:string)=>{
  if(!Object.hasOwn(values,name))throw Error('MISSING_TRANSLATION_PARAMETER');
  return values[name]===null||values[name]===undefined?'':String(values[name]);
 });
}
/** Explicit approved UI-label maps only. Never apply this to product/customer
 * names, notes, original documents or arbitrary API/DOM text. */
export function translateKnownLabel(value:string,locale:Locale):string{
 return Object.hasOwn(uz,value)?translate(value as MessageKey,locale):value;
}
/** Localizes explicitly registered, source-owned label tables. Never pass API,
 * entity or document data here. Routing keys, option values and icons stay exact. */
export function localizeOwnedLabels<T>(source:T,locale:Locale):T{
 const fields=new Set(['label','title','help']);
 const record=(item:unknown):unknown=>{
  if(!item||typeof item!=='object'||Array.isArray(item))return item;
  return Object.fromEntries(Object.entries(item).map(([key,value])=>[key,fields.has(key)&&typeof value==='string'?translateKnownLabel(value,locale):value]));
 };
 if(Array.isArray(source))return source.map(record) as T;
 if(source&&typeof source==='object')return Object.fromEntries(Object.entries(source).map(([key,value])=>[key,typeof value==='string'?translateKnownLabel(value,locale):record(value)])) as T;
 return source;
}
