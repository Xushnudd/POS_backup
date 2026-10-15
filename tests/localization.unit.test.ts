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
 assert.equal(translate('Saqlash','ru'),'Сохранить');assert.equal(translate('Jami: {amount}','ru',{amount:'12,50 сум'}),'Итого: 12,50 сум');assert.throws(()=>translate('Jami: {amount}','ru'),/MISSING_TRANSLATION_PARAMETER/);assert.equal(translateKnownLabel('Original unowned customer name','ru'),'Original unowned customer name');
});
test('Intl display keeps exact cents beyond Number safe integer and leaves canonical source and form strings unchanged',()=>{
 const source='9007199254740993.01',body={amount:'12.50',quantity:'0.125',barcode:'0012345678901',operationId:'original-key'},before=JSON.stringify(body);
 assert.equal(formatLocaleMoney(source,'uz'),'9 007 199 254 740 993.01 so‘m');assert.equal(formatLocaleMoney(source,'ru'),'9 007 199 254 740 993,01 сум');assert.equal(formatLocaleMoney('-0.01','ru'),'-0,01 сум');assert.equal(formatLocaleMoney('1.50','ru'),'1,50 сум');assert.equal(formatLocaleNumber('100000000000.125','ru'),'100 000 000 000,125');assert.equal(formatLocaleNumber('-0.0005','ru'),'-0,001');assert.equal(JSON.stringify(body),before);
});
test('Language does not change instant, Gregorian date, branch timezone or filter boundary semantics',()=>{
 const instant='2026-10-14T20:30:00.000Z';
 assert.equal(formatLocaleDate(instant,'uz',true,'Asia/Tashkent'),'15.10.2026 01:30');assert.equal(formatLocaleDate(instant,'ru',true,'Asia/Tashkent'),'15.10.2026 01:30');assert.equal(formatLocaleDate(instant,'ru',true,'UTC'),'14.10.2026 20:30');assert.equal(formatLocaleDate('invalid','ru'),'-');assert.equal(instant,'2026-10-14T20:30:00.000Z');
});
