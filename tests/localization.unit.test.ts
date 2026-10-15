import test from 'node:test';
import assert from 'node:assert/strict';
import uz from '@/dictionary/ui.uz.json';
import ru from '@/dictionary/ui.ru.json';
import {translate,translateKnownLabel} from '@/i18n/messages';
import {localeFromCookie,normalizeLocale} from '@/i18n/locale';
import {formatLocaleDate,formatLocaleMoney,formatLocaleNumber} from '@/i18n/format';
test('Locale cookie is an explicit harmless preference, never a dictionary path or authorization',()=>{
 assert.equal(localeFromCookie('other=ru; pos_locale=ru'),'ru');assert.equal(localeFromCookie('pos_locale=../../.env'),'uz');assert.equal(normalizeLocale('ru-RU'),'uz');assert.equal(localeFromCookie('pos_locale=uz'),'uz');
});
test('Both owned dictionaries have complete nonempty typed keys and identical named interpolation slots',()=>{
 assert.deepEqual(Object.keys(ru).sort(),Object.keys(uz).sort());
 for(const key of Object.keys(uz) as (keyof typeof uz)[]){assert.ok(ru[key].trim());assert.deepEqual([...ru[key].matchAll(/\{([A-Za-z][A-Za-z0-9_]*)\}/g)].map(match=>match[1]).sort(),[...uz[key].matchAll(/\{([A-Za-z][A-Za-z0-9_]*)\}/g)].map(match=>match[1]).sort());}
 assert.throws(()=>translate('constructor' as keyof typeof uz,'ru'),/UNKNOWN_TRANSLATION_KEY/);assert.equal(translate('Saqlash','ru'),'Сохранить');assert.equal(translate('Jami: {amount}','ru',{amount:'12,50 сум'}),'Итого: 12,50 сум');assert.throws(()=>translate('Jami: {amount}','ru'),/MISSING_TRANSLATION_PARAMETER/);assert.equal(translateKnownLabel('Original unowned customer name','ru'),'Original unowned customer name');
});
test('Intl display keeps exact cents beyond Number safe integer and leaves canonical source and form strings unchanged',()=>{
 const source='9007199254740993.01',body={amount:'12.50',quantity:'0.125',barcode:'0012345678901',operationId:'original-key'},before=JSON.stringify(body);
 assert.equal(formatLocaleMoney(source,'uz'),'9 007 199 254 740 993.01 so‘m');assert.equal(formatLocaleMoney(source,'ru'),'9 007 199 254 740 993,01 сум');assert.equal(formatLocaleMoney('249000','uz'),'249 000 so‘m');assert.equal(formatLocaleMoney('249000','ru'),'249 000 сум');assert.equal(formatLocaleMoney('-0.01','ru'),'-0,01 сум');assert.equal(formatLocaleMoney('1.50','ru'),'1,50 сум');assert.equal(formatLocaleNumber('100000000000.125','ru'),'100 000 000 000,125');assert.equal(formatLocaleNumber('-0.0005','ru'),'-0,001');assert.equal(JSON.stringify(body),before);
});
test('Language does not change instant, Gregorian date, branch timezone or filter boundary semantics',()=>{
 const instant='2026-10-14T20:30:00.000Z';
 assert.equal(formatLocaleDate(instant,'uz',true,'Asia/Tashkent'),'15.10.2026 01:30');assert.equal(formatLocaleDate(instant,'ru',true,'Asia/Tashkent'),'15.10.2026 01:30');assert.equal(formatLocaleDate(instant,'ru',true,'UTC'),'14.10.2026 20:30');assert.equal(formatLocaleDate('invalid','ru'),'-');assert.equal(instant,'2026-10-14T20:30:00.000Z');
});

