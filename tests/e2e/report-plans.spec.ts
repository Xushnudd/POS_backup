import {test,expect} from '@playwright/test';
import {PrismaClient} from '@prisma/client';
import {randomUUID} from 'node:crypto';
import {URI,type TOTP} from 'otpauth';
const url=new URL(process.env.DATABASE_URL??'');
if(url.hostname!=='127.0.0.1'||url.port!=='55439'||url.pathname!=='/pos_test')throw Error('Isolated pos_test only');
const db=new PrismaClient(),orgs:string[]=[],users:string[]=[];
test.afterAll(async()=>{await db.organization.deleteMany({where:{id:{in:orgs}}});await db.user.deleteMany({where:{id:{in:users}}});await db.$disconnect();});
test('Owner report policy preview, MFA and lost-ack recovery preserve one original disabled schedule',async({page})=>{
 const password='test-only-password';const registration=await page.request.post('/api/auth/register',{headers:{Origin:'https://localhost:3100'},data:{fullName:'Report plan owner',phone:'plan-'+randomUUID(),password,organizationName:'Report plan fixture'}});expect(registration.ok()).toBe(true);
 const me=(await(await page.request.get('/api/auth/me')).json()).data;orgs.push(me.organization.id);users.push(me.user.id);
 const begin=await page.request.post('/api/auth/totp/enroll',{headers:{Origin:'https://localhost:3100'},data:{password}});expect(begin.ok()).toBe(true);
 const factor=(await begin.json()).data,totp=URI.parse(factor.provisioningUri) as TOTP;
 expect((await page.request.post('/api/auth/totp/confirm',{headers:{Origin:'https://localhost:3100'},data:{factorId:factor.factorId,code:totp.generate({timestamp:Date.now()-30000})}})).ok()).toBe(true);
 await page.goto('/reports/plans');await expect(page.getByText('Hali hisobot jadvali yaratilmagan.',{exact:true})).toBeVisible();
 await expect(page.getByLabel('Avtomatik hisobot yaratishga ruxsat',{exact:true})).not.toBeChecked();
 await page.getByLabel('Hisobot nomi',{exact:true}).fill('Reviewed internal KPI');await page.getByLabel('Sozlash sababi',{exact:true}).fill('Owner reviewed KPI and retention');
 await page.getByRole('button',{name:'KPI va prognozni oldindan ko‘rish',exact:true}).click();
 await expect(page.getByRole('region',{name:'Hisobot oldindan ko‘rish'}).getByRole('table')).toBeVisible();expect(await db.reportSchedule.count({where:{organizationId:me.organization.id}})).toBe(0);
 const bodies:string[]=[];let lost=false;
 await page.route('**/api/reports/plans',async route=>{if(route.request().method()==='POST'){bodies.push(route.request().postData()!);const response=await route.fetch();if(response.ok()&&!lost){lost=true;await route.abort('failed');}else await route.fulfill({response});}else await route.continue();});
 await page.getByRole('button',{name:'Hisobot jadvalini saqlash: oldindan ko‘rish',exact:true}).click();await page.getByRole('button',{name:'Amalni tasdiqlash',exact:true}).click();
 const dialog=page.getByRole('dialog',{name:'Muhim amalni tasdiqlash'});await expect(dialog).toBeVisible();expect(await db.reportSchedule.count({where:{organizationId:me.organization.id}})).toBe(0);
 await dialog.getByLabel('Muhim amal uchun Authenticator kodi',{exact:true}).fill(totp.generate());await dialog.getByRole('button',{name:'Amalni tasdiqlash',exact:true}).click();
 // The original button appears as soon as the local intent is persisted.
 // Wait for the injected *committed* lost acknowledgement, not that earlier
 // MFA-in-flight state, before simulating a browser restart.
 await expect.poll(()=>lost).toBe(true);
 await expect(page.getByText('Server tasdig‘i kutilmoqda…',{exact:true})).toHaveCount(0);
 await expect(page.getByRole('button',{name:'Original amalni qayta tekshirish',exact:true})).toBeVisible();
 await page.reload();await page.getByRole('button',{name:'Saqlangan amalni qayta tekshirish',exact:true}).click();
 await expect(page.getByRole('button',{name:'Ochish: Reviewed internal KPI',exact:true})).toBeVisible();
 const saved=await db.reportSchedule.findMany({where:{organizationId:me.organization.id}});expect(saved).toHaveLength(1);expect(saved[0].enabled).toBe(false);expect(saved[0].revision).toBe(1);
 expect(bodies.length).toBeGreaterThanOrEqual(3);expect(new Set(bodies).size).toBe(1);
 await page.getByRole('button',{name:'Ochish: Reviewed internal KPI',exact:true}).click();await page.getByLabel('Hisobot nomi',{exact:true}).fill('Unsaved name');page.once('dialog',dialog=>dialog.dismiss());await page.getByRole('button',{name:'Yangi hisobot jadvali',exact:true}).click();await expect(page.getByLabel('Hisobot nomi',{exact:true})).toHaveValue('Unsaved name');
 expect((await page.request.post('/api/reports/plans/preview',{headers:{Origin:'https://foreign.invalid'},data:saved[0].configuration})).status()).toBe(403);
});
