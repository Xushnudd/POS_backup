import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {createRequire} from 'node:module';
import {createElement} from 'react';
import {renderToStaticMarkup} from 'react-dom/server';
import LandingContent from '@/components/landing/LandingContent';
import {LocaleProvider} from '@/context/LocaleContext';
import {PUBLIC_COPY} from '@/release/public-copy';
import {translate} from '@/i18n/messages';
import type {PublicPlan} from '@/server/billing/public-pricing';
const requireSource=createRequire(process.cwd()+'/package.json');
const {check,COPY,REGISTRY}=requireSource('./scripts/release/check-claims.cjs') as {check:(root:string,overrides?:Record<string,string>)=>{copyEntries:number;capabilities:number;problems:{code:string}[]};COPY:string;REGISTRY:string};
const read=(file:string)=>readFileSync(file,'utf8');
const registry=()=>JSON.parse(read(REGISTRY));
const codes=(overrides:Record<string,string>)=>check(process.cwd(),overrides).problems.map(problem=>problem.code);
const landing='src/components/landing/LandingContent.tsx';
test('Every public claim, metadata and bilingual review maps to accepted source-attested capabilities without publishing review internals',()=>{
 const result=check(process.cwd());assert.deepEqual(result.problems,[]);assert.equal(result.copyEntries,Object.keys(PUBLIC_COPY).length);assert.equal(result.capabilities,7);
 assert.doesNotMatch(read(landing),/tasks\/evidence|PUBLIC_CLAIMS|sourceSha256/);
});
test('A new or inline public promise cannot bypass the explicit copy/surface review',()=>{
 assert.ok(codes({[COPY]:read(COPY).replace('PUBLIC_COPY={',"PUBLIC_COPY={\n undeclaredClick:'Saqlash',")}).includes('UNREVIEWED_COPY'));
 const changed=read(landing).replace('tr(PUBLIC_COPY.heroTitle)',"tr('Real Click ishlaydi')");
 const errors=codes({[landing]:changed});assert.ok(errors.includes('PUBLIC_SURFACE_REVIEW_REQUIRED'));assert.ok(errors.includes('UNREGISTERED_TRANSLATION'));
 assert.ok(codes({[landing]:read(landing).replace('PUBLIC_COPY.heroTitle',"PUBLIC_COPY['heroTitle']")}).includes('DYNAMIC_PUBLIC_COPY_FORBIDDEN'));
});
test('A changed Russian promise or forged evidence requires review rather than silently reusing acceptance',()=>{
 const ru=JSON.parse(read('src/dictionary/ui.ru.json'));ru[PUBLIC_COPY.salesDescription]='Real Click: guaranteed';
 assert.ok(codes({'src/dictionary/ui.ru.json':JSON.stringify(ru)}).includes('TEXT_REVIEW_REQUIRED'));
 const review=registry();review.proofs.localization.sha256='0'.repeat(64);
 assert.ok(codes({[REGISTRY]:JSON.stringify(review)}).includes('PROOF_HASH_CHANGED'));
});
test('Deferred originals and modified economic source invalidate a published capability proof',()=>{
 const review=registry();review.groups.checkout.originalIds.push('LOC-03.02');
 assert.ok(codes({[REGISTRY]:JSON.stringify(review)}).includes('UNACCEPTED_ORIGINAL'));
 const file='src/server/sales/service.ts';assert.ok(codes({[file]:read(file)+'\n// changed economic source\n'}).includes('CAPABILITY_SOURCE_CHANGED'));
 const formatter='src/i18n/format.ts';assert.ok(codes({[formatter]:read(formatter)+'\n// changed public display runtime\n'}).includes('PUBLIC_RUNTIME_REVIEW_REQUIRED'));
});
test('Removing an integration boundary or importing obsolete marketing copy fails the public gate',()=>{
 const without=read(landing).replace('tr(PUBLIC_COPY.integrationLimitations)','tr(PUBLIC_COPY.hardwareLimitations)');
 const result=codes({[landing]:without});assert.ok(result.includes('CLAIM_BOUNDARY_MISSING'));assert.ok(result.includes('UNAVAILABLE_BOUNDARY_MISSING'));
 assert.ok(codes({[landing]:read(landing)+"\nimport oldCopy from '@/dictionary/ru.json';\n"}).includes('INACTIVE_MARKETING_DICTIONARY_IMPORTED'));
});
const render=(locale:'uz'|'ru',plans:PublicPlan[]|null)=>renderToStaticMarkup(createElement(LocaleProvider,{initialLocale:locale} as Parameters<typeof LocaleProvider>[0],createElement(LandingContent,{plans})));
const escape=(value:string)=>value.replace(/[&<>"']/g,char=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#x27;'}[char]!));
test('Unavailable or empty pricing renders no invented tariff or trial promise in either language',()=>{
 for(const locale of ['uz','ru'] as const)for(const plans of [null,[]]){
  const html=render(locale,plans),priceSection=html.split('id="prices"')[1].split('</section>')[0];
  assert.ok(!html.includes(escape(translate(PUBLIC_COPY.startTrial,locale))));
  assert.ok(!priceSection.includes(translate(PUBLIC_COPY.pricePeriod,locale)));
  assert.ok(html.includes(escape(translate(PUBLIC_COPY.integrationLimitations,locale))));
  assert.equal(html.includes(escape(translate(PUBLIC_COPY.pricesUnavailable,locale))),plans===null);
 }
});
test('Actual plan fields remain data, exact money and escaped names; no-trial configuration changes the CTA',()=>{
 const plan:PublicPlan={code:'reviewed',name:'Saqlash <script>not-code</script>',monthlyPrice:'123456.75',currency:'UZS',branchLimit:2,registerLimit:4,staffLimit:8,isTrial:true,trialDays:11,graceDays:3};
 const before=JSON.stringify(plan),html=render('ru',[plan]);assert.ok(html.includes('Saqlash &lt;script&gt;not-code&lt;/script&gt;'));assert.ok(!html.includes('<script>'));assert.ok(!html.includes('Сохранить'));assert.ok(html.includes('123 456,75 сум'));assert.ok(html.includes('11'));assert.ok(html.includes('3'));assert.equal(JSON.stringify(plan),before);
 const noTrial=render('ru',[{...plan,isTrial:false}]);assert.ok(!noTrial.includes(escape(translate(PUBLIC_COPY.startTrial,'ru'))));assert.ok(noTrial.includes(escape(translate(PUBLIC_COPY.register,'ru'))));
});
