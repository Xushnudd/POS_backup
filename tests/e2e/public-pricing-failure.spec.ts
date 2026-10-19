import {test,expect} from '@playwright/test';
import {PrismaClient} from '@prisma/client';
import {PUBLIC_COPY} from '../../src/release/public-copy';
import {translate} from '../../src/i18n/messages';
const connection=new URL(process.env.DATABASE_URL??'');
if(connection.hostname!=='127.0.0.1'||connection.port!=='55439'||connection.pathname!=='/pos_test')throw Error('Isolated pricing failure DB required');
const db=new PrismaClient();
test.afterAll(async()=>{await db.$disconnect()});
// Run this file alone against a fresh e2e server: a successful earlier public
// request is intentionally allowed to use the real60s configuration cache.
test('A real uncached pricing read timeout shows no invented price or trial in either language',async({page,context})=>{
 await db.$transaction(async tx=>{
  await tx.$executeRaw`LOCK TABLE "BillingPlan" IN ACCESS EXCLUSIVE MODE`;
  for(const locale of ['uz','ru'] as const){
   await context.addCookies([{name:'pos_locale',value:locale,url:'https://localhost:3100',secure:true,sameSite:'Lax'}]);
   await page.goto('/');
   await expect(page.getByRole('status')).toContainText(translate(PUBLIC_COPY.pricesUnavailable,locale));
   await expect(page.locator('#prices').getByRole('article')).toHaveCount(0);
   await expect(page.getByRole('link',{name:translate(PUBLIC_COPY.startTrial,locale),exact:true})).toHaveCount(0);
   await expect(page.getByRole('link',{name:translate(PUBLIC_COPY.register,locale),exact:true})).toBeVisible();
   await expect(page.getByText(translate(PUBLIC_COPY.integrationLimitations,locale),{exact:true})).toBeVisible();
   await page.screenshot({path:test.info().outputPath('pricing-unavailable-'+locale+'.png')});
  }
 },{maxWait:5000,timeout:20000});
 // The lock was transactional and is gone: the test does not mutate plans.
 expect(await db.billingPlan.count({where:{isActive:true}})).toBeGreaterThan(0);
});