test('Registered label maps translate display fields and preserve routes, raw choices, icons and typed keys',async()=>{
 const {localizeOwnedLabels}=await import('@/i18n/messages');
 const icon={name:'Saqlash'},input=[{label:'Saqlash',href:'/products',value:'Saqlash',roles:['owner'],icon}];
 const result=localizeOwnedLabels(input,'ru');assert.equal(result[0].label,'Сохранить');assert.equal(result[0].value,'Saqlash');assert.equal(result[0].href,'/products');assert.equal(result[0].icon,icon);assert.equal(input[0].label,'Saqlash');
});
test('Known error guidance translates with its unchanged diagnostic ID and original API error metadata',async()=>{
 const {ApiError}=await import('@/lib/api'),{errorMessage}=await import('@/i18n/errors'),{localizeOwnedMessage}=await import('@/i18n/messages');
 const failure=new ApiError('Original server diagnostic');failure.code='INSUFFICIENT_STOCK';failure.status=409;failure.requestId='request-001';failure.details={available:'0.125'};
 const canonical=errorMessage(failure);const display=localizeOwnedMessage(canonical,'ru');assert.match(display,/Недостаточно остатка/);assert.match(display,/Запрос: request-001/);assert.doesNotMatch(display,/Yetarli|So‘rov/);assert.equal(failure.message,'Original server diagnostic');assert.equal(failure.code,'INSUFFICIENT_STOCK');assert.equal(failure.status,409);assert.deepEqual(failure.details,{available:'0.125'});
 const balanceError=new ApiError('Original balance diagnostic');balanceError.code='CUSTOMER_HAS_BALANCE';assert.match(localizeOwnedMessage(errorMessage(balanceError),'ru'),/У клиента есть остаток долга или аванса/);assert.equal(balanceError.message,'Original balance diagnostic');
 assert.equal(localizeOwnedMessage('Saqlanmagan mijoz o‘zgarishlari bor.','ru'),'Есть несохранённые изменения клиента.');assert.equal(errorMessage(new Error('Mijoz topilmadi')),'Mijoz topilmadi');assert.equal(errorMessage(new Error('Native permission denied'),'Kameraga ulanib bo‘lmadi. Ruxsat berilganini va HTTPS ishlatilayotganini tekshiring.'),'Kameraga ulanib bo‘lmadi. Ruxsat berilganini va HTTPS ishlatilayotganini tekshiring.');
});

test('Russian return receipt escapes original business data, preserves exact amounts and timezone without changing the source',async()=>{
 const {returnReceiptHtml}=await import('@/i18n/return-receipt');
 const source={id:'return-001',returnReceiptNo:'RET-001',returnedAt:'2026-10-14T20:30:00.000Z',status:'completed',refundAmount:'12.50',reason:'<img src=x onerror=alert(1)>',approvedBy:'owner',approvedRole:'owner',approvedAt:'2026-10-14T20:30:00.000Z',processor:{fullName:'Saqlash'},items:[{id:'line-001',saleItemId:'original-line',quantity:'0.125',lineTotal:'12.50',disposition:'sellable',saleItem:{productName:'Saqlash',sku:'001234',unit:'kg'}}]};
 const before=JSON.stringify(source),html=returnReceiptHtml(source,'sale-001','Asia/Tashkent','ru');
 assert.match(html,/lang="ru"/);assert.match(html,/ЧЕК ВОЗВРАТА/);assert.match(html,/12,50 сум/);assert.match(html,/15\.10\.2026 01:30/);assert.match(html,/Saqlash/);assert.match(html,/0\.125 kg/);assert.match(html,/&lt;img/);assert.doesNotMatch(html,/<img|Сохранить|QAYTARMA/);assert.equal(JSON.stringify(source),before);
});

test('Reviewed catalogue rewrite is repeatable and keeps matching user data, protocol values and existing typed calls intact',async()=>{
 const {mkdtempSync,writeFileSync,readFileSync,rmSync}=await import('node:fs'),{tmpdir}=await import('node:os'),{join}=await import('node:path'),{spawnSync}=await import('node:child_process');
 const directory=mkdtempSync(join(tmpdir(),'pos-locale-catalog-')),file=join(directory,'Fixture.tsx');
 try{
  writeFileSync(file,`'use client';\nimport {useTranslation} from '@/context/LocaleContext';\nexport default function Fixture({name}:{name:string}){const {t:tr,message:uiMessage}=useTranslation();const body={note:'Saqlash',amount:'12.50',barcode:'0012345678901'};const label=tr('Til');return <div><p>Saqlash</p><p>{name}</p><input aria-label="Til" value="Saqlash"/><span>{label}</span><p>{uiMessage('Mijoz topilmadi')}</p></div>}`);
  const run=()=>spawnSync(process.execPath,['scripts/i18n/catalog.cjs','apply',file],{encoding:'utf8'});
  const first=run();assert.equal(first.status,0,first.stderr);const reviewed=readFileSync(file,'utf8');assert.match(reviewed,/\{tr\("Saqlash"\)\}/);assert.match(reviewed,/value="Saqlash"/);assert.match(reviewed,/note:'Saqlash',amount:'12.50',barcode:'0012345678901'/);assert.match(reviewed,/\{name\}/);assert.doesNotMatch(reviewed,/tr\(tr\(/);assert.equal((reviewed.match(/t:tr/g)??[]).length,1);
  const second=run();assert.equal(second.status,0,second.stderr);assert.equal(readFileSync(file,'utf8'),reviewed);
 }finally{rmSync(directory,{recursive:true,force:true})}
});
