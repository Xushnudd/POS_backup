import uz from '@/dictionary/ui.uz.json';
import ru from '@/dictionary/ui.ru.json';
import {type Locale} from './locale';
export type MessageKey=keyof typeof uz;
export type MessageValues=Record<string,string|number|bigint|null|undefined>;
const dictionaries:Record<Locale,Record<MessageKey,string>>={uz,ru};
export function translate(key:MessageKey,locale:Locale,values:MessageValues={}):string{
 const template=Object.hasOwn(dictionaries[locale],key)?dictionaries[locale][key]:undefined;
 if(typeof template!=='string')throw Error('UNKNOWN_TRANSLATION_KEY');
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
  return Object.fromEntries(Object.entries(item).map(([key,value])=>[key,fields.has(key)&&typeof value==='string'?translateKnownLabel(value,locale):key==='steps'&&Array.isArray(value)?value.map(step=>typeof step==='string'?translateKnownLabel(step,locale):step):value]));
 };
 if(Array.isArray(source))return source.map(record) as T;
 if(source&&typeof source==='object')return Object.fromEntries(Object.entries(source).map(([key,value])=>[key,typeof value==='string'?translateKnownLabel(value,locale):record(value)])) as T;
 return source;
}

// Error/status boundaries only. Source-owned fragments may be joined with a
// diagnostic request ID. Never call this for entity names, notes or documents.
const fragments=Object.keys(uz).filter(key=>!/[{][A-Za-z]/.test(key)).sort((a,b)=>b.length-a.length) as MessageKey[];
export function localizeOwnedMessage(text:string,locale:Locale):string{
 if(!text)return text;
 if(Object.hasOwn(uz,text))return translate(text as MessageKey,locale);
 let remaining=text.startsWith('Error: ')?text.slice(7):text,result='';
 for(let part=0;remaining&&part<8;part++){
  const key=fragments.find(candidate=>remaining===candidate||remaining.startsWith(candidate+' '));
  if(!key){result+=remaining;remaining='';break;}
  result+=translate(key,locale);remaining=remaining.slice(key.length);
  const gap=/^\s+/.exec(remaining)?.[0]??'';result+=gap;remaining=remaining.slice(gap.length);
 }
 return result+remaining;
}

const codeLabels:Record<string,MessageKey>={
 fiscal:'Fiskal xizmat',sms:'SMS',printer_agent:'Printer agenti',payment:'To‘lov xizmati',hosting:'Xosting',backup:'Zaxira nusxa',other:'Boshqa',bank:'Bank',provider:'Provayder',draft:'Qoralama',completed:'Yakunlangan',partially_returned:'Qisman qaytarilgan',returned:'Qaytarilgan',cancelled:'Bekor qilingan',confirmed:'Tasdiqlangan',pending:'Javob kutilmoqda',recorded:'Qayd etilgan',open:'Ochiq',closed:'Yopilgan',closing:'Tasdiq kutilmoqda',sent:'Jo‘natilgan',received:'Qabul qilingan',partially_received:'Qisman qabul qilingan',prepared:'Tayyor, qo‘llanmagan',applied:'Tannarxga qo‘llangan',reversed:'Qarshi hujjat yozilgan',paid:'To‘langan',unpaid:'To‘lanmagan',expired:'Muddati tugagan',void:'Bekor qilingan',active:'Faol',revoked:'Bekor qilingan',cash:'Naqd pul',card:'Karta',transfer:"Pul o'tkazmasi",credit:'Nasiya / Qarz',owner:"Do'kon egasi",admin:'Administrator',cashier:'Kassir',in:'Kirim',out:'Chiqim',normal:'Oddiy',important:'Muhim',critical:'Kritik',unused:'Ishlatilmagan',synced:'Server tasdiqlagan',conflict:'Qo‘lda tekshirish kerak',rejected:'Rad etilgan',queued:'Navbatda',running:'Bajarilmoqda',succeeded:'Yakunlangan',dead:'Ko‘rib chiqish kerak',failed:'Xatolik',pending_approval:'Tasdiq kutilmoqda',in_progress:'Ishlanmoqda',waiting_customer:'Mijoz javobi kutilmoqda',resolved:'Yechilgan',legacy_unmanaged:'Tarifga ko‘chirish kutilmoqda',trial:'Sinov davri',grace:'Imtiyozli muddat',consumed:'Ishlatilgan',released:'Bo‘shatilgan',reserved:'Rezervlangan',in_transit:'Yo‘lda',available:'Mavjud',damaged:'Brak',written_off:'Hisobdan chiqarilgan',sold:'Sotilgan',closing_pending:'Tasdiq kutilmoqda',closing_rejected:'Rad etilgan'
};
/** Explicit enum fields in display only. Never use this for stored state,
 * option values, URLs, data attributes, names, notes or request payloads. */
export function localizeCodeLabel(value:string|null|undefined,locale:Locale){
 if(!value)return '—';const key=Object.hasOwn(codeLabels,value)?codeLabels[value]:undefined;return key?translate(key,locale):value;
}

export function isOwnedMessage(text:string):boolean{
 return Object.hasOwn(uz,text)||fragments.some(key=>text.startsWith(key+' '));
}

/** Safe display fallback for native browser errors, including the static cash
 * screen. Original error objects remain available to the caller unchanged. */
export function ownedErrorMessage(error:unknown,fallback:string):string{
 return error instanceof Error&&isOwnedMessage(error.message)?error.message:fallback;
}
