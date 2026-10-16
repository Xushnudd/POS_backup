import {test,expect,type Page} from '@playwright/test';
import {PrismaClient} from '@prisma/client';
import {randomUUID} from 'node:crypto';
import {execFileSync} from 'node:child_process';
import {mkdirSync} from 'node:fs';
const db=new PrismaClient(),orgs:string[]=[],users:string[]=[],headers={Origin:'https://localhost:3100'};
test.afterAll(async()=>{await db.organization.deleteMany({where:{id:{in:orgs}}});await db.user.deleteMany({where:{id:{in:users}}});await db.$disconnect();});
async function post(page:Page,path:string,data:unknown){const response=await page.request.post(path,{headers,data});expect(response.ok(),path).toBe(true);return (await response.json()).data;}
async function fixture(page:Page){
 await post(page,'/api/auth/register',{fullName:'Private document owner',phone:'shared-document-'+randomUUID(),password:'test-only-password',organizationName:'Original document merchant'});
 const me=(await(await page.request.get('/api/auth/me')).json()).data;orgs.push(me.organization.id);users.push(me.user.id);
 const store=await db.store.findFirstOrThrow({where:{organizationId:me.organization.id}}),register=await db.register.findFirstOrThrow({where:{storeId:store.id}}),member=await db.organizationUser.findFirstOrThrow({where:{organizationId:me.organization.id,userId:me.user.id}});
 const shift=await db.shift.create({data:{registerId:register.id,organizationUserId:member.id,openingCash:0}}),product=await db.product.create({data:{organizationId:me.organization.id,name:'Original document item',sku:randomUUID(),barcode:randomUUID(),unit:'dona',salePrice:'1.01',costPrice:'0.50'}});
 await db.inventoryBalance.create({data:{storeId:store.id,productId:product.id,quantity:5}});
 const sale=await post(page,'/api/sales',{operationId:randomUUID(),organizationId:me.organization.id,storeId:store.id,registerId:register.id,shiftId:shift.id,items:[{productId:product.id,quantity:'1'}]});
 await post(page,'/api/sales/'+sale.id+'/complete',{operationId:randomUUID(),payments:[{paymentType:'cash',amount:'1.01'}]});
 return {orgId:me.organization.id,product,sale};
}
test('Receipt consent UI survives lost acknowledgement; anonymous receipt matches both PDF widths and becomes unavailable on revoke',async({page,browser,browserName})=>{
 const f=await fixture(page);await page.goto('/sales/'+f.sale.id);await page.getByRole('button',{name:'Chekni chop etish',exact:true}).click();
 const section=page.getByRole('region',{name:'Elektron chek',exact:true}),preview=section.getByRole('button',{name:'Elektron chek havolasini yaratish: oldindan ko‘rish',exact:true});
 await expect(preview).toBeDisabled();await section.getByRole('checkbox').check();await expect(preview).toBeEnabled();
 const path='/api/sales/'+f.sale.id+'/receipt-links',bodies:string[]=[];let lost=false;
 await page.route('**'+path,async route=>{if(route.request().method()!=='POST')return route.continue();bodies.push(route.request().postData()!);const response=await route.fetch();if(!lost&&response.ok()){lost=true;await route.abort('failed');}else await route.fulfill({response});});
 await preview.click();await section.getByRole('button',{name:'Amalni tasdiqlash',exact:true}).click();await expect.poll(()=>lost).toBe(true);
 await page.reload();await page.getByRole('button',{name:'Chekni chop etish',exact:true}).click();
 await section.getByRole('button',{name:'Original amalni qayta tekshirish',exact:true}).click();
 await expect(section.getByRole('button',{name:'Original amalni qayta tekshirish',exact:true})).toHaveCount(0);
 expect(new Set(bodies).size).toBe(1);expect(bodies.length).toBe(2);
 expect(await db.operation.count({where:{organizationId:f.orgId,type:'receipt.share'}})).toBe(1);
 const link=section.getByRole('link',{name:'Elektron chekni ochish',exact:true});await expect(link).toBeVisible();const url=(await link.getAttribute('href'))!;
 const anonymous=await browser.newContext({ignoreHTTPSErrors:true}),receipt=await anonymous.newPage(),requests:string[]=[];
 receipt.on('request',request=>requests.push(request.url()));
 try{
  await receipt.goto(url);await expect(receipt.locator('[data-receipt-total="1.01"]')).toBeVisible();await expect(receipt.locator('#electronic-receipt')).toContainText('Original document merchant');await expect(receipt.locator('#electronic-receipt')).toContainText('CHEK NUSXASI');
  await expect(receipt.locator('#electronic-receipt')).not.toContainText('Private document owner');
  await receipt.reload();await expect(receipt.locator('[data-receipt-total="1.01"]')).toBeVisible();
  for(const width of ['58','80']){
   await receipt.getByLabel('Chek qog‘ozi eni',{exact:true}).selectOption(width);
   if(browserName==='chromium'){const pdf=await receipt.pdf({preferCSSPageSize:true});expect(pdf.subarray(0,4).toString()).toBe('%PDF');const box=/\/MediaBox\s*\[\s*0\s+0\s+([\d.]+)/.exec(pdf.toString('latin1'));expect(box).not.toBeNull();expect(Math.abs(Number(box![1])-Number(width)*72/25.4)).toBeLessThan(2);}
  }
  const capability=new URL(url).hash.slice(1).split('.')[2];expect(requests.some(request=>request.includes(capability))).toBe(false);
  mkdirSync('tasks/evidence/core185-20261016',{recursive:true});await receipt.screenshot({path:'tasks/evidence/core185-20261016/receipt.png',fullPage:true});
  await section.getByRole('button',{name:'Havolani bekor qilish',exact:true}).click();await expect(section.getByText('Havola faol emas.',{exact:true})).toBeVisible();
  await receipt.reload();await expect(receipt.getByRole('heading',{name:'Elektron chek mavjud emas yoki muddati tugagan.',exact:true})).toBeVisible();
 }finally{await anonymous.close();}
 expect(await db.payment.count({where:{organizationId:f.orgId}})).toBe(1);expect(await db.inventoryMovement.count({where:{organizationId:f.orgId}})).toBe(1);
});
test('Personal service consent prepares a real worker statement; opt-out blocks anonymous reload',async({page,browser})=>{
 const f=await fixture(page),customer=await db.customer.create({data:{organizationId:f.orgId,fullName:'Statement browser customer',phone:randomUUID(),creditLimit:100}});
 await post(page,'/api/customers/'+customer.id+'/ledger',{operationId:randomUUID(),kind:'opening',amount:'1.01',reason:'Browser service reminder debt',effectiveAt:new Date(Date.now()-3*86400000).toISOString(),dueAt:new Date(Date.now()-86400000).toISOString()});
 await page.goto('/customers/'+customer.id);
 await page.getByLabel('Rozilik maqsadi',{exact:true}).selectOption('service_reminder');await page.getByLabel('Aloqa kanali',{exact:true}).selectOption('in_person');await page.getByLabel('Rozilik qarori',{exact:true}).selectOption('grant');
 await page.getByLabel('Rozilik dalilining identifikatori',{exact:true}).fill('synthetic-personal-request');await page.getByLabel('Rozilik matni versiyasi',{exact:true}).fill('service-in-person-v1');
 await page.getByRole('button',{name:'Rozilik qarorini saqlash: oldindan ko‘rish',exact:true}).click();await page.getByRole('button',{name:'Amalni tasdiqlash',exact:true}).click();
 await expect.poll(()=>db.consentEvent.count({where:{customerId:customer.id}})).toBe(1);
 // The Card component's title and controls share the nearest enclosing card.
 const card=page.getByRole('heading',{name:'Shaxsan xizmat eslatmalari',exact:true}).locator('..').locator('..').locator('..');
 await card.getByRole('button',{name:'Yangilash',exact:true}).click();await card.getByRole('button',{name:'Ko‘chirmani tayyorlash navbatiga qo‘yish: oldindan ko‘rish',exact:true}).click();await card.getByRole('button',{name:'Amalni tasdiqlash',exact:true}).click();
 await expect.poll(()=>db.backgroundJob.count({where:{organizationId:f.orgId,type:'customer_reminder'}})).toBe(1);
 execFileSync(process.execPath,['--require','./scripts/worker-resolver.cjs','.worker-build/scripts/workers/jobs.js','--once'],{env:{...process.env,APP_ORIGIN:'https://localhost:3100',AUTH_TOTP_ENABLED:'true',AUTH_CHALLENGE_SECRET:'c'.repeat(64)},stdio:'pipe',timeout:60000});
 await card.getByRole('button',{name:'Yangilash',exact:true}).click();const link=card.getByRole('link',{name:'Ko‘chirmani ochish',exact:true});await expect(link).toBeVisible();const url=(await link.getAttribute('href'))!;
 const anonymous=await browser.newContext({ignoreHTTPSErrors:true}),statement=await anonymous.newPage();
 try{
  await statement.goto(url);await expect(statement.getByRole('heading',{name:'Mijoz qarz ko‘chirmasi',exact:true})).toBeVisible();await expect(statement.getByText('Muddati o‘tgan qarz: 1.01',{exact:true})).toBeVisible();await expect(statement.locator('tbody tr')).toHaveCount(1);
  await page.getByLabel('Rozilik qarori',{exact:true}).selectOption('withdraw');await page.getByLabel('Rozilik dalilining identifikatori',{exact:true}).fill('synthetic-withdrawal');await page.getByLabel('Rozilik matni versiyasi',{exact:true}).fill('service-in-person-v1');await page.getByRole('button',{name:'Rozilik qarorini saqlash: oldindan ko‘rish',exact:true}).click();await page.getByRole('button',{name:'Amalni tasdiqlash',exact:true}).click();
  await expect.poll(()=>db.consentEvent.count({where:{customerId:customer.id}})).toBe(2);await statement.reload();await expect(statement.getByRole('heading',{name:'Ko‘chirma mavjud emas yoki ruxsat bekor qilingan.',exact:true})).toBeVisible();
 }finally{await anonymous.close();}
});
test('Legacy external image metadata cannot create an automatic browser request',async({page})=>{
 const f=await fixture(page);let served=false,externalRequests=0;
 await page.route('**/api/products/'+f.product.id,async route=>{if(route.request().method()!=='GET')return route.continue();const response=await route.fetch(),body=await response.json();body.data.imageUrl='https://legacy-image.invalid/synthetic.png';served=true;await route.fulfill({response,json:body});});
 await page.route('https://legacy-image.invalid/**',async route=>{externalRequests++;await route.abort();});
 await page.goto('/products/'+f.product.id+'/media');await expect.poll(()=>served).toBe(true);await expect(page.getByLabel('Mahsulot rasm fayli',{exact:true})).toBeEnabled();
 await expect(page.locator('img[src^="https://legacy-image.invalid"]')).toHaveCount(0);expect(externalRequests).toBe(0);
});
test('Lost consent rejection clears only the blocked reminder attempt and permits a newly consented request',async({page})=>{
 const f=await fixture(page),customer=await db.customer.create({data:{organizationId:f.orgId,fullName:'Reminder conflict customer',phone:randomUUID(),creditLimit:100}});
 await post(page,'/api/customers/'+customer.id+'/ledger',{operationId:randomUUID(),kind:'opening',amount:'1.01',reason:'Synthetic reminder conflict debt'});
 const consentPath='/api/customers/'+customer.id+'/consents',grant=(revision:number,granted:boolean)=>({operationId:randomUUID(),expectedRevision:revision,purpose:'service_reminder',channel:'in_person',granted,source:'customer_request',evidenceRef:'synthetic-reminder-conflict',policyVersion:'service-in-person-v1'});
 await post(page,consentPath,grant(0,true));await page.goto('/customers/'+customer.id);
 const card=page.getByRole('heading',{name:'Shaxsan xizmat eslatmalari',exact:true}).locator('..').locator('..').locator('..'),path='/api/customers/'+customer.id+'/reminders';let lost=false;
 await page.route('**'+path,async route=>{if(route.request().method()!=='POST')return route.continue();if(!lost){await post(page,consentPath,grant(1,false));const response=await route.fetch();expect(response.status()).toBe(409);lost=true;await route.abort('failed');}else await route.continue();});
 await card.getByRole('button',{name:'Ko‘chirmani tayyorlash navbatiga qo‘yish: oldindan ko‘rish',exact:true}).click();await card.getByRole('button',{name:'Amalni tasdiqlash',exact:true}).click();await expect.poll(()=>lost).toBe(true);
 await page.reload();await card.getByRole('button',{name:'Original amalni qayta tekshirish',exact:true}).click();await expect(card.getByRole('button',{name:'Original amalni qayta tekshirish',exact:true})).toHaveCount(0);
 expect(await db.backgroundJob.count({where:{organizationId:f.orgId,type:'customer_reminder'}})).toBe(0);
 await post(page,consentPath,grant(2,true));await card.getByRole('button',{name:'Yangilash',exact:true}).click();await card.getByRole('button',{name:'Ko‘chirmani tayyorlash navbatiga qo‘yish: oldindan ko‘rish',exact:true}).click();await card.getByRole('button',{name:'Amalni tasdiqlash',exact:true}).click();await expect.poll(()=>db.backgroundJob.count({where:{organizationId:f.orgId,type:'customer_reminder'}})).toBe(1);
});
