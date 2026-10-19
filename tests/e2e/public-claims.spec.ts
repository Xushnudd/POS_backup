import {test,expect} from '@playwright/test';
import {PrismaClient} from '@prisma/client';
import {PUBLIC_COPY} from '../../src/release/public-copy';
import {translate} from '../../src/i18n/messages';
import {formatLocaleMoney} from '../../src/i18n/format';

const connection=new URL(process.env.DATABASE_URL??'');
if(connection.hostname!=='127.0.0.1'||connection.port!=='55439'||connection.pathname!=='/pos_test')throw Error('Public claims require the isolated DB');
const db=new PrismaClient();
test.afterAll(async()=>{await db.$disconnect()});

// These are metadata/accessibility-only values or the separate unavailable
// branch, rather than body text on a page with configured active plans.
const nonBodyKeys=new Set<keyof typeof PUBLIC_COPY>([
 'navigationLabel','pricesUnavailable','landingTitle','landingDescription',
 'rootTitle','rootDescription','manifestDescription',
]);
const plans=()=>db.billingPlan.findMany({where:{isActive:true},include:{currentVersion:true},orderBy:{code:'asc'}});

for(const locale of ['uz','ru'] as const){
 test(`Public claims in ${locale} match reviewed wording, current DB prices/trial/limits and localized metadata`,async({page,context},testInfo)=>{
  const tr=(key:(typeof PUBLIC_COPY)[keyof typeof PUBLIC_COPY])=>translate(key,locale);
  const current=await plans();
  expect(current.length,'The isolated database must have configured plans').toBeGreaterThan(0);
  // Read shared configuration only: no edits, cache invalidation or shortened
  // TTL. Invoice policy and pricing-cache expiry are covered independently.
  const before=JSON.stringify(current);
  await context.addCookies([{name:'pos_locale',value:locale,url:'https://localhost:3100',secure:true,sameSite:'Lax'}]);
  await page.goto('/');
  await expect(page.locator('html')).toHaveAttribute('lang',locale);
  await expect(page.getByRole('heading',{name:tr(PUBLIC_COPY.heroTitle),exact:true})).toBeVisible();
  await expect(page.getByRole('navigation',{name:tr(PUBLIC_COPY.navigationLabel),exact:true})).toBeVisible();
  for(const [key,copy] of Object.entries(PUBLIC_COPY)){
   if(!nonBodyKeys.has(key as keyof typeof PUBLIC_COPY))await expect(page.locator('body'),`Reviewed public copy: ${locale}/${key}`).toContainText(tr(copy));
  }
  await expect(page).toHaveTitle(tr(PUBLIC_COPY.landingTitle));
  await expect(page.locator('meta[name="description"]')).toHaveAttribute('content',tr(PUBLIC_COPY.landingDescription));
  const pricing=page.locator('#prices'),cards=pricing.getByRole('article');
  await expect(cards).toHaveCount(current.length);
  for(const [index,plan] of current.entries()){
   const version=plan.currentVersion,card=cards.nth(index);
   await expect(card.getByRole('heading',{name:version.name,exact:true})).toBeVisible();
   const price=version.currency==='UZS'?formatLocaleMoney(version.monthlyPrice.toFixed(2),locale):version.monthlyPrice.toFixed(2)+' '+version.currency;
   await expect(card.getByText(price+tr(PUBLIC_COPY.pricePeriod),{exact:true})).toBeVisible();
   await expect(card.getByText(`${version.branchLimit} ${tr(PUBLIC_COPY.branchLimit)}`,{exact:true})).toBeVisible();
   await expect(card.getByText(`${tr(PUBLIC_COPY.organizationLimit)} ${version.registerLimit} ${tr(PUBLIC_COPY.registerLimit)}`,{exact:true})).toBeVisible();
   await expect(card.getByText(`${tr(PUBLIC_COPY.totalLimit)} ${version.staffLimit} ${tr(PUBLIC_COPY.staffLimit)}`,{exact:true})).toBeVisible();
  }
  const trial=current.find(plan=>plan.isTrial)?.currentVersion;
  expect(trial,'Trial configuration is required by this acceptance fixture').toBeDefined();
  await expect(page.getByText(`${tr(PUBLIC_COPY.trialOrganization)} ${trial!.trialDays} ${tr(PUBLIC_COPY.trialDays)} ${trial!.name} ${tr(PUBLIC_COPY.trialAfter)} ${trial!.graceDays} ${tr(PUBLIC_COPY.graceDays)}`,{exact:true})).toBeVisible();
  await expect(page.getByText(tr(PUBLIC_COPY.pricesUnavailable),{exact:true})).toHaveCount(0);
  // Execute the actual generated PWA module in each browser engine as well.
  // Different ICU versions may choose a comma for Uzbek grouping; our public
  // SSR/client/offline contract uses an ordinary space in both locales.
  const offlineMoney=await page.evaluate(async(language)=>{
   const asset='/pwa/format.js';
   const formatter=await import(/* webpackIgnore: true */ asset);
   return formatter.formatLocaleMoney('249000.00',language);
  },locale);
  expect(offlineMoney).toBe(locale==='uz'?'249 000 so‘m':'249 000 сум');
  for(const width of [1280,360]){
   await page.setViewportSize({width,height:780});
   const login=page.getByRole('link',{name:tr(PUBLIC_COPY.login),exact:true});
   const language=page.getByRole('combobox',{name:translate('Til',locale),exact:true}).locator('..');
   await login.click({trial:true});
   const link=await login.boundingBox(),switcher=await language.boundingBox();
   expect(link).not.toBeNull();expect(switcher).not.toBeNull();
   const intersects=link!.x<switcher!.x+switcher!.width&&link!.x+link!.width>switcher!.x&&link!.y<switcher!.y+switcher!.height&&link!.y+link!.height>switcher!.y;
   expect(intersects,'Language control must not obscure the public login link').toBe(false);
   expect(await page.evaluate(()=>document.documentElement.scrollWidth<=window.innerWidth+1)).toBe(true);
   await page.screenshot({path:testInfo.outputPath(`public-${locale}-${width}.png`),fullPage:true});
  }
  await page.setViewportSize({width:1280,height:780});
  await page.screenshot({path:testInfo.outputPath(`public-${locale}.png`),fullPage:true});
  const manifest=await page.request.get('/manifest.webmanifest');
  expect(manifest.ok()).toBe(true);
  expect(await manifest.json()).toMatchObject({name:'Shuni POS',short_name:'Shuni POS',description:tr(PUBLIC_COPY.manifestDescription),lang:locale,start_url:'/pos',scope:'/'});
  // Public login inherits root metadata, while the landing page overrides it.
  await page.goto('/login');
  await expect(page).toHaveTitle(tr(PUBLIC_COPY.rootTitle));
  await expect(page.locator('meta[name="description"]')).toHaveAttribute('content',tr(PUBLIC_COPY.rootDescription));
  expect(JSON.stringify(await plans()),'Public reads must not mutate shared plans').toBe(before);
 });
}
