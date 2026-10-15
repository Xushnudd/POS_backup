import {TOTP,URI} from 'otpauth';
import {enrollCritical} from './critical-fixture';
import sharp from 'sharp';
import {readFileSync,writeFileSync,renameSync} from 'node:fs'
import {execFileSync} from 'node:child_process'
import ts from 'typescript'
import { test, expect, type Locator, type Page } from '@playwright/test'
import { PrismaClient } from '@prisma/client'
import { randomUUID } from 'node:crypto'
const connection=new URL(process.env.DATABASE_URL??'')
if(connection.hostname!=='127.0.0.1'||connection.pathname!=='/pos_test')throw new Error('Isolated test DB required')
const db=new PrismaClient(),orgs:string[]=[],users:string[]=[],phones:string[]=[]
// Strict-MFA regressions use actual single-use counters; no replay state is reset.
async function criticalApprover(page:Page,password:string){
 if(process.env.AUTH_CRITICAL_MFA_REQUIRED!=='true')return async()=>{};
 const origin={Origin:'https://localhost:3100'};
 const response=await page.request.post('https://localhost:3100/api/auth/totp/enroll',{headers:origin,data:{password}});expect(response.ok()).toBe(true);
 const factor=(await response.json()).data,totp=URI.parse(factor.provisioningUri) as TOTP,stamp=Date.now()-30000;
 const confirmed=await page.request.post('https://localhost:3100/api/auth/totp/confirm',{headers:origin,data:{factorId:factor.factorId,code:totp.generate({timestamp:stamp})}});expect(confirmed.ok()).toBe(true);
 let lastCounter=Math.floor(stamp/30000);
 return async()=>{
  const proof=page.getByRole('dialog',{name:'Muhim amalni tasdiqlash',exact:true});await expect(proof).toBeVisible();
  await expect.poll(()=>Math.floor(Date.now()/30000),{timeout:35000,intervals:[250]}).toBeGreaterThan(lastCounter);
  const now=Date.now();lastCounter=Math.floor(now/30000);
  await proof.getByLabel('Muhim amal uchun Authenticator kodi',{exact:true}).fill(totp.generate({timestamp:now}));
  await proof.getByRole('button',{name:'Amalni tasdiqlash',exact:true}).click();await expect(proof).toHaveCount(0);
 };
}
async function expectReadableText(locator:Locator){
 const ratios=await locator.evaluateAll(elements=>elements.filter(el=>el.getBoundingClientRect().width>0&&!el.matches(':disabled')).map(el=>{
  const canvas=document.createElement('canvas');canvas.width=canvas.height=1;const ctx=canvas.getContext('2d')!;
  const rgb=(color:string)=>{ctx.clearRect(0,0,1,1);ctx.fillStyle=color;ctx.fillRect(0,0,1,1);return [...ctx.getImageData(0,0,1,1).data]};
  let parent:Element|null=el,background=[255,255,255,255];while(parent){const candidate=rgb(getComputedStyle(parent).backgroundColor);if(candidate[3]===255){background=candidate;break;}parent=parent.parentElement;}
  const luminance=(values:number[])=>values.slice(0,3).map(v=>{const s=v/255;return s<=0.04045?s/12.92:((s+0.055)/1.055)**2.4}).reduce((sum,v,i)=>sum+v*[0.2126,0.7152,0.0722][i],0);
  const fg=luminance(rgb(getComputedStyle(el).color)),bg=luminance(background);return {text:el.textContent?.trim(),ratio:(Math.max(fg,bg)+0.05)/(Math.min(fg,bg)+0.05)};
 }));
 expect(ratios.length).toBeGreaterThan(0);for(const row of ratios)expect(row.ratio,`${row.text}: contrast`).toBeGreaterThanOrEqual(4.5);
}
test.afterAll(async()=>{
 const accounts=await db.user.findMany({where:{phone:{in:phones}},include:{organizationUsers:true}})
 users.push(...accounts.map(user=>user.id));orgs.push(...accounts.flatMap(user=>user.organizationUsers.map(member=>member.organizationId)))
 await db.organization.deleteMany({where:{id:{in:orgs}}})
 await db.user.deleteMany({where:{id:{in:users}}})
 await db.$disconnect()
})
test('Landed cost UI previews partial receipts, invalidates edited results and retries without posting', async ({page}) => {
 const phone='landed-browser-'+randomUUID();phones.push(phone);
 const registration=await page.request.post('/api/auth/register',{headers:{Origin:'https://localhost:3100'},data:{fullName:'Landed owner',phone,password:'test-only-password',organizationName:'Landed business'}});expect(registration.ok()).toBe(true);
 const me=(await (await page.request.get('/api/auth/me')).json()).data;orgs.push(me.organization.id);users.push(me.user.id);
 const store=await db.store.findFirstOrThrow({where:{organizationId:me.organization.id}});
 const supplier=await db.supplier.create({data:{organizationId:me.organization.id,name:'Landed supplier'}});
 const product=await db.product.create({data:{organizationId:me.organization.id,name:'Landed item',sku:randomUUID(),barcode:randomUUID(),unit:'dona',salePrice:10,costPrice:2}});
 const ordered=await page.request.post('/api/purchase-orders',{headers:{Origin:'https://localhost:3100'},data:{operationId:randomUUID(),storeId:store.id,supplierId:supplier.id,referenceNo:'LANDED-ORDER',reason:'Browser purchase',items:[{productId:product.id,quantity:'10',unitCost:'2'}]}});expect(ordered.ok()).toBe(true);
 const order=(await ordered.json()).data;
 const received=await page.request.post(`/api/purchase-orders/${order.id}/receive`,{headers:{Origin:'https://localhost:3100'},data:{operationId:randomUUID(),referenceNo:'LANDED-RECEIPT',reason:'Partial browser receipt',items:[{orderItemId:order.items[0].id,quantity:'3'}]}});expect(received.ok()).toBe(true);
 const stock=(await received.json()).data.stockDocument;
 const before=await db.operation.count({where:{organizationId:me.organization.id}});
 await page.goto('/suppliers/'+supplier.id);
 await page.getByRole('button',{name:/LANDED-ORDER/}).click();
 page.on('dialog',async dialog=>{if(dialog.type()==='beforeunload')await dialog.accept();else await dialog.dismiss();});
 const panel=page.getByRole('region',{name:'Kirim xarajatlari: LANDED-RECEIPT'});
 await panel.getByLabel('Qo‘shimcha xarajat summasi').fill('0.01');
 await panel.getByRole('button',{name:'Taqsimotni hisoblash',exact:true}).click();
 await expect(panel.getByRole('status').filter({hasText:'Hisoblandi.'})).toContainText('Jami xarajat: 0.01');
 await expect(panel.getByRole('cell',{name:'3 dona',exact:true})).toBeVisible();
 await expect(panel.getByRole('cell',{name:'2.003333',exact:true})).toBeVisible();
 await expect(panel.getByRole('cell',{name:'0.000001',exact:true})).toBeVisible();
 await panel.getByLabel('Qo‘shimcha xarajat summasi').fill('12');
 await expect(panel.getByRole('status').filter({hasText:'Hisoblandi.'})).toHaveCount(0);
 await panel.getByLabel('Taqsimlash usuli').selectOption('weight');
 await panel.getByLabel('Landed item: kg / bazaviy birlik').fill('0.5');
 let fail=true;
 await page.route('**/landed-cost-preview',async route=>{if(fail){fail=false;await route.abort('failed');}else await route.continue();});
 await panel.getByRole('button',{name:'Taqsimotni hisoblash',exact:true}).click();
 await expect(panel.getByRole('alert')).toBeVisible();
 await panel.getByRole('button',{name:'Qayta hisoblash',exact:true}).click();
 await expect(panel.getByRole('status').filter({hasText:'Hisoblandi.'})).toContainText('Jami xarajat: 12.00');
 await expect(panel.getByRole('cell',{name:'6.000000',exact:true})).toBeVisible();
 // Reloading order data and selecting the already active order must retain independent drafts.
 await page.getByLabel('Buyurtma raqami',{exact:true}).fill('UNSAVED-NEXT-ORDER');
 await page.getByRole('button',{name:/LANDED-ORDER/}).click();
 await expect(panel.getByLabel('Qo‘shimcha xarajat summasi')).toHaveValue('12');
 const listRead=page.waitForResponse(response=>new URL(response.url()).pathname==='/api/purchase-orders'&&response.ok());
 await page.getByRole('heading',{name:'Buyurtma tarixi',exact:true}).locator('..').getByRole('button',{name:'Qayta yuklash',exact:true}).click();await listRead;
 await expect(page.getByLabel('Buyurtma raqami',{exact:true})).toHaveValue('UNSAVED-NEXT-ORDER');
 await page.locator('a[href="/dashboard"]').first().click();await expect(page).toHaveURL(new RegExp('/suppliers/'+supplier.id+'$'));
 await expect(panel.getByLabel('Qo‘shimcha xarajat summasi')).toHaveValue('12');

 expect(await db.operation.count({where:{organizationId:me.organization.id}})).toBe(before);
 expect((await db.inventoryBalance.findUniqueOrThrow({where:{storeId_productId:{storeId:store.id,productId:product.id}}})).quantity.toString()).toBe('3');
 expect((await db.product.findUniqueOrThrow({where:{id:product.id}})).costPrice.toString()).toBe('2');
 expect((await db.supplierInvoice.findUniqueOrThrow({where:{stockDocumentId:stock.id}})).amount.toString()).toBe('6');
 const origin={Origin:'https://localhost:3100'};
 const post=async(path:string,data:Record<string,unknown>)=>{const response=await page.request.post(path,{headers:origin,data:{operationId:randomUUID(),...data}});expect(response.ok()).toBe(true);return (await response.json()).data;};
 const bank=await post('/api/finance/accounts',{storeId:store.id,name:'Freight bank ledger',kind:'bank',openingBalance:'20',reason:'Actual test opening balance'});
 const category=await post('/api/finance/categories',{name:'Freight',treatment:'capitalised'});
 const expense=await post('/api/finance/expenses',{accountId:bank.id,expenseCategoryId:category.id,amount:'12',reason:'Paid original freight'});
 const plan=await post(`/api/stock-documents/${stock.id}/cost-plans`,{expenseDocumentId:expense.id,amount:'12',method:'value',reason:'Prepared freight allocation'});
 const history=page.getByRole('region',{name:'Taqsimot tarixi: LANDED-RECEIPT'});
 let listFailure=true;
 await page.route(`**/stock-documents/${stock.id}/cost-plans?page=*`,async route=>{if(listFailure){listFailure=false;await route.abort('failed');}else await route.continue();});
 await history.getByRole('button',{name:'Qayta yuklash',exact:true}).click();await expect(history.getByRole('alert')).toBeVisible();
 await history.getByRole('button',{name:'Qayta yuklash',exact:true}).click();
 const article=history.getByRole('article',{name:`Taqsimot ${plan.id}`});
 await expect(article).toContainText('Tayyor, qo‘llanmagan');
 await article.getByLabel('Taqsimotni bekor qilish sababi').fill('Original prepared allocation not needed');
 await article.getByRole('button',{name:'Tayyor taqsimotni bekor qilish: oldindan ko‘rish',exact:true}).click();
 expect((await db.receiptCostPlan.findUniqueOrThrow({where:{id:plan.id}})).status).toBe('prepared');
 const keys:string[]=[];let loseAck=true;
 await page.route(`**/cost-plans/${plan.id}/cancel`,async route=>{keys.push(route.request().postDataJSON().operationId);const response=await route.fetch();expect(response.ok()).toBe(true);if(loseAck){loseAck=false;await route.abort('failed');}else await route.fulfill({response});});
 await article.getByRole('button',{name:'Amalni tasdiqlash',exact:true}).click();await expect(article.getByRole('button',{name:'Original amalni qayta tekshirish',exact:true})).toBeVisible();
 await expect.poll(async()=>(await db.receiptCostPlan.findUniqueOrThrow({where:{id:plan.id}})).status).toBe('cancelled');
 await expect(article.getByRole('alert')).toBeVisible();
 await page.reload();await page.getByRole('button',{name:/LANDED-ORDER/}).click();
 await expect(article).toContainText('Bekor qilingan');
 await expect(article.getByRole('button',{name:'Tayyor taqsimotni bekor qilish: oldindan ko‘rish',exact:true})).toHaveCount(0);
 await article.getByRole('button',{name:'Original amalni qayta tekshirish',exact:true}).click();
 await expect(article.getByRole('button',{name:'Original amalni qayta tekshirish',exact:true})).toHaveCount(0);
 expect(keys).toHaveLength(2);expect(keys[1]).toBe(keys[0]);
 expect(await db.auditLog.count({where:{entityType:'ReceiptCostPlan',entityId:plan.id,action:'cancelled'}})).toBe(1);
 expect((await db.inventoryBalance.findUniqueOrThrow({where:{storeId_productId:{storeId:store.id,productId:product.id}}})).quantity.toString()).toBe('3');
 expect((await db.product.findUniqueOrThrow({where:{id:product.id}})).costPrice.toString()).toBe('2');
 const accounts=(await (await page.request.get('/api/finance/accounts')).json()).data;expect(accounts.find((row:{id:string})=>row.id===bank.id).balance).toBe('8');
});
test('Manual bank refund UI previews exact channels and journals confirmed settlement once without provider requests',async({page})=>{
 const phone='998'+Date.now();phones.push(phone);
 const registration=await page.request.post('/api/auth/register',{headers:{Origin:'https://localhost:3100'},data:{fullName:'Refund owner',phone,password:'test-only-password',organizationName:'Manual refund business'}});expect(registration.ok()).toBe(true);
 const me=(await (await page.request.get('/api/auth/me')).json()).data;orgs.push(me.organization.id);users.push(me.user.id);
 const store=await db.store.findFirstOrThrow({where:{organizationId:me.organization.id}}),register=await db.register.findFirstOrThrow({where:{storeId:store.id}}),member=await db.organizationUser.findFirstOrThrow({where:{organizationId:me.organization.id,userId:me.user.id}});
 const shift=await db.shift.create({data:{registerId:register.id,organizationUserId:member.id,openingCash:0}}),product=await db.product.create({data:{organizationId:me.organization.id,name:'Manual refund item',sku:randomUUID(),barcode:randomUUID(),unit:'dona',salePrice:100,costPrice:40}});
 await db.inventoryBalance.create({data:{storeId:store.id,productId:product.id,quantity:2}});
 const draftResponse=await page.request.post('/api/sales',{headers:{Origin:'https://localhost:3100'},data:{organizationId:me.organization.id,storeId:store.id,registerId:register.id,shiftId:shift.id,operationId:randomUUID(),items:[{productId:product.id,quantity:1}]}});expect(draftResponse.ok()).toBe(true);const sale=(await draftResponse.json()).data;
 expect((await page.request.post(`/api/sales/${sale.id}/complete`,{headers:{Origin:'https://localhost:3100'},data:{payments:[{paymentType:'cash',amount:60},{paymentType:'card',amount:40}]}})).ok()).toBe(true);
 const external:string[]=[];page.on('request',request=>{if(!new URL(request.url()).hostname.includes('localhost'))external.push(request.url())});
 await page.goto(`/sales/${sale.id}`);await page.getByRole('button',{name:'Qaytarish',exact:true}).click();const dialog=page.getByRole('dialog');
 await dialog.getByLabel('Manual refund item',{exact:true}).fill('1');await dialog.getByLabel('Sabab',{exact:true}).fill('Confirmed physical return');await dialog.getByRole('button',{name:'Qaytariladigan summalarni hisoblash',exact:true}).click();
 await expect(dialog.getByRole('status')).toContainText('naqd 60, karta 40, bank 0, qarz 0');
 expect(await db.saleReturn.count({where:{saleId:sale.id}})).toBe(0);expect(await db.payment.count({where:{saleId:sale.id,direction:'out'}})).toBe(0);
 await dialog.getByRole('checkbox',{name:'Qo‘lda qayd etilgan karta/bank to‘lovining qaytariladigan qismini tashqarida haqiqatda qaytardim'}).check();await dialog.getByLabel('Bank qaytarmasi hujjat raqami',{exact:true}).fill('BANK-'+randomUUID());
 await dialog.getByRole('button',{name:'Qaytarishni tasdiqlash',exact:true}).click();await expect(dialog).not.toBeVisible();
 const payments=await db.payment.findMany({where:{saleId:sale.id,direction:'out'}});expect(payments).toHaveLength(2);expect(payments.find(row=>row.paymentType==='cash')?.amount.toString()).toBe('60');expect(payments.find(row=>row.paymentType==='card')?.amount.toString()).toBe('40');expect(payments.find(row=>row.paymentType==='card')?.status).toBe('recorded');
 expect(await db.saleReturn.count({where:{saleId:sale.id}})).toBe(1);expect(external).toEqual([]);
});
test('Production HTTPS: register, open shift, restore local basket and sell cash exactly once',async({page,browserName})=>{
 await page.addInitScript(()=>{window.print=()=>{};})
 const errors:string[]=[];page.on('pageerror',error=>errors.push(error.message))
 const phone='998'+Date.now(),password='test-only-password';phones.push(phone)
 await page.goto('/register')
 await page.getByLabel('Ism va Familiya').fill('Browser Owner')
 await page.getByLabel('Telefon raqam',{exact:true}).fill(phone)
 await page.getByLabel("Do'kon yoki Biznes nomi").fill('Browser POS test')
 await page.getByLabel(/Parol \(/).fill(password)
 await page.getByRole('button',{name:'Hisob yaratish va Boshlash'}).click()
 await expect(page).toHaveURL(/\/dashboard$/)
 const me=await (await page.request.get('/api/auth/me')).json()
 orgs.push(me.data.organization.id);users.push(me.data.user.id)
 const cookie=(await page.context().cookies()).find(cookie=>cookie.name==='pos_session')
 expect(cookie?.httpOnly).toBe(true);expect(cookie?.secure).toBe(true);expect(cookie?.sameSite).toBe('Lax')
 expect(await page.evaluate(()=>localStorage.getItem('pos_token'))).toBeNull()
 const store=(await (await page.request.get(`/api/stores?organizationId=${me.data.organization.id}`)).json()).data[0]
 const productResponse=await page.request.post('/api/products',{headers:{Origin:'https://localhost:3100'},data:{organizationId:me.data.organization.id,name:'Browser coffee',sku:'BROWSER',barcode:'BROWSER',unit:'dona',salePrice:100.25,costPrice:40,minStock:0}})
 expect(productResponse.ok()).toBe(true)
 const product=(await productResponse.json()).data
 const documentResponse=await page.request.post('/api/stock-documents',{headers:{Origin:'https://localhost:3100'},data:{organizationId:me.data.organization.id,storeId:store.id,documentType:'purchase',documentNo:randomUUID(),items:[{productId:product.id,quantity:3,unitCost:40}]}})
 expect(documentResponse.ok()).toBe(true)
 const document=(await documentResponse.json()).data
 expect((await page.request.post(`/api/stock-documents/${document.id}/confirm`,{headers:{Origin:'https://localhost:3100'},data:{}})).ok()).toBe(true)
 await page.goto('/pos')
 await page.getByRole('button',{name:'Smenani ochish',exact:true}).click()
 await expect(page.getByRole('dialog')).toBeVisible()
 await page.getByRole('dialog').getByRole('button',{name:'Smenani ochish: oldindan ko‘rish',exact:true}).click();await page.getByRole('dialog').getByRole('button',{name:'Amalni tasdiqlash',exact:true}).click()
 await expect(page.getByRole('dialog')).not.toBeVisible()
 await page.keyboard.press('F9');await expect(page.getByRole('dialog')).not.toBeVisible()
 await page.keyboard.press('F2');await expect(page.getByLabel('POS mahsulot qidirish',{exact:true})).toBeFocused()
 await page.getByLabel('POS mahsulot qidirish',{exact:true}).fill('no-such-product')
 await page.keyboard.press('F4');await expect(page.getByLabel('POS mahsulot qidirish',{exact:true})).toHaveValue('')
 await page.getByRole('button',{name:'Browser coffee — tezkor ro‘yxat',exact:true}).click()
 await expect(page.getByRole('region',{name:'Tezkor mahsulotlar'})).toBeVisible()
 await page.reload()
 await expect(page.getByRole('button',{name:'Browser coffee — tezkor',exact:true})).toBeVisible()
 // Keyboard-wedge input arriving before the 300ms search debounce must use exact lookup.
 await page.getByLabel('POS mahsulot qidirish',{exact:true}).fill('BROWSER')
 await page.keyboard.press('Enter')
 await expect(page.getByRole('button',{name:"To'lovga o'tish"})).toBeEnabled()
 // Wait for IndexedDB commit rather than an arbitrary UI delay.
 await expect.poll(()=>page.evaluate(async()=>{
  const request=indexedDB.open('shuni-pos-local-v1');const database=await new Promise<IDBDatabase>((resolve,reject)=>{request.onsuccess=()=>resolve(request.result);request.onerror=()=>reject(request.error)})
  const values=await new Promise<{value:{cart:{items:unknown[]}}}[]>(resolve=>{const query=database.transaction('drafts').objectStore('drafts').getAll();query.onsuccess=()=>resolve(query.result)})
  database.close();return values.some(value=>value.value.cart.items.length===1)
 })).toBe(true)
 await page.reload()
 await expect(page.getByRole('button',{name:"To'lovga o'tish"})).toBeEnabled()
 await page.keyboard.press('F9')
 await expect(page.getByRole('dialog')).toBeVisible()
 await page.keyboard.press('Escape');await expect(page.getByRole('dialog')).not.toBeVisible()
 await page.keyboard.press('F9')
 await page.getByRole('button',{name:'Nasiya / Qarz',exact:true}).click()
 await page.getByLabel('Nasiya to‘lash muddati (ixtiyoriy)',{exact:true}).fill('2030-01-01')
 await page.getByRole('button',{name:'Aralash',exact:true}).click()
 await expect(page.getByLabel('Nasiya to‘lash muddati (ixtiyoriy)',{exact:true})).toHaveValue('2030-01-01')
 await page.getByRole('button',{name:'Naqd pul',exact:true}).click()
 await expect(page.getByLabel('Nasiya to‘lash muddati (ixtiyoriy)',{exact:true})).not.toBeVisible()
 await page.getByLabel("Mijoz bergan naqd pul (so'm)").fill('150.25')
 // Simulate a transport failure AFTER the real server committed checkout.
 await page.route('**/api/sales/*/complete',async route=>{await route.fetch();await route.abort()})
 await page.getByRole('button',{name:/Savdoni yakunlash/}).click()
 await expect.poll(async()=>db.sale.count({where:{organizationId:me.data.organization.id,status:'completed'}})).toBe(1)
 await page.reload()
 await page.getByRole('button',{name:'Natijani tekshirish',exact:true}).click()
 await expect(page.getByRole('button',{name:'Natijani tekshirish',exact:true})).not.toBeVisible()
 const sale=await db.sale.findFirstOrThrow({where:{organizationId:me.data.organization.id},include:{payments:true,items:true}})
 expect(sale.cashTendered?.toString()).toBe('150.25');expect(sale.cashChange?.toString()).toBe('50')
 expect(sale.totalAmount.toString()).toBe('100.25');expect(sale.payments.length).toBe(1);expect(sale.payments[0].amount.toString()).toBe('100.25')
 expect(sale.items[0].unit).toBe('dona')
 await page.goto(`/sales/${sale.id}`)
 await page.getByRole('button',{name:'Chekni chop etish',exact:true}).click()
 await expect(page.locator('#printable-receipt')).toContainText('CHEK NUSXASI')
 for(const paper of ['58','80']){
  await page.getByLabel('Chek qog‘ozi eni',{exact:true}).selectOption(paper)
  if(paper==='58'){
   let originalPrint='',replayedPrint=''
   await page.route('**/api/sales/*/print-requests',async route=>{originalPrint=route.request().postData()??'';await route.fetch();await route.abort()})
   await page.getByRole('dialog').getByRole('button',{name:'Chekni chop etish',exact:true}).click()
   await expect(page.getByRole('dialog').getByRole('alert')).toBeVisible()
   await expect(page.getByLabel('Chek qog‘ozi eni',{exact:true})).toBeDisabled()
   expect(await db.auditLog.count({where:{organizationId:me.data.organization.id,entityId:sale.id,action:'receipt_print_requested'}})).toBe(1)
   await page.unroute('**/api/sales/*/print-requests')
   await page.route('**/api/sales/*/print-requests',async route=>{replayedPrint=route.request().postData()??'';await route.continue()})
   await page.getByRole('dialog').getByRole('button',{name:'Chekni chop etish',exact:true}).click()
   await expect(page.locator('iframe[title="Chek chop etish"]')).toHaveCount(1)
   expect(JSON.parse(replayedPrint)).toEqual(JSON.parse(originalPrint))
   await page.unroute('**/api/sales/*/print-requests')
  }else await page.getByRole('dialog').getByRole('button',{name:'Chekni chop etish',exact:true}).click()
  await expect(page.locator('iframe[title="Chek chop etish"]')).toHaveCount(paper==='58'?1:2)
  const frame=page.locator('iframe[title="Chek chop etish"]').last()
  await expect(frame).toBeAttached()
  const document=await frame.getAttribute('srcdoc');expect(document).toContain(`size:${paper}mm 297mm`);expect(document).toContain('CHEK NUSXASI');expect(document).toContain(sale.receiptNo)
  const pdfPage=await page.context().newPage();await pdfPage.setContent(document!);if(browserName==='chromium'){const pdf=await pdfPage.pdf({preferCSSPageSize:true});expect(pdf.subarray(0,4).toString()).toBe('%PDF');}await pdfPage.close()
 }
 await page.getByRole('dialog').getByRole('button',{name:'Yopish',exact:true}).click()
 await page.getByRole('button',{name:'Qaytarish',exact:true}).click()
 const disposition=page.getByLabel(`${sale.items[0].productName}: qaytarilgan tovar holati`,{exact:true})
 await expect(disposition).toHaveValue('sellable')
 await disposition.selectOption('damaged');await expect(disposition).toHaveValue('damaged')
 await disposition.selectOption('write_off');await expect(disposition).toHaveValue('write_off')
 await expect(page.getByText('Brak va hisobdan chiqarilgan tovar qaytarish hujjatida qayd etiladi; alohida brak omboriga ko‘chirilmaydi.')).toBeVisible()
 expect(await db.inventoryMovement.count({where:{sourceId:sale.id}})).toBe(1)
 expect((await db.inventoryBalance.findUniqueOrThrow({where:{storeId_productId:{storeId:store.id,productId:product.id}}})).quantity.toString()).toBe('2')
 const adjustmentNumber='ADJUST-'+randomUUID()
 const adjustmentResponse=await page.request.post('/api/stock-documents',{headers:{Origin:'https://localhost:3100'},data:{organizationId:me.data.organization.id,storeId:store.id,documentType:'adjustment',documentNo:adjustmentNumber,note:'Browser reversal check',items:[{productId:product.id,quantity:2,unitCost:40}]}})
 expect(adjustmentResponse.ok()).toBe(true)
 const adjustment=(await adjustmentResponse.json()).data
 expect((await page.request.post(`/api/stock-documents/${adjustment.id}/confirm`,{headers:{Origin:'https://localhost:3100'},data:{}})).ok()).toBe(true)
 await page.goto('/inventory')
 await page.getByRole('button',{name:'Hujjatlar (Kirim/Tuzatish)',exact:true}).click()
 await page.getByRole('row').filter({hasText:adjustmentNumber}).getByRole('button',{name:'Qarshi hujjat',exact:true}).click()
 await page.getByLabel('Qaytarish sababi').fill('Browser stock correction')
 await page.getByRole('button',{name:'Qarshi hujjatni tasdiqlash',exact:true}).click()
 await expect(page.getByRole('dialog')).not.toBeVisible()
 await expect(page.getByRole('row').filter({hasText:adjustmentNumber})).toContainText('Qaytarilgan:')
 expect(await db.stockDocument.count({where:{reversalOfId:adjustment.id,status:'confirmed'}})).toBe(1)
 expect((await db.inventoryBalance.findUniqueOrThrow({where:{storeId_productId:{storeId:store.id,productId:product.id}}})).quantity.toString()).toBe('2')
 const destinationResponse=await page.request.post('/api/stores',{headers:{Origin:'https://localhost:3100'},data:{organizationId:me.data.organization.id,name:'Browser destination'}})
 expect(destinationResponse.ok()).toBe(true)
 const destination=(await destinationResponse.json()).data
 const transferResponse=await page.request.post('/api/transfers',{headers:{Origin:'https://localhost:3100'},data:{organizationId:me.data.organization.id,fromStoreId:store.id,toStoreId:destination.id,items:[{productId:product.id,quantity:1,unitCost:40}]}})
 expect(transferResponse.ok()).toBe(true)
 const transfer=(await transferResponse.json()).data
 expect((await page.request.post(`/api/transfers/${transfer.id}/send`,{headers:{Origin:'https://localhost:3100'},data:{}})).ok()).toBe(true)
 await page.goto('/inventory/transfers')
 page.once('dialog',dialog=>dialog.accept('Goods physically returned to source'))
 await page.getByRole('button',{name:'Yo‘ldagi qismini qaytarish',exact:true}).click()
 await expect(page.getByText('Qabul/qaytarish bilan yopilgan',{exact:true})).toBeVisible()
 expect((await db.stockTransferItem.findFirstOrThrow({where:{stockTransferId:transfer.id}})).returnedQuantity.toString()).toBe('1')
 expect((await db.inventoryBalance.findUniqueOrThrow({where:{storeId_productId:{storeId:store.id,productId:product.id}}})).quantity.toString()).toBe('2')
 await page.goto('/inventory/counts')
 await page.getByRole('button',{name:'Sanashni boshlash',exact:true}).click()
 await expect(page.getByRole('heading',{name:/Sanash davom etmoqda —/})).toBeVisible()
 await expect(page.getByRole('cell',{name:'Yashirilgan',exact:true})).toBeVisible()
 await page.getByLabel('BROWSER sanalgan miqdor',{exact:true}).fill('1')
 await page.getByRole('button',{name:'Sanalgan miqdorlarni saqlash',exact:true}).click()
 await expect(page.getByText(/1-sanash: 1/)).toBeVisible()
 await page.getByRole('button',{name:'Tekshirishga yuborish',exact:true}).click()
 await expect(page.getByRole('heading',{name:/Tekshirish va qayta sanash —/})).toBeVisible()
 await expect(page.getByRole('cell',{name:'2',exact:true})).toBeVisible()
 await page.getByLabel('BROWSER sanalgan miqdor',{exact:true}).fill('1')
 await page.getByRole('button',{name:'Sanalgan miqdorlarni saqlash',exact:true}).click()
 await expect(page.getByText(/2-sanash: 1/)).toBeVisible()
 await page.getByLabel('Tasdiqlash yoki bekor qilish sababi').fill('Browser recount confirmed shortage')
 await page.getByRole('button',{name:'Farqni tasdiqlash',exact:true}).click()
 await expect(page.getByRole('heading',{name:/Tasdiqlangan —/})).toBeVisible()
 const count=await db.stockCount.findFirstOrThrow({where:{organizationId:me.data.organization.id},include:{lines:{include:{readings:true}}}})
 expect(count.status).toBe('approved');expect(count.adjustmentId).toBeTruthy();expect(count.lines[0].readings.length).toBe(2)
 expect(await db.stockFreeze.count({where:{countId:count.id}})).toBe(0)
 expect((await db.inventoryBalance.findUniqueOrThrow({where:{storeId_productId:{storeId:store.id,productId:product.id}}})).quantity.toString()).toBe('1')
 const customerResponse=await page.request.post('/api/customers',{headers:{Origin:'https://localhost:3100'},data:{organizationId:me.data.organization.id,fullName:'Browser debtor',phone:'998'+Date.now().toString().slice(-9),creditLimit:1000}})
 expect(customerResponse.ok()).toBe(true)
 const customer=(await customerResponse.json()).data
 const creditDraftResponse=await page.request.post('/api/sales',{headers:{Origin:'https://localhost:3100'},data:{operationId:randomUUID(),organizationId:me.data.organization.id,storeId:store.id,registerId:sale.registerId,shiftId:sale.shiftId,customerId:customer.id,items:[{productId:product.id,quantity:1}]}})
 expect(creditDraftResponse.ok()).toBe(true)
 const creditDraft=(await creditDraftResponse.json()).data
 const creditResponse=await page.request.post(`/api/sales/${creditDraft.id}/complete`,{headers:{Origin:'https://localhost:3100'},data:{payments:[{paymentType:'credit',amount:'100.25'}]}})
 expect(creditResponse.ok()).toBe(true)
 const creditSale=(await creditResponse.json()).data

 await page.goto(`/customers/${customer.id}`)
 await expect(page.getByRole('link',{name:creditSale.receiptNo,exact:true})).toBeVisible()
 await page.getByLabel('Qarz hujjati summasi',{exact:true}).fill('100.25')
 await page.getByLabel('Qarz hujjati sababi',{exact:true}).fill('Verified imported opening debt')
 await page.getByLabel('Qarz to‘lash muddati',{exact:true}).fill(new Date(Date.now()+30*86400000).toISOString().slice(0,10))
 let openingPayload=''
 const ledgerPattern='**/api/customers/*/ledger'
 await page.route(ledgerPattern,async route=>{if(route.request().method()==='POST'){openingPayload=route.request().postData()??'';await route.fetch();await route.abort()}else await route.continue()})
 await page.getByRole('button',{name:'Qarz hujjatini saqlash',exact:true}).click()
 await expect(page.getByRole('button',{name:'Oldingi qarz hujjatini tekshirish',exact:true})).toBeVisible()
 expect(await db.debtEntry.count({where:{customerId:customer.id,sourceType:'opening_debt'}})).toBe(1)
 await page.reload()
 await expect(page.getByRole('button',{name:'Oldingi qarz hujjatini tekshirish',exact:true})).toBeVisible()
 await expect(page.getByLabel('Qarz hujjati summasi',{exact:true})).toHaveValue('100.25')
 await expect(page.getByLabel('Qarz hujjati sababi',{exact:true})).toHaveValue('Verified imported opening debt')
 await expect(page.getByLabel('Qarz hujjati summasi',{exact:true})).toBeDisabled()
 await page.unroute(ledgerPattern)
 let replayOpeningPayload=''
 await page.route(ledgerPattern,async route=>{if(route.request().method()==='POST')replayOpeningPayload=route.request().postData()??'';await route.continue()})
 await page.getByRole('button',{name:'Oldingi qarz hujjatini tekshirish',exact:true}).click()
 await expect(page.getByLabel('Qarz hujjati summasi',{exact:true})).toHaveValue('')
 expect(JSON.parse(replayOpeningPayload)).toEqual(JSON.parse(openingPayload))
 expect(await db.debtEntry.count({where:{customerId:customer.id,sourceType:'opening_debt'}})).toBe(1)
 const downloading=page.waitForEvent('download')
 await page.getByRole('button',{name:'Qarz ko‘chirmasini CSV yuklash',exact:true}).click()
 const download=await downloading
 expect(download.suggestedFilename()).toBe(`customer-debt-${customer.id}.csv`)
 expect(await download.failure()).toBeNull()
 const commercialDownload=page.waitForEvent('download')
 await page.getByRole('button',{name:'To‘liq mijoz ko‘chirmasini CSV yuklash',exact:true}).click()
 const completeDownload=await commercialDownload
 expect(completeDownload.suggestedFilename()).toBe(`customer-statement-${customer.id}.csv`)
 expect(await completeDownload.failure()).toBeNull()
 const printDownload=page.waitForEvent('download')
 await page.getByRole('button',{name:'Qarz ko‘chirmasini chop etish fayli',exact:true}).click()
 const printableDownload=await printDownload
 expect(printableDownload.suggestedFilename()).toBe(`customer-debt-${customer.id}.html`)
 expect(await printableDownload.failure()).toBeNull()
 const stream=await printableDownload.createReadStream()
 if(!stream)throw new Error('Printable file stream missing')
 let printableHtml=''
 for await(const chunk of stream)printableHtml+=chunk.toString()
 const preview=await page.context().newPage()
 await preview.setContent(printableHtml)
 await expect(preview.getByRole('heading',{name:'Mijoz qarz ko‘chirmasi',exact:true})).toBeVisible()
 await expect(preview.locator('tbody tr[data-entry-id]')).toHaveCount(2)
 if(browserName==='chromium'){const pdf=await preview.pdf({preferCSSPageSize:true});expect(pdf.subarray(0,4).toString()).toBe('%PDF')}
 await preview.close()
 await page.getByLabel('Qarz hujjati turi',{exact:true}).selectOption('write_off')
 await page.getByLabel('Qarz hujjati summasi',{exact:true}).fill('20.25')
 await page.getByLabel('Qarz hujjati sababi',{exact:true}).fill('Owner approved partial waiver')
 await page.getByRole('button',{name:'Qarz hujjatini saqlash',exact:true}).click()
 await expect(page.getByRole('cell').filter({hasText:'Qarzni hisobdan chiqarish'})).toBeVisible()
 expect((await db.debtEntry.aggregate({where:{customerId:customer.id},_sum:{amount:true}}))._sum.amount?.toString()).toBe('180.25')
 await page.goto('/customers')
 await page.getByRole('row').filter({hasText:'Browser debtor'}).getByRole('link',{name:'Qarzni undirish',exact:true}).click()
 await expect(page).toHaveURL(new RegExp('/customers/'+customer.id+'$'))
 await page.getByLabel("To'lov summasi (so'm) *",{exact:true}).fill('100.25')
 await page.getByLabel('Qarzni taqsimlash usuli',{exact:true}).selectOption('explicit')
 await page.getByLabel('Chek: '+creditSale.receiptNo+' — ajratiladigan summa',{exact:true}).fill('100.25')
 let originalCollectionPayload=''
 await page.route('**/api/payments/credit',async route=>{originalCollectionPayload=route.request().postData()??'';await route.fetch();await route.abort()})
 await page.getByRole('dialog').getByRole('button',{name:'Tasdiqlash',exact:true}).click()
 await expect(page.getByRole('button',{name:'Oldingi to‘lovni tekshirish',exact:true})).toBeVisible()
 await expect(page.getByLabel('Qarzni taqsimlash usuli',{exact:true})).toBeDisabled()
 await expect(page.getByLabel('Chek: '+creditSale.receiptNo+' — ajratiladigan summa',{exact:true})).toBeDisabled()
 await expect.poll(()=>db.payment.count({where:{customerId:customer.id,note:'debt_collection'}})).toBe(1)
 const closed=await page.request.post(`/api/shifts/${sale.shiftId}`,{headers:{Origin:'https://localhost:3100'},data:{countedCash:200.50}})
 expect(closed.ok()).toBe(true)
 expect((await db.shift.findUniqueOrThrow({where:{id:sale.shiftId}})).expectedCash?.toString()).toBe('200.5')
 // The pending intent must survive a full reload after the original shift closed.
 await page.reload()
 await expect(page.getByRole('dialog')).toBeVisible()
 await expect(page.getByRole('button',{name:'Oldingi to‘lovni tekshirish',exact:true})).toBeVisible()
 await expect(page.getByLabel('Qarzni taqsimlash usuli',{exact:true})).toHaveValue('explicit')
 await expect(page.getByLabel("To'lov summasi (so'm) *",{exact:true})).toHaveValue('100.25')
 await page.unroute('**/api/payments/credit')
 let replayCollectionPayload=''
 await page.route('**/api/payments/credit',async route=>{replayCollectionPayload=route.request().postData()??'';await route.continue()})
 await page.getByRole('button',{name:'Oldingi to‘lovni tekshirish',exact:true}).click()
 await expect(page.getByRole('dialog')).not.toBeVisible()
 expect(await db.payment.count({where:{customerId:customer.id,note:'debt_collection'}})).toBe(1)
 expect((await db.debtEntry.aggregate({where:{customerId:customer.id},_sum:{amount:true}}))._sum.amount?.toString()).toBe('80')
 expect(JSON.parse(replayCollectionPayload)).toEqual(JSON.parse(originalCollectionPayload))
 expect((await db.debtEntry.aggregate({where:{customerId:customer.id,saleId:creditSale.id},_sum:{amount:true}}))._sum.amount?.toString()).toBe('0')
 await page.reload()
 await expect(page.getByRole('heading',{name:'Browser debtor',exact:true})).toBeVisible()
 await expect(page.getByText(/Hujjatlarga taqsimlanmagan qarz:/)).toContainText('0');await expect(page.getByText(/Muddati kelmagan qarz:/)).toContainText('80')
 await expect(page.getByRole('dialog')).not.toBeVisible()
 // Recover a real refund after its server commit and after its original shift closes.
 const newShiftResponse=await page.request.post('/api/shifts',{headers:{Origin:'https://localhost:3100'},data:{registerId:sale.registerId,organizationUserId:me.data.user.organizationUserId,openingCash:100.25,operationId:randomUUID()}})
 expect(newShiftResponse.ok()).toBe(true)
 const refundShift=(await newShiftResponse.json()).data
 await page.goto(`/sales/${sale.id}`)
 await page.getByRole('button',{name:'Qaytarish',exact:true}).click()
 await page.getByLabel('Browser coffee',{exact:true}).fill('1')
 await page.getByLabel('Browser coffee: qaytarilgan tovar holati',{exact:true}).selectOption('damaged')
 await page.getByLabel('Sabab',{exact:true}).fill('Damaged refund recovery')
 let originalReturnPayload=''
 await page.route('**/api/sales/*/returns',async route=>{originalReturnPayload=route.request().postData()??'';await route.fetch();await route.abort()})
 await page.getByRole('button',{name:'Qaytarishni tasdiqlash',exact:true}).click()
 await expect(page.getByRole('button',{name:'Oldingi qaytarishni tekshirish',exact:true})).toBeVisible()
 await expect.poll(()=>db.saleReturn.count({where:{saleId:sale.id}})).toBe(1)
 expect((await page.request.post(`/api/shifts/${refundShift.id}`,{headers:{Origin:'https://localhost:3100'},data:{countedCash:0}})).ok()).toBe(true)
 await page.reload()
 await expect(page.getByRole('dialog')).toBeVisible()
 await expect(page.getByLabel('Browser coffee: qaytarilgan tovar holati',{exact:true})).toHaveValue('damaged')
 await expect(page.getByLabel('Browser coffee',{exact:true})).toBeDisabled()
 await expect(page.getByLabel('Sabab',{exact:true})).toHaveValue('Damaged refund recovery')
 await page.unroute('**/api/sales/*/returns')
 let replayReturnPayload=''
 await page.route('**/api/sales/*/returns',async route=>{replayReturnPayload=route.request().postData()??'';await route.continue()})
 await page.getByRole('button',{name:'Oldingi qaytarishni tekshirish',exact:true}).click()
 await expect(page.getByRole('dialog')).not.toBeVisible()
 expect(JSON.parse(replayReturnPayload)).toEqual(JSON.parse(originalReturnPayload))
 expect(await db.saleReturn.count({where:{saleId:sale.id}})).toBe(1)
 expect(await db.payment.count({where:{saleId:sale.id,direction:'out'}})).toBe(1)
 expect(await db.inventoryMovement.count({where:{sourceType:'return',sourceId:(await db.saleReturn.findFirstOrThrow({where:{saleId:sale.id}})).id}})).toBe(0)
 await page.reload();await expect(page.getByRole('dialog')).not.toBeVisible()
 await expect(page.getByText('Damaged refund recovery',{exact:false})).toBeVisible()
 await expect(page.getByText('Brak — sotiladigan qoldiqqa qo‘shilmagan',{exact:false})).toBeVisible()
 await expect(page.getByText('Qiymat qaytarilgan tovar summasi; uning hammasi naqd refund degani emas.',{exact:true})).toBeVisible()
 const returnDownload=page.waitForEvent('download');await page.getByRole('button',{name:'Qaytarma chek HTML yuklash',exact:true}).click();const returnHtml=await returnDownload;
 const returnMarkup=await (await import('node:fs/promises')).readFile((await returnHtml.path())!,'utf8');expect(returnMarkup).toContain('QAYTARMA CHEK — NUSXA');expect(returnMarkup).toContain(sale.id);expect(returnMarkup).toContain('Damaged refund recovery');expect(returnMarkup).toContain('tasdiq: Do&#39;kon egasi');expect((await db.saleReturn.findFirstOrThrow({where:{saleId:sale.id}})).approvedRole).toBe('owner');

 await page.getByRole('link',{name:'Audit tarixi',exact:true}).click()
 await expect(page.getByRole('heading',{name:'Audit tarixi',exact:true})).toBeVisible()
 await page.getByLabel('Resurs turi (masalan SaleReturn)',{exact:true}).fill('SaleReturn')
 await page.getByLabel('Amal (masalan returned)',{exact:true}).fill('returned')
 await page.getByRole('button',{name:'Filtrlash',exact:true}).click()
 await expect(page.getByRole('row').filter({hasText:'SaleReturn'})).toHaveCount(1)
 await expect(page.getByRole('row').filter({hasText:'SaleReturn'})).toContainText('Browser Owner')
 for(const [path,label,contains] of [['/products','Katalogni CSV yuklash','Browser coffee'],['/customers','Mijozlarni CSV yuklash','Browser debtor']] as const){
  await page.goto(path);const downloadPromise=page.waitForEvent('download');await page.getByRole('button',{name:label,exact:true}).click();const download=await downloadPromise;const stream=await download.createReadStream();const chunks:Buffer[]=[];for await(const chunk of stream!)chunks.push(Buffer.from(chunk));expect(Buffer.concat(chunks).toString('utf8')).toContain(contains)
 }
 await page.goto('/reports')
 for(const tab of ['Savdolar hisoboti','Mahsulotlar hisoboti']){
  await page.getByRole('button',{name:tab,exact:true}).click();const downloadPromise=page.waitForEvent('download');await page.getByRole('button',{name:'To‘liq hisobotni CSV yuklash',exact:true}).click();const download=await downloadPromise;expect(download.suggestedFilename()).toMatch(/report-.*\.csv$/)
 }
 // Archive/recovery is exercised through real manager screens, preserving sale history.
 const archiveCustomer=await (await page.request.post('/api/customers',{headers:{Origin:'https://localhost:3100'},data:{organizationId:me.data.organization.id,fullName:'Archive zero customer',phone:'123456789',creditLimit:0}})).json()
 const archiveCategory=await (await page.request.post('/api/categories',{headers:{Origin:'https://localhost:3100'},data:{organizationId:me.data.organization.id,name:'Archive category'}})).json()
 expect(archiveCustomer.success).toBe(true);expect(archiveCategory.success).toBe(true)
 await page.goto('/archive')
 for(const [kind,name] of [['products','Browser coffee'],['customers','Archive zero customer'],['categories','Archive category']] as const){
  await page.getByLabel('Arxiv turi',{exact:true}).selectOption(kind)
  await page.getByLabel('Holat',{exact:true}).selectOption('active')
  const row=page.getByRole('row').filter({hasText:name});await expect(row).toBeVisible()
  await row.getByRole('button',{name:'Arxivlash',exact:true}).click();await expect(row).not.toBeVisible()
  await page.getByLabel('Holat',{exact:true}).selectOption('archived');await expect(row).toBeVisible()
  await row.getByRole('button',{name:'Tiklash',exact:true}).click();await expect(row).not.toBeVisible()
 }
 expect(await db.sale.count({where:{id:sale.id}})).toBe(1)
 await page.getByLabel('Arxiv turi',{exact:true}).selectOption('customers');await page.getByLabel('Holat',{exact:true}).selectOption('active')
 await page.getByRole('row').filter({hasText:'Browser debtor'}).getByRole('button',{name:'Arxivlash',exact:true}).click()
 await expect(page.getByText(/Mijozning qarz\/avans qoldig‘i bor; avval uni hal qiling/)).toBeVisible()
 await page.goto('/suppliers');await page.getByRole('button',{name:'Yangi yetkazib beruvchi',exact:true}).click()
 await page.getByRole('dialog').getByLabel('Nomi',{exact:true}).fill('Browser supplier')
 await page.getByRole('dialog').getByLabel('Telefon',{exact:true}).fill('123456789')
 await page.getByRole('dialog').getByRole('button',{name:'Saqlash',exact:true}).click();await expect(page.getByRole('dialog')).not.toBeVisible()
 const supplierRow=page.getByRole('row').filter({hasText:'Browser supplier'});await expect(supplierRow).toBeVisible()
 await supplierRow.getByRole('button',{name:'Tahrirlash',exact:true}).click();await page.getByRole('dialog').getByLabel('STIR',{exact:true}).fill('987654321');await page.getByRole('dialog').getByRole('button',{name:'Saqlash',exact:true}).click();await expect(supplierRow).toContainText('987654321')
 await supplierRow.getByRole('button',{name:'Arxivlash',exact:true}).click();await expect(supplierRow).not.toBeVisible();await page.getByLabel('Holat',{exact:true}).selectOption('archived');await expect(supplierRow).toBeVisible();await supplierRow.getByRole('button',{name:'Tiklash',exact:true}).click();await expect(supplierRow).not.toBeVisible();await page.getByLabel('Holat',{exact:true}).selectOption('active');await expect(supplierRow).toBeVisible()
 for(const [path,contains] of [['/suppliers','Browser supplier'],['/inventory/movements','Browser coffee'],['/shifts','Browser Owner'],['/audit','receipt_print_requested']] as const){
  await page.goto(path);const downloadPromise=page.waitForEvent('download');await page.getByRole('button',{name:'CSV eksport',exact:true}).click();const download=await downloadPromise;const stream=await download.createReadStream();const chunks:Buffer[]=[];for await(const chunk of stream!)chunks.push(Buffer.from(chunk));expect(Buffer.concat(chunks).toString('utf8')).toContain(contains)
 }
 await page.goto('/inventory/movements');await page.getByLabel('Manba ID',{exact:true}).fill(document.id);await page.getByRole('button',{name:'Filtrlash',exact:true}).click();await expect(page.getByRole('row').filter({hasText:document.id})).toHaveCount(1)
 expect(await db.auditLog.count({where:{organizationId:me.data.organization.id,entityId:sale.id,action:'receipt_print_requested'}})).toBe(2)
 const secondContext=await page.context().browser()!.newContext({ignoreHTTPSErrors:true})
 try{
  const login=await secondContext.request.post('https://localhost:3100/api/auth/login',{headers:{Origin:'https://localhost:3100'},data:{phone,password}});expect(login.ok()).toBe(true)
  await page.getByRole('link',{name:'Faol sessiyalar',exact:true}).click()
  await expect(page.getByRole('heading',{name:'Faol sessiyalar',exact:true})).toBeVisible()
  await expect(page.getByText('Joriy sessiya',{exact:true})).toBeVisible()
  await page.getByRole('button',{name:'Sessiyani bekor qilish',exact:true}).click()
  await expect(page.getByRole('button',{name:'Sessiyani bekor qilish',exact:true})).not.toBeVisible()
  expect((await secondContext.request.get('https://localhost:3100/api/auth/me')).status()).toBe(401)
  expect((await page.request.get('/api/auth/me')).ok()).toBe(true)
 }finally{await secondContext.close()}
 let passwordTotp:TOTP|undefined
 if(process.env.AUTH_CRITICAL_MFA_REQUIRED==='true'){
  const factor=await page.request.post('/api/auth/totp/enroll',{headers:{Origin:'https://localhost:3100'},data:{password}});expect(factor.ok()).toBe(true)
  const enrollment=(await factor.json()).data;passwordTotp=URI.parse(enrollment.provisioningUri) as TOTP
  const confirmed=await page.request.post('/api/auth/totp/confirm',{headers:{Origin:'https://localhost:3100'},data:{factorId:enrollment.factorId,code:passwordTotp.generate({timestamp:Date.now()-30000})}});expect(confirmed.ok()).toBe(true)
 }
 await page.getByLabel('Joriy parol',{exact:true}).fill(password)
 await page.getByLabel('Yangi parol',{exact:true}).fill('browser-new-password')
 await page.getByLabel('Yangi parolni tasdiqlash',{exact:true}).fill('different-password')
 await page.getByRole('button',{name:'Parolni yangilash',exact:true}).click()
 await expect(page.getByText('Yangi parollar bir xil emas',{exact:true})).toBeVisible()
 await page.getByLabel('Yangi parolni tasdiqlash',{exact:true}).fill('browser-new-password')
 await page.getByRole('button',{name:'Parolni yangilash',exact:true}).click()
 if(passwordTotp){const proof=page.getByRole('dialog',{name:'Muhim amalni tasdiqlash',exact:true});await expect(proof).toBeVisible();await proof.getByLabel('Muhim amal uchun Authenticator kodi',{exact:true}).fill(passwordTotp.generate());await proof.getByRole('button',{name:'Amalni tasdiqlash',exact:true}).click()}
 await expect(page).toHaveURL(/\/login$/)
 expect((await page.request.get('/api/auth/me')).status()).toBe(401)
 expect((await page.request.post('/api/auth/login',{headers:{Origin:'https://localhost:3100'},data:{phone,password}})).status()).toBe(401)
 expect((await page.request.post('/api/auth/login',{headers:{Origin:'https://localhost:3100'},data:{phone,password:'browser-new-password'}})).ok()).toBe(true)
 await page.goto('/security')
 const localGuardId=randomUUID()
 await page.evaluate(async({id,organizationId,userId})=>{
  const request=indexedDB.open('shuni-pos-local-v1');const database=await new Promise<IDBDatabase>((resolve,reject)=>{request.onsuccess=()=>resolve(request.result);request.onerror=()=>reject(request.error)})
  await new Promise<void>((resolve,reject)=>{const tx=database.transaction('operations','readwrite');tx.objectStore('operations').add({id,scope:{organizationId,userId,deviceId:localStorage.getItem('pos_device_id')},type:'debt.document',payload:{customerId:id},state:'pending',createdAt:new Date().toISOString()});tx.oncomplete=()=>resolve();tx.onerror=()=>reject(tx.error)});database.close()
 },{id:localGuardId,organizationId:me.data.organization.id,userId:me.data.user.id})
 await page.getByRole('button',{name:'Barcha sessiyalardan chiqish',exact:true}).click()
 await expect(page.getByText('Sinxronlanmagan amallar bor; avval ularning natijasini tekshiring',{exact:true})).toBeVisible()
 expect((await page.request.get('/api/auth/me')).ok()).toBe(true)
 // Only remove the synthetic test fixture; no real economic intent is discarded.
 await page.evaluate(async id=>{
  const request=indexedDB.open('shuni-pos-local-v1');const database=await new Promise<IDBDatabase>(resolve=>{request.onsuccess=()=>resolve(request.result)})
  await new Promise<void>(resolve=>{const tx=database.transaction('operations','readwrite');tx.objectStore('operations').delete(id);tx.oncomplete=()=>resolve()});database.close()
 },localGuardId)
 const thirdContext=await page.context().browser()!.newContext({ignoreHTTPSErrors:true})
 try{
  expect((await thirdContext.request.post('https://localhost:3100/api/auth/login',{headers:{Origin:'https://localhost:3100'},data:{phone,password:'browser-new-password'}})).ok()).toBe(true)
  await page.getByRole('button',{name:'Barcha sessiyalardan chiqish',exact:true}).click();await expect(page).toHaveURL(/\/login$/)
  expect((await thirdContext.request.get('https://localhost:3100/api/auth/me')).status()).toBe(401)
  expect((await page.request.get('/api/auth/me')).status()).toBe(401)
 }finally{await thirdContext.close()}
 expect(errors).toEqual([])
})

test('Production HTTPS: catalog management, supplier purchase history and complete inventory exports',async({page})=>{
 const phone='998'+Date.now();phones.push(phone)
 await page.goto('/register');await page.getByLabel('Ism va Familiya').fill('Catalog browser owner');await page.getByLabel('Telefon raqam',{exact:true}).fill(phone);await page.getByLabel("Do'kon yoki Biznes nomi").fill('Catalog browser POS');await page.getByLabel(/Parol \(/).fill('test-only-password');await page.getByRole('button',{name:'Hisob yaratish va Boshlash'}).click();await expect(page).toHaveURL(/\/dashboard$/)
 const me=await (await page.request.get('/api/auth/me')).json(),org=me.data.organization.id,userId=me.data.user.id;orgs.push(org);users.push(userId)
 const origin={Origin:'https://localhost:3100'}
 const store=(await (await page.request.get(`/api/stores?organizationId=${org}`)).json()).data[0]
 const downloadText=async(label:string)=>{const pending=page.waitForEvent('download');await page.getByRole('button',{name:label,exact:true}).click();const download=await pending,stream=await download.createReadStream(),chunks:Buffer[]=[];for await(const chunk of stream!)chunks.push(Buffer.from(chunk));return Buffer.concat(chunks).toString('utf8')}
 await page.goto('/products/categories');await page.getByLabel('Kategoriya nomi',{exact:true}).fill('Browser category');await page.getByLabel('Tartib raqami',{exact:true}).fill('7');await page.getByRole('button',{name:'Saqlash',exact:true}).click()
 const categoryRow=page.getByRole('row').filter({hasText:'Browser category'});await expect(categoryRow).toBeVisible();await categoryRow.getByRole('button',{name:'Tahrirlash',exact:true}).click();await page.getByLabel('Kategoriya nomi',{exact:true}).fill('Browser category edited');await page.getByRole('button',{name:'Saqlash',exact:true}).click();await expect(categoryRow).toContainText('Browser category edited')
 await page.getByLabel('Kategoriya qidirish',{exact:true}).fill('edited');await page.getByRole('button',{name:'Qidirish',exact:true}).click();expect(await downloadText('CSV eksport')).toContain('Browser category edited')
 await categoryRow.getByRole('button',{name:'Arxivlash',exact:true}).click();await expect(categoryRow).not.toBeVisible();await page.getByLabel('Kategoriya holati',{exact:true}).selectOption('archived');await expect(categoryRow).toBeVisible();await categoryRow.getByRole('button',{name:'Tiklash',exact:true}).click();await expect(categoryRow).not.toBeVisible()
 const category=await db.category.findFirstOrThrow({where:{organizationId:org,name:'Browser category edited'}})
 await db.unit.createMany({data:Array.from({length:25},(_,index)=>({organizationId:org,code:'browser_u'+index,name:'Paging unit '+index,precision:0}))})
 await page.goto('/products/units');await expect(page.getByText('1 / 2',{exact:true})).toBeVisible();await page.getByRole('button',{name:'Keyingi',exact:true}).click();await expect(page.getByText('2 / 2',{exact:true})).toBeVisible()
 await page.getByLabel('Kod',{exact:true}).fill('browser_unit');await page.getByLabel('Nomi',{exact:true}).fill('Browser custom unit');await page.getByLabel('Kasr aniqligi',{exact:true}).fill('2');await page.getByRole('button',{name:'Saqlash',exact:true}).click();await expect(page.getByLabel('Kod',{exact:true})).toHaveValue('')
 await page.getByLabel('Birlik qidirish',{exact:true}).fill('custom');await page.getByRole('button',{name:'Qidirish',exact:true}).click();const unitRow=page.getByRole('row').filter({hasText:'Browser custom unit'});await expect(unitRow).toBeVisible();expect(await downloadText('CSV eksport')).toContain('browser_unit')
 await unitRow.getByRole('button',{name:'Arxivlash',exact:true}).click();await expect(unitRow).toContainText('(arxiv)');await unitRow.getByRole('button',{name:'Faollashtirish',exact:true}).click();await expect(unitRow).not.toContainText('(arxiv)')
 const productResponse=await page.request.post('/api/products',{headers:origin,data:{organizationId:org,name:'Browser catalog product',sku:'CATALOG-BROWSER',barcode:'CATALOG-BROWSER',unit:'dona',salePrice:5,costPrice:2,minStock:3,categoryId:category.id}});expect(productResponse.ok()).toBe(true);const product=(await productResponse.json()).data
 await page.goto(`/products/${product.id}`);await page.getByLabel('Qo‘shimcha barkod',{exact:true}).fill('BROWSER-EXTRA-MANUAL');await page.getByRole('button',{name:'Qo‘shish',exact:true}).click();await expect(page.getByText('BROWSER-EXTRA-MANUAL',{exact:true})).toBeVisible()
 await page.getByRole('button',{name:'Ichki barkod yaratish',exact:true}).click();await expect(page.getByText(/^INT-[a-f0-9]{16}$/)).toBeVisible()
 await page.getByLabel('Etiketka soni',{exact:true}).fill('2');const labelDownload=page.waitForEvent('download');await page.getByRole('button',{name:'Etiketka',exact:true}).first().click();const labelFile=await labelDownload;expect(labelFile.suggestedFilename()).toMatch(/\.html$/)
 await db.productBarcode.createMany({data:Array.from({length:60},(_,index)=>({organizationId:org,productId:product.id,value:'BROWSER-EXTRA-'+index}))})
 await page.reload();await page.getByLabel('Barkod qidirish',{exact:true}).fill('BROWSER-EXTRA');await page.getByRole('button',{name:'Qidirish',exact:true}).click();await expect(page.getByText('1 / 2',{exact:true})).toBeVisible();await page.getByRole('button',{name:'Keyingi',exact:true}).click();await expect(page.getByText('2 / 2',{exact:true})).toBeVisible();const barcodeCsv=await downloadText('Barkodlarni CSV yuklash');expect((barcodeCsv.match(/^"[0-9a-f-]{36}",/gm)??[]).length).toBe(61)
 const supplier=await db.supplier.create({data:{organizationId:org,name:'Browser history supplier',phone:'123456789',tin:'123456789'}})
 const purchase=async(number:string,confirm=true)=>{const response=await page.request.post('/api/stock-documents',{headers:origin,data:{organizationId:org,storeId:store.id,supplierId:supplier.id,documentType:'purchase',documentNo:number,items:[{productId:product.id,quantity:2,unitCost:2}]}});expect(response.ok()).toBe(true);const row=(await response.json()).data;if(confirm)expect((await page.request.post(`/api/stock-documents/${row.id}/confirm`,{headers:origin,data:{}})).ok()).toBe(true);return row}
 const reversed=await purchase('BROWSER-REVERSED');expect((await page.request.post(`/api/stock-documents/${reversed.id}/reverse`,{headers:origin,data:{operationId:randomUUID(),reason:'Browser purchase reversal'}})).ok()).toBe(true);await purchase('BROWSER-CURRENT');await purchase('BROWSER-DRAFT',false)
 await page.goto('/reports/purchases');await expect(page.getByRole('heading',{name:'Xarid narxlari tahlili',exact:true})).toBeVisible()
 await page.getByLabel('Yetkazib beruvchi',{exact:true}).selectOption(supplier.id);await page.getByLabel('Mahsulot',{exact:true}).selectOption(product.id);await page.getByRole('button',{name:'Xaridni filtrlash',exact:true}).click()
 await expect(page.getByRole('row').filter({hasText:'BROWSER-CURRENT'})).toBeVisible();expect(await downloadText('Xarid tahlilini CSV yuklash')).not.toContain('BROWSER-DRAFT')
 await page.getByLabel('Xarid tahlili ko‘rinishi',{exact:true}).selectOption('comparison');await page.getByRole('button',{name:'Xaridni filtrlash',exact:true}).click();await expect(page.getByRole('columnheader',{name:'Vaznli o‘rtacha',exact:true})).toBeVisible();expect(await downloadText('Xarid tahlilini CSV yuklash')).toContain('2.000000')
 await page.goto('/suppliers');await page.getByRole('row').filter({hasText:'Browser history supplier'}).getByRole('button',{name:'Tahrirlash',exact:true}).click();await page.getByLabel('Bank nomi',{exact:true}).fill('Browser bank');await page.getByLabel('Bank hisob raqami',{exact:true}).fill('browser-opaque-account');await page.getByLabel('To‘lov va yetkazish shartlari',{exact:true}).fill('30 days after acceptance');await page.getByRole('dialog').getByRole('button',{name:'Saqlash',exact:true}).click();await expect(page.getByRole('dialog')).not.toBeVisible();await page.getByRole('link',{name:'Browser history supplier',exact:true}).click();await expect(page.getByText('Bank: Browser bank',{exact:true})).toBeVisible();await expect(page.getByText('Hisob raqami: browser-opaque-account',{exact:true})).toBeVisible();await expect(page.getByText('To‘lov va yetkazish shartlari: 30 days after acceptance',{exact:true})).toBeVisible();await expect(page.getByRole('heading',{name:'Yetkazib beruvchi kartasi',exact:true})).toBeVisible();await expect(page.getByText('Sof xarid qiymati: 4 UZS',{exact:true})).toBeVisible();await expect(page.getByText('Supplierga to‘langan pul yoki qarz hisobi emas;',{exact:false})).toBeVisible();await expect(page.getByRole('row').filter({hasText:'BROWSER-CURRENT'})).toBeVisible();const historyCsv=await downloadText('Supplier tarixini CSV yuklash');expect(historyCsv).toContain('BROWSER-REVERSED');expect(historyCsv).toContain('"-2.000000"')
 await page.getByLabel('Supplier kirim hujjati raqami qidirish',{exact:true}).fill('CURRENT');await page.getByRole('button',{name:'Qidirish',exact:true}).click();await expect(page.getByRole('row').filter({hasText:'BROWSER-CURRENT'})).toHaveCount(1);expect((await downloadText('Supplier tarixini CSV yuklash')).includes('BROWSER-DRAFT')).toBe(false)
 await page.goto('/inventory');await page.getByLabel('Mahsulot, SKU yoki barkod',{exact:true}).fill('catalog');await page.getByRole('button',{name:'Filtrlash',exact:true}).click();await page.getByText('Faqat kam qolganlar',{exact:true}).click();await expect(page.getByRole('row').filter({hasText:'Browser catalog product'})).toBeVisible();const balanceCsv=await downloadText('Qoldiqlarni CSV yuklash');expect(balanceCsv).toContain('"2.000000","3.000000","1.000000","2.000000","4.00"')
 await page.getByRole('button',{name:'Hujjatlar (Kirim/Tuzatish)',exact:false}).click();await page.getByLabel('Hujjat raqamini qidirish',{exact:true}).fill('BROWSER');await page.getByLabel('Hujjat holati filtri',{exact:true}).selectOption('confirmed');await page.getByRole('button',{name:'Filtrlash',exact:true}).click();expect(await downloadText('Hujjatlarni CSV yuklash')).toContain('BROWSER-CURRENT')
 const destination=await db.store.create({data:{organizationId:org,name:'Browser transfer destination'}})
 const membership=await db.organizationUser.findFirstOrThrow({where:{organizationId:org,userId}});await db.userStore.create({data:{organizationUserId:membership.id,storeId:destination.id}})
 await db.stockTransfer.createMany({data:Array.from({length:25},()=>({organizationId:org,fromStoreId:store.id,toStoreId:destination.id,createdBy:userId,status:'draft'}))})
 await page.goto('/inventory/transfers');await page.getByLabel('Jo‘natuvchi filtri',{exact:true}).selectOption(store.id);await page.getByLabel('Qabul qiluvchi filtri',{exact:true}).selectOption(destination.id);await page.getByLabel('Transfer holati filtri',{exact:true}).selectOption('draft');await page.getByRole('button',{name:'Filtrlash',exact:true}).click();await expect(page.getByText('1 / 2',{exact:true})).toBeVisible();await page.getByRole('button',{name:'Keyingi',exact:true}).click();await expect(page.getByText('2 / 2',{exact:true})).toBeVisible();const transferCsv=await downloadText('Transferlarni CSV yuklash');expect((transferCsv.match(/^"[0-9a-f-]{36}",/gm)??[]).length).toBe(25)
})

test('Production HTTPS: durable shift correction and frozen report pagination/export',async({page})=>{
 const phone='998'+Date.now(),password='test-only-password';phones.push(phone)
 await page.goto('/register');await page.getByLabel('Ism va Familiya').fill('Finance Browser');await page.getByLabel('Telefon raqam',{exact:true}).fill(phone);await page.getByLabel("Do'kon yoki Biznes nomi").fill('Finance browser');await page.getByLabel(/Parol \(/).fill(password);await page.getByRole('button',{name:'Hisob yaratish va Boshlash'}).click();await expect(page).toHaveURL(/\/dashboard$/)
 const me=(await (await page.request.get('/api/auth/me')).json()).data;orgs.push(me.organization.id);users.push(me.user.id)
 const store=await db.store.findFirstOrThrow({where:{organizationId:me.organization.id}}),register=await db.register.findFirstOrThrow({where:{storeId:store.id}}),headers={Origin:'https://localhost:3100'}
 const open=async()=>{const response=await page.request.post('/api/shifts',{headers,data:{registerId:register.id,organizationUserId:me.user.organizationUserId,openingCash:0,operationId:randomUUID()}});expect(response.ok()).toBe(true);return (await response.json()).data}
 const original=await open();expect((await page.request.post(`/api/shifts/${original.id}`,{headers,data:{countedCash:0}})).ok()).toBe(true)
 const posting=await open();await page.goto('/shifts')
 page.on('dialog',async dialog=>{if(dialog.type()==='beforeunload')await dialog.accept();else await dialog.dismiss();})
 await page.getByLabel('Original yopilgan smena',{exact:true}).selectOption(original.id);await page.getByLabel('Tuzatish summasi',{exact:true}).fill('3.50');await page.getByLabel('Tuzatish sababi',{exact:true}).fill('Browser count correction')
 await page.locator('a[href="/dashboard"]').first().click();await expect(page).toHaveURL(/\/shifts$/);await expect(page.getByLabel('Tuzatish summasi',{exact:true})).toHaveValue('3.50')
 let originalInput='',retryInput='',posts=0
 await page.route('**/api/shifts/*/corrections',async route=>{if(route.request().method()==='POST'){posts++;originalInput=route.request().postData()??'';await route.fetch();await route.abort()}else await route.continue()})
 await page.getByRole('button',{name:'Tuzatishni yozish',exact:true}).evaluate(button=>{(button as HTMLButtonElement).click();(button as HTMLButtonElement).click()});await expect.poll(()=>db.shiftCorrection.count({where:{originalShiftId:original.id}})).toBe(1)
 await expect(page.getByRole('alert').filter({hasText:/asl|Network|Failed|server/i}).first()).toBeVisible();expect(posts).toBe(1)
 await page.reload();await expect(page.getByRole('button',{name:'Tuzatish natijasini tekshirish',exact:true})).toBeVisible();await expect(page.getByLabel('Tuzatish summasi',{exact:true})).toBeDisabled()
 await page.unroute('**/api/shifts/*/corrections');await page.route('**/api/shifts/*/corrections',async route=>{if(route.request().method()==='POST')retryInput=route.request().postData()??'';await route.continue()})
 await page.getByRole('button',{name:'Tuzatish natijasini tekshirish',exact:true}).click();await expect(page.getByRole('button',{name:'Tuzatishni yozish',exact:true})).toBeVisible();expect(JSON.parse(retryInput)).toEqual(JSON.parse(originalInput));await expect(page.getByText('Smena tuzatishi serverda saqlandi.',{exact:true})).toBeVisible()
 expect(await db.shiftCorrection.count({where:{originalShiftId:original.id}})).toBe(1);expect((await db.shift.findUniqueOrThrow({where:{id:original.id}})).expectedCash?.toString()).toBe('0')
 expect((await page.request.post(`/api/shifts/${posting.id}`,{headers,data:{countedCash:'3.50'}})).ok()).toBe(true);expect((await db.shift.findUniqueOrThrow({where:{id:posting.id}})).expectedCash?.toString()).toBe('3.5')
 await page.unroute('**/api/shifts/*/corrections');const current=await open()
 const product=await db.product.create({data:{organizationId:me.organization.id,name:'Report product',sku:randomUUID(),barcode:randomUUID(),unit:'dona',salePrice:10,costPrice:4}})
 await db.inventoryBalance.create({data:{storeId:store.id,productId:product.id,quantity:100}})
 const ids=Array.from({length:61},()=>randomUUID()),now=new Date()
 await db.sale.createMany({data:ids.map(id=>({id,organizationId:me.organization.id,storeId:store.id,registerId:register.id,shiftId:current.id,cashierId:me.user.id,receiptNo:id,subtotal:10,totalAmount:10,completedAt:now}))})
 await db.saleItem.createMany({data:ids.map(saleId=>({saleId,productId:product.id,productName:'Frozen report',sku:'FROZEN',unit:'dona',quantity:1,unitPrice:10,lineTotal:10,unitCost:4}))})
 await db.payment.createMany({data:ids.map(saleId=>({organizationId:me.organization.id,storeId:store.id,shiftId:current.id,saleId,paymentType:'cash',direction:'in',amount:10,receivedBy:me.user.id,paidAt:now}))})
 await db.sale.updateMany({where:{id:{in:ids}},data:{status:'completed'}})
 const initial=page.waitForResponse(response=>response.url().includes('/api/reports/sales?')&&response.request().method()==='GET');await page.goto('/reports');const report=(await (await initial).json());expect(report.pagination.total).toBe(61)
 await expect(page.getByText('61 ta',{exact:true})).toBeVisible();await page.getByRole('button',{name:'Keyingi sahifa',exact:true}).click();await expect(page.getByText('2 / 2; jami 61',{exact:true})).toBeVisible();await expect(page.getByText('61 ta',{exact:true})).toBeVisible()
 const draftResponse=await page.request.post('/api/sales',{headers,data:{organizationId:me.organization.id,storeId:store.id,registerId:register.id,shiftId:current.id,operationId:randomUUID(),items:[{productId:product.id,quantity:1}]}});expect(draftResponse.ok()).toBe(true);const sale=(await draftResponse.json()).data;expect((await page.request.post(`/api/sales/${sale.id}/complete`,{headers,data:{payments:[{paymentType:'cash',amount:10}]}})).ok()).toBe(true)
 const download=page.waitForEvent('download');await page.getByRole('button',{name:'To‘liq hisobotni CSV yuklash',exact:true}).click();const file=await download,content=await (await import('node:fs/promises')).readFile((await file.path())!,'utf8');expect((content.match(/^"sale",/gm)??[]).length).toBe(61);expect(content).toContain('"Savdolar soni","61"');expect(content).toContain('"Yalpi savdo","610.00"')
 const params=new URLSearchParams({organizationId:me.organization.id,storeId:store.id,startDate:report.meta.startDate,endDate:report.meta.endDate,asOf:report.meta.asOf})
 const dash=await (await page.request.get('/api/reports/dashboard?'+params)).json();expect(dash.data.totalSales).toBe(61);expect(dash.data.totalRevenue).toBe(report.summary.totalRevenue)
 await page.getByRole('button',{name:'Yangilash',exact:true}).click();await expect(page.getByText('62 ta',{exact:true})).toBeVisible()
 await page.goto('/dashboard');await page.getByRole('link',{name:'Shu holatdagi jadval',exact:true}).click();await expect(page).toHaveURL(/\/reports\?startDate=/);await expect(page.getByText('62 ta',{exact:true})).toBeVisible()
})


test('Production HTTPS: offline server banner, browser reopen, customer/note and original mixed-payment sync',async({page,context})=>{
 const phone='998'+Date.now();phones.push(phone)
 await page.goto('/register');await page.getByLabel('Ism va Familiya').fill('Queue Browser');await page.getByLabel('Telefon raqam',{exact:true}).fill(phone);await page.getByLabel("Do'kon yoki Biznes nomi").fill('Queue browser');await page.getByLabel(/Parol \(/).fill('test-only-password');await page.getByRole('button',{name:'Hisob yaratish va Boshlash'}).click();await expect(page).toHaveURL(/\/dashboard$/)
 const me=(await(await page.request.get('/api/auth/me')).json()).data;orgs.push(me.organization.id);users.push(me.user.id)
 const store=await db.store.findFirstOrThrow({where:{organizationId:me.organization.id}}),register=await db.register.findFirstOrThrow({where:{storeId:store.id}}),headers={Origin:'https://localhost:3100'}
 const product=await db.product.create({data:{organizationId:me.organization.id,name:'Queue coffee',sku:randomUUID(),barcode:randomUUID(),unit:'dona',salePrice:100000,costPrice:10}})
 await db.inventoryBalance.create({data:{storeId:store.id,productId:product.id,quantity:5}})
 const customer=await db.customer.create({data:{organizationId:me.organization.id,fullName:'Queue customer',phone:randomUUID(),creditLimit:100000}})
 expect((await page.request.post('/api/shifts',{headers,data:{registerId:register.id,organizationUserId:me.user.organizationUserId,openingCash:0,operationId:randomUUID()}})).ok()).toBe(true)
 await page.goto('/pos');await expect(page.getByText('Server bilan aloqa bor',{exact:true})).toBeVisible()
 await page.getByRole('heading',{name:'Queue coffee',exact:true}).click();await page.locator('select').filter({has:page.locator('option',{hasText:'Queue customer'})}).selectOption(customer.id)
 await page.getByLabel('Chek izohi',{exact:true}).fill('Browser delivery note');await page.getByLabel('Xizmat turi (ixtiyoriy)',{exact:true}).fill('Yetkazish')
 await expect.poll(()=>page.evaluate(async()=>{const r=indexedDB.open('shuni-pos-local-v1');const d=await new Promise<IDBDatabase>(resolve=>{r.onsuccess=()=>resolve(r.result)});const values=await new Promise<{value:{cart:{note:string}}}[]>(resolve=>{const q=d.transaction('drafts').objectStore('drafts').getAll();q.onsuccess=()=>resolve(q.result)});d.close();return values.some(v=>v.value.cart.note==='Browser delivery note')})).toBe(true)
 await page.close();const reopened=await context.newPage();await reopened.goto('/pos')
 await expect(reopened.getByLabel('Chek izohi',{exact:true})).toHaveValue('Browser delivery note');await expect(reopened.getByRole('button',{name:"To'lovga o'tish",exact:true})).toBeEnabled()
 await reopened.route('**/api/health/ready',route=>route.fulfill({status:503,json:{status:'unavailable'}}));await reopened.getByRole('button',{name:'Aloqani tekshirish',exact:true}).click();await expect(reopened.getByText(/Server bilan aloqa yo‘q/)).toBeVisible();await expect(reopened.getByRole('button',{name:"To'lovga o'tish",exact:true})).toBeDisabled();expect(await db.sale.count({where:{organizationId:me.organization.id}})).toBe(0)
 await reopened.unroute('**/api/health/ready');await expect(reopened.getByText('Server bilan aloqa bor',{exact:true})).toBeVisible()
 await reopened.getByRole('button',{name:"To'lovga o'tish",exact:true}).click();await reopened.getByRole('button',{name:'Aralash',exact:true}).click();await reopened.getByLabel('Naqd',{exact:true}).fill('1e3');await reopened.getByRole('button',{name:/Savdoni yakunlash/}).click();await expect(reopened.getByText('Aralash to‘lov jami chek summasiga teng bo‘lishi kerak',{exact:true})).toBeVisible();expect(await db.sale.count({where:{organizationId:me.organization.id}})).toBe(0);await reopened.getByLabel('Naqd',{exact:true}).fill('60000');await reopened.getByLabel('Karta (qo‘lda qayd)',{exact:true}).fill('0');await reopened.getByLabel('Nasiya',{exact:true}).fill('40000');await reopened.getByLabel('Aralash to‘lovda berilgan naqd pul',{exact:true}).fill('80000')
 await reopened.route('**/api/sales/*/complete',async route=>{await route.fetch();await route.abort()});await reopened.getByRole('button',{name:/Savdoni yakunlash/}).click();await expect.poll(()=>db.sale.count({where:{organizationId:me.organization.id,status:'completed'}})).toBe(1)
 await reopened.reload();await expect(reopened.getByRole('button',{name:'Navbatni sinxronlash',exact:true})).toBeEnabled();await reopened.getByTitle('Tizimdan chiqish',{exact:true}).click();await expect(reopened.getByText('Sinxronlanmagan amallar bor; avval natijani tekshiring',{exact:true})).toBeVisible();await expect(reopened).toHaveURL(/\/pos$/);await reopened.getByRole('button',{name:'Navbatni sinxronlash',exact:true}).click();await expect(reopened.getByRole('button',{name:'Natijani tekshirish',exact:true})).not.toBeVisible()
 const sale=await db.sale.findFirstOrThrow({where:{organizationId:me.organization.id},include:{payments:true}});expect(sale.sellerId).toBe(me.user.id);expect(sale.serviceType).toBe('Yetkazish');expect(sale.customerId).toBe(customer.id);expect(sale.note).toBe('Browser delivery note');expect(sale.cashTendered?.toString()).toBe('80000');expect(sale.cashChange?.toString()).toBe('20000');expect(sale.payments.length).toBe(2)
 expect((await db.debtEntry.aggregate({where:{customerId:customer.id},_sum:{amount:true}}))._sum.amount?.toString()).toBe('40000');expect(await db.inventoryMovement.count({where:{sourceId:sale.id}})).toBe(1)
 await expect(reopened.locator('#printable-receipt')).toContainText('Browser delivery note');await expect(reopened.locator('#printable-receipt')).toContainText('Qaytim:')
})

test('IndexedDB transactions isolate users/devices, preserve restart queues and forbid unsafe clear/ack races',async({page})=>{
 await page.goto('/login')
 const moduleUrl=(file:string,dependencies:Record<string,string>={})=>{
  let output=ts.transpileModule(readFileSync(file,'utf8'),{compilerOptions:{target:ts.ScriptTarget.ES2022,module:ts.ModuleKind.ES2022}}).outputText
  for(const [name,url] of Object.entries(dependencies))output=output.replaceAll("'"+name+"'",JSON.stringify(url)).replaceAll('"'+name+'"',JSON.stringify(url))
  return 'data:text/javascript;base64,'+Buffer.from(output).toString('base64')
 }
 const cryptoUrl=moduleUrl('src/lib/offline-cash-crypto.ts')
 const cashStoreUrl=moduleUrl('src/lib/offline-cash-store.ts',{'./offline-cash-crypto':cryptoUrl})
 const source=moduleUrl('src/lib/offline.ts',{'./offline-cash-store':cashStoreUrl,'./catalog-cache':moduleUrl('src/lib/catalog-cache.ts')})
 const result=await page.evaluate(async source=>{
  const lib=await import(source)
  const scope={organizationId:crypto.randomUUID(),userId:crypto.randomUUID(),deviceId:lib.deviceId()},foreign={...scope,userId:crypto.randomUUID()},otherDevice={...scope,deviceId:crypto.randomUUID()}
  await lib.saveDraft(scope,{marker:'own'});await lib.saveDraft(foreign,{marker:'foreign'})
  const minimalScope={...scope,deviceId:crypto.randomUUID()};await lib.saveDraft(minimalScope,{cart:{customer:{id:'customer',fullName:'Name',phone:'phone',email:'private',passwordHash:'never-persist'},items:[{product:{id:'sku',name:'Item',costPrice:'private',supplier:{secret:'never-persist'}}}]}});const minimal=JSON.stringify(await lib.loadDraft(minimalScope));const minimized=!minimal.includes('private')&&!minimal.includes('never-persist');
  const id=crypto.randomUUID(),op={id,scope,type:'sale.create',payload:{organizationId:scope.organizationId},state:'pending',createdAt:new Date().toISOString()}
  const race=await Promise.allSettled([lib.enqueue(op),lib.enqueue({...op,payload:{organizationId:'different'}})])
  const own=await lib.pendingOperations(scope),stranger=await lib.pendingOperations(foreign),device=await lib.pendingOperations(otherDevice)
  let blocked=false;try{await lib.clearScope(scope)}catch{blocked=true}
  const before=await lib.loadDraft(scope),foreignBefore=await lib.loadDraft(foreign)
  const fetchOriginal=globalThis.fetch;let invalidAckBlocked=false
  try{globalThis.fetch=async()=>new Response(JSON.stringify({success:true,data:[{operationId:crypto.randomUUID(),state:'synced',result:{id:'wrong'}}]}),{status:200,headers:{'content-type':'application/json'}});try{await lib.synchronize(scope)}catch{invalidAckBlocked=true}}finally{globalThis.fetch=fetchOriginal}
  const preservedAfterInvalidAck=(await lib.pendingOperations(scope)).length
  await Promise.all([lib.acknowledge(id,'synced',{id:'original'}),lib.acknowledge(id,'conflict',undefined,'STALE')])
  await lib.acknowledge(id,'synced',{id:'original'});const pending=await lib.pendingOperations(scope)
  await lib.clearScope(scope);const after=await lib.loadDraft(scope),foreignAfter=await lib.loadDraft(foreign)
  return {minimized,oneWinner:race.filter(r=>r.status==='fulfilled').length,own:own.length,stranger:stranger.length,device:device.length,blocked,invalidAckBlocked,preservedAfterInvalidAck,before,foreignBefore,pending:pending.length,after:after??null,foreignAfter,stableDevice:scope.deviceId===lib.deviceId()}
 },source)
 expect(result).toEqual({minimized:true,oneWinner:1,own:1,stranger:0,device:0,blocked:true,invalidAckBlocked:true,preservedAfterInvalidAck:1,before:{marker:'own'},foreignBefore:{marker:'foreign'},pending:0,after:null,foreignAfter:{marker:'foreign'},stableDevice:true})
})

test('Business switching keeps catalogs, local baskets and terminal selection scoped; label HTML downloads safely',async({page,browser})=>{
 test.setTimeout(240000);
 const phone='998'+Date.now();phones.push(phone)
 await page.goto('/register');await page.getByLabel('Ism va Familiya').fill('Switch Owner');await page.getByLabel('Telefon raqam',{exact:true}).fill(phone);await page.getByLabel("Do'kon yoki Biznes nomi").fill('Switch A');await page.getByLabel(/Parol \(/).fill('test-only-password');await page.getByRole('button',{name:'Hisob yaratish va Boshlash'}).click();await expect(page).toHaveURL(/\/dashboard$/)
 const me=(await (await page.request.get('/api/auth/me')).json()).data,first=await db.store.findFirstOrThrow({where:{organizationId:me.organization.id}})
 const second=await db.organization.create({data:{name:'Switch B',phone:randomUUID()}});orgs.push(second.id)
 const secondMember=await db.organizationUser.create({data:{organizationId:second.id,userId:me.user.id,role:'owner'}})
 const secondStore=await db.store.create({data:{organizationId:second.id,name:'B store'}})
 await db.userStore.create({data:{organizationUserId:secondMember.id,storeId:secondStore.id}})
 await db.register.create({data:{storeId:secondStore.id,name:'B terminal',code:randomUUID()}})
 const a=await db.product.create({data:{organizationId:me.organization.id,name:'ONLY_A',sku:randomUUID(),barcode:'00123456789',unit:'dona',salePrice:10,costPrice:1}})
 await db.product.create({data:{organizationId:second.id,name:'ONLY_B',sku:randomUUID(),barcode:'987654321',unit:'dona',salePrice:10,costPrice:1}})
 await page.goto('/pos');await page.getByRole('button',{name:'Smenani ochish',exact:true}).click();await page.getByRole('dialog').getByRole('button',{name:'Smenani ochish: oldindan ko‘rish',exact:true}).click();await page.getByRole('dialog').getByRole('button',{name:'Amalni tasdiqlash',exact:true}).click();await expect(page.getByRole('dialog')).not.toBeVisible();await page.getByRole('heading',{name:'ONLY_A',exact:true}).click();await expect(page.getByRole('button',{name:"To'lovga o'tish"})).toBeEnabled()
 await expect.poll(()=>page.evaluate(async()=>{const r=indexedDB.open('shuni-pos-local-v1');const d=await new Promise<IDBDatabase>(resolve=>{r.onsuccess=()=>resolve(r.result)});const values=await new Promise<{value:{cart:{items:unknown[]}}}[]>(resolve=>{const q=d.transaction('drafts').objectStore('drafts').getAll();q.onsuccess=()=>resolve(q.result)});d.close();return values.some(x=>x.value.cart.items.length>0)})).toBe(true)
 await page.getByLabel('Biznesni almashtirish').selectOption(second.id)
 await expect(page.getByRole('heading',{name:'ONLY_B',exact:true})).toBeVisible();await expect(page.getByRole('heading',{name:'ONLY_A',exact:true})).toHaveCount(0);await expect(page.getByText("Savat bo'sh",{exact:true})).toBeVisible()
 await page.getByLabel('Biznesni almashtirish').selectOption(me.organization.id)
 await expect(page.getByRole('heading',{name:'ONLY_A',exact:true})).toHaveCount(2);await expect(page.getByRole('button',{name:"To'lovga o'tish"})).toBeEnabled()
 expect((await page.request.get(`/api/stores?organizationId=${me.organization.id}`)).ok()).toBe(true)
 for(const method of ['POST','PUT','PATCH','DELETE'])expect((await page.request.fetch('/api/inventory/balances',{method,headers:{Origin:'https://localhost:3100'},data:{storeId:first.id,productId:a.id,quantity:999}})).status()).toBe(405)
 const generated=await page.request.post(`/api/products/${a.id}/barcodes/generate`,{headers:{Origin:'https://localhost:3100'},data:{operationId:randomUUID()}});expect(generated.ok()).toBe(true)
 const barcode=(await generated.json()).data
 const label=await page.request.get(`/api/products/${a.id}/barcodes/labels?barcodeId=${barcode.id}&copies=2`);expect(label.ok()).toBe(true);expect((await label.json()).data.content).toContain('<svg')
 const owner=await db.user.findUniqueOrThrow({where:{id:me.user.id}})
 const target=await db.user.create({data:{phone:randomUUID(),fullName:'Recipient owner',passwordHash:owner.passwordHash}});users.push(target.id)
 const member=await db.organizationUser.create({data:{organizationId:me.organization.id,userId:target.id,role:'cashier'}})
 await db.userStore.create({data:{organizationUserId:member.id,storeId:first.id}})
 const approveOwner=await criticalApprover(page,'test-only-password');
 await page.goto('/settings');await page.getByRole('button',{name:'Xodimlar (Foydalanuvchilar)',exact:true}).click()
 page.on('dialog',dialog=>void dialog.accept())
 await page.getByRole('row').filter({hasText:'Recipient owner'}).getByRole('button',{name:'Arxivlash',exact:true}).click();await approveOwner()
 await expect(page.getByRole('row').filter({hasText:'Recipient owner'}).getByText('Arxivlangan',{exact:true})).toBeVisible()
 await expect(page.getByRole('row').filter({hasText:'Recipient owner'}).getByRole('button',{name:'Faollashtirish',exact:true})).toHaveCount(0)
 await page.reload();await page.getByRole('button',{name:'Xodimlar (Foydalanuvchilar)',exact:true}).click()
 await page.getByRole('row').filter({hasText:'Recipient owner'}).getByRole('button',{name:'Arxivdan tiklash',exact:true}).click();await approveOwner()
 await expect(page.getByRole('row').filter({hasText:'Recipient owner'}).getByText('Bloklangan',{exact:true})).toBeVisible()
 await page.getByRole('row').filter({hasText:'Recipient owner'}).getByRole('button',{name:'Faollashtirish',exact:true}).click();await approveOwner()
 await expect(page.getByRole('row').filter({hasText:'Recipient owner'}).getByText('Faol',{exact:true})).toBeVisible()
 await page.getByRole('row').filter({hasText:'Recipient owner'}).getByRole('button',{name:'Egalikni topshirish',exact:true}).click();await approveOwner()
 await expect.poll(()=>db.ownershipTransfer.count({where:{organizationId:me.organization.id,state:'pending'}})).toBe(1)
 expect((await db.organizationUser.findUniqueOrThrow({where:{id:member.id}})).role).toBe('cashier')
 const recipient=await browser.newContext({ignoreHTTPSErrors:true})
 try{
  expect((await recipient.request.post('https://localhost:3100/api/auth/login',{headers:{Origin:'https://localhost:3100'},data:{phone:target.phone,password:'test-only-password'}})).ok()).toBe(true)
  const recipientPage=await recipient.newPage();const approveRecipient=await criticalApprover(recipientPage,'test-only-password');recipientPage.on('dialog',dialog=>void dialog.accept());await recipientPage.goto('https://localhost:3100/pos')
  await recipientPage.getByRole('button',{name:'Qabul qilish',exact:true}).click();await approveRecipient()
  await expect.poll(()=>db.organizationUser.findUniqueOrThrow({where:{id:member.id}}).then(x=>x.role)).toBe('owner')
  expect((await page.request.get('/api/auth/me')).status()).toBe(401)
  expect((await recipientPage.request.get('/api/auth/me')).ok()).toBe(true)
 }finally{await recipient.close()}
 expect(first.organizationId).toBe(me.organization.id)
})


test('Checkout price/stock conflicts require review; print failure and integration failure stay separate',async({page})=>{
 const phone='998'+Date.now();phones.push(phone)
 await page.addInitScript(()=>{window.print=()=>{if(window.top?.localStorage.getItem('fail-next-test-print')){window.top.localStorage.removeItem('fail-next-test-print');throw new Error('Controlled browser print failure')}}})
 await page.goto('/register');await page.getByLabel('Ism va Familiya').fill('Conflict Owner');await page.getByLabel('Telefon raqam',{exact:true}).fill(phone);await page.getByLabel("Do'kon yoki Biznes nomi").fill('Conflict POS');await page.getByLabel(/Parol \(/).fill('test-only-password');await page.getByRole('button',{name:'Hisob yaratish va Boshlash'}).click();await expect(page).toHaveURL(/\/dashboard$/)
 const me=(await (await page.request.get('/api/auth/me')).json()).data;orgs.push(me.organization.id);users.push(me.user.id)
 const store=await db.store.findFirstOrThrow({where:{organizationId:me.organization.id}})
 const product=await db.product.create({data:{organizationId:me.organization.id,name:'Conflict item',sku:randomUUID(),barcode:randomUUID(),unit:'dona',salePrice:100,costPrice:40}})
 await db.inventoryBalance.create({data:{storeId:store.id,productId:product.id,quantity:2}})
 await page.goto('/pos');await page.getByRole('button',{name:'Smenani ochish',exact:true}).click();await page.getByRole('dialog').getByRole('button',{name:'Smenani ochish: oldindan ko‘rish',exact:true}).click();await page.getByRole('dialog').getByRole('button',{name:'Amalni tasdiqlash',exact:true}).click();await expect(page.getByRole('dialog')).not.toBeVisible()
 await page.getByRole('button',{name:'Conflict item — savatga qo‘shish',exact:true}).click()
 await db.product.update({where:{id:product.id},data:{salePrice:120}})
 await page.getByRole('button',{name:"To'lovga o'tish"}).click()
 const conflict=page.getByRole('dialog');await expect(conflict).toContainText('PRICE_CHANGED');await expect(conflict).toContainText('Oldingi narx: 100');await expect(conflict).toContainText('Joriy narx: 120')
 expect(await db.sale.count({where:{organizationId:me.organization.id}})).toBe(0)
 await conflict.getByRole('button',{name:'Eski urinishni bekor qilib savatni yangilash'}).click();await expect(conflict).not.toBeVisible()
 await page.route('**/api/sales/*/complete',async route=>{await db.inventoryBalance.update({where:{storeId_productId:{storeId:store.id,productId:product.id}},data:{quantity:0}});await route.continue()})
 await page.getByRole('button',{name:"To'lovga o'tish"}).click();await page.getByRole('button',{name:/Savdoni yakunlash/}).click();await expect(conflict).toContainText('INSUFFICIENT_STOCK');await expect(conflict).toContainText('Mavjud qoldiq: 0')
 expect(await db.payment.count({where:{organizationId:me.organization.id}})).toBe(0)
 await page.unroute('**/api/sales/*/complete');await conflict.getByRole('button',{name:'Eski urinishni bekor qilib savatni yangilash'}).click();await expect(conflict).not.toBeVisible()
 await db.inventoryBalance.update({where:{storeId_productId:{storeId:store.id,productId:product.id}},data:{quantity:2}})
 await page.getByRole('button',{name:"To'lovga o'tish"}).click();await page.getByRole('button',{name:/Savdoni yakunlash/}).click();await expect(conflict).toContainText('Savdo muvaffaqiyatli yakunlandi')
 const sale=await db.sale.findFirstOrThrow({where:{organizationId:me.organization.id,status:'completed'}})
 const before={sales:await db.sale.count({where:{organizationId:me.organization.id}}),payments:await db.payment.count({where:{organizationId:me.organization.id}}),movements:await db.inventoryMovement.count({where:{organizationId:me.organization.id}})}
 await page.evaluate(()=>localStorage.setItem('fail-next-test-print','1'))
 await conflict.getByRole('button',{name:'Chekni chop etish',exact:true}).click();await expect(conflict.locator('[data-stage="print"]')).toContainText('PRINT_FAILED');await expect(conflict).toContainText('Savdo saqlangan')
 await conflict.getByRole('button',{name:'Chekni chop etish',exact:true}).click();await expect(conflict.locator('[data-stage="print"]')).toHaveCount(0);await expect(page.locator('iframe[title="Chek chop etish"]')).toHaveCount(1)
 expect({sales:await db.sale.count({where:{organizationId:me.organization.id}}),payments:await db.payment.count({where:{organizationId:me.organization.id}}),movements:await db.inventoryMovement.count({where:{organizationId:me.organization.id}})}).toEqual(before)
 expect(await db.auditLog.count({where:{entityId:sale.id,action:'receipt_print_requested'}})).toBe(2)
 await conflict.getByRole('button',{name:'Yangi savdo',exact:true}).click();await page.getByRole('button',{name:'Conflict item — savatga qo‘shish',exact:true}).click()
 // Controlled contract error, not a fake provider implementation.
 await page.route('**/api/sales/*/complete',route=>route.fulfill({status:503,contentType:'application/json',body:JSON.stringify({success:false,error:{code:'INTEGRATION_UNAVAILABLE',message:'Tashqi xizmat sozlanmagan'}})}))
 await page.getByRole('button',{name:"To'lovga o'tish"}).click();await page.getByRole('button',{name:/Savdoni yakunlash/}).click();await expect(conflict).toContainText('Tashqi xizmat holati');await expect(conflict.locator('[data-stage="integration"]')).toBeVisible();await expect(conflict).toContainText('yangi kalit bilan takrorlamang')
 expect(await db.payment.count({where:{organizationId:me.organization.id}})).toBe(1)
 await page.unroute('**/api/sales/*/complete')
})

test('Cashier shortage requires owner approval; next cashier accepts counted handover in UI',async({page,browser})=>{
 const phone='998'+Date.now();phones.push(phone)
 await page.goto('/register');await page.getByLabel('Ism va Familiya').fill('Shift Owner');await page.getByLabel('Telefon raqam',{exact:true}).fill(phone);await page.getByLabel("Do'kon yoki Biznes nomi").fill('Handover POS');await page.getByLabel(/Parol \(/).fill('test-only-password');await page.getByRole('button',{name:'Hisob yaratish va Boshlash'}).click();await expect(page).toHaveURL(/\/dashboard$/)
 const me=(await (await page.request.get('/api/auth/me')).json()).data;orgs.push(me.organization.id);users.push(me.user.id)
 const owner=await db.user.findUniqueOrThrow({where:{id:me.user.id}}),store=await db.store.findFirstOrThrow({where:{organizationId:me.organization.id}})
 const staff=await db.user.create({data:{fullName:'Shift cashier',phone:randomUUID(),passwordHash:owner.passwordHash}});users.push(staff.id)
 const member=await db.organizationUser.create({data:{organizationId:me.organization.id,userId:staff.id,role:'cashier',userStores:{create:{storeId:store.id}}}})
 const context=await browser.newContext({ignoreHTTPSErrors:true})
 try{
  expect((await context.request.post('https://localhost:3100/api/auth/login',{headers:{Origin:'https://localhost:3100'},data:{phone:staff.phone,password:'test-only-password'}})).ok()).toBe(true)
  const cashier=await context.newPage();await cashier.goto('https://localhost:3100/training');await cashier.getByRole('button',{name:'Mashq mahsulotini qo‘shish',exact:true}).click();await cashier.getByRole('button',{name:'Mashq to‘loviga o‘tish',exact:true}).click();await cashier.getByLabel('Mashqda berilgan naqd',{exact:true}).fill('15000');await cashier.getByRole('button',{name:'Faqat mashqni yakunlash',exact:true}).click();await expect(cashier.getByRole('status').filter({hasText:'Mashq yakunlandi'})).toBeVisible();expect(await db.sale.count({where:{organizationId:me.organization.id}})).toBe(0);await cashier.goto('https://localhost:3100/pos');await cashier.getByRole('button',{name:'Smenani ochish',exact:true}).click();await cashier.getByLabel("Boshlang'ich naqd pul (so'm)").fill('50');await cashier.getByRole('dialog').getByRole('button',{name:'Smenani ochish: oldindan ko‘rish',exact:true}).click();await cashier.getByRole('dialog').getByRole('button',{name:'Amalni tasdiqlash',exact:true}).click();await expect(cashier.getByRole('dialog')).not.toBeVisible()
  const product=await db.product.create({data:{organizationId:me.organization.id,name:'Cashier mixed item',sku:randomUUID(),barcode:randomUUID(),unit:'dona',salePrice:10,costPrice:4}})
  await db.inventoryBalance.create({data:{storeId:store.id,productId:product.id,quantity:2}})
  const customer=await db.customer.create({data:{organizationId:me.organization.id,fullName:'Cashier customer',phone:randomUUID(),creditLimit:10}})
  await cashier.reload();await cashier.getByRole('button',{name:'Cashier mixed item — savatga qo‘shish',exact:true}).click();await cashier.locator('select').filter({has:cashier.locator(`option[value="${customer.id}"]`)}).selectOption(customer.id)
  await cashier.getByRole('button',{name:"To'lovga o'tish"}).click();await cashier.getByRole('button',{name:'Aralash',exact:true}).click();await cashier.getByLabel('Naqd',{exact:true}).fill('5');await cashier.getByLabel('Nasiya',{exact:true}).fill('5');await cashier.getByRole('button',{name:/Savdoni yakunlash/}).click();await expect(cashier.getByRole('dialog')).toContainText('Savdo muvaffaqiyatli yakunlandi')
  const sale=await db.sale.findFirstOrThrow({where:{cashierId:staff.id,status:'completed'}});expect(sale.totalAmount.toString()).toBe('10')
  expect((await cashier.request.get('/api/reports/dashboard')).status()).toBe(403)
  expect((await cashier.request.post(`/api/sales/${sale.id}/void`,{headers:{Origin:'https://localhost:3100'},data:{}})).status()).toBe(403)
  await cashier.goto('https://localhost:3100/shifts');await cashier.getByRole('button',{name:'Smenani yopish',exact:true}).click();await cashier.getByLabel("Kassadagi sanalgan naqd pul (so'm) *").fill('50');await cashier.getByLabel('Izoh (ixtiyoriy)',{exact:true}).fill('Shortage counted with supervisor');await cashier.getByRole('dialog').getByRole('button',{name:'Smenani yopish',exact:true}).click();await expect(cashier.getByRole('dialog')).not.toBeVisible()
  await expect(cashier.getByText('Smena yopilishi tasdiq kutmoqda',{exact:true})).toBeVisible()
  await page.goto('/shifts');await page.getByRole('button',{name:'Farqni tasdiqlash va yopish',exact:true}).click();await expect(page.getByRole('button',{name:'Farqni tasdiqlash va yopish',exact:true})).not.toBeVisible()
  const closed=await db.shift.findFirstOrThrow({where:{organizationUserId:member.id,status:'closed'}});expect(closed.countedBy).toBe(staff.id);expect(closed.approvedBy).toBe(owner.id);expect(closed.cashDifference?.toString()).toBe('-5')
  await cashier.goto('https://localhost:3100/pos');await cashier.getByRole('button',{name:'Smenani ochish',exact:true}).click();await cashier.getByLabel(/Oldingi smenani qabul qilish/).check();await expect(cashier.getByLabel("Boshlang'ich naqd pul (so'm)")).toHaveValue('50');await cashier.getByRole('dialog').getByRole('button',{name:'Smenani ochish: oldindan ko‘rish',exact:true}).click();await cashier.getByRole('dialog').getByRole('button',{name:'Amalni tasdiqlash',exact:true}).click();await expect(cashier.getByRole('dialog')).not.toBeVisible()
  const next=await db.shift.findFirstOrThrow({where:{handoverFromId:closed.id}});expect(next.openingCash.toString()).toBe('50')
 }finally{await context.close()}
})

test('Owner mobile dashboard and cashier touch controls remain reachable at 360, 768 and 1280 pixels',async({page})=>{
 const phone='998'+Date.now();phones.push(phone)
 await page.goto('/register');await page.getByLabel('Ism va Familiya').fill('Mobile Owner');await page.getByLabel('Telefon raqam',{exact:true}).fill(phone);await page.getByLabel("Do'kon yoki Biznes nomi").fill('Mobile POS');await page.getByLabel(/Parol \(/).fill('test-only-password');await page.getByRole('button',{name:'Hisob yaratish va Boshlash'}).click();await expect(page).toHaveURL(/\/dashboard$/)
 const me=(await (await page.request.get('/api/auth/me')).json()).data;orgs.push(me.organization.id);users.push(me.user.id)
 await db.product.create({data:{organizationId:me.organization.id,name:'Touch item',sku:randomUUID(),barcode:randomUUID(),unit:'dona',salePrice:10,costPrice:1}})
 await page.goto('/pos');await page.getByRole('button',{name:'Smenani ochish',exact:true}).click();await page.getByRole('dialog').getByRole('button',{name:'Smenani ochish: oldindan ko‘rish',exact:true}).click();await page.getByRole('dialog').getByRole('button',{name:'Amalni tasdiqlash',exact:true}).click();await expect(page.getByRole('dialog')).not.toBeVisible()
 for(const width of [360,768,1280]){
  await page.setViewportSize({width,height:900});await page.goto('/dashboard');await expect(page.getByTestId('owner-dashboard')).toBeVisible()
  await expect.poll(()=>page.evaluate(()=>document.documentElement.scrollWidth<=window.innerWidth)).toBe(true)
  await page.goto('/pos');await expect(page.getByRole('button',{name:'Touch item — savatga qo‘shish',exact:true})).toBeVisible()
  await page.getByRole('button',{name:'Touch item — savatga qo‘shish',exact:true}).click()
  const checkout=page.getByRole('button',{name:"To'lovga o'tish"});await checkout.scrollIntoViewIfNeeded();await expect(checkout).toBeEnabled()
  const size=await checkout.boundingBox();expect(size!.height).toBeGreaterThanOrEqual(44)
  const increase=page.getByRole('button',{name:'Touch item miqdorini oshirish',exact:true});await increase.scrollIntoViewIfNeeded();const plus=await increase.boundingBox();expect(plus!.height).toBeGreaterThanOrEqual(44);expect(plus!.width).toBeGreaterThanOrEqual(44)
  const quantity=page.getByLabel('Touch item miqdori',{exact:true}),before=Number(await quantity.inputValue());await increase.click();await expect(quantity).toHaveValue(String(before+1))
  await checkout.click();await expect(page.getByRole('dialog')).toBeVisible();await page.keyboard.press('Escape');await expect(page.getByRole('dialog')).not.toBeVisible()
 }
})

test('Held server draft resumes on another authorized device and closes the original receipt once',async({page,browser})=>{
 const phone='998'+Date.now();phones.push(phone)
 await page.goto('/register');await page.getByLabel('Ism va Familiya').fill('Draft Owner');await page.getByLabel('Telefon raqam',{exact:true}).fill(phone);await page.getByLabel("Do'kon yoki Biznes nomi").fill('Held POS');await page.getByLabel(/Parol \(/).fill('test-only-password');await page.getByRole('button',{name:'Hisob yaratish va Boshlash'}).click();await expect(page).toHaveURL(/\/dashboard$/)
 const me=(await (await page.request.get('/api/auth/me')).json()).data;orgs.push(me.organization.id);users.push(me.user.id)
 const store=await db.store.findFirstOrThrow({where:{organizationId:me.organization.id}}),product=await db.product.create({data:{organizationId:me.organization.id,name:'Held item',sku:randomUUID(),barcode:randomUUID(),unit:'dona',salePrice:'12.34',costPrice:'4.50'}})
 await db.inventoryBalance.create({data:{storeId:store.id,productId:product.id,quantity:3}})
 await page.goto('/pos');await page.getByRole('button',{name:'Smenani ochish',exact:true}).click();await page.getByRole('dialog').getByRole('button',{name:'Smenani ochish: oldindan ko‘rish',exact:true}).click();await page.getByRole('dialog').getByRole('button',{name:'Amalni tasdiqlash',exact:true}).click();await expect(page.getByRole('dialog')).not.toBeVisible()
 await page.getByRole('button',{name:'Held item — savatga qo‘shish',exact:true}).click();await page.getByLabel('Chek izohi',{exact:true}).fill('Held note');await page.getByRole('button',{name:'Qoralamani serverda saqlash',exact:true}).click();await expect(page.getByText(/Qoralama serverda saqlandi:/)).toBeVisible()
 const draft=await db.sale.findFirstOrThrow({where:{organizationId:me.organization.id,status:'draft'}});expect(await db.payment.count({where:{saleId:draft.id}})).toBe(0);expect(await db.inventoryMovement.count({where:{sourceId:draft.id}})).toBe(0)
 const other=await browser.newContext({ignoreHTTPSErrors:true})
 try{
  expect((await other.request.post('https://localhost:3100/api/auth/login',{headers:{Origin:'https://localhost:3100'},data:{phone,password:'test-only-password'}})).ok()).toBe(true)
  const next=await other.newPage();await next.goto('https://localhost:3100/drafts');await next.getByRole('link',{name:'Qoralamani ochish',exact:true}).click();await next.getByRole('button',{name:'Tanlangan server qoralamasini ochish',exact:true}).click();await expect(next.getByText(/Server qoralamasi ochildi/)).toBeVisible();await expect(next.getByLabel('Chek izohi',{exact:true})).toHaveValue('Held note')
  await expect(next.getByRole('button',{name:'Held item — savatga qo‘shish',exact:true})).toBeDisabled()
  await next.getByRole('button',{name:'Qoralama to‘lovini davom ettirish',exact:true}).click();await next.getByRole('button',{name:/Savdoni yakunlash/}).click();await expect(next.getByRole('dialog')).toContainText('Savdo muvaffaqiyatli yakunlandi')
  expect(await db.sale.count({where:{organizationId:me.organization.id}})).toBe(1);expect(await db.payment.count({where:{saleId:draft.id}})).toBe(1);expect(await db.inventoryMovement.count({where:{sourceId:draft.id}})).toBe(1)
  expect((await db.sale.findUniqueOrThrow({where:{id:draft.id}})).receiptNo).toBe(draft.receiptNo)
 }finally{await other.close()}
})

test('Owner sees durable inventory alert, exact branch replenishment and guided help without hidden repairs',async({page})=>{
 const phone='998'+Date.now();phones.push(phone)
 await page.goto('/register');await page.getByLabel('Ism va Familiya').fill('Alert Owner');await page.getByLabel('Telefon raqam',{exact:true}).fill(phone);await page.getByLabel("Do'kon yoki Biznes nomi").fill('Alert POS');await page.getByLabel(/Parol \(/).fill('test-only-password');await page.getByRole('button',{name:'Hisob yaratish va Boshlash'}).click();await expect(page).toHaveURL(/\/dashboard$/)
 const me=(await (await page.request.get('/api/auth/me')).json()).data;orgs.push(me.organization.id);users.push(me.user.id)
 const store=await db.store.findFirstOrThrow({where:{organizationId:me.organization.id}}),product=await db.product.create({data:{organizationId:me.organization.id,name:'Alert item',sku:randomUUID(),barcode:randomUUID(),unit:'dona',salePrice:10,costPrice:4}})
 await db.inventoryBalance.create({data:{storeId:store.id,productId:product.id,quantity:2}})
 await page.goto('/incidents');await page.getByRole('button',{name:'Hisoblarni solishtirish: oldindan ko‘rish',exact:true}).click();await page.getByRole('button',{name:'Amalni tasdiqlash',exact:true}).click();await expect(page.getByRole('article')).toContainText('Ombor qoldig‘i');await expect(page.getByRole('article')).toContainText('Jiddiy')
 await page.getByLabel('Yopish sababi',{exact:true}).fill('Checked in browser');await page.getByRole('button',{name:'Tuzatilganini tekshirib yopish: oldindan ko‘rish',exact:true}).click();await page.getByRole('button',{name:'Amalni tasdiqlash',exact:true}).click();await expect(page.getByRole('alert').filter({hasText:'Farq hali bor'})).toContainText('Farq hali bor')
 expect((await db.inventoryBalance.findUniqueOrThrow({where:{storeId_productId:{storeId:store.id,productId:product.id}}})).quantity.toString()).toBe('2')
 await page.getByLabel('Yopish sababi',{exact:true}).fill('');await page.goto('/replenishment');await page.getByLabel('Qoldiq filiali',{exact:true}).selectOption(store.id);await page.getByLabel('Mahsulot qidirish',{exact:true}).fill('Alert item');await page.getByLabel('Mahsulot',{exact:true}).selectOption(product.id);await page.getByLabel('Minimal qoldiq',{exact:true}).fill('3');await page.getByLabel('Maksimal qoldiq',{exact:true}).fill('10');await page.getByRole('button',{name:'Chegaralarni saqlash: oldindan ko‘rish',exact:true}).click();await page.getByRole('button',{name:'Amalni tasdiqlash',exact:true}).click();await expect(page.getByRole('article')).toContainText('tavsiya 8 dona')
 await page.goto('/help');await expect(page.getByRole('heading',{name:'Internet yoki server javobi kelmadi'})).toBeVisible();await expect(page.getByRole('heading',{name:'Chek chop etilmadi'})).toBeVisible();await expect(page.getByRole('heading',{name:'Katalog va import xatolari'})).toBeVisible();await page.getByRole('link',{name:'Navbatni tekshirish',exact:true}).click();await expect(page.getByRole('heading',{name:'Navbat va konfliktlar',exact:true})).toBeVisible()
})

test('Training is isolated from real money and keyboard-only payment modal traps and restores focus',async({page})=>{
 const phone='998'+Date.now();phones.push(phone)
 await page.goto('/register');await page.getByLabel('Ism va Familiya').fill('Keyboard Owner');await page.getByLabel('Telefon raqam',{exact:true}).fill(phone);await page.getByLabel("Do'kon yoki Biznes nomi").fill('Keyboard POS');await page.getByLabel(/Parol \(/).fill('test-only-password');await page.getByRole('button',{name:'Hisob yaratish va Boshlash'}).click();await expect(page).toHaveURL(/\/dashboard$/)
 const me=(await (await page.request.get('/api/auth/me')).json()).data;orgs.push(me.organization.id);users.push(me.user.id)
 await page.goto('/training');await page.getByRole('button',{name:'Mashq mahsulotini qo‘shish',exact:true}).click();await page.getByRole('button',{name:'Mashq to‘loviga o‘tish',exact:true}).click();await page.getByLabel('Mashqda berilgan naqd',{exact:true}).fill('15000');await expect(page.getByText('Qaytim: 5000 so‘m',{exact:true})).toBeVisible();await page.getByRole('button',{name:'Faqat mashqni yakunlash',exact:true}).click();await expect(page.getByRole('status').filter({hasText:'Mashq yakunlandi'})).toBeVisible();expect(await db.sale.count({where:{organizationId:me.organization.id}})).toBe(0);expect(await db.payment.count({where:{organizationId:me.organization.id}})).toBe(0)
 const store=await db.store.findFirstOrThrow({where:{organizationId:me.organization.id}}),product=await db.product.create({data:{organizationId:me.organization.id,name:'Keyboard item',sku:randomUUID(),barcode:randomUUID(),unit:'dona',salePrice:10,costPrice:4}});await db.inventoryBalance.create({data:{storeId:store.id,productId:product.id,quantity:3}})
 await page.goto('/pos');const open=page.getByRole('button',{name:'Smenani ochish',exact:true});await expect(page.getByRole('button',{name:'Keyboard item — savatga qo‘shish',exact:true})).toBeVisible();await open.press('Enter');await page.getByRole('dialog').getByRole('button',{name:'Smenani ochish: oldindan ko‘rish',exact:true}).press('Enter');await page.getByRole('dialog').getByRole('button',{name:'Amalni tasdiqlash',exact:true}).press('Enter');await expect(page.getByRole('dialog')).not.toBeVisible()
 await page.keyboard.press('F2');const catalogRefresh=page.waitForResponse(response=>new URL(response.url()).pathname==='/api/products'&&new URL(response.url()).searchParams.get('search')==='Keyboard item');await page.getByLabel('POS mahsulot qidirish',{exact:true}).fill('Keyboard item');const tile=page.getByRole('button',{name:'Keyboard item — savatga qo‘shish',exact:true});await tile.focus();await page.keyboard.press('Enter');await tile.focus();await expect(tile).toBeFocused();await expectReadableText(tile.locator('span,h4'));await page.keyboard.press('F9');const dialog=page.getByRole('dialog');await expect(dialog).toBeVisible();await expect.poll(()=>page.evaluate(()=>Boolean(document.activeElement?.closest('[role="dialog"]')))).toBe(true);await expectReadableText(dialog.locator('label,button,span'));await catalogRefresh;await expect(page.locator('[data-focus-key]').filter({hasText:'Keyboard item'})).toBeAttached()
 for(let i=0;i<12;i++){await page.keyboard.press('Tab');expect(await page.evaluate(()=>Boolean(document.activeElement?.closest('[role="dialog"]')))).toBe(true)}
 await page.keyboard.press('Escape');await expect(dialog).not.toBeVisible();await expect(tile).toBeFocused()
 expect(await db.sale.count({where:{organizationId:me.organization.id}})).toBe(0)
 // Complete a fresh checkout with keyboard-wedge input and keyboard actions only.
 const alias='KEYBOARD-'+randomUUID();
 expect((await page.request.post(`/api/products/${product.id}/barcodes`,{headers:{Origin:'https://localhost:3100'},data:{value:alias}})).ok()).toBe(true)
 const wrongIdentifier=page.waitForResponse(response=>new URL(response.url()).searchParams.get('identifier')==='NOT-A-BARCODE');
 const wrongScan=page.waitForResponse(response=>new URL(response.url()).searchParams.get('barcode')==='NOT-A-BARCODE');
 await page.keyboard.press('F2');await page.getByLabel('POS mahsulot qidirish',{exact:true}).fill('NOT-A-BARCODE');await page.keyboard.press('Enter');await wrongScan;await wrongIdentifier;await expect(page.getByRole('status').filter({hasText:'Barkod tekshirilmoqda'})).not.toBeVisible();await expect(page.getByLabel('POS mahsulot qidirish',{exact:true})).toHaveValue('NOT-A-BARCODE')
 let releaseScan:(()=>void)|undefined;
 await page.route('**/api/products?*',async route=>{if(new URL(route.request().url()).searchParams.get('barcode')===alias)await new Promise<void>(resolve=>{releaseScan=resolve});await route.continue()});
 await page.keyboard.press('F2');await page.getByLabel('POS mahsulot qidirish',{exact:true}).fill(alias);await page.keyboard.press('Enter');await expect.poll(()=>Boolean(releaseScan)).toBe(true);
 await page.keyboard.press('F9');await expect(dialog).not.toBeVisible();await expect(page.getByText('Avval mahsulot tekshiruvi tugashini kuting',{exact:true})).toBeVisible();releaseScan!();
 await expect(page.getByLabel('POS mahsulot qidirish',{exact:true})).toHaveValue('');await page.unroute('**/api/products?*');await page.keyboard.press('F2');await page.getByLabel('POS mahsulot qidirish',{exact:true}).fill('keyboard item');await page.keyboard.press('Enter');await expect(page.getByLabel('POS mahsulot qidirish',{exact:true})).toHaveValue('')
 await page.keyboard.press('F9');await expect(dialog).toBeVisible();await dialog.getByLabel("Mijoz bergan naqd pul (so'm)").focus();await page.keyboard.insertText('30');await dialog.getByRole('button',{name:/Savdoni yakunlash/}).focus();await page.keyboard.press('Enter')
 await expect.poll(()=>db.sale.count({where:{organizationId:me.organization.id,status:'completed'}})).toBe(1)
 const final=await db.sale.findFirstOrThrow({where:{organizationId:me.organization.id,status:'completed'},include:{items:true,payments:true}});expect(final.items).toHaveLength(1);expect(final.items[0].quantity.toString()).toBe('3');expect(final.payments).toHaveLength(1);expect(final.totalAmount.toString()).toBe('30')
})

test('Sync conflict requires manager terminal proof and keeps the original local and server payloads',async({page})=>{
 const phone='998'+Date.now();phones.push(phone)
 await page.goto('/register');await page.getByLabel('Ism va Familiya').fill('Sync Owner');await page.getByLabel('Telefon raqam',{exact:true}).fill(phone);await page.getByLabel("Do'kon yoki Biznes nomi").fill('Sync review POS');await page.getByLabel(/Parol \(/).fill('test-only-password');await page.getByRole('button',{name:'Hisob yaratish va Boshlash'}).click();await expect(page).toHaveURL(/\/dashboard$/)
 const me=(await (await page.request.get('/api/auth/me')).json()).data;orgs.push(me.organization.id);users.push(me.user.id)
 const store=await db.store.findFirstOrThrow({where:{organizationId:me.organization.id}}),register=await db.register.findFirstOrThrow({where:{storeId:store.id}})
 const member=await db.organizationUser.findFirstOrThrow({where:{organizationId:me.organization.id,userId:me.user.id}}),shift=await db.shift.create({data:{registerId:register.id,organizationUserId:member.id,openingCash:0}}),product=await db.product.create({data:{organizationId:me.organization.id,name:'Sync item',sku:randomUUID(),barcode:randomUUID(),unit:'dona',salePrice:100,costPrice:40}})
 await db.inventoryBalance.create({data:{storeId:store.id,productId:product.id,quantity:2}})
 const draftResponse=await page.request.post('/api/sales',{headers:{Origin:'https://localhost:3100'},data:{organizationId:me.organization.id,storeId:store.id,registerId:register.id,shiftId:shift.id,operationId:randomUUID(),items:[{productId:product.id,quantity:1}]}});expect(draftResponse.ok()).toBe(true);const draft=(await draftResponse.json()).data,id=randomUUID()
 await page.goto('/pos');await expect(page.getByRole('button',{name:'Sync item — savatga qo‘shish'})).toBeVisible()
 const payload={saleId:draft.id,payments:[{paymentType:'cash',amount:'99'}]}
 await page.evaluate(async({id,payload,organizationId,userId})=>{
  const request=indexedDB.open('shuni-pos-local-v1');const database=await new Promise<IDBDatabase>((resolve,reject)=>{request.onsuccess=()=>resolve(request.result);request.onerror=()=>reject(request.error)})
  await new Promise<void>((resolve,reject)=>{const tx=database.transaction('operations','readwrite');tx.objectStore('operations').add({id,scope:{organizationId,userId,deviceId:localStorage.getItem('pos_device_id')},type:'sale.complete',payload,state:'pending',createdAt:new Date().toISOString()});tx.oncomplete=()=>resolve();tx.onerror=()=>reject(tx.error)});database.close()
 },{id,payload,organizationId:me.organization.id,userId:me.user.id})
 await page.goto('/sync-review');await page.getByRole('button',{name:'Asl kalitlar bilan sinxronlash',exact:true}).click();await expect(page.getByRole('article').filter({hasText:id}).first()).toContainText('conflict')
 const review=await db.syncReview.findFirstOrThrow({where:{organizationId:me.organization.id,operationId:id}});expect(review.payload).toEqual(payload)
 await page.getByLabel('Konflikt ko‘rib chiqish sababi',{exact:true}).fill('Original draft reviewed');await page.getByRole('button',{name:'Terminal natija dalili bilan hal qilish: oldindan ko‘rish',exact:true}).click();await page.getByRole('button',{name:'Amalni tasdiqlash',exact:true}).click();await expect(page.getByRole('alert').filter({hasText:'Avval asl amal natijasini tekshiring'})).toContainText('Avval asl amal natijasini tekshiring')
 expect((await page.request.post(`/api/sales/${draft.id}/void`,{headers:{Origin:'https://localhost:3100'},data:{}})).ok()).toBe(true)
 await page.getByRole('button',{name:'Terminal natija dalili bilan hal qilish: oldindan ko‘rish',exact:true}).click();await page.getByRole('button',{name:'Amalni tasdiqlash',exact:true}).click();await page.getByRole('button',{name:'Rahbar dalilini lokal navbatga saqlash',exact:true}).click();await expect(page.getByRole('article').filter({hasText:id}).first()).toContainText('rejected')
 expect((await db.syncReview.findUniqueOrThrow({where:{id:review.id}})).payload).toEqual(payload);expect(await db.payment.count({where:{saleId:draft.id}})).toBe(0);expect(await db.inventoryMovement.count({where:{sourceId:draft.id}})).toBe(0);expect(await db.auditLog.count({where:{entityId:review.id,action:'sync_review_resolved'}})).toBe(1)
})


test('Debt collection UI records exact cash/card/transfer channels with manual document proof',async({page})=>{
 const phone='998'+Date.now();phones.push(phone);
 const registration=await page.request.post('/api/auth/register',{headers:{Origin:'https://localhost:3100'},data:{fullName:'Collection owner',phone,password:'test-only-password',organizationName:'Debt channels business'}});expect(registration.ok()).toBe(true);
 const me=(await (await page.request.get('/api/auth/me')).json()).data;orgs.push(me.organization.id);users.push(me.user.id);
 const store=await db.store.findFirstOrThrow({where:{organizationId:me.organization.id}}),register=await db.register.findFirstOrThrow({where:{storeId:store.id}}),member=await db.organizationUser.findFirstOrThrow({where:{organizationId:me.organization.id,userId:me.user.id}});
 const shift=await db.shift.create({data:{registerId:register.id,organizationUserId:member.id,openingCash:0}}),product=await db.product.create({data:{organizationId:me.organization.id,name:'Debt channel item',sku:randomUUID(),barcode:randomUUID(),unit:'dona',salePrice:100,costPrice:40}}),customer=await db.customer.create({data:{organizationId:me.organization.id,fullName:'Channel customer',phone:randomUUID(),creditLimit:1000}});
 await db.inventoryBalance.create({data:{storeId:store.id,productId:product.id,quantity:1}});
 const draftResponse=await page.request.post('/api/sales',{headers:{Origin:'https://localhost:3100'},data:{organizationId:me.organization.id,storeId:store.id,registerId:register.id,shiftId:shift.id,customerId:customer.id,operationId:randomUUID(),items:[{productId:product.id,quantity:1}]}});expect(draftResponse.ok()).toBe(true);const sale=(await draftResponse.json()).data;
 expect((await page.request.post(`/api/sales/${sale.id}/complete`,{headers:{Origin:'https://localhost:3100'},data:{payments:[{paymentType:'credit',amount:100}]}})).ok()).toBe(true);
 await page.goto(`/customers/${customer.id}`);
 for(const channel of ['cash','card','transfer']){
  await page.getByRole('button',{name:'Qarzni undirish',exact:true}).click();const modal=page.getByRole('dialog');
  await modal.getByLabel("To'lov summasi (so'm) *",{exact:true}).fill('30');await modal.getByLabel('Undirish usuli',{exact:true}).selectOption(channel);
  if(channel!=='cash'){await modal.getByLabel('To‘lov hujjati raqami',{exact:true}).fill('DEBT-'+randomUUID());await modal.getByRole('checkbox',{name:'To‘lov haqiqatan bajarilganini tasdiqlayman'}).check();}
  await modal.getByRole('button',{name:'Tasdiqlash',exact:true}).click();await expect(modal).not.toBeVisible();
 }
 const payments=await db.payment.findMany({where:{customerId:customer.id,note:'debt_collection'}});expect(payments).toHaveLength(3);for(const channel of ['cash','card','transfer']){const payment=payments.find(row=>row.paymentType===channel);expect(payment?.amount.toString()).toBe('30');expect(payment?.sourceType).toBe('manual');expect(payment?.shiftId).toBe(shift.id);}
 expect((await db.debtEntry.aggregate({where:{customerId:customer.id},_sum:{amount:true}}))._sum.amount?.toString()).toBe('10');
});

test('Reviewed price batch survives lost acknowledgement and damaged journal stays outside sellable stock',async({page})=>{
 const phone='998'+Date.now();phones.push(phone);const headers={Origin:'https://localhost:3100'};
 expect((await page.request.post('/api/auth/register',{headers,data:{fullName:'Price owner',phone,password:'test-only-password',organizationName:'Price journal business'}})).ok()).toBe(true);
 const me=(await (await page.request.get('/api/auth/me')).json()).data;orgs.push(me.organization.id);users.push(me.user.id);
 const store=await db.store.findFirstOrThrow({where:{organizationId:me.organization.id}}),register=await db.register.findFirstOrThrow({where:{storeId:store.id}}),member=await db.organizationUser.findFirstOrThrow({where:{organizationId:me.organization.id,userId:me.user.id}});
 const shift=await db.shift.create({data:{registerId:register.id,organizationUserId:member.id,openingCash:0}}),product=await db.product.create({data:{organizationId:me.organization.id,name:'Reviewed journal item',sku:randomUUID(),barcode:randomUUID(),unit:'dona',salePrice:100,costPrice:40}});
 await db.inventoryBalance.create({data:{storeId:store.id,productId:product.id,quantity:2}});
 const draftResponse=await page.request.post('/api/sales',{headers,data:{organizationId:me.organization.id,storeId:store.id,registerId:register.id,shiftId:shift.id,operationId:randomUUID(),items:[{productId:product.id,quantity:2}]}});expect(draftResponse.ok()).toBe(true);const sale=(await draftResponse.json()).data;
 expect((await page.request.post(`/api/sales/${sale.id}/complete`,{headers,data:{payments:[{paymentType:'cash',amount:200}]}})).ok()).toBe(true);
 await page.goto('/products/prices');await page.getByLabel('Yangi narx Reviewed journal item',{exact:true}).fill('125.50');await page.getByLabel('O‘zgartirish sababi').fill('Reviewed supplier adjustment');await page.getByRole('button',{name:'Oldindan ko‘rish',exact:true}).click();await expect(page.getByRole('heading',{name:'Tasdiqlashdan oldin tekshiring'})).toBeVisible();
 expect((await db.product.findUniqueOrThrow({where:{id:product.id}})).salePrice.toString()).toBe('100');
 let lost=false,deniedRetry=false;
 await page.route('**/api/products/prices',async route=>{const request=route.request();if(request.method()==='POST'&&!request.postDataJSON().preview&&!lost){lost=true;const response=await route.fetch();expect(response.ok()).toBe(true);await route.abort();}else if(request.method()==='POST'&&!request.postDataJSON().preview&&!deniedRetry){deniedRetry=true;await route.fulfill({status:403,json:{success:false,error:{code:'COST_CHANGE_FORBIDDEN',message:'Test-only temporary replay denial'}}});}else await route.continue();});
 await page.getByRole('button',{name:'Narxlarni tasdiqlash',exact:true}).click();await expect(page.getByRole('button',{name:'Original amalni qayta tekshirish'})).toBeEnabled();await page.reload();await expect(page.getByRole('button',{name:'Original amalni qayta tekshirish'})).toBeEnabled();await page.getByRole('button',{name:'Original amalni qayta tekshirish'}).click();await expect(page.getByRole('alert').filter({hasText:'Test-only temporary replay denial'})).toContainText('Test-only temporary replay denial');await expect(page.getByRole('button',{name:'Original amalni qayta tekshirish'})).toBeEnabled();await page.reload();await page.getByRole('button',{name:'Original amalni qayta tekshirish'}).click();await expect(page.getByRole('button',{name:'Original amalni qayta tekshirish'})).not.toBeVisible();
 expect((await db.product.findUniqueOrThrow({where:{id:product.id}})).salePrice.toString()).toBe('125.5');expect(await db.productPriceHistory.count({where:{productId:product.id,source:'catalog.bulk'}})).toBe(1);expect((await db.saleItem.findUniqueOrThrow({where:{id:sale.items[0].id}})).unitPrice.toString()).toBe('100');
 await page.getByLabel('Narx maydoni').selectOption('costPrice');await page.getByLabel('O‘zgartirish sababi').fill('Exact six-decimal cost review');await page.getByLabel('Yangi narx Reviewed journal item',{exact:true}).fill('90071992547409.123456');await page.getByRole('button',{name:'Oldindan ko‘rish',exact:true}).click();await expect(page.getByRole('heading',{name:'Tasdiqlashdan oldin tekshiring'})).toBeVisible();await page.getByRole('button',{name:'Narxlarni tasdiqlash',exact:true}).click();await expect(page.getByRole('heading',{name:'Tasdiqlashdan oldin tekshiring'})).not.toBeVisible();expect((await db.product.findUniqueOrThrow({where:{id:product.id}})).costPrice.toString()).toBe('90071992547409.123456');expect((await db.saleItem.findUniqueOrThrow({where:{id:sale.items[0].id}})).unitCost.toString()).toBe('40');

 expect((await page.request.post(`/api/sales/${sale.id}/returns`,{headers,data:{operationId:randomUUID(),shiftId:shift.id,reason:'Physical damaged return',items:[{saleItemId:sale.items[0].id,quantity:1,disposition:'damaged'}]}})).ok()).toBe(true);
 expect((await page.request.post(`/api/sales/${sale.id}/returns`,{headers,data:{operationId:randomUUID(),shiftId:shift.id,reason:'Disposed returned item',items:[{saleItemId:sale.items[0].id,quantity:1,disposition:'write_off'}]}})).ok()).toBe(true);
 await page.goto('/inventory/dispositions');await expect(page.getByRole('heading',{name:'Brak va hisobdan chiqarish'})).toBeVisible();await expect(page.getByText('Brak qaytarmalari',{exact:true})).toBeVisible();await expect(page.getByText('Saqlanmaydi',{exact:true})).toBeVisible();await expect(page.getByText(/Brak qoldig‘i 1/)).toBeVisible();
 expect((await db.inventoryBalance.findUniqueOrThrow({where:{storeId_productId:{storeId:store.id,productId:product.id}}})).quantity.toString()).toBe('0');expect(await db.returnDispositionEntry.count({where:{organizationId:me.organization.id}})).toBe(2);
});

test('Finance UI records internal bank expense, transfer and exact reversal with durable recovery',async({page})=>{
 const phone='998'+Date.now();phones.push(phone);const origin={Origin:'https://localhost:3100'};
 expect((await page.request.post('/api/auth/register',{headers:origin,data:{fullName:'Finance owner',phone,password:'test-only-password',organizationName:'Finance browser business'}})).ok()).toBe(true);
 const me=(await (await page.request.get('/api/auth/me')).json()).data;orgs.push(me.organization.id);users.push(me.user.id);
 await page.goto('/finance');await expect(page.getByRole('heading',{name:'Hisoblar va biznes xarajatlari',exact:true})).toBeVisible();
 const confirm=async(label:string)=>{await page.getByRole('button',{name:label+': oldindan ko‘rish',exact:true}).click();await page.getByRole('button',{name:'Amalni tasdiqlash',exact:true}).click();};
 await page.getByLabel('Hisob nomi',{exact:true}).fill('Primary manual bank');await page.getByLabel('Hisob ochish asosi',{exact:true}).fill('Verified opening statement');await page.getByLabel('Boshlang‘ich hisob summasi',{exact:true}).fill('100');await confirm('Hisob yaratish');
 await expect(page.getByText('Primary manual bank: 100 · bank · Ichki jurnal',{exact:true})).toBeVisible();
 await page.getByLabel('Hisob nomi',{exact:true}).fill('Secondary manual bank');await page.getByLabel('Boshlang‘ich hisob summasi',{exact:true}).fill('0');await confirm('Hisob yaratish');await expect(page.getByText('Secondary manual bank: 0 · bank · Ichki jurnal',{exact:true})).toBeVisible();
 await page.getByLabel('Xarajat toifasi nomi',{exact:true}).fill('Rent paid');await confirm('Toifa yaratish');await expect(page.getByLabel('Xarajat toifasi',{exact:true}).locator('option').filter({hasText:'Rent paid'})).toHaveCount(1);
 const primary=await db.financialAccount.findFirstOrThrow({where:{organizationId:me.organization.id,name:'Primary manual bank'}}),secondary=await db.financialAccount.findFirstOrThrow({where:{organizationId:me.organization.id,name:'Secondary manual bank'}}),category=await db.expenseCategory.findFirstOrThrow({where:{organizationId:me.organization.id,name:'Rent paid'}});
 await page.getByLabel('To‘lov hisobi',{exact:true}).selectOption(primary.id);await page.getByLabel('Xarajat toifasi',{exact:true}).selectOption(category.id);await page.getByLabel('Xarajat summasi',{exact:true}).fill('10.25');await page.getByLabel('Xarajat sababi',{exact:true}).fill('Actual rent payment');await confirm('Xarajat');await expect(page.getByText('Operatsion foyda: -10.25',{exact:true})).toBeVisible();
 await page.getByLabel('Qaysi hisobdan',{exact:true}).selectOption(primary.id);await page.getByLabel('Qaysi hisobga',{exact:true}).selectOption(secondary.id);await page.getByLabel('O‘tkazma summasi',{exact:true}).fill('20.05');await page.getByLabel('O‘tkazma sababi',{exact:true}).fill('Actual manual transfer');await confirm('Ichki o‘tkazma');await expect(page.getByText('Secondary manual bank: 20.05 · bank · Ichki jurnal',{exact:true})).toBeVisible();await expect(page.getByText('Operatsion foyda: -10.25',{exact:true})).toBeVisible();
 const expense=page.locator('article').filter({hasText:'Actual rent payment'});await expense.getByRole('button',{name:'Qarshi hujjat yaratish',exact:true}).click();await page.getByLabel('Qarshi hujjat sababi',{exact:true}).fill('Rent payment correction');
 let dropped=false;await page.route('**/api/finance/documents/*/reverse',async route=>{const response=await route.fetch();if(!dropped&&response.ok()){dropped=true;await route.abort('failed');}else await route.fulfill({response});});
 await confirm('Qarshi hujjat');await expect(page.getByRole('button',{name:'Original amalni qayta tekshirish',exact:true})).toBeVisible();await page.reload();await expect(page.getByRole('button',{name:'Saqlangan amalni qayta tekshirish',exact:true})).toBeVisible();await page.getByRole('button',{name:'Saqlangan amalni qayta tekshirish',exact:true}).click();await expect(page.getByRole('button',{name:'Saqlangan amalni qayta tekshirish',exact:true})).not.toBeVisible();await expect(page.getByText('Operatsion foyda: 0',{exact:true})).toBeVisible();
 expect(await db.financialDocument.count({where:{organizationId:me.organization.id,kind:'expense_reversal'}})).toBe(1);await expect(page.getByText('Primary manual bank: 79.95 · bank · Ichki jurnal',{exact:true})).toBeVisible();
});

test('Sales breakdown UI reconciles all five dimensions and downloads full exact CSV',async({page})=>{
 const phone='998'+Date.now();phones.push(phone);const origin={Origin:'https://localhost:3100'};
 expect((await page.request.post('/api/auth/register',{headers:origin,data:{fullName:'Breakdown owner',phone,password:'test-only-password',organizationName:'Breakdown browser business'}})).ok()).toBe(true);
 const me=(await (await page.request.get('/api/auth/me')).json()).data;orgs.push(me.organization.id);users.push(me.user.id);
 const store=await db.store.findFirstOrThrow({where:{organizationId:me.organization.id}}),register=await db.register.findFirstOrThrow({where:{storeId:store.id}}),member=await db.organizationUser.findFirstOrThrow({where:{organizationId:me.organization.id,userId:me.user.id}});
 const shift=await db.shift.create({data:{registerId:register.id,organizationUserId:member.id,openingCash:0}}),category=await db.category.create({data:{organizationId:me.organization.id,name:'Browser grouped category'}}),product=await db.product.create({data:{organizationId:me.organization.id,categoryId:category.id,name:'Browser grouped item',sku:randomUUID(),barcode:randomUUID(),unit:'dona',salePrice:100,costPrice:50}});
 await db.inventoryBalance.create({data:{storeId:store.id,productId:product.id,quantity:2}});
 const response=await page.request.post('/api/sales',{headers:origin,data:{organizationId:me.organization.id,storeId:store.id,registerId:register.id,shiftId:shift.id,operationId:randomUUID(),discountAmount:5,items:[{productId:product.id,quantity:1}]}});expect(response.ok()).toBe(true);const sale=(await response.json()).data;expect((await page.request.post(`/api/sales/${sale.id}/complete`,{headers:origin,data:{payments:[{paymentType:'cash',amount:95}]}})).ok()).toBe(true);
 await page.goto('/reports/breakdowns');await expect(page.getByRole('heading',{name:'Savdo kesimlari',exact:true})).toBeVisible();
 for(const dimension of ['product','category','cashier','store','payment']){
  await page.getByLabel('Savdo kesimi',{exact:true}).selectOption(dimension);await expect(page.getByText('Umumiy sof savdo: 95',{exact:true})).toBeVisible();await expect(page.getByRole('row').filter({hasText:dimension==='product'?'Browser grouped item':dimension==='category'?'Browser grouped category':dimension==='cashier'?'Breakdown owner':dimension==='payment'?'Naqd':store.name})).toBeVisible();
 }
 const pending=page.waitForEvent('download');await page.getByRole('button',{name:'CSV eksport',exact:true}).click();const download=await pending,stream=await download.createReadStream(),chunks:Buffer[]=[];for await(const chunk of stream!)chunks.push(Buffer.from(chunk));expect(Buffer.concat(chunks).toString('utf8')).toContain('95');
});

test('Supplier ledger UI records invoice, partial cash allocation and recovers unknown advance exactly once',async({page})=>{
 const phone='998'+Date.now();phones.push(phone);const origin={Origin:'https://localhost:3100'};
 expect((await page.request.post('/api/auth/register',{headers:origin,data:{fullName:'Supplier ledger owner',phone,password:'test-only-password',organizationName:'Supplier ledger browser'}})).ok()).toBe(true);
 const me=(await (await page.request.get('/api/auth/me')).json()).data;orgs.push(me.organization.id);users.push(me.user.id);
 const store=await db.store.findFirstOrThrow({where:{organizationId:me.organization.id}}),register=await db.register.findFirstOrThrow({where:{storeId:store.id}}),member=await db.organizationUser.findFirstOrThrow({where:{organizationId:me.organization.id,userId:me.user.id}}),supplier=await db.supplier.create({data:{organizationId:me.organization.id,name:'Browser supplier ledger'}}),product=await db.product.create({data:{organizationId:me.organization.id,name:'Supplier receipt item',sku:randomUUID(),barcode:randomUUID(),unit:'dona',salePrice:100,costPrice:50}});
 await db.shift.create({data:{registerId:register.id,organizationUserId:member.id,openingCash:1000}});
 expect((await page.request.post('/api/finance/accounts',{headers:origin,data:{operationId:randomUUID(),storeId:store.id,registerId:register.id,name:'Supplier browser till',kind:'cash',reason:'Existing counted cash'}})).ok()).toBe(true);const account=await db.financialAccount.findFirstOrThrow({where:{organizationId:me.organization.id}});
 const response=await page.request.post('/api/stock-documents',{headers:origin,data:{organizationId:me.organization.id,storeId:store.id,supplierId:supplier.id,documentType:'purchase',documentNo:'SUPPLIER-BROWSER-RECEIPT',items:[{productId:product.id,quantity:2,unitCost:40}]}});expect(response.ok()).toBe(true);const doc=(await response.json()).data;expect((await page.request.post(`/api/stock-documents/${doc.id}/confirm`,{headers:origin,data:{}})).ok()).toBe(true);
 page.on('dialog',async dialog=>{if(dialog.type()==='beforeunload')await dialog.accept();else await dialog.dismiss();});
 await page.goto('/suppliers/'+supplier.id);await expect(page.getByRole('heading',{name:'Yetkazib beruvchi qarzi va avansi',exact:true})).toBeVisible();await page.getByLabel('Invoice uchun xarid',{exact:true}).selectOption(doc.id);await page.getByLabel('Supplier invoice raqami',{exact:true}).fill('BROWSER-SUPPLIER-INVOICE');await page.getByLabel('Invoice hisobga olish sababi',{exact:true}).fill('Verified new unpaid supplier invoice');
 const confirm=async(label:string)=>{await page.getByRole('button',{name:label+': oldindan ko‘rish',exact:true}).click();await page.getByRole('button',{name:'Amalni tasdiqlash',exact:true}).click();};await confirm('Invoice qayd etish');await expect(page.getByText('To‘lanmagan qarz: 80',{exact:true})).toBeVisible();
 await page.getByLabel('Supplier invoice raqami',{exact:true}).fill('UNPOSTED-INDEPENDENT-INVOICE');
 const invoice=await db.supplierInvoice.findFirstOrThrow({where:{supplierId:supplier.id}});await page.getByLabel('Supplier to‘lov hisobi',{exact:true}).selectOption(account.id);await page.getByLabel('Supplier to‘lov summasi',{exact:true}).fill('30');await page.getByLabel('Supplier to‘lov sababi',{exact:true}).fill('Actual partial cash payment');await page.getByLabel('To‘lanadigan invoice',{exact:true}).selectOption(invoice.id);await page.getByLabel('Invoicega taqsimlanadigan summa',{exact:true}).fill('30');await confirm('Supplier to‘lovi');await expect(page.getByText('To‘lanmagan qarz: 50',{exact:true})).toBeVisible();await expect(page.getByLabel('Supplier invoice raqami',{exact:true})).toHaveValue('UNPOSTED-INDEPENDENT-INVOICE');await page.locator('a[href="/dashboard"]').first().click();await expect(page).toHaveURL(new RegExp('/suppliers/'+supplier.id+'$'));
 await page.getByLabel('To‘lanadigan invoice',{exact:true}).selectOption('');await page.getByLabel('Supplier to‘lov summasi',{exact:true}).fill('10.25');await page.getByLabel('Supplier to‘lov sababi',{exact:true}).fill('Actual supplier advance recovered');let dropped=false;
 await page.route('**/api/supplier-payments',async route=>{const response=await route.fetch();if(!dropped&&response.ok()){dropped=true;await route.abort('failed');}else await route.fulfill({response});});await confirm('Supplier to‘lovi');await expect(page.getByRole('button',{name:'Original amalni qayta tekshirish',exact:true})).toBeVisible();await page.reload();await page.getByRole('button',{name:'Saqlangan amalni qayta tekshirish',exact:true}).click();await expect(page.getByText('Taqsimlanmagan avans: 10.25',{exact:true})).toBeVisible();await expect(page.getByRole('button',{name:'Saqlangan amalni qayta tekshirish',exact:true})).not.toBeVisible();
 expect(await db.supplierPayment.count({where:{supplierId:supplier.id}})).toBe(2);const advance=await db.supplierPayment.findFirstOrThrow({where:{supplierId:supplier.id,financialDocument:{reason:'Actual supplier advance recovered'}}});
 await page.getByLabel('Supplier invoice raqami',{exact:true}).fill('PRESERVED-ON-READ-ERROR');
 let readFailure=true;await page.route('**/api/suppliers/'+supplier.id+'/ledger?page=*',async route=>{if(readFailure){readFailure=false;await route.abort('failed');}else await route.continue();});
 await page.getByLabel('Avans yozuvi',{exact:true}).selectOption(advance.id);await page.getByLabel('Avans uchun invoice',{exact:true}).selectOption(invoice.id);await page.getByLabel('Avans taqsimot summasi',{exact:true}).fill('10.25');await page.getByLabel('Avans taqsimot sababi',{exact:true}).fill('Apply recovered advance to invoice');await confirm('Avans taqsimlash');await expect(page.getByRole('button',{name:'Supplier hisobini qayta tekshirish',exact:true})).toBeVisible();await expect(page.getByLabel('Supplier invoice raqami',{exact:true})).toHaveValue('PRESERVED-ON-READ-ERROR');await expect(page.getByRole('button',{name:'Invoice qayd etish: oldindan ko‘rish',exact:true})).toBeDisabled();await page.getByRole('button',{name:'Supplier hisobini qayta tekshirish',exact:true}).click();await expect(page.getByLabel('Supplier invoice raqami',{exact:true})).toBeEnabled();await expect(page.getByLabel('Supplier invoice raqami',{exact:true})).toHaveValue('PRESERVED-ON-READ-ERROR');await expect(page.getByText('To‘lanmagan qarz: 39.75',{exact:true})).toBeVisible();await expect(page.getByText('Taqsimlanmagan avans: 0',{exact:true})).toBeVisible();expect(await db.supplierPayment.count({where:{supplierId:supplier.id}})).toBe(2);
 const accounts=(await (await page.request.get('/api/finance/accounts')).json()).data;expect(accounts.find((a:{id:string})=>a.id===account.id).balance).toBe('959.75');
});

test('Purchase order UI accepts two receipts and preserves original unknown receipt intent across reload',async({page})=>{
 const phone='998'+Date.now();phones.push(phone);const origin={Origin:'https://localhost:3100'};expect((await page.request.post('/api/auth/register',{headers:origin,data:{fullName:'Purchase order owner',phone,password:'test-only-password',organizationName:'Order browser'}})).ok()).toBe(true);
 const me=(await (await page.request.get('/api/auth/me')).json()).data;orgs.push(me.organization.id);users.push(me.user.id);const store=await db.store.findFirstOrThrow({where:{organizationId:me.organization.id}}),supplier=await db.supplier.create({data:{organizationId:me.organization.id,name:'Order browser supplier'}}),product=await db.product.create({data:{organizationId:me.organization.id,name:'Order browser product',sku:randomUUID(),barcode:randomUUID(),unit:'dona',salePrice:100,costPrice:50}});
 await page.goto('/suppliers/'+supplier.id);await page.getByLabel('Buyurtma filiali',{exact:true}).selectOption(store.id);await page.getByLabel('Buyurtma raqami',{exact:true}).fill('UI-ORDER-FIVE');await page.getByLabel('Buyurtma sababi',{exact:true}).fill('Actual purchase five units');await page.getByLabel('Mahsulot',{exact:true}).selectOption(product.id);await page.getByLabel('Buyurtma miqdori 1',{exact:true}).fill('5');await page.getByLabel('Buyurtma xarid narxi 1',{exact:true}).fill('10.25');
 const confirm=async(label:string)=>{await page.getByRole('button',{name:label+': oldindan ko‘rish',exact:true}).click();await page.getByRole('button',{name:'Amalni tasdiqlash',exact:true}).click();};await confirm('Xarid buyurtmasi');await page.getByRole('button',{name:'UI-ORDER-FIVE · '+store.name,exact:true}).click();await expect(page.getByText('Buyurtma holati: ordered',{exact:true})).toBeVisible();await page.getByLabel('Qabul miqdori 1',{exact:true}).fill('2');await page.getByLabel('Qabul invoice raqami',{exact:true}).fill('UI-RECEIPT-TWO');await page.getByLabel('Qabul sababi',{exact:true}).fill('First two units received');await confirm('Buyurtmani qabul qilish');await expect(page.getByText('Buyurtma holati: partial',{exact:true})).toBeVisible();await expect(page.getByText('To‘lanmagan qarz: 20.5',{exact:true})).toBeVisible();
 await page.getByLabel('Qabul miqdori 1',{exact:true}).fill('3');await page.getByLabel('Qabul invoice raqami',{exact:true}).fill('UI-RECEIPT-THREE');await page.getByLabel('Qabul sababi',{exact:true}).fill('Remaining three actual units');let lost=false;await page.route('**/api/purchase-orders/*/receive',async route=>{const response=await route.fetch();if(!lost&&response.ok()){lost=true;await route.abort('failed');}else await route.fulfill({response});});await confirm('Buyurtmani qabul qilish');await expect(page.getByRole('button',{name:'Original amalni qayta tekshirish',exact:true})).toBeVisible();await page.reload();await page.getByRole('button',{name:'Saqlangan amalni qayta tekshirish',exact:true}).click();await expect(page.getByRole('button',{name:'Saqlangan amalni qayta tekshirish',exact:true})).not.toBeVisible();await page.getByRole('button',{name:'UI-ORDER-FIVE · '+store.name,exact:true}).click();await expect(page.getByText('Buyurtma holati: received',{exact:true})).toBeVisible();await expect(page.getByText('To‘lanmagan qarz: 51.25',{exact:true})).toBeVisible();
 const order=await db.purchaseOrder.findFirstOrThrow({where:{supplierId:supplier.id}});expect(await db.purchaseReceipt.count({where:{orderId:order.id}})).toBe(2);expect(await db.supplierInvoice.count({where:{supplierId:supplier.id}})).toBe(2);expect((await db.inventoryBalance.findUniqueOrThrow({where:{storeId_productId:{storeId:store.id,productId:product.id}}})).quantity.toString()).toBe('5');expect((await db.purchaseReceiptLine.count({where:{receipt:{orderId:order.id}}}))).toBe(2);
 await page.goto('/reports/supplier-balances');await expect(page.getByText('To‘lanmagan qarz: 51.25',{exact:true})).toBeVisible();await expect(page.getByText('Muddatsiz: 51.25',{exact:true})).toBeVisible();const download=page.waitForEvent('download');await page.getByRole('button',{name:'Supplier balansini CSV yuklash',exact:true}).click();expect((await download).suggestedFilename()).toBe('supplier-balances.csv');
});

test('Supplier return UI preserves original lost credit intent, releases paid amount to advance and never posts a cash refund',async({page})=>{
 const phone='998'+Date.now();phones.push(phone);const origin={Origin:'https://localhost:3100'};expect((await page.request.post('/api/auth/register',{headers:origin,data:{fullName:'Supplier return owner',phone,password:'test-only-password',organizationName:'Return browser'}})).ok()).toBe(true);const me=(await (await page.request.get('/api/auth/me')).json()).data;orgs.push(me.organization.id);users.push(me.user.id);const store=await db.store.findFirstOrThrow({where:{organizationId:me.organization.id}}),register=await db.register.findFirstOrThrow({where:{storeId:store.id}}),member=await db.organizationUser.findFirstOrThrow({where:{organizationId:me.organization.id,userId:me.user.id}}),supplier=await db.supplier.create({data:{organizationId:me.organization.id,name:'Original return browser supplier'}}),product=await db.product.create({data:{organizationId:me.organization.id,name:'Original return product',sku:randomUUID(),barcode:randomUUID(),unit:'dona',salePrice:100,costPrice:10}}),shift=await db.shift.create({data:{registerId:register.id,organizationUserId:member.id,openingCash:1000}});
 const create=await page.request.post('/api/purchase-orders',{headers:origin,data:{operationId:randomUUID(),storeId:store.id,supplierId:supplier.id,referenceNo:'BROWSER-RETURN-ORDER',reason:'Original paid purchase',items:[{productId:product.id,quantity:'2',unitCost:'10'}]}});expect(create.ok()).toBe(true);const order=(await create.json()).data;const receive=await page.request.post('/api/purchase-orders/'+order.id+'/receive',{headers:origin,data:{operationId:randomUUID(),referenceNo:'BROWSER-RETURN-RECEIPT',reason:'Original actual receipt',items:[{orderItemId:order.items[0].id,quantity:'2'}]}});expect(receive.ok()).toBe(true);const receipt=(await receive.json()).data;const accountResponse=await page.request.post('/api/finance/accounts',{headers:origin,data:{operationId:randomUUID(),storeId:store.id,registerId:register.id,name:'Return browser cash',kind:'cash',reason:'Actual opening till'}});expect(accountResponse.ok()).toBe(true);const account=(await accountResponse.json()).data;expect((await page.request.post('/api/supplier-payments',{headers:origin,data:{operationId:randomUUID(),supplierId:supplier.id,accountId:account.id,shiftId:shift.id,amount:'20',reason:'Original supplier paid cash',allocations:[{invoiceId:receipt.invoice.id,amount:'20'}]}})).ok()).toBe(true);
 let prompts=0;page.on('dialog',async dialog=>{if(dialog.type()==='beforeunload')await dialog.accept();else{prompts++;await dialog.dismiss();}});
 await page.goto('/suppliers/'+supplier.id);await page.getByLabel('Supplier qaytarish invoice',{exact:true}).selectOption(receipt.invoice.id);await expect(page.getByLabel('Supplier qaytarish miqdori 1',{exact:true})).toBeVisible();await page.getByLabel('Supplier qaytarish invoice',{exact:true}).selectOption(receipt.invoice.id);await page.getByLabel('Supplier qaytarish miqdori 1',{exact:true}).fill('1');await page.getByLabel('Supplier credit sababi',{exact:true}).fill('One actual original unit returned');
 await page.locator('a[href="/dashboard"]').first().click();await expect(page).toHaveURL(new RegExp('/suppliers/'+supplier.id+'$'));
 await page.getByLabel('Supplier credit turi',{exact:true}).selectOption('price_correction');await expect(page.getByLabel('Supplier credit turi',{exact:true})).toHaveValue('goods_return');await expect(page.getByLabel('Supplier qaytarish miqdori 1',{exact:true})).toHaveValue('1');expect(prompts).toBe(2);
 let entered!:()=>void,release!:()=>void,previews=0;const started=new Promise<void>(resolve=>{entered=resolve}),gate=new Promise<void>(resolve=>{release=resolve});
 const previewPath='**/api/supplier-invoices/'+receipt.invoice.id+'/credits';
 await page.route(previewPath,async route=>{if(route.request().method()==='POST'&&route.request().postDataJSON().preview){previews++;const response=await route.fetch();expect(response.ok()).toBe(true);entered();await gate;await route.abort('failed');}else await route.continue();});
 try{await page.getByRole('button',{name:'Supplier credit server preview',exact:true}).evaluate(button=>{const form=(button as HTMLButtonElement).form!;form.requestSubmit();form.requestSubmit();});await started;await expect(page.getByLabel('Supplier qaytarish miqdori 1',{exact:true})).toBeDisabled();await page.locator('a[href="/dashboard"]').first().click();await expect(page).toHaveURL(new RegExp('/suppliers/'+supplier.id+'$'));expect(prompts).toBe(2);}finally{release();}
 await expect(page.getByRole('button',{name:'Original invoiceni qayta tekshirish',exact:true})).toBeVisible();await expect(page.getByLabel('Supplier qaytarish miqdori 1',{exact:true})).toHaveValue('1');expect(previews).toBe(1);expect(await db.supplierCredit.count({where:{invoiceId:receipt.invoice.id}})).toBe(0);
 await page.unroute(previewPath);await page.getByRole('button',{name:'Supplier credit server preview',exact:true}).click();await page.getByRole('button',{name:'Supplier credit: oldindan ko‘rish',exact:true}).click();await expect(page.getByText('Credit: 10',{exact:true})).toBeVisible();let lost=false;await page.route('**/api/supplier-invoices/*/credits',async route=>{if(route.request().method()==='POST'&&!route.request().postDataJSON().preview){const response=await route.fetch();if(!lost&&response.ok()){lost=true;await route.abort('failed');}else await route.fulfill({response});}else await route.continue();});await page.getByRole('button',{name:'Amalni tasdiqlash',exact:true}).click();await expect(page.getByRole('button',{name:'Original amalni qayta tekshirish',exact:true})).toBeVisible();await page.reload();await page.getByRole('button',{name:'Saqlangan amalni qayta tekshirish',exact:true}).click();await expect(page.getByText('Taqsimlanmagan avans: 10',{exact:true})).toBeVisible();expect(await db.supplierCredit.count({where:{invoiceId:receipt.invoice.id}})).toBe(1);expect((await db.inventoryBalance.findUniqueOrThrow({where:{storeId_productId:{storeId:store.id,productId:product.id}}})).quantity.toString()).toBe('1');expect(await db.cashMovement.count({where:{shiftId:shift.id}})).toBe(1);
 await page.getByLabel('Supplier qaytarish invoice',{exact:true}).selectOption(receipt.invoice.id);await page.getByLabel('Supplier qaytarish miqdori 1',{exact:true}).fill('1');await page.getByLabel('Supplier credit sababi',{exact:true}).fill('Last actual original unit returned');await page.getByRole('button',{name:'Supplier credit server preview',exact:true}).click();await page.getByRole('button',{name:'Supplier credit: oldindan ko‘rish',exact:true}).click();await page.getByRole('button',{name:'Amalni tasdiqlash',exact:true}).click();await expect(page.getByText('Taqsimlanmagan avans: 20',{exact:true})).toBeVisible();expect(await db.cashMovement.count({where:{shiftId:shift.id}})).toBe(1);expect((await db.inventoryBalance.findUniqueOrThrow({where:{storeId_productId:{storeId:store.id,productId:product.id}}})).quantity.toString()).toBe('0');const accounts=(await (await page.request.get('/api/finance/accounts')).json()).data;expect(accounts.find((a:{id:string})=>a.id===account.id).balance).toBe('980');
});

test('Variant UI creates independent color size SKU and restores the original lost creation intent once',async({page})=>{
 const phone='998'+Date.now();phones.push(phone);const origin={Origin:'https://localhost:3100'};expect((await page.request.post('/api/auth/register',{headers:origin,data:{fullName:'Variant owner',phone,password:'test-only-password',organizationName:'Variant business'}})).ok()).toBe(true);
 const me=(await (await page.request.get('/api/auth/me')).json()).data;orgs.push(me.organization.id);users.push(me.user.id);const store=await db.store.findFirstOrThrow({where:{organizationId:me.organization.id}}),base=await db.product.create({data:{organizationId:me.organization.id,name:'Original shirt',sku:randomUUID(),barcode:randomUUID(),unit:'dona',salePrice:'10',costPrice:'5'}});await db.inventoryBalance.create({data:{storeId:store.id,productId:base.id,quantity:7}});
 await page.goto('/products/'+base.id+'/variants');await expect(page.getByRole('heading',{name:'Mahsulot variantlari: Original shirt',exact:true})).toBeVisible();const sku=randomUUID(),barcode=randomUUID();await page.getByLabel('Variant nomi',{exact:true}).fill('Shirt red M');await page.getByLabel('Variant SKU',{exact:true}).fill(sku);await page.getByLabel('Variant barkodi',{exact:true}).fill(barcode);await page.getByLabel('Variant narxi',{exact:true}).fill('12.50');await page.getByLabel('Variant qiymati 1',{exact:true}).fill('Red');await page.getByLabel('Variant qiymati 2',{exact:true}).fill('M');await page.getByLabel('Variant yaratish sababi',{exact:true}).fill('Independent apparel color size');
 let lost=false;await page.route('**/api/products/*/variants',async route=>{if(route.request().method()==='POST'){const response=await route.fetch();if(!lost&&response.ok()){lost=true;await route.abort('failed');}else await route.fulfill({response});}else await route.continue();});await page.getByRole('button',{name:'Mahsulot varianti: oldindan ko‘rish',exact:true}).click();await page.getByRole('button',{name:'Amalni tasdiqlash',exact:true}).click();await expect(page.getByRole('button',{name:'Original amalni qayta tekshirish',exact:true})).toBeVisible();await page.reload();await page.getByRole('button',{name:'Saqlangan amalni qayta tekshirish',exact:true}).click();await expect(page.getByRole('button',{name:'Saqlangan amalni qayta tekshirish',exact:true})).not.toBeVisible();await page.getByRole('button',{name:'Tanlash: Shirt red M',exact:true}).click();await expect(page.getByText('Tanlangan variant: Shirt red M · SKU '+sku+' · barkod '+barcode+' · qoldiq 0 dona. Kassada aynan shu SKU yoki barkodni kiriting.',{exact:true})).toBeVisible();
 expect(await db.product.count({where:{organizationId:me.organization.id,sku}})).toBe(1);const variant=await db.product.findFirstOrThrow({where:{organizationId:me.organization.id,sku}});expect((await db.productVariant.findUniqueOrThrow({where:{productId:variant.id}})).rootProductId).toBe(base.id);expect(await db.productVariant.count({where:{rootProductId:base.id}})).toBe(2);expect((await db.inventoryBalance.findUniqueOrThrow({where:{storeId_productId:{storeId:store.id,productId:base.id}}})).quantity.toString()).toBe('7');expect(await db.inventoryMovement.count({where:{organizationId:me.organization.id}})).toBe(0);expect(await db.payment.count({where:{organizationId:me.organization.id}})).toBe(0);
});


test('Catalog tree brand description and protected image UI recover a lost upload and delete retained bytes safely',async({page,browser})=>{
 const phone='998'+Date.now();phones.push(phone);const origin={Origin:'https://localhost:3100'};expect((await page.request.post('/api/auth/register',{headers:origin,data:{fullName:'Media owner',phone,password:'test-only-password',organizationName:'Protected media business'}})).ok()).toBe(true);const me=(await (await page.request.get('/api/auth/me')).json()).data;orgs.push(me.organization.id);users.push(me.user.id);const product=await db.product.create({data:{organizationId:me.organization.id,name:'Protected shirt',sku:randomUUID(),barcode:randomUUID(),unit:'dona',salePrice:'10',costPrice:'5'}});
 const rootResponse=await page.request.post('/api/categories',{headers:origin,data:{organizationId:me.organization.id,name:'Clothes'}});expect(rootResponse.ok()).toBe(true);const root=(await rootResponse.json()).data;
 await page.goto('/products/categories');await page.getByLabel('Kategoriya nomi',{exact:true}).fill('Shirts');await page.getByLabel('Ota kategoriya',{exact:true}).selectOption(root.id);await page.getByRole('button',{name:'Saqlash',exact:true}).click();await expect(page.getByRole('cell').filter({hasText:'Shirts'})).toBeVisible();const child=await db.category.findFirstOrThrow({where:{organizationId:me.organization.id,name:'Shirts'}});expect(child.parentId).toBe(root.id);
 await page.goto('/products/brands');await page.getByLabel('Brend nomi',{exact:true}).fill('Original apparel brand');await page.getByRole('button',{name:'Brendni saqlash',exact:true}).click();await expect(page.getByRole('button',{name:'Brendni tahrirlash: Original apparel brand',exact:true})).toBeVisible();const brand=await db.brand.findFirstOrThrow({where:{organizationId:me.organization.id,name:'Original apparel brand'}});
 await page.route('**/products/'+product.id+'/media',async route=>{const response=await route.fetch();const html=await response.text();await route.fulfill({response,body:html.replace('</body>','<script>window.__untrustedCatalogScript=true</script></body>')});});const navigation=await page.goto('/products/'+product.id+'/media');expect(navigation?.headers()['content-security-policy']).toContain("'strict-dynamic'");expect(await page.evaluate(()=>Boolean((window as unknown as Record<string,unknown>).__untrustedCatalogScript))).toBe(false);await page.getByLabel('Mahsulot brendi',{exact:true}).selectOption(brand.id);await page.getByLabel('Mahsulot tavsifi',{exact:true}).fill('<script>display as text only</script>');const updated=page.waitForResponse(r=>r.url().includes('/api/products/'+product.id)&&r.request().method()==='PUT');await page.getByRole('button',{name:'Katalog metama’lumotlarini saqlash',exact:true}).click();expect((await updated).ok()).toBe(true);expect((await db.product.findUniqueOrThrow({where:{id:product.id}})).brandId).toBe(brand.id);
 const buffer=await sharp({create:{width:4,height:3,channels:4,background:'red'}}).withMetadata().png().toBuffer();await page.getByLabel('Mahsulot rasm fayli',{exact:true}).setInputFiles({name:'shirt.png',mimeType:'image/png',buffer});let lost=false;await page.route('**/api/files',async route=>{if(route.request().method()==='POST'){const response=await route.fetch();if(!lost&&response.ok()){lost=true;await route.abort('failed');}else await route.fulfill({response});}else await route.continue();});await page.getByRole('button',{name:'Mahsulot rasmi: oldindan ko‘rish',exact:true}).click();await page.getByRole('button',{name:'Amalni tasdiqlash',exact:true}).click();await expect(page.getByRole('button',{name:'Original amalni qayta tekshirish',exact:true})).toBeVisible();await page.reload();await page.getByRole('button',{name:'Saqlangan amalni qayta tekshirish',exact:true}).click();await expect(page.getByRole('button',{name:'Saqlangan amalni qayta tekshirish',exact:true})).not.toBeVisible();const image=page.getByRole('img',{name:'Protected shirt',exact:true});await expect(image).toBeVisible();await expect.poll(()=>image.evaluate(element=>(element as HTMLImageElement).naturalWidth)).toBe(4);expect(await db.fileAsset.count({where:{productId:product.id}})).toBe(1);const asset=await db.fileAsset.findFirstOrThrow({where:{productId:product.id}});expect(asset.mime).toBe('image/webp');const outsider=await browser.newContext({ignoreHTTPSErrors:true});try{expect((await outsider.request.get('https://localhost:3100/api/files/'+asset.id)).status()).toBe(401);}finally{await outsider.close();}
 await page.getByRole('button',{name:'Rasmni o‘chirish: shirt.png: oldindan ko‘rish',exact:true}).click();await page.getByRole('button',{name:'Amalni tasdiqlash',exact:true}).click();await expect(image).not.toBeVisible();expect((await db.fileAsset.findUniqueOrThrow({where:{id:asset.id}})).data).toBe(null);expect((await page.request.get('/api/files/'+asset.id)).status()).toBe(410);expect((await db.product.findUniqueOrThrow({where:{id:product.id}})).description).toBe('<script>display as text only</script>');
});

test('Cashier PIN UI sets a password-protected credential and switches only to branch-scoped cashier without manager elevation',async({page,browser})=>{
 const phone='998'+Date.now();phones.push(phone);const origin={Origin:'https://localhost:3100'};expect((await page.request.post('/api/auth/register',{headers:origin,data:{fullName:'PIN owner',phone,password:'test-only-password',organizationName:'PIN UI business'}})).ok()).toBe(true);const me=(await (await page.request.get('/api/auth/me')).json()).data;orgs.push(me.organization.id);users.push(me.user.id);const store=await db.store.findFirstOrThrow({where:{organizationId:me.organization.id}}),hidden=await db.store.create({data:{organizationId:me.organization.id,name:'PIN other branch'}});const {default:bcrypt}=await import('bcryptjs');const cashierPhone='998'+Date.now()+'1';phones.push(cashierPhone);const cashier=await db.user.create({data:{fullName:'PIN browser cashier',phone:cashierPhone,passwordHash:await bcrypt.hash('test-only-password',12)}});users.push(cashier.id);const membership=await db.organizationUser.create({data:{organizationId:me.organization.id,userId:cashier.id,role:'cashier',userStores:{create:[{storeId:store.id},{storeId:hidden.id}]}}});
 const cashierContext=await browser.newContext({ignoreHTTPSErrors:true});try{expect((await cashierContext.request.post('https://localhost:3100/api/auth/login',{headers:origin,data:{phone:cashierPhone,password:'test-only-password'}})).ok()).toBe(true);const cashierPage=await cashierContext.newPage();await cashierPage.goto('https://localhost:3100/security');await cashierPage.getByLabel('PIN sozlash uchun parol',{exact:true}).fill('test-only-password');await cashierPage.getByLabel('Yangi kassir PIN',{exact:true}).fill('654321');await cashierPage.getByRole('button',{name:'Kassir PINni saqlash',exact:true}).click();await expect(cashierPage.getByRole('status').filter({hasText:'PIN saqlandi'})).toHaveText('PIN saqlandi');expect(await bcrypt.compare('654321',(await db.organizationUser.findUniqueOrThrow({where:{id:membership.id}})).pinHash!)).toBe(true);}finally{await cashierContext.close();}
 await page.goto('/security');await page.getByLabel('Almashiladigan kassir',{exact:true}).selectOption(membership.id);await page.getByLabel('Almashish PIN',{exact:true}).fill('000000');await page.getByRole('button',{name:'PIN bilan kassirni almashtirish',exact:true}).click();await expect(page.getByRole('status').filter({hasText:'Kassir yoki PIN noto‘g‘ri'})).toContainText('Kassir yoki PIN noto‘g‘ri');await page.getByLabel('Almashish PIN',{exact:true}).fill('654321');await page.getByRole('button',{name:'PIN bilan kassirni almashtirish',exact:true}).click();await page.waitForURL('**/pos');const current=(await (await page.request.get('/api/auth/me')).json()).data;expect(current.user.id).toBe(cashier.id);expect(current.role).toBe('cashier');expect(current.stores.map((s:{id:string})=>s.id)).toEqual([store.id]);const stores=(await (await page.request.get('/api/stores?organizationId='+me.organization.id)).json()).data;expect(stores.map((s:{id:string})=>s.id)).toEqual([store.id]);expect((await page.request.post('/api/products',{headers:origin,data:{}})).status()).toBe(403);await db.organizationUser.update({where:{id:membership.id},data:{role:'admin'}});expect((await page.request.get('/api/auth/me')).status()).toBe(401);
});

test('Configured tax UI recovers original rate acknowledgement, binds POS server quote and preserves old tax and profit after configuration changes',async({page})=>{
 const phone='998'+Date.now();phones.push(phone);const origin={Origin:'https://localhost:3100'};expect((await page.request.post('/api/auth/register',{headers:origin,data:{fullName:'Tax UI owner',phone,password:'test-only-password',organizationName:'Configured tax business'}})).ok()).toBe(true);const me=(await (await page.request.get('/api/auth/me')).json()).data;orgs.push(me.organization.id);users.push(me.user.id);const store=await db.store.findFirstOrThrow({where:{organizationId:me.organization.id}}),register=await db.register.findFirstOrThrow({where:{storeId:store.id}});const shiftResponse=await page.request.post('/api/shifts',{headers:origin,data:{operationId:randomUUID(),registerId:register.id,organizationUserId:me.user.organizationUserId,openingCash:1000}});expect(shiftResponse.ok()).toBe(true);const product=await db.product.create({data:{organizationId:me.organization.id,name:'Tax browser product',sku:'TAX-BROWSER',barcode:randomUUID(),unit:'dona',salePrice:'100',costPrice:'40'}});await db.inventoryBalance.create({data:{storeId:store.id,productId:product.id,quantity:10}});
 await page.goto('/settings/taxes');await page.getByLabel('Soliq profili nomi',{exact:true}).fill('Business configured excluded tax');await page.getByRole('button',{name:'Soliq profilini yaratish: oldindan ko‘rish',exact:true}).click();await page.getByRole('button',{name:'Amalni tasdiqlash',exact:true}).click();await page.getByRole('button',{name:'Soliq tarixini ochish: Business configured excluded tax',exact:true}).click();const profile=await db.taxProfile.findFirstOrThrow({where:{organizationId:me.organization.id}});await page.getByLabel('Soliq hisoblash usuli',{exact:true}).selectOption('excluded');await page.getByLabel('Soliq stavkasi foiz',{exact:true}).fill('12');let lost=false;await page.route('**/api/taxes/*/versions',async route=>{if(route.request().method()==='POST'){const response=await route.fetch();if(!lost&&response.ok()){lost=true;await route.abort('failed');}else await route.fulfill({response});}else await route.continue();});await page.getByRole('button',{name:'Soliq stavkasini yozish: oldindan ko‘rish',exact:true}).click();await page.getByRole('button',{name:'Amalni tasdiqlash',exact:true}).click();await expect(page.getByRole('button',{name:'Original amalni qayta tekshirish',exact:true})).toBeVisible();await page.reload();await page.getByRole('button',{name:'Saqlangan amalni qayta tekshirish',exact:true}).click();await expect(page.getByRole('button',{name:'Saqlangan amalni qayta tekshirish',exact:true})).not.toBeVisible();expect(await db.taxProfileVersion.count({where:{profileId:profile.id}})).toBe(1);
 await page.goto('/products/'+product.id+'/media');await page.getByLabel('Mahsulot soliq profili',{exact:true}).selectOption(profile.id);const saved=page.waitForResponse(r=>r.url().includes('/api/products/'+product.id)&&r.request().method()==='PUT');await page.getByRole('button',{name:'Katalog metama’lumotlarini saqlash',exact:true}).click();expect((await saved).ok()).toBe(true);
 await page.goto('/pos');await expect(page.getByLabel('POS mahsulot qidirish',{exact:true})).toBeEnabled();await page.getByLabel('POS mahsulot qidirish',{exact:true}).fill('TAX-BROWSER');await page.keyboard.press('Enter');await page.getByRole('button',{name:"To'lovga o'tish",exact:true}).click();await expect(page.getByRole('dialog')).toContainText('soliq qismi 12, soliqsiz 100');await page.getByLabel("Mijoz bergan naqd pul (so'm)").fill('112');await page.getByRole('button',{name:/Savdoni yakunlash/}).click();await expect(page.getByRole('dialog')).toContainText('Jami ichidagi soliq qismi:');const sale=await db.sale.findFirstOrThrow({where:{organizationId:me.organization.id,status:'completed'},include:{items:true}});expect(sale.totalAmount.toString()).toBe('112');expect(sale.taxAmount.toString()).toBe('12');expect(sale.items[0].taxBase!.toString()).toBe('100');expect(sale.items[0].unitCost.toString()).toBe('40');const version=sale.items[0].taxVersionId;
 expect((await page.request.post('/api/taxes/'+profile.id+'/versions',{headers:origin,data:{operationId:randomUUID(),mode:'excluded',rate:'20',effectiveAt:new Date().toISOString()}})).ok()).toBe(true);await db.product.update({where:{id:product.id},data:{costPrice:'90',salePrice:'200'}});const historical=await db.saleItem.findUniqueOrThrow({where:{id:sale.items[0].id}});expect(historical.taxVersionId).toBe(version);expect(historical.unitCost.toString()).toBe('40');const report=await page.request.get('/api/reports/profit');expect(report.ok()).toBe(true);const totals=(await report.json()).data.summary;expect(totals.netSales).toBe('100');expect(totals.grossProfit).toBe('60');
});
test('Discount UI applies exact line and receipt percentages with reason and immutable manager authorization',async({page})=>{
 const phone='998'+Date.now();phones.push(phone);const origin={Origin:'https://localhost:3100'};expect((await page.request.post('/api/auth/register',{headers:origin,data:{fullName:'Discount owner',phone,password:'test-only-password',organizationName:'Discount production core'}})).ok()).toBe(true);const me=(await (await page.request.get('/api/auth/me')).json()).data;orgs.push(me.organization.id);users.push(me.user.id);const store=await db.store.findFirstOrThrow({where:{organizationId:me.organization.id}}),register=await db.register.findFirstOrThrow({where:{storeId:store.id}}),member=await db.organizationUser.findFirstOrThrow({where:{organizationId:me.organization.id,userId:me.user.id}});await db.shift.create({data:{registerId:register.id,organizationUserId:member.id,openingCash:1000}});const product=await db.product.create({data:{organizationId:me.organization.id,name:'Discount percent item',sku:randomUUID(),barcode:randomUUID(),unit:'dona',salePrice:100,costPrice:40}});await db.inventoryBalance.create({data:{storeId:store.id,productId:product.id,quantity:10}});
 await page.goto('/pos');await expect(page.getByLabel('POS mahsulot qidirish',{exact:true})).toBeEnabled();await page.getByRole('button',{name:'Discount percent item — savatga qo‘shish',exact:true}).click();await page.getByRole('button',{name:'Chegirma',exact:true}).click();await page.getByLabel('Discount percent item qator chegirmasi turi',{exact:true}).selectOption('percent');await page.getByLabel('Discount percent item qator chegirmasi',{exact:true}).fill('10');await page.getByRole('button',{name:"Chegirma qo'llash",exact:true}).click();await page.getByLabel('Butun chek chegirmasi turi',{exact:true}).selectOption('percent');await page.getByLabel('Butun chek chegirmasi',{exact:true}).fill('5');await page.getByLabel('Chegirma sababi',{exact:true}).fill('Reviewed owner promotion');await expect(page.getByText('Savat lokal saqlandi',{exact:true})).toBeVisible();await page.reload();await expect(page.getByLabel('Chegirma sababi',{exact:true})).toHaveValue('Reviewed owner promotion');await page.getByRole('button',{name:"To'lovga o'tish",exact:true}).click();await page.getByLabel("Mijoz bergan naqd pul (so'm)").fill('85.50');await page.getByRole('button',{name:/Savdoni yakunlash/}).click();await expect(page.getByRole('dialog')).toContainText('Chegirma sababi: Reviewed owner promotion');const sale=await db.sale.findFirstOrThrow({where:{organizationId:me.organization.id,status:'completed'},include:{items:true}});expect(sale.totalAmount.toString()).toBe('85.5');expect(sale.discountAmount.toString()).toBe('4.5');expect(sale.discountPercent?.toString()).toBe('5');expect(sale.items[0].discountPercent?.toString()).toBe('10');expect(sale.discountApprovedBy).toBe(me.user.id);expect(sale.discountApprovedRole).toBe('owner');expect(await db.payment.count({where:{saleId:sale.id}})).toBe(1);
});

test.describe('Real PWA worker',()=>{
test.use({serviceWorkers:'allow'});
test('PWA private catalog uses scoped bounded TTL, expires offline and keeps API and receipts out of shared cache',async({page})=>{
 const phone='998'+Date.now();phones.push(phone);const origin={Origin:'https://localhost:3100'};
 expect((await page.request.post('/api/auth/register',{headers:origin,data:{fullName:'PWA owner',phone,password:'test-only-password',organizationName:'PWA catalog business'}})).ok()).toBe(true);
 const me=(await (await page.request.get('/api/auth/me')).json()).data;orgs.push(me.organization.id);users.push(me.user.id);
 const store=await db.store.findFirstOrThrow({where:{organizationId:me.organization.id}}),register=await db.register.findFirstOrThrow({where:{storeId:store.id}});
 await db.product.create({data:{organizationId:me.organization.id,name:'PWA scoped item',sku:randomUUID(),barcode:randomUUID(),unit:'dona',salePrice:'15.25',costPrice:'7'}});
 const manifest=await (await page.request.get('/manifest.webmanifest')).json();expect(manifest.display).toBe('standalone');expect(manifest.start_url).toBe('/pos');expect(manifest.icons.map((x:{sizes:string})=>x.sizes)).toEqual(['192x192','512x512']);
 for(const icon of manifest.icons){const response=await page.request.get(icon.src);expect(response.ok()).toBe(true);expect(response.headers()['content-type']).toContain('image/png');}
 await page.goto('/pos');
 await expect(page.getByRole('button',{name:'PWA scoped item — tezkor ro‘yxat',exact:true})).toBeVisible();
 const inspect=()=>page.evaluate(async()=>{const r=indexedDB.open('shuni-pos-local-v1');const d=await new Promise<IDBDatabase>((resolve,reject)=>{r.onsuccess=()=>resolve(r.result);r.onerror=()=>reject(r.error)});try{return await new Promise<Record<string,unknown>[]>((resolve,reject)=>{const q=d.transaction('catalogs').objectStore('catalogs').getAll();q.onsuccess=()=>resolve(q.result);q.onerror=()=>reject(q.error)})}finally{d.close()}});
 await expect.poll(async()=>(await inspect()).length).toBe(1);const [saved]=await inspect();expect(saved.scope).toEqual({organizationId:me.organization.id,userId:me.user.id,deviceId:expect.any(String),registerId:register.id});expect(JSON.stringify(saved)).not.toContain('costPrice');expect(JSON.stringify(saved)).not.toContain('balance');
 let actions=0;page.on('request',r=>{if(r.method()==='POST'&&new URL(r.url()).pathname.startsWith('/api/sales'))actions++});
 await page.context().setOffline(true);await page.evaluate(()=>window.dispatchEvent(new Event('offline')));
 await expect(page.getByRole('status').filter({hasText:'Oxirgi qidiruvning lokal katalogi'})).toBeVisible();
 await expect(page.getByRole('button',{name:'PWA scoped item — tezkor ro‘yxat',exact:true})).toBeVisible();
 await page.evaluate(async()=>{const r=indexedDB.open('shuni-pos-local-v1');const d=await new Promise<IDBDatabase>(resolve=>{r.onsuccess=()=>resolve(r.result)});await new Promise<void>(resolve=>{const tx=d.transaction('catalogs','readwrite'),s=tx.objectStore('catalogs'),q=s.getAll();q.onsuccess=()=>{for(const row of q.result)s.put({...row,lease:{...row.lease,expiresAt:new Date(Date.now()-1).toISOString()}})};tx.oncomplete=()=>resolve()});d.close();window.dispatchEvent(new Event('offline'))});
 await expect(page.getByRole('status').filter({hasText:'Lokal katalog yo‘q yoki muddati tugagan'})).toBeVisible();await expect(page.getByRole('button',{name:'PWA scoped item — tezkor ro‘yxat',exact:true})).not.toBeVisible();expect(actions).toBe(0);
 await page.context().setOffline(false);await page.evaluate(()=>window.dispatchEvent(new Event('online')));await expect(page.getByRole('button',{name:'PWA scoped item — tezkor ro‘yxat',exact:true})).toBeVisible();
 await expect.poll(()=>page.evaluate(async()=>Boolean((await navigator.serviceWorker.getRegistration('/'))?.active))).toBe(true);
 await page.reload();await expect(page.getByRole('button',{name:'PWA scoped item — tezkor ro‘yxat',exact:true})).toBeVisible();await expect.poll(()=>page.evaluate(()=>Boolean(navigator.serviceWorker.controller))).toBe(true);
 const cached=await page.evaluate(async()=>{const rows:string[]=[];for(const key of await caches.keys()){for(const r of await (await caches.open(key)).keys())rows.push(new URL(r.url).pathname)}return rows});expect(cached.sort()).toEqual(['/pwa/cash-crypto.js','/pwa/cash-screen.js','/pwa/cash-store.js','/pwa/cash.html','/pwa/format.js','/pwa/icon-192.png','/pwa/icon-512.png','/pwa/locale.js','/pwa/messages.js','/pwa/money.js','/pwa/offline.html','/pwa/static-locale.js']);
 await page.request.get('/api/auth/me');await page.request.get('/api/products?organizationId='+me.organization.id);
 await page.goto('/__test-offline-navigation');await expect(page.getByRole('heading',{name:'Server bilan aloqa yo‘q'})).toBeVisible();await expect(page.getByText('PWA scoped item',{exact:true})).not.toBeVisible();
});
});

test('Transfer receipt UI preserves unknown partial receipt and separates damage and confirmed shortage from sellable stock',async({page})=>{
 const phone='998'+Date.now();phones.push(phone);const origin={Origin:'https://localhost:3100'};expect((await page.request.post('/api/auth/register',{headers:origin,data:{fullName:'Transfer receipt owner',phone,password:'test-only-password',organizationName:'Transfer receipt business'}})).ok()).toBe(true);
 const me=(await(await page.request.get('/api/auth/me')).json()).data;orgs.push(me.organization.id);users.push(me.user.id);const source=await db.store.findFirstOrThrow({where:{organizationId:me.organization.id}}),destination=await db.store.create({data:{organizationId:me.organization.id,name:'Partial receipt destination'}}),product=await db.product.create({data:{organizationId:me.organization.id,name:'Transfer receipt item',sku:randomUUID(),barcode:randomUUID(),unit:'dona',salePrice:100,costPrice:50}});await db.inventoryBalance.create({data:{storeId:source.id,productId:product.id,quantity:10}});
 const transfer=await db.stockTransfer.create({data:{organizationId:me.organization.id,fromStoreId:source.id,toStoreId:destination.id,createdBy:me.user.id,items:{create:[{productId:product.id,quantity:6,unitCost:50}]}},include:{items:true}});expect((await page.request.post(`/api/transfers/${transfer.id}/send`,{headers:origin,data:{}})).ok()).toBe(true);
 await page.goto('/inventory/transfers');await page.getByRole('button',{name:'Qabul qilish',exact:true}).click();const dialog=page.getByRole('dialog');await dialog.getByLabel('Transfer receipt item soz qabul',{exact:true}).fill('2');await dialog.getByLabel('Transfer receipt item brak qabul',{exact:true}).fill('1');await dialog.getByLabel('Transfer receipt item kamomad',{exact:true}).fill('1');await dialog.getByLabel('Brak/kamomad sababi',{exact:true}).fill('Physical damaged unit and counted shortage');let dropped=false;
 await page.route('**/api/transfers/*/receive',async route=>{const response=await route.fetch();if(!dropped&&response.ok()){dropped=true;await route.abort('failed')}else await route.fulfill({response})});await dialog.getByRole('button',{name:'Transfer qabulini qayd etish: oldindan ko‘rish',exact:true}).click();await dialog.getByRole('button',{name:'Amalni tasdiqlash',exact:true}).click();await expect(dialog.getByRole('button',{name:'Original amalni qayta tekshirish',exact:true})).toBeVisible();
 await page.reload();await page.getByRole('button',{name:'Saqlangan amalni qayta tekshirish',exact:true}).click();await expect(page.getByRole('button',{name:'Saqlangan amalni qayta tekshirish',exact:true})).not.toBeVisible();expect(await db.transferDispositionEntry.count({where:{itemId:transfer.items[0].id}})).toBe(2);expect((await db.inventoryBalance.findUniqueOrThrow({where:{storeId_productId:{storeId:destination.id,productId:product.id}}})).quantity.toString()).toBe('2');
 await page.getByText('Qabul va farqlar',{exact:true}).click();await expect(page.getByText('Transfer receipt item: jo‘natilgan 6, soz 2, manbaga qaytgan 0, brak 1, kamomad 1, yo‘lda 2',{exact:true})).toBeVisible();await expect(page.getByText('Brak 1: Physical damaged unit and counted shortage',{exact:true})).toBeVisible();
 await page.getByRole('button',{name:'Qabul qilish',exact:true}).click();await expect(dialog.getByLabel('Transfer receipt item soz qabul',{exact:true})).toHaveValue('2');await dialog.getByRole('button',{name:'Transfer qabulini qayd etish: oldindan ko‘rish',exact:true}).click();await dialog.getByRole('button',{name:'Amalni tasdiqlash',exact:true}).click();await expect(dialog).not.toBeVisible();expect((await db.stockTransfer.findUniqueOrThrow({where:{id:transfer.id}})).status).toBe('closed');expect((await db.inventoryBalance.findUniqueOrThrow({where:{storeId_productId:{storeId:destination.id,productId:product.id}}})).quantity.toString()).toBe('4');expect((await db.inventoryBalance.findUniqueOrThrow({where:{storeId_productId:{storeId:source.id,productId:product.id}}})).quantity.toString()).toBe('4');expect(await db.transferDispositionEntry.count({where:{itemId:transfer.items[0].id}})).toBe(2);expect(await db.payment.count({where:{organizationId:me.organization.id}})).toBe(0);
 const exported=await(await page.request.get(`/api/transfers?organizationId=${me.organization.id}&format=csv`)).json();expect(exported.data.content).toContain('Tasdiqlangan kamomad');expect(exported.data.content).toContain('Brak');
});

test('Owner consent UI recovers a single support grant and platform operator read is audited and blocked immediately after revocation',async({page,browser})=>{
 const origin={Origin:'https://localhost:3100'},phone='998'+Date.now();phones.push(phone);expect((await page.request.post('/api/auth/register',{headers:origin,data:{fullName:'Support consent owner',phone,password:'test-only-password',organizationName:'Support consent target'}})).ok()).toBe(true);const me=(await(await page.request.get('/api/auth/me')).json()).data;orgs.push(me.organization.id);users.push(me.user.id);const store=await db.store.findFirstOrThrow({where:{organizationId:me.organization.id}});await db.product.create({data:{organizationId:me.organization.id,name:'Support scoped browser item',sku:randomUUID(),barcode:randomUUID(),unit:'dona',salePrice:'10.25',costPrice:'7'}});
 const operatorContext=await browser.newContext({ignoreHTTPSErrors:true,serviceWorkers:'block'});try{const operatorPage=await operatorContext.newPage(),operatorPhone='998'+(Date.now()+1);phones.push(operatorPhone);expect((await operatorContext.request.post('https://localhost:3100/api/auth/register',{headers:origin,data:{fullName:'Browser support operator',phone:operatorPhone,password:'test-only-password',organizationName:'Support operator source'}})).ok()).toBe(true);const operator=(await(await operatorContext.request.get('https://localhost:3100/api/auth/me')).json()).data;orgs.push(operator.organization.id);users.push(operator.user.id);await db.platformOperator.create({data:{userId:operator.user.id,role:'platform_admin'}});
 expect((await operatorContext.request.get('https://localhost:3100/api/products?organizationId='+me.organization.id)).status()).toBe(403);await operatorPage.goto('https://localhost:3100/support');await expect(operatorPage.getByLabel('Ruxsatli biznes')).toHaveValue('');
 const approveSupport=await criticalApprover(page,'test-only-password');
 await page.goto('/settings/support');await page.getByLabel('Support operator',{exact:true}).selectOption(operator.user.id);await page.getByRole('checkbox',{name:store.name,exact:true}).check();await page.getByRole('checkbox',{name:'Katalog (tannarxsiz)',exact:true}).check();await page.getByLabel('Support ruxsati sababi',{exact:true}).fill('Owner approved catalog issue diagnosis');let dropped=false;await page.route('**/api/support/grants',async route=>{if(route.request().method()!=='POST')return route.continue();const response=await route.fetch();if(!dropped&&response.ok()){dropped=true;await route.abort('failed')}else await route.fulfill({response})});await page.getByRole('button',{name:'Support ruxsatini berish: oldindan ko‘rish',exact:true}).click();await page.getByRole('button',{name:'Amalni tasdiqlash',exact:true}).click();await approveSupport();await expect(page.getByRole('button',{name:'Original amalni qayta tekshirish',exact:true})).toBeVisible();await page.reload();await page.getByRole('button',{name:'Saqlangan amalni qayta tekshirish',exact:true}).click();await expect(page.getByRole('button',{name:'Saqlangan amalni qayta tekshirish',exact:true})).not.toBeVisible();expect(await db.supportGrant.count({where:{organizationId:me.organization.id}})).toBe(1);const grant=await db.supportGrant.findFirstOrThrow({where:{organizationId:me.organization.id}});expect(grant.approvedBy).toBe(me.user.id);expect(await db.auditLog.count({where:{entityId:grant.id,action:'support_granted'}})).toBe(1);
 await operatorPage.getByRole('button',{name:'Operator ruxsatlarini yangilash',exact:true}).click();await expect(operatorPage.getByLabel('Ruxsatli biznes')).toContainText('Support consent target');await operatorPage.getByLabel('Ruxsatli biznes').selectOption(grant.id);await operatorPage.getByLabel('Support ko‘rish turi').selectOption('catalog');await operatorPage.getByRole('button',{name:'Ruxsatli ma’lumotni ko‘rish',exact:true}).click();await expect(operatorPage.getByLabel('Support natija')).toContainText('Support scoped browser item');await expect(operatorPage.getByLabel('Support natija')).not.toContainText('costPrice');expect(await db.auditLog.count({where:{entityId:grant.id,action:'support_read',actorId:operator.user.id}})).toBe(1);
 await page.getByLabel('Support bekor qilish sababi').fill('Unsubmitted revoke draft');
 let supportPrompts=0;page.on('dialog',async dialog=>{if(dialog.type()==='beforeunload')await dialog.accept();else{supportPrompts++;await dialog.dismiss()}});
 await page.locator('a[href="/dashboard"]').first().click();await expect(page).toHaveURL(/\/settings\/support$/);expect(supportPrompts).toBe(1);
 await page.route('**/api/support/operators',route=>route.abort('failed'));await page.getByRole('button',{name:'Ruxsatlarni yangilash',exact:true}).click();await expect(page.getByRole('alert').filter({hasText:'Oxirgi yuklangan ma’lumot'})).toBeVisible();await expect(page.getByLabel('Support bekor qilish sababi')).toHaveValue('Unsubmitted revoke draft');await expect(page.getByRole('button',{name:'Support ruxsatini bekor qilish: oldindan ko‘rish',exact:true})).toBeDisabled();await expect(page.getByRole('button',{name:'Support ruxsatini berish: oldindan ko‘rish',exact:true})).toBeDisabled();await page.unroute('**/api/support/operators');await page.getByRole('button',{name:'Ruxsatlarni yangilash',exact:true}).click();await expect(page.getByRole('button',{name:'Support ruxsatini bekor qilish: oldindan ko‘rish',exact:true})).toBeEnabled();
 await page.getByLabel('Support bekor qilish sababi').fill('Owner withdrew support access after diagnosis');await page.getByRole('button',{name:'Support ruxsatini bekor qilish: oldindan ko‘rish',exact:true}).click();await page.getByRole('button',{name:'Amalni tasdiqlash',exact:true}).click();await expect(page.getByText(/bekor qilingan/)).toBeVisible();await expect(page.getByLabel('Support bekor qilish sababi')).toHaveValue('');await operatorPage.getByRole('button',{name:'Ruxsatli ma’lumotni ko‘rish',exact:true}).click();await expect(operatorPage.getByRole('alert').filter({hasText:'Biznes egasi support ruxsatini bekor qildi.'})).toBeVisible();await expect(operatorPage.getByLabel('Support natija')).not.toBeVisible();expect(await db.auditLog.count({where:{entityId:grant.id,action:'support_read_denied'}})).toBe(1);expect(await db.auditLog.count({where:{entityId:grant.id,action:'support_revoked'}})).toBe(1);expect(await db.sale.count({where:{organizationId:me.organization.id}})).toBe(0);expect(await db.payment.count({where:{organizationId:me.organization.id}})).toBe(0);expect(await db.inventoryMovement.count({where:{organizationId:me.organization.id}})).toBe(0);
 }finally{await operatorContext.close()}
});

test('Price tier UI recovers one scheduled rule, requires POS price review and keeps original receipt after archive',async({page})=>{
 const phone='998'+Date.now();phones.push(phone);const origin={Origin:'https://localhost:3100'};expect((await page.request.post('/api/auth/register',{headers:origin,data:{fullName:'Tier owner',phone,password:'test-only-password',organizationName:'Price tier core'}})).ok()).toBe(true);const me=(await(await page.request.get('/api/auth/me')).json()).data;orgs.push(me.organization.id);users.push(me.user.id);const store=await db.store.findFirstOrThrow({where:{organizationId:me.organization.id}}),register=await db.register.findFirstOrThrow({where:{storeId:store.id}}),member=await db.organizationUser.findFirstOrThrow({where:{organizationId:me.organization.id,userId:me.user.id}});await db.shift.create({data:{registerId:register.id,organizationUserId:member.id,openingCash:1000}});const product=await db.product.create({data:{organizationId:me.organization.id,name:'Tiered item',sku:randomUUID(),barcode:randomUUID(),unit:'dona',salePrice:100,costPrice:40}});await db.inventoryBalance.create({data:{storeId:store.id,productId:product.id,quantity:10}});
 await page.goto('/settings/prices');await page.getByLabel('Narx mahsuloti',{exact:true}).selectOption(product.id);await page.getByLabel('Narx filiali',{exact:true}).selectOption(store.id);await page.getByLabel('Daraja birlik narxi',{exact:true}).fill('90');await page.getByLabel('Narx boshlanish UTC ISO',{exact:true}).fill('2020-01-01T00:00:00.000Z');await page.getByLabel('Narx qoidasi sababi',{exact:true}).fill('Reviewed branch retail agreement');await page.getByRole('button',{name:'Narx qoidasini yozish: oldindan ko‘rish',exact:true}).click();let dropped=false;await page.route('**/api/price-rules',async route=>{if(route.request().method()==='POST'&&!dropped){dropped=true;await route.fetch();await route.abort('failed')}else await route.continue()});await page.getByRole('button',{name:'Amalni tasdiqlash',exact:true}).click();await expect(page.getByRole('button',{name:'Original amalni qayta tekshirish',exact:true})).toBeVisible();await page.reload();await page.getByRole('button',{name:'Saqlangan amalni qayta tekshirish',exact:true}).click();await expect(page.getByText(/Tiered item · retail · 1 dan · 90/)).toBeVisible();const rule=await db.priceRule.findFirstOrThrow({where:{organizationId:me.organization.id,productId:product.id}});expect(await db.priceRule.count({where:{organizationId:me.organization.id}})).toBe(1);expect(await db.auditLog.count({where:{entityId:rule.id,action:'price_rule_created'}})).toBe(1);
 await page.goto('/pos');await expect(page.getByLabel('POS mahsulot qidirish',{exact:true})).toBeEnabled();await page.getByRole('button',{name:'Tiered item — savatga qo‘shish',exact:true}).click();await page.getByRole('button',{name:"To'lovga o'tish",exact:true}).click();await expect(page.getByRole('dialog')).toContainText('Joriy narx: 90');await page.getByRole('button',{name:'Eski urinishni bekor qilib savatni yangilash',exact:true}).click();await expect(page.getByRole('dialog')).toHaveCount(0);await page.getByRole('button',{name:"To'lovga o'tish",exact:true}).click();await page.getByLabel("Mijoz bergan naqd pul (so'm)").fill('90');await page.getByRole('button',{name:/Savdoni yakunlash/}).click();await expect(page.getByRole('dialog')).toContainText('Tiered item');const sale=await db.sale.findFirstOrThrow({where:{organizationId:me.organization.id,status:'completed'},include:{items:true}});expect(sale.totalAmount.toString()).toBe('90');expect(sale.items[0].priceRuleId).toBe(rule.id);expect(sale.items[0].unitCost.toString()).toBe('40');expect((await page.request.post('/api/price-rules/'+rule.id+'/archive',{headers:origin,data:{operationId:randomUUID(),reason:'Agreement ended after original sale'}})).ok()).toBe(true);expect((await db.saleItem.findUniqueOrThrow({where:{id:sale.items[0].id}})).unitPrice.toString()).toBe('90');expect(await db.payment.count({where:{saleId:sale.id}})).toBe(1);expect((await db.inventoryBalance.findUniqueOrThrow({where:{storeId_productId:{storeId:store.id,productId:product.id}}})).quantity.toString()).toBe('9');
});

test('Customer identity UI normalizes duplicate phones, assigns a price group and recovers settled merge while original partial refund history remains intact',async({page})=>{
 const phone='998'+Date.now();phones.push(phone);const origin={Origin:'https://localhost:3100'};expect((await page.request.post('/api/auth/register',{headers:origin,data:{fullName:'Identity owner',phone,password:'test-only-password',organizationName:'Customer identity core'}})).ok()).toBe(true);const me=(await(await page.request.get('/api/auth/me')).json()).data;orgs.push(me.organization.id);users.push(me.user.id);const store=await db.store.findFirstOrThrow({where:{organizationId:me.organization.id}}),register=await db.register.findFirstOrThrow({where:{storeId:store.id}}),member=await db.organizationUser.findFirstOrThrow({where:{organizationId:me.organization.id,userId:me.user.id}}),shift=await db.shift.create({data:{registerId:register.id,organizationUserId:member.id,openingCash:1000}}),product=await db.product.create({data:{organizationId:me.organization.id,name:'Identity historical item',sku:randomUUID(),barcode:randomUUID(),unit:'dona',salePrice:'10.25',costPrice:'4'}});await db.inventoryBalance.create({data:{storeId:store.id,productId:product.id,quantity:5}});
 const created=await page.request.post('/api/customers',{headers:origin,data:{organizationId:me.organization.id,fullName:'Primary buyer',phone:'+998 (90) 123-45-67',creditLimit:1000}});expect(created.ok()).toBe(true);const target=(await created.json()).data;expect(target.phone).toBe('998901234567');expect((await page.request.post('/api/customers',{headers:origin,data:{organizationId:me.organization.id,fullName:'Duplicate valid buyer',phone:'901234567',creditLimit:0}})).status()).toBe(400);const source=await db.customer.create({data:{organizationId:me.organization.id,fullName:'Original buyer card',phone:'legacy-unresolved'}});
 const draft=(await(await page.request.post('/api/sales',{headers:origin,data:{operationId:randomUUID(),organizationId:me.organization.id,storeId:store.id,registerId:register.id,shiftId:shift.id,customerId:source.id,discountAmount:0,items:[{productId:product.id,quantity:2,discountAmount:0}]}})).json()).data;expect((await page.request.post('/api/sales/'+draft.id+'/complete',{headers:origin,data:{payments:[{paymentType:'cash',amount:'20.50'}]}})).ok()).toBe(true);
 await page.goto('/settings/prices');await page.getByLabel('Yangi mijoz guruhi',{exact:true}).fill('Contract buyers');await page.getByRole('button',{name:'Guruh yaratish: oldindan ko‘rish',exact:true}).click();await page.getByRole('button',{name:'Amalni tasdiqlash',exact:true}).click();await expect(page.getByLabel('Yangi mijoz guruhi',{exact:true})).toHaveValue('');const group=await db.customerGroup.findFirstOrThrow({where:{organizationId:me.organization.id,name:'Contract buyers'}});await page.getByLabel('Guruhga o‘tkaziladigan mijoz',{exact:true}).selectOption(target.id);await page.getByLabel('Mijozning yangi guruhi',{exact:true}).selectOption(group.id);await page.getByLabel('Guruh o‘zgarishi sababi',{exact:true}).fill('Owner approved contracted price level');await page.getByRole('button',{name:'Mijoz guruhini o‘zgartirish: oldindan ko‘rish',exact:true}).click();await page.getByRole('button',{name:'Amalni tasdiqlash',exact:true}).click();await expect.poll(async()=>(await db.customer.findUniqueOrThrow({where:{id:target.id}})).groupId).toBe(group.id);
 expect((await page.request.post('/api/price-rules',{headers:origin,data:{operationId:randomUUID(),productId:product.id,kind:'group',groupId:group.id,unitPrice:'8.75',minimumQuantity:'1',startsAt:'2020-01-01T00:00:00.000Z',reason:'Agreed future buyer group'}})).ok()).toBe(true);
 await page.goto('/customers/'+source.id+'/history');await expect(page.getByText('Xarid va qaytarish tarixi',{exact:true})).toBeVisible();await page.getByLabel('Merge asosiy mijozi',{exact:true}).selectOption(target.id);await page.getByLabel('Mijoz merge sababi',{exact:true}).fill('Reviewed settled duplicate cards with original receipt');await page.getByRole('button',{name:'Original kartani birlashtirish: oldindan ko‘rish',exact:true}).click();let dropped=false;await page.route('**/api/customer-merges',async route=>{if(!dropped){dropped=true;await route.fetch();await route.abort('failed')}else await route.continue()});await page.getByRole('button',{name:'Amalni tasdiqlash',exact:true}).click();await expect(page.getByRole('button',{name:'Original amalni qayta tekshirish',exact:true})).toBeVisible();await page.reload();await page.getByRole('button',{name:'Saqlangan amalni qayta tekshirish',exact:true}).click();await expect(page.getByText(/Original buyer card.*Original merge karta/)).toBeVisible();expect((await db.customer.findUniqueOrThrow({where:{id:source.id}})).mergedIntoId).toBe(target.id);expect(await db.auditLog.count({where:{entityId:source.id,action:'customer_merged'}})).toBe(1);expect((await db.sale.findUniqueOrThrow({where:{id:draft.id}})).customerId).toBe(source.id);
 const quote=(await(await page.request.post('/api/price-rules/quote',{headers:origin,data:{storeId:store.id,customerId:target.id,items:[{productId:product.id,quantity:1}]}})).json()).data;expect(quote[0].unitPrice).toBe('8.75');const sale=await db.sale.findUniqueOrThrow({where:{id:draft.id},include:{items:true}});expect((await page.request.post('/api/sales/'+sale.id+'/returns',{headers:origin,data:{operationId:randomUUID(),shiftId:shift.id,reason:'Original partial refund after merge',items:[{saleItemId:sale.items[0].id,quantity:1,disposition:'sellable'}]}})).ok()).toBe(true);await page.goto('/customers/'+target.id+'/history');await expect(page.getByText(/Qaytarish 10.25/)).toBeVisible();await expect(page.getByText(/Original karta: Original buyer card · Jami 20.5/)).toBeVisible();expect((await db.saleItem.findUniqueOrThrow({where:{id:sale.items[0].id}})).unitPrice.toString()).toBe('10.25');expect(await db.payment.count({where:{saleId:sale.id}})).toBe(2);
});

test('Stock zone UI recovers original lost reservation once, protects held stock and releases without physical movement',async({page})=>{
 const phone='998'+Date.now();phones.push(phone);const origin={Origin:'https://localhost:3100'};expect((await page.request.post('/api/auth/register',{headers:origin,data:{fullName:'Zone owner',phone,password:'test-only-password',organizationName:'Stock reservation browser'}})).ok()).toBe(true);const me=(await(await page.request.get('/api/auth/me')).json()).data;orgs.push(me.organization.id);users.push(me.user.id);const store=await db.store.findFirstOrThrow({where:{organizationId:me.organization.id}}),product=await db.product.create({data:{organizationId:me.organization.id,name:'Reserved shelf item',sku:randomUUID(),barcode:randomUUID(),unit:'dona',salePrice:'10.25',costPrice:'4'}});await db.inventoryBalance.create({data:{storeId:store.id,productId:product.id,quantity:5}});
 const confirm=async(label:string)=>{await page.getByRole('button',{name:label+': oldindan ko‘rish',exact:true}).click();await page.getByRole('button',{name:'Amalni tasdiqlash',exact:true}).click()};await page.goto('/inventory/locations');await page.getByLabel('Zona nomi',{exact:true}).fill('Shelf A');await confirm('Zona yaratish');await expect(page.getByLabel('Qabul zona',{exact:true})).toContainText('Shelf A');const zone=await db.stockLocation.findFirstOrThrow({where:{storeId:store.id}});await page.getByLabel('Zona mahsuloti',{exact:true}).selectOption(product.id);await page.getByLabel('Zona miqdori',{exact:true}).fill('3');await page.getByLabel('Zona ko‘chirish sababi',{exact:true}).fill('Physically placed three on shelf');await page.getByLabel('Qabul zona',{exact:true}).selectOption(zone.id);await confirm('Zonaga ko‘chirish');await expect(page.getByText(/Fizik: 5 · Rezerv: 0 · Mavjud: 5 · Biriktirilmagan: 2/)).toBeVisible();await page.getByLabel('Rezerv miqdori',{exact:true}).fill('2');await page.getByLabel('Rezerv zonasi',{exact:true}).selectOption(zone.id);await page.getByLabel('Rezerv yaratish sababi',{exact:true}).fill('Exact held customer basket');let dropped=false;await page.route('**/api/inventory/reservations',async route=>{if(!dropped){dropped=true;const response=await route.fetch();expect(response.ok()).toBe(true);await route.abort('failed')}else await route.continue()});await confirm('Qoldiqni rezervlash');await expect(page.getByRole('button',{name:'Original amalni qayta tekshirish',exact:true})).toBeVisible();await page.reload();await page.getByRole('button',{name:'Saqlangan amalni qayta tekshirish',exact:true}).click();await expect(page.getByRole('button',{name:'Saqlangan amalni qayta tekshirish',exact:true})).not.toBeVisible();await page.getByLabel('Zona mahsuloti',{exact:true}).selectOption(product.id);await expect(page.getByText(/Fizik: 5 · Rezerv: 2 · Mavjud: 3/)).toBeVisible();const reservation=await db.stockReservation.findFirstOrThrow({where:{storeId:store.id}});expect(await db.stockReservation.count({where:{storeId:store.id}})).toBe(1);expect(await db.auditLog.count({where:{entityId:reservation.id,action:'reserved'}})).toBe(1);
 await page.getByLabel('Rezervni bo‘shatish sababi: '+reservation.id,{exact:true}).fill('Customer cancelled unused hold');await confirm('Rezervni bo‘shatish');await expect(page.getByText(/Fizik: 5 · Rezerv: 0 · Mavjud: 5/)).toBeVisible();expect((await db.inventoryBalance.findUniqueOrThrow({where:{storeId_productId:{storeId:store.id,productId:product.id}}})).quantity.toString()).toBe('5');expect(await db.inventoryMovement.count({where:{organizationId:me.organization.id}})).toBe(0);expect(await db.payment.count({where:{organizationId:me.organization.id}})).toBe(0);expect(await db.reservationEntry.count({where:{organizationId:me.organization.id,kind:'release'}})).toBe(1);
});

test.describe('Real offline cash worker',()=>{
test.use({serviceWorkers:'allow'});
test('Offline signed cash basket reloads privately, rejects altered quantity and two-tab replay, then reconnects once with exact stock and cash',async({page,context})=>{
 const origin={Origin:'https://localhost:3100'},phone='998'+Date.now();phones.push(phone);expect((await page.request.post('/api/auth/register',{headers:origin,data:{fullName:'Offline cash owner',phone,password:'test-only-password',organizationName:'Offline cash actual core'}})).ok()).toBe(true);const me=(await(await page.request.get('/api/auth/me')).json()).data;orgs.push(me.organization.id);users.push(me.user.id);const store=await db.store.findFirstOrThrow({where:{organizationId:me.organization.id}}),register=await db.register.findFirstOrThrow({where:{storeId:store.id}}),member=await db.organizationUser.findFirstOrThrow({where:{organizationId:me.organization.id,userId:me.user.id}}),shift=await db.shift.create({data:{registerId:register.id,organizationUserId:member.id,openingCash:100}}),product=await db.product.create({data:{organizationId:me.organization.id,name:'Private offline signed basket item',sku:randomUUID(),barcode:randomUUID(),unit:'dona',salePrice:'10.25',costPrice:'4'}});await db.inventoryBalance.create({data:{storeId:store.id,productId:product.id,quantity:5}});
 const critical=await enrollCritical(page,'test-only-password');await page.goto('/pos');await expect(page.getByLabel('POS mahsulot qidirish',{exact:true})).toBeEnabled();await page.getByRole('button',{name:'Private offline signed basket item — savatga qo‘shish',exact:true}).click();await page.getByRole('button',{name:'Qoralamani serverda saqlash',exact:true}).click();await expect(page.getByText(/Qoralama serverda saqlandi:/)).toBeVisible();const sale=await db.sale.findFirstOrThrow({where:{organizationId:me.organization.id,status:'draft'}});
 await page.goto('/pos/offline');await page.getByLabel('Offline naqdga ruxsat berish',{exact:true}).check();await page.getByLabel('Filialning jami hal qilinmagan offline summasi limiti',{exact:true}).fill('25');await page.getByLabel('Offline ruxsat muddati (30–300 soniya)',{exact:true}).fill('300');await page.getByLabel('Offline siyosat sababi',{exact:true}).fill('Owner approved exact short cash risk');await page.getByRole('button',{name:'Offline siyosatni yozish: oldindan ko‘rish',exact:true}).click();await page.getByRole('button',{name:'Amalni tasdiqlash',exact:true}).click();await critical.approve();await expect(page.getByText(/Joriy siyosat: Yoqilgan/)).toBeVisible();await page.getByLabel('Offline qoralama',{exact:true}).selectOption(sale.id);await page.getByLabel('Offline unlock iborasi (serverga yuborilmaydi)',{exact:true}).fill('test-only-private-phrase');await page.getByRole('button',{name:'Offline ruxsatni oldindan ko‘rish',exact:true}).click();await page.getByRole('button',{name:'Offline ruxsatni tasdiqlash',exact:true}).click();await expect(page.getByText(/Offline ruxsat shifrlangan holda saqlandi/)).toBeVisible();const lease=await db.offlineCashLease.findFirstOrThrow({where:{saleId:sale.id}});expect(lease.shiftId).toBe(shift.id);expect(await db.stockReservation.count({where:{id:lease.id}})).toBe(1);expect(await db.payment.count({where:{saleId:sale.id}})).toBe(0);
 const persisted=await page.evaluate(async()=>{const r=indexedDB.open('shuni-pos-offline-cash-v1');const d=await new Promise<IDBDatabase>(resolve=>{r.onsuccess=()=>resolve(r.result)});const rows=await new Promise<unknown[]>(resolve=>{const q=d.transaction('leases').objectStore('leases').getAll();q.onsuccess=()=>resolve(q.result)});d.close();return rows});expect(persisted).toHaveLength(1);expect(persisted[0]).toMatchObject({state:'unused'});expect(JSON.stringify(persisted)).not.toContain('Private offline signed basket item');expect(JSON.stringify(persisted)).not.toContain('test-only-private-phrase');expect(JSON.stringify(persisted)).not.toContain('costPrice');
 await expect.poll(()=>page.evaluate(async()=>Boolean((await navigator.serviceWorker.getRegistration('/'))?.active))).toBe(true);await page.goto('/pwa/cash.html');await expect.poll(()=>page.evaluate(()=>Boolean(navigator.serviceWorker.controller))).toBe(true);const cached=await page.evaluate(async()=>{const rows:string[]=[];for(const name of await caches.keys())for(const request of await(await caches.open(name)).keys())rows.push(new URL(request.url).pathname);return rows});expect(cached).toContain('/pwa/cash.html');expect(cached.some(p=>p.startsWith('/api/')||p.startsWith('/_next/')||p==='/pos/offline')).toBe(false);
 await context.addCookies([{name:'pos_test_transport_offline',value:'1',domain:'localhost',path:'/',secure:true,sameSite:'Strict'}]);await page.reload();await page.getByLabel('Offline ruxsat',{exact:true}).selectOption(lease.id);await page.getByLabel('Unlock iborasi',{exact:true}).fill('test-only-private-phrase');await page.getByRole('button',{name:'Offline savatni ochish',exact:true}).click();await expect(page.getByLabel('Offline savat tafsiloti',{exact:true})).toContainText('Private offline signed basket item');expect(await page.evaluate(async(id)=>{const path='/pwa/cash-store.js',store=await import(path),original=await store.unlockCashTicket(id,'test-only-private-phrase');try{await store.takeOfflineCash({...original.ticket,payload:{...original.ticket.payload,items:original.ticket.payload.items.map((i:Record<string,unknown>)=>({...i,quantity:'1000'}))}},'20');return false}catch{return true}},lease.id)).toBe(true);await page.getByLabel('Mijoz bergan naqd pul',{exact:true}).fill('20');
 // The second real offline tab unlocks the same source before either takes cash.
 const second=await context.newPage();await second.goto('/pwa/cash.html');await second.getByLabel('Offline ruxsat',{exact:true}).selectOption(lease.id);await second.getByLabel('Unlock iborasi',{exact:true}).fill('test-only-private-phrase');await second.getByRole('button',{name:'Offline savatni ochish',exact:true}).click();await expect(second.getByLabel('Offline savat tafsiloti',{exact:true})).toContainText('Holat: Ishlatilmagan');await second.getByLabel('Mijoz bergan naqd pul',{exact:true}).fill('20');await page.getByRole('button',{name:'Shu savat uchun naqdni bir marta qabul qilish',exact:true}).click();await expect(page.getByRole('status')).toContainText('SERVER TASDIQLAMAGAN');await second.getByRole('button',{name:'Shu savat uchun naqdni bir marta qabul qilish',exact:true}).click();await expect(second.getByRole('status')).toContainText('qayta pul olmang');await second.close();expect(await db.payment.count({where:{saleId:sale.id}})).toBe(0);expect((await db.inventoryBalance.findUniqueOrThrow({where:{storeId_productId:{storeId:store.id,productId:product.id}}})).quantity.toString()).toBe('5');
 await page.reload();await page.getByLabel('Offline ruxsat',{exact:true}).selectOption(lease.id);await page.getByLabel('Unlock iborasi',{exact:true}).fill('test-only-private-phrase');await page.getByRole('button',{name:'Offline savatni ochish',exact:true}).click();await expect(page.getByLabel('Offline savat tafsiloti',{exact:true})).toContainText('Qaytim: 9.75');await expect(page.getByRole('button',{name:'Shu savat uchun naqdni bir marta qabul qilish',exact:true})).toBeDisabled();await context.addCookies([{name:'pos_test_transport_offline',value:'0',domain:'localhost',path:'/',secure:true,sameSite:'Strict'}]);await page.getByRole('button',{name:'Original naqd natijasini sinxronlash',exact:true}).click();await expect(page.getByRole('status')).toContainText('Original naqd savdo serverda yakunlandi.');expect(await db.payment.count({where:{saleId:sale.id}})).toBe(1);expect(await db.inventoryMovement.count({where:{sourceId:sale.id}})).toBe(1);expect((await db.inventoryBalance.findUniqueOrThrow({where:{storeId_productId:{storeId:store.id,productId:product.id}}})).quantity.toString()).toBe('4');expect((await db.sale.findUniqueOrThrow({where:{id:sale.id}})).cashChange?.toString()).toBe('9.75');expect(await db.debtEntry.count({where:{saleId:sale.id}})).toBe(0);
});
});

test('Offline issuer and cash synchronization recover original lost acknowledgements with encrypted ticket and a single financial effect',async({page})=>{
 const origin={Origin:'https://localhost:3100'},phone='998'+Date.now();phones.push(phone);expect((await page.request.post('/api/auth/register',{headers:origin,data:{fullName:'Offline recovery owner',phone,password:'test-only-password',organizationName:'Offline recovery core'}})).ok()).toBe(true);const me=(await(await page.request.get('/api/auth/me')).json()).data;orgs.push(me.organization.id);users.push(me.user.id);const critical=await enrollCritical(page,'test-only-password');const store=await db.store.findFirstOrThrow({where:{organizationId:me.organization.id}}),register=await db.register.findFirstOrThrow({where:{storeId:store.id}}),member=await db.organizationUser.findFirstOrThrow({where:{organizationId:me.organization.id,userId:me.user.id}}),shift=await db.shift.create({data:{registerId:register.id,organizationUserId:member.id,openingCash:100}}),product=await db.product.create({data:{organizationId:me.organization.id,name:'Offline recovered original item',sku:randomUUID(),barcode:randomUUID(),unit:'dona',salePrice:'10.25',costPrice:'4'}});await db.inventoryBalance.create({data:{storeId:store.id,productId:product.id,quantity:5}});expect((await critical.post('/api/offline-cash/policy',{operationId:randomUUID(),storeId:store.id,enabled:true,maxAmount:'25',ttlSeconds:300,reason:'Owner explicit recovery policy'})).ok()).toBe(true);const response=await page.request.post('/api/sales',{headers:origin,data:{operationId:randomUUID(),organizationId:me.organization.id,storeId:store.id,registerId:register.id,shiftId:shift.id,discountAmount:0,items:[{productId:product.id,quantity:1}]}});expect(response.ok()).toBe(true);const sale=(await response.json()).data;
 await page.goto('/pos/offline');await page.getByLabel('Offline qoralama',{exact:true}).selectOption(sale.id);await page.getByLabel('Offline unlock iborasi (serverga yuborilmaydi)',{exact:true}).fill('test-only-original-phrase');await page.getByRole('button',{name:'Offline ruxsatni oldindan ko‘rish',exact:true}).click();let issueDropped=false;await page.route('**/api/offline-cash',async route=>{if(route.request().method()==='POST'&&!issueDropped){issueDropped=true;const reply=await route.fetch();expect(reply.ok()).toBe(true);expect(route.request().postData()).not.toContain('test-only-original-phrase');await route.abort('failed')}else await route.continue()});await page.getByRole('button',{name:'Offline ruxsatni tasdiqlash',exact:true}).click();await expect(page.getByRole('button',{name:'Original offline ruxsatni tekshirish',exact:true})).toBeVisible();await page.reload();await page.getByLabel('Offline unlock iborasi (serverga yuborilmaydi)',{exact:true}).fill('test-only-original-phrase');await page.getByRole('button',{name:'Original offline ruxsatni tekshirish',exact:true}).click();await expect(page.getByText(/Offline ruxsat shifrlangan holda saqlandi/)).toBeVisible();const lease=await db.offlineCashLease.findFirstOrThrow({where:{saleId:sale.id}});expect(await db.offlineCashLease.count({where:{saleId:sale.id}})).toBe(1);expect(await db.auditLog.count({where:{entityId:lease.id,action:'offline_cash_issued'}})).toBe(1);
 await page.goto('/pwa/cash.html');await page.getByLabel('Offline ruxsat',{exact:true}).selectOption(lease.id);await page.getByLabel('Unlock iborasi',{exact:true}).fill('wrong-unlock-phrase');await page.getByRole('button',{name:'Offline savatni ochish',exact:true}).click();await expect(page.getByRole('status')).toContainText('Unlock iborasi yoki offline ruxsat noto‘g‘ri');await expect(page.getByLabel('Offline savat tafsiloti',{exact:true})).not.toContainText(product.name);await page.getByLabel('Unlock iborasi',{exact:true}).fill('test-only-original-phrase');await page.getByRole('button',{name:'Offline savatni ochish',exact:true}).click();await expect(page.getByLabel('Offline savat tafsiloti',{exact:true})).toContainText(product.name);await page.getByLabel('Mijoz bergan naqd pul',{exact:true}).fill('20');await page.getByRole('button',{name:'Shu savat uchun naqdni bir marta qabul qilish',exact:true}).click();await expect(page.getByRole('status')).toContainText('SERVER TASDIQLAMAGAN');let syncDropped=false;await page.route('**/api/sync',async route=>{if(!syncDropped){syncDropped=true;const reply=await route.fetch();expect((await reply.json()).data[0].state).toBe('synced');await route.abort('failed')}else await route.continue()});await page.getByRole('button',{name:'Original naqd natijasini sinxronlash',exact:true}).click();await expect(page.getByRole('status')).toContainText('original amal saqlangan');expect(await db.payment.count({where:{saleId:sale.id}})).toBe(1);await page.reload();await page.getByLabel('Offline ruxsat',{exact:true}).selectOption(lease.id);await page.getByLabel('Unlock iborasi',{exact:true}).fill('test-only-original-phrase');await page.getByRole('button',{name:'Offline savatni ochish',exact:true}).click();await page.getByRole('button',{name:'Original naqd natijasini sinxronlash',exact:true}).click();await expect(page.getByRole('status')).toContainText('Asl chek serverda yakunlangan');expect(await db.payment.count({where:{saleId:sale.id}})).toBe(1);expect(await db.inventoryMovement.count({where:{sourceId:sale.id}})).toBe(1);expect(await db.operation.count({where:{organizationId:me.organization.id,type:'offline.cash',key:lease.cashOperationId}})).toBe(1);
});

test('Owner reviews a changed-price offline cash conflict, recovers lost settlement acknowledgment and confirms the original receipt once',async({page})=>{
 const origin={Origin:'https://localhost:3100'},phone='998'+Date.now();phones.push(phone);
 expect((await page.request.post('/api/auth/register',{headers:origin,data:{fullName:'Offline review owner',phone,password:'test-only-password',organizationName:'Offline reviewed cash'}})).ok()).toBe(true);
 const me=(await(await page.request.get('/api/auth/me')).json()).data;orgs.push(me.organization.id);users.push(me.user.id);
 const critical=await enrollCritical(page,'test-only-password');const store=await db.store.findFirstOrThrow({where:{organizationId:me.organization.id}}),register=await db.register.findFirstOrThrow({where:{storeId:store.id}}),member=await db.organizationUser.findFirstOrThrow({where:{organizationId:me.organization.id,userId:me.user.id}});
 const shift=await db.shift.create({data:{registerId:register.id,organizationUserId:member.id,openingCash:100}}),product=await db.product.create({data:{organizationId:me.organization.id,name:'Offline reviewed original item',sku:randomUUID(),barcode:randomUUID(),unit:'dona',salePrice:'10.25',costPrice:'4'}});
 await db.inventoryBalance.create({data:{storeId:store.id,productId:product.id,quantity:5}});
 expect((await critical.post('/api/offline-cash/policy',{operationId:randomUUID(),storeId:store.id,enabled:true,maxAmount:'25',ttlSeconds:300,reason:'Owner explicit reviewed cash policy'})).ok()).toBe(true);
 const response=await page.request.post('/api/sales',{headers:origin,data:{operationId:randomUUID(),organizationId:me.organization.id,storeId:store.id,registerId:register.id,shiftId:shift.id,discountAmount:0,items:[{productId:product.id,quantity:1}]}});expect(response.ok()).toBe(true);const sale=(await response.json()).data;
 await page.goto('/pos/offline');await page.getByLabel('Offline qoralama',{exact:true}).selectOption(sale.id);await page.getByLabel('Offline unlock iborasi (serverga yuborilmaydi)',{exact:true}).fill('test-only-owner-review-phrase');await page.getByRole('button',{name:'Offline ruxsatni oldindan ko‘rish',exact:true}).click();await page.getByRole('button',{name:'Offline ruxsatni tasdiqlash',exact:true}).click();await expect(page.getByText(/Offline ruxsat shifrlangan holda saqlandi/)).toBeVisible();
 const lease=await db.offlineCashLease.findFirstOrThrow({where:{saleId:sale.id}});
 await page.goto('/pwa/cash.html');await page.getByLabel('Offline ruxsat',{exact:true}).selectOption(lease.id);await page.getByLabel('Unlock iborasi',{exact:true}).fill('test-only-owner-review-phrase');await page.getByRole('button',{name:'Offline savatni ochish',exact:true}).click();await page.getByLabel('Mijoz bergan naqd pul',{exact:true}).fill('20');await page.getByRole('button',{name:'Shu savat uchun naqdni bir marta qabul qilish',exact:true}).click();await expect(page.getByRole('status')).toContainText('SERVER TASDIQLAMAGAN');
 await db.product.update({where:{id:product.id},data:{salePrice:'11',costPrice:'9'}});
 await page.getByRole('button',{name:'Original naqd natijasini sinxronlash',exact:true}).click();await expect.poll(()=>db.syncReview.count({where:{organizationId:me.organization.id,operationId:lease.cashOperationId,state:'conflict'}})).toBe(1);expect(await db.payment.count({where:{saleId:sale.id}})).toBe(0);
 await page.goto('/pos/offline');await page.getByLabel('Tovar berilgan va sof naqd pul shu smenaga haqiqatan olingan',{exact:true}).check();await page.getByLabel('Tekshirilgan savdo vaqti (ISO, ruxsat muddati ichida)',{exact:true}).fill(new Date(lease.createdAt.getTime()+1).toISOString());await page.getByLabel('Mijoz bergan asl naqd pul',{exact:true}).fill('20');await page.getByLabel('Offline tekshiruv dalili raqami',{exact:true}).fill('TEST-OWNER-REVIEW-001');await page.getByLabel('Original savdoni qayd etish sababi',{exact:true}).fill('Verified original goods and cash in this shift');
 await page.getByRole('button',{name:'Asl offline savdoni qayd etish '+lease.id+': oldindan ko‘rish',exact:true}).click();let dropped=false;await page.route('**/api/offline-cash/*/settle',async route=>{if(!dropped){dropped=true;const reply=await route.fetch();expect(reply.ok()).toBe(true);await route.abort('failed')}else await route.continue()});await page.getByRole('button',{name:'Amalni tasdiqlash',exact:true}).click();await expect(page.getByRole('button',{name:'Original amalni qayta tekshirish',exact:true})).toBeVisible();await page.reload();await page.getByRole('button',{name:'Saqlangan amalni qayta tekshirish',exact:true}).click();
 await expect.poll(()=>db.operation.count({where:{organizationId:me.organization.id,type:'offline-cash.settle'}})).toBe(1);
 await page.goto('/pwa/cash.html');await page.getByLabel('Offline ruxsat',{exact:true}).selectOption(lease.id);await page.getByLabel('Unlock iborasi',{exact:true}).fill('test-only-owner-review-phrase');await page.getByRole('button',{name:'Offline savatni ochish',exact:true}).click();await page.getByRole('button',{name:'Original naqd natijasini sinxronlash',exact:true}).click();await expect(page.getByRole('status')).toContainText('Asl chek serverda yakunlangan');
 const final=await db.sale.findUniqueOrThrow({where:{id:sale.id},include:{items:true,payments:true}});expect(final.totalAmount.toString()).toBe('10.25');expect(final.items[0].unitCost.toString()).toBe('4');expect(final.cashierId).toBe(me.user.id);expect(final.payments).toHaveLength(1);expect(final.payments[0].receivedBy).toBe(me.user.id);expect(await db.inventoryMovement.count({where:{sourceId:sale.id}})).toBe(1);expect(await db.auditLog.count({where:{entityId:lease.id,action:'offline_cash_owner_settled',actorId:me.user.id}})).toBe(1);
});

test('Catalog CSV import previews errors, recovers original lost confirmation once and exports exact Excel values',async({page})=>{
 const origin={Origin:'https://localhost:3100'},phone='998'+Date.now();phones.push(phone);expect((await page.request.post('/api/auth/register',{headers:origin,data:{fullName:'Catalog import owner',phone,password:'test-only-password',organizationName:'Reviewed catalog importer'}})).ok()).toBe(true);const me=(await(await page.request.get('/api/auth/me')).json()).data;orgs.push(me.organization.id);users.push(me.user.id);
 await page.goto('/products');await page.getByRole('link',{name:'CSV / Excel import va eksport',exact:true}).click();const bytes=Buffer.from('name,sku,barcode,unit,salePrice,costPrice,minStock\r\nImported browser item,BROWSER-001,0001001,dona,1.01,0.333333,1\r\nRejected duplicate,BROWSER-001,0001002,dona,1.01,0,0\r\n');await page.getByLabel('Katalog fayli',{exact:true}).setInputFiles({name:'catalog.csv',mimeType:'text/csv',buffer:bytes});await page.getByRole('button',{name:'Importni oldindan ko‘rish',exact:true}).click();await expect(page.getByText('Jami2; yaroqli1; xatoli/dublikat1. Faqat yaroqli qatorlar qo‘shiladi.',{exact:true})).toBeVisible();expect(await db.product.count({where:{organizationId:me.organization.id}})).toBe(0);await expect(page.getByRole('cell',{name:'Faylda takror SKU',exact:true})).toBeVisible();await page.getByLabel('Katalog import sababi',{exact:true}).fill('Owner reviewed original import file errors');await page.getByRole('button',{name:'Yaroqli katalog qatorlarini qo‘shish: oldindan ko‘rish',exact:true}).click();let dropped=false;await page.route('**/api/catalog-import',async route=>{if(!dropped){dropped=true;const result=await route.fetch();expect(result.ok()).toBe(true);await route.abort('failed')}else await route.continue()});await page.getByRole('button',{name:'Amalni tasdiqlash',exact:true}).click();await expect(page.getByRole('button',{name:'Original amalni qayta tekshirish',exact:true})).toBeVisible();await page.reload();await page.getByRole('button',{name:'Saqlangan amalni qayta tekshirish',exact:true}).click();await expect(page.getByRole('status').filter({hasText:'Import serverda tasdiqlandi'})).toBeVisible();expect(await db.product.count({where:{organizationId:me.organization.id}})).toBe(1);expect(await db.auditLog.count({where:{organizationId:me.organization.id,action:'catalog_imported'}})).toBe(1);expect(await db.operation.count({where:{organizationId:me.organization.id,type:'catalog.import'}})).toBe(1);
 const downloadEvent=page.waitForEvent('download');await page.getByRole('button',{name:'Katalog Excel yuklash',exact:true}).click();const download=await downloadEvent;expect(download.suggestedFilename()).toMatch(/\.xlsx$/);const path=await download.path();expect(path).toBeTruthy();const ExcelJS=(await import('exceljs')).default,book=new ExcelJS.Workbook();await book.xlsx.load(readFileSync(path!) as never);expect(book.worksheets[0].getRow(2).getCell(8).value).toBe('1.01');expect(book.worksheets[0].getRow(2).getCell(9).value).toBe('0.333333');expect(await db.inventoryMovement.count({where:{organizationId:me.organization.id}})).toBe(0);expect(await db.payment.count({where:{organizationId:me.organization.id}})).toBe(0)
});

test('Onboarding resumes original lost checkpoint and verifies actual branch import opening cashier and a normal POS sale in order',async({page})=>{
 const origin={Origin:'https://localhost:3100'},phone='998'+Date.now();phones.push(phone);expect((await page.request.post('/api/auth/register',{headers:origin,data:{fullName:'Onboarding owner',phone,password:'test-only-password',organizationName:'Ordered onboarding business'}})).ok()).toBe(true);const me=(await(await page.request.get('/api/auth/me')).json()).data;orgs.push(me.organization.id);users.push(me.user.id);const store=await db.store.findFirstOrThrow({where:{organizationId:me.organization.id}}),register=await db.register.findFirstOrThrow({where:{storeId:store.id}}),member=await db.organizationUser.findFirstOrThrow({where:{organizationId:me.organization.id,userId:me.user.id}});
 await page.goto('/onboarding');await expect(page.getByRole('status').filter({hasText:'Tasdiqlangan bosqichlar:'})).toHaveText('Tasdiqlangan bosqichlar: 0 / 6');await page.getByLabel('Sozlash bosqichini tasdiqlash sababi',{exact:true}).fill('Verified new business and branch');await page.getByRole('button',{name:'Tashkilot ma’lumoti bosqichini tasdiqlash: oldindan ko‘rish',exact:true}).click();let dropped=false;await page.route('**/api/onboarding',async route=>{if(route.request().method()==='POST'&&!dropped){dropped=true;const result=await route.fetch();expect(result.ok()).toBe(true);await route.abort('failed')}else await route.continue()});await page.getByRole('button',{name:'Amalni tasdiqlash',exact:true}).click();await expect(page.getByRole('button',{name:'Original amalni qayta tekshirish',exact:true})).toBeVisible();await page.reload();await page.getByRole('button',{name:'Saqlangan amalni qayta tekshirish',exact:true}).click();await expect.poll(()=>db.onboardingCheckpoint.count({where:{organizationId:me.organization.id,step:'organization'}})).toBe(1);
 const confirm=async(title:string,count:number)=>{await page.getByLabel('Sozlash bosqichini tasdiqlash sababi',{exact:true}).fill('Verified actual '+title);await page.getByRole('button',{name:title+' bosqichini tasdiqlash: oldindan ko‘rish',exact:true}).click();await page.getByRole('button',{name:'Amalni tasdiqlash',exact:true}).click();await expect.poll(()=>db.onboardingCheckpoint.count({where:{organizationId:me.organization.id}})).toBe(count)};await confirm('Filial va kassa',2);
 await page.getByRole('link',{name:'Katalog importi bo‘limiga o‘tish',exact:true}).click();await page.getByLabel('Katalog fayli',{exact:true}).setInputFiles({name:'onboarding.csv',mimeType:'text/csv',buffer:Buffer.from('name,sku,barcode,unit,salePrice,costPrice\nOnboarded real SKU,ONBOARD-1,ONBOARD-1,dona,1.01,0.333333\n')});await page.getByRole('button',{name:'Importni oldindan ko‘rish',exact:true}).click();await page.getByLabel('Katalog import sababi',{exact:true}).fill('Verified onboarding catalog');await page.getByRole('button',{name:'Yaroqli katalog qatorlarini qo‘shish: oldindan ko‘rish',exact:true}).click();await page.getByRole('button',{name:'Amalni tasdiqlash',exact:true}).click();await expect(page.getByRole('status').filter({hasText:'Import serverda tasdiqlandi'})).toBeVisible();await page.goto('/onboarding');await confirm('Katalog importi',3);const product=await db.product.findFirstOrThrow({where:{organizationId:me.organization.id}});
 const draft=await page.request.post('/api/stock-documents',{headers:origin,data:{organizationId:me.organization.id,storeId:store.id,documentType:'opening',documentNo:'ONBOARD-OPEN',note:'Owner verified actual opening five units',items:[{productId:product.id,quantity:5,unitCost:'0.333333'}]}});expect(draft.ok()).toBe(true);const opening=(await draft.json()).data;expect((await page.request.post('/api/stock-documents/'+opening.id+'/confirm',{headers:origin,data:{}})).ok()).toBe(true);await page.reload();await confirm('Boshlang‘ich qoldiq',4);
 const cashierPhone='998'+(Date.now()+1);phones.push(cashierPhone);const critical=await enrollCritical(page,'test-only-password');expect((await critical.post('/api/organizations/'+me.organization.id+'/users',{operationId:randomUUID(),fullName:'Assigned onboarding cashier',phone:cashierPhone,password:'test-only-password',role:'cashier',storeIds:[store.id]})).ok()).toBe(true);const cashier=await db.user.findUniqueOrThrow({where:{phone:cashierPhone}});users.push(cashier.id);await page.reload();await confirm('Kassir va o‘qitish',5);await page.getByRole('link',{name:'Kassir mashqiga o‘tish',exact:true}).click();await page.getByRole('button',{name:'Mashq mahsulotini qo‘shish',exact:true}).click();await page.getByRole('button',{name:'Mashq to‘loviga o‘tish',exact:true}).click();await page.getByLabel('Mashqda berilgan naqd',{exact:true}).fill('15000');await page.getByRole('button',{name:'Faqat mashqni yakunlash',exact:true}).click();await expect(page.getByRole('status').filter({hasText:'Mashq yakunlandi'})).toBeVisible();expect(await db.sale.count({where:{organizationId:me.organization.id}})).toBe(0);
 expect((await page.request.post('/api/shifts',{headers:origin,data:{operationId:randomUUID(),registerId:register.id,organizationUserId:member.id,openingCash:0}})).ok()).toBe(true);await page.goto('/pos');await expect(page.getByLabel('POS mahsulot qidirish',{exact:true})).toBeEnabled();await page.getByRole('button',{name:'Onboarded real SKU — savatga qo‘shish',exact:true}).click();await page.getByRole('button',{name:/To'lovga o'tish/}).click();await page.getByLabel("Mijoz bergan naqd pul (so'm)",{exact:true}).fill('1.01');await page.getByRole('dialog').getByRole('button',{name:/Savdoni yakunlash/}).click();await expect.poll(()=>db.sale.count({where:{organizationId:me.organization.id,status:'completed'}})).toBe(1);await page.goto('/onboarding');await confirm('Savdo oqimini tekshirish',6);await expect(page.getByRole('status').filter({hasText:'Tanlangan filialning barcha sozlash'})).toHaveText('Tanlangan filialning barcha sozlash bosqichlari tasdiqlandi.');expect(await db.auditLog.count({where:{organizationId:me.organization.id,action:'onboarding_step_confirmed'}})).toBe(6);expect(await db.payment.count({where:{organizationId:me.organization.id}})).toBe(1);expect((await db.inventoryBalance.findUniqueOrThrow({where:{storeId_productId:{storeId:store.id,productId:product.id}}})).quantity.toString()).toBe('4')
});

test('Exchange UI reviews exact net cash and recovers original lost acknowledgement with linked real return and replacement once',async({page})=>{
 const origin={Origin:'https://localhost:3100'},phone='998'+Date.now();phones.push(phone);expect((await page.request.post('/api/auth/register',{headers:origin,data:{fullName:'Exchange owner',phone,password:'test-only-password',organizationName:'Exchange business'}})).ok()).toBe(true);const me=(await(await page.request.get('/api/auth/me')).json()).data;orgs.push(me.organization.id);users.push(me.user.id);const store=await db.store.findFirstOrThrow({where:{organizationId:me.organization.id}}),register=await db.register.findFirstOrThrow({where:{storeId:store.id}}),member=await db.organizationUser.findFirstOrThrow({where:{organizationId:me.organization.id,userId:me.user.id}}),shift=await db.shift.create({data:{registerId:register.id,organizationUserId:member.id,openingCash:0}});
 const old=await db.product.create({data:{organizationId:me.organization.id,name:'Original exchange item',sku:randomUUID(),barcode:randomUUID(),unit:'dona',salePrice:'10.01',costPrice:'3.333333'}}),replacement=await db.product.create({data:{organizationId:me.organization.id,name:'New exchange item',sku:randomUUID(),barcode:randomUUID(),unit:'dona',salePrice:'12.03',costPrice:'4.444444'}});for(const product of [old,replacement])await db.inventoryBalance.create({data:{storeId:store.id,productId:product.id,quantity:10}});
 const draft=await page.request.post('/api/sales',{headers:origin,data:{operationId:randomUUID(),organizationId:me.organization.id,storeId:store.id,registerId:register.id,shiftId:shift.id,items:[{productId:old.id,quantity:1}]}});expect(draft.ok()).toBe(true);const sale=(await draft.json()).data;expect((await page.request.post('/api/sales/'+sale.id+'/complete',{headers:origin,data:{operationId:randomUUID(),payments:[{paymentType:'cash',amount:'10.01'}]}})).ok()).toBe(true);
 await page.goto('/sales/'+sale.id);await page.getByRole('link',{name:'Tovar almashtirish',exact:true}).click();await page.getByLabel('Qaytarish miqdori: Original exchange item',{exact:true}).fill('1');await page.getByLabel('Almashtirish sababi',{exact:true}).fill('Actual customer exchanged original item');await page.getByLabel('Almashtirishdagi yangi mahsulot',{exact:true}).selectOption(replacement.id);await page.getByRole('button',{name:'Almashtirish farqini hisoblash',exact:true}).click();await expect(page.getByRole('status').filter({hasText:'Qaytarish:'})).toContainText('naqd farq: 2.02; nasiya farqi: 0');expect(await db.saleReturn.count({where:{saleId:sale.id}})).toBe(0);await page.getByLabel('Farq uchun mijoz bergan haqiqiy naqd pul',{exact:true}).fill('5');await page.getByRole('button',{name:'Almashtirishni qayd etish: oldindan ko‘rish',exact:true}).click();let dropped=false;await page.route('**/api/exchanges',async route=>{if(route.request().method()==='POST'&&!dropped){dropped=true;const response=await route.fetch();expect(response.ok()).toBe(true);await route.abort('failed')}else await route.continue()});await page.getByRole('button',{name:'Amalni tasdiqlash',exact:true}).click();await expect(page.getByRole('button',{name:'Original amalni qayta tekshirish',exact:true})).toBeVisible();await page.reload();await page.getByRole('button',{name:'Saqlangan amalni qayta tekshirish',exact:true}).click();await expect(page.getByRole('link',{name:'Bog‘langan yangi savdoni ochish',exact:true})).toBeVisible();const exchange=await db.saleExchange.findFirstOrThrow({where:{organizationId:me.organization.id}});expect(exchange.cashDifference.toFixed(2)).toBe('2.02');expect(exchange.cashChange.toFixed(2)).toBe('2.98');expect(await db.saleReturn.count({where:{saleId:sale.id}})).toBe(1);expect(await db.saleExchange.count({where:{organizationId:me.organization.id}})).toBe(1);expect(await db.operation.count({where:{organizationId:me.organization.id,type:'sale.exchange'}})).toBe(1);await page.getByRole('link',{name:'Bog‘langan yangi savdoni ochish',exact:true}).click();await expect(page.getByRole('region',{name:'Almashtirish hujjatlari'})).toContainText('haqiqiy berilgan naqd 5; qaytim 2.98');expect((await db.sale.findUniqueOrThrow({where:{id:exchange.replacementSaleId}})).cashTendered).toBeNull()
});

test('Background jobs UI recovers enqueue and manual retry once while the real worker exhausts failures then completes scoped reconciliation',async({page})=>{
 const origin={Origin:'https://localhost:3100'},phone='998'+Date.now();phones.push(phone);expect((await page.request.post('/api/auth/register',{headers:origin,data:{fullName:'Job owner',phone,password:'test-only-password',organizationName:'Durable background job business'}})).ok()).toBe(true);const me=(await(await page.request.get('/api/auth/me')).json()).data;orgs.push(me.organization.id);users.push(me.user.id);const store=await db.store.findFirstOrThrow({where:{organizationId:me.organization.id}}),product=await db.product.create({data:{organizationId:me.organization.id,name:'Reconciliation source',sku:randomUUID(),barcode:randomUUID(),unit:'dona',salePrice:1,costPrice:0}});await db.inventoryBalance.create({data:{storeId:store.id,productId:product.id,quantity:2}});
 await page.goto('/jobs');await page.getByLabel('Fon ishini tasdiqlash sababi',{exact:true}).fill('Owner reviewed selected branch');await page.getByRole('button',{name:'Hisob solishtirishni navbatga qo‘yish: oldindan ko‘rish',exact:true}).click();let dropped=false;await page.route('**/api/jobs',async route=>{if(route.request().method()==='POST'&&!dropped){dropped=true;const r=await route.fetch();expect(r.ok()).toBe(true);await route.abort('failed')}else await route.continue()});await page.getByRole('button',{name:'Amalni tasdiqlash',exact:true}).click();await expect(page.getByRole('button',{name:'Original amalni qayta tekshirish',exact:true})).toBeVisible();await page.reload();await page.getByRole('button',{name:'Saqlangan amalni qayta tekshirish',exact:true}).click();await expect.poll(()=>db.backgroundJob.count({where:{organizationId:me.organization.id}})).toBe(1);const job=await db.backgroundJob.findFirstOrThrow({where:{organizationId:me.organization.id}}),trigger='browser_job_fault_'+randomUUID().replaceAll('-','');
 const worker=()=>execFileSync(process.execPath,['--require','./scripts/worker-resolver.cjs','.worker-build/scripts/workers/jobs.js','--once'],{env:{...process.env,NODE_ENV:'production',APP_ORIGIN:'https://localhost:3100'},timeout:30000,stdio:'pipe'});
 await db.$executeRawUnsafe(`CREATE FUNCTION ${trigger}() RETURNS trigger LANGUAGE plpgsql AS $$ BEGIN RAISE EXCEPTION 'Injected browser job fault';END $$`);try{await db.$executeRawUnsafe(`CREATE TRIGGER ${trigger} BEFORE INSERT ON "AuditLog" FOR EACH ROW WHEN (NEW."organizationId"='${me.organization.id}' AND NEW.action='system_job_succeeded') EXECUTE FUNCTION ${trigger}()`);for(let attempt=1;attempt<=3;attempt++){expect(worker).toThrow();expect((await db.backgroundJob.findUniqueOrThrow({where:{id:job.id}})).attempts).toBe(attempt);if(attempt<3)await db.backgroundJob.update({where:{id:job.id},data:{nextRunAt:new Date(Date.now()-1)}})}}finally{await db.$executeRawUnsafe(`DROP TRIGGER IF EXISTS ${trigger} ON "AuditLog"`);await db.$executeRawUnsafe(`DROP FUNCTION ${trigger}()`)}expect(await db.incident.count({where:{organizationId:me.organization.id}})).toBe(0);await page.getByRole('button',{name:'Fon ishlarini yangilash',exact:true}).click();await expect(page.getByRole('heading',{name:'Hisob solishtirish · Ko‘rib chiqish kerak',exact:true})).toBeVisible();await page.getByLabel('Fon ishini qayta tasdiqlash sababi: '+job.id,{exact:true}).fill('Owner checked fault and authorized retry');await page.getByRole('button',{name:'Fon ishini qayta tasdiqlash '+job.id+': oldindan ko‘rish',exact:true}).click();let retryDropped=false;await page.route('**/api/jobs/*/retry',async route=>{if(!retryDropped){retryDropped=true;const r=await route.fetch();expect(r.ok()).toBe(true);await route.abort('failed')}else await route.continue()});await page.getByRole('button',{name:'Amalni tasdiqlash',exact:true}).click();await expect(page.getByRole('button',{name:'Original amalni qayta tekshirish',exact:true})).toBeVisible();await page.reload();await page.getByRole('button',{name:'Saqlangan amalni qayta tekshirish',exact:true}).click();await expect(page.getByRole('heading',{name:'Hisob solishtirish · Navbatda',exact:true})).toBeVisible();worker();await page.getByRole('button',{name:'Fon ishlarini yangilash',exact:true}).click();await expect(page.getByRole('heading',{name:'Hisob solishtirish · Yakunlangan',exact:true})).toBeVisible();expect(await db.jobAuthorization.count({where:{jobId:job.id}})).toBe(2);expect(await db.auditLog.count({where:{entityId:job.id,action:'system_job_succeeded',actorId:null}})).toBe(1);expect(await db.auditLog.count({where:{entityId:job.id,action:'job_retried',actorId:me.user.id}})).toBe(1);expect(await db.operation.count({where:{organizationId:me.organization.id,type:'job.retry'}})).toBe(1);expect(await db.incident.count({where:{organizationId:me.organization.id}})).toBe(1);await page.getByRole('button',{name:'Ish tarixini ko‘rish '+job.id,exact:true}).click();await expect(page.getByRole('region',{name:'Fon ishining tarixi'})).toContainText('manual_retry')
});

test('Security history delivers a real new-browser notice and recovers a lost read acknowledgement once',async({page})=>{
 const origin={Origin:'https://localhost:3100'},phone='998'+Date.now(),password='test-only-password',deviceA=randomUUID(),deviceB=randomUUID();
 const errors:string[]=[];page.on('pageerror',error=>errors.push(error.message));phones.push(phone);
 expect((await page.request.post('/api/auth/register',{headers:origin,data:{fullName:'Security history owner',phone,password,organizationName:'Security history business'}})).ok()).toBe(true);
 const me=(await(await page.request.get('/api/auth/me')).json()).data;orgs.push(me.organization.id);users.push(me.user.id);
 await page.goto('/login');const userAgent=await page.evaluate(()=>navigator.userAgent);
 expect((await page.request.post('/api/auth/login',{headers:{...origin,'User-Agent':userAgent},data:{phone,password,deviceId:deviceA}})).ok()).toBe(true);
 const baseline=await db.securityEvent.findFirstOrThrow({where:{userId:me.user.id,type:'login_succeeded'}});
 expect(baseline.suspicious).toBe(false);expect(baseline.sourceSessionId).toBeTruthy();
 expect(await db.securityNoticeOutbox.count({where:{event:{userId:me.user.id}}})).toBe(0);
 expect((await page.request.post('/api/auth/logout',{headers:origin,data:{}})).ok()).toBe(true);
 await page.addInitScript(id=>localStorage.setItem('pos_device_id',id),deviceB);
 await page.goto('/login');await page.getByLabel('Telefon raqam',{exact:true}).fill(phone);await page.getByLabel('Parol',{exact:true}).fill(password);await page.getByRole('button',{name:'Kirish',exact:true}).click();
 await expect(page).toHaveURL(/\/dashboard$/);
 const suspicious=await db.securityEvent.findFirstOrThrow({where:{userId:me.user.id,type:'login_succeeded',suspicious:true}});
 expect(await db.securityEvent.count({where:{userId:me.user.id,type:'login_succeeded'}})).toBe(2);
 expect(await db.securityNoticeOutbox.count({where:{event:{userId:me.user.id},state:'pending'}})).toBe(1);
 expect(await db.securityNotice.count({where:{event:{userId:me.user.id}}})).toBe(0);
 const worker=()=>execFileSync(process.execPath,['--require','./scripts/worker-resolver.cjs','.worker-build/scripts/workers/jobs.js','--once'],{env:{...process.env,DATABASE_URL:process.env.DATABASE_URL,NODE_ENV:'production',APP_ORIGIN:'https://localhost:3100'},timeout:30000,stdio:'pipe'});
 const trigger='browser_security_fault_'+randomUUID().replaceAll('-','');
 await db.$executeRawUnsafe(`CREATE FUNCTION ${trigger}() RETURNS trigger LANGUAGE plpgsql AS $$ BEGIN RAISE EXCEPTION 'Injected security delivery fault';END $$`);
 try{await db.$executeRawUnsafe(`CREATE TRIGGER ${trigger} BEFORE INSERT ON "AuditLog" FOR EACH ROW WHEN (NEW."organizationId"='${me.organization.id}' AND NEW.action='security_notice_delivered') EXECUTE FUNCTION ${trigger}()`);for(let attempt=1;attempt<=3;attempt++){expect(worker).toThrow();const row=await db.securityNoticeOutbox.findUniqueOrThrow({where:{eventId:suspicious.id}});expect(row.attempts).toBe(attempt);if(attempt<3)await db.securityNoticeOutbox.update({where:{id:row.id},data:{nextRunAt:new Date(Date.now()-1)}})}}finally{await db.$executeRawUnsafe(`DROP TRIGGER IF EXISTS ${trigger} ON "AuditLog"`);await db.$executeRawUnsafe(`DROP FUNCTION ${trigger}()`)}
 expect(await db.securityNotice.count({where:{event:{userId:me.user.id}}})).toBe(0);
 await page.goto('/security');let retryDropped=false;await page.route('**/api/auth/security/retry',async route=>{if(!retryDropped){retryDropped=true;const response=await route.fetch();expect(response.ok()).toBe(true);await route.abort('failed')}else await route.continue()});
 await page.getByRole('button',{name:'Bildirishnomani qayta yetkazish '+suspicious.id,exact:true}).click();
 await expect.poll(async()=>(await db.securityNoticeOutbox.findUniqueOrThrow({where:{eventId:suspicious.id}})).maxAttempts).toBe(6);
 await expect(page.getByRole('button',{name:'Bildirishnomani qayta yetkazish '+suspicious.id,exact:true})).toHaveCount(0);
 expect(retryDropped).toBe(true);expect(await db.operation.count({where:{organizationId:me.organization.id,type:'security_notice_retry'}})).toBe(1);
 worker();worker();
 expect(await db.securityNotice.count({where:{event:{userId:me.user.id}}})).toBe(1);
 expect(await db.auditLog.count({where:{entityId:suspicious.id,action:'security_notice_delivered',actorId:null}})).toBe(1);
 await page.goto('/security');await expect(page.getByRole('heading',{name:'Xavfsizlik hodisalari',exact:true})).toBeVisible();
 await expect(page.getByRole('link',{name:'Xavfsizlik bildirishnomalari: 1 ta o‘qilmagan',exact:true})).toBeVisible();
 const notice=await db.securityNotice.findUniqueOrThrow({where:{eventId:suspicious.id}});
 let dropped=false,operationId='';
 await page.route('**/api/auth/security/read',async route=>{
  if(!dropped){dropped=true;const input=route.request().postDataJSON();operationId=input.operationId;expect(input.noticeId).toBe(notice.id);const response=await route.fetch();expect(response.ok()).toBe(true);await route.abort('failed');}
  else await route.continue();
 });
 await page.getByRole('button',{name:'O‘qildi deb belgilash',exact:true}).click();
 await expect(page.getByRole('status').filter({hasText:'Bildirishnoma o‘qildi deb belgilandi.'})).toBeVisible();
 await expect(page.getByRole('link',{name:'Xavfsizlik bildirishnomalari: 0 ta o‘qilmagan',exact:true})).toBeVisible();
 expect(dropped).toBe(true);expect((await db.securityNotice.findUniqueOrThrow({where:{id:notice.id}})).readAt).not.toBeNull();
 expect(await db.operation.count({where:{organizationId:me.organization.id,type:'security_notice_read',key:operationId}})).toBe(1);
 expect(await db.operation.count({where:{organizationId:me.organization.id,type:'security_notice_read'}})).toBe(1);
 await page.reload();await expect(page.getByText('O‘qilgan',{exact:true})).toBeVisible();await expect(page.getByRole('button',{name:'O‘qildi deb belgilash',exact:true})).toHaveCount(0);
 await expect(page.getByRole('link',{name:'Xavfsizlik bildirishnomalari: 0 ta o‘qilmagan',exact:true})).toBeVisible();
 await page.getByRole('button',{name:'Sessiyalar tarixi',exact:true}).click();
 await expect(page.getByRole('heading',{name:'Sessiyalar tarixi',exact:true})).toBeVisible();
 const revoked=page.locator('article').filter({hasText:'Sessiya ID: '+baseline.sourceSessionId}).filter({hasText:'Holat:'});
 await expect(revoked).toContainText('Holat: Bekor qilingan');await expect(revoked.getByRole('button',{name:'Sessiyani bekor qilish',exact:true})).toHaveCount(0);
 const text=await page.locator('body').innerText();for(const secret of [deviceA,deviceB,userAgent,password,suspicious.clientHash!])expect(text).not.toContain(secret);
 expect(errors).toEqual([]);
});

test('Product classification owner UI stores reviewed policy and checkout rejects unavailable marking',async({page})=>{
 const phone='998'+Date.now();phones.push(phone);
 const registration=await page.request.post('/api/auth/register',{headers:{Origin:'https://localhost:3100'},data:{fullName:'Classification owner',phone,password:'test-only-password',organizationName:'Classification business'}});expect(registration.ok()).toBe(true);
 const me=(await (await page.request.get('/api/auth/me')).json()).data;orgs.push(me.organization.id);users.push(me.user.id);
 const store=await db.store.findFirstOrThrow({where:{organizationId:me.organization.id}}),register=await db.register.findFirstOrThrow({where:{storeId:store.id}}),member=await db.organizationUser.findFirstOrThrow({where:{organizationId:me.organization.id,userId:me.user.id}});
 const shift=await db.shift.create({data:{registerId:register.id,organizationUserId:member.id,openingCash:0}}),product=await db.product.create({data:{organizationId:me.organization.id,name:'Classification item',sku:randomUUID(),barcode:randomUUID(),unit:'dona',salePrice:100,costPrice:40}});await db.inventoryBalance.create({data:{storeId:store.id,productId:product.id,quantity:2}});
 await page.goto(`/products/${product.id}/compliance`);await page.getByLabel('MXIK kodi',{exact:true}).fill('Owner supplied code');await page.getByLabel('MXIK tekshirilgan manbasi',{exact:true}).fill('Owner supplied source reference');await page.getByLabel('MXIK majburiy',{exact:true}).check();await page.getByLabel('Markirovka majburiy',{exact:true}).check();await page.getByLabel('Tasnif o‘zgarishi sababi',{exact:true}).fill('Owner confirmed classification');
 await page.getByRole('button',{name:'Tasnifni saqlash: oldindan ko‘rish',exact:true}).click();await expect(page.getByRole('status').filter({hasText:'Amalni tekshiring'})).toContainText('Owner supplied source reference');await page.getByRole('button',{name:'Amalni tasdiqlash',exact:true}).click();await expect.poll(async()=> (await db.product.findUniqueOrThrow({where:{id:product.id}})).markingRequired).toBe(true);
 await page.reload();await expect(page.getByLabel('MXIK kodi',{exact:true})).toHaveValue('Owner supplied code');await expect(page.getByLabel('Markirovka majburiy',{exact:true})).toBeChecked();
 const draft=(await (await page.request.post('/api/sales',{headers:{Origin:'https://localhost:3100'},data:{organizationId:me.organization.id,storeId:store.id,registerId:register.id,shiftId:shift.id,operationId:randomUUID(),items:[{productId:product.id,quantity:1}]}})).json()).data;
 const blocked=await page.request.post(`/api/sales/${draft.id}/complete`,{headers:{Origin:'https://localhost:3100'},data:{operationId:randomUUID(),payments:[{paymentType:'cash',amount:100}]}});expect(blocked.status()).toBe(503);expect(await db.payment.count({where:{saleId:draft.id}})).toBe(0);expect(await db.auditLog.count({where:{entityId:product.id,action:'classification_updated'}})).toBe(1);
});

test('Box conversion owner recovery and POS checkout preserve original ratio, stock and one cash receipt',async({page})=>{
 const phone='998'+Date.now();phones.push(phone);expect((await page.request.post('/api/auth/register',{headers:{Origin:'https://localhost:3100'},data:{fullName:'Box owner',phone,password:'test-only-password',organizationName:'Box business'}})).ok()).toBe(true);
 const me=(await (await page.request.get('/api/auth/me')).json()).data;orgs.push(me.organization.id);users.push(me.user.id);
 const store=await db.store.findFirstOrThrow({where:{organizationId:me.organization.id}}),register=await db.register.findFirstOrThrow({where:{storeId:store.id}}),member=await db.organizationUser.findFirstOrThrow({where:{organizationId:me.organization.id,userId:me.user.id}});await db.shift.create({data:{registerId:register.id,organizationUserId:member.id,openingCash:0}});
 const product=await db.product.create({data:{organizationId:me.organization.id,name:'Browser box item',sku:'BOX-'+randomUUID(),barcode:'BOX-'+randomUUID(),unit:'dona',salePrice:100,costPrice:40}});await db.inventoryBalance.create({data:{storeId:store.id,productId:product.id,quantity:24}});
 const unitsPattern='**/api/products/'+product.id+'/units';let original='';await page.route(unitsPattern,async route=>{if(route.request().method()==='POST'){original=route.request().postData()??'';await route.fetch();await route.abort()}else await route.continue()});await page.goto('/products/'+product.id+'/units');await page.getByLabel('Savdo birligi kodi',{exact:true}).fill('quti');await page.getByLabel('Asosiy birliklar soni',{exact:true}).fill('12');await page.getByLabel('Konvertatsiya sababi',{exact:true}).fill('Owner verified twelve pieces per box');await page.getByRole('button',{name:'Konvertatsiyani saqlash: oldindan ko‘rish',exact:true}).click();await page.getByRole('button',{name:'Amalni tasdiqlash',exact:true}).click();await expect.poll(()=>db.productUnitConversion.count({where:{productId:product.id}})).toBe(1);
 await page.reload();await page.unroute(unitsPattern);let replay='';await page.route(unitsPattern,async route=>{if(route.request().method()==='POST')replay=route.request().postData()??'';await route.continue()});await page.getByRole('button',{name:'Saqlangan amalni qayta tekshirish',exact:true}).click();await expect(page.getByRole('button',{name:'Saqlangan amalni qayta tekshirish',exact:true})).not.toBeVisible();expect(JSON.parse(replay)).toEqual(JSON.parse(original));expect(await db.auditLog.count({where:{entityId:product.id,action:'conversion_updated'}})).toBe(1);
 await page.goto('/pos');await page.getByLabel('POS mahsulot qidirish',{exact:true}).fill(product.barcode);await page.keyboard.press('Enter');await expect(page.getByLabel('Browser box item savdo birligi',{exact:true})).toBeVisible();await page.getByLabel('Browser box item savdo birligi',{exact:true}).selectOption('quti');await expect(page.getByText('1 quti = 12 dona; narx asosiy birlik uchun.',{exact:true})).toBeVisible();await expect(page.getByLabel('Browser box item miqdori',{exact:true})).toHaveValue('1');
 await page.getByRole('button',{name:"To'lovga o'tish",exact:true}).click();await page.getByRole('button',{name:'Naqd pul',exact:true}).click();await page.getByLabel("Mijoz bergan naqd pul (so'm)").fill('1200');await page.getByRole('button',{name:/Savdoni yakunlash/}).click();await expect.poll(()=>db.sale.count({where:{organizationId:me.organization.id,status:'completed'}})).toBe(1);
 const sale=await db.sale.findFirstOrThrow({where:{organizationId:me.organization.id,status:'completed'},include:{items:true,payments:true}});expect(sale.totalAmount.toString()).toBe('1200');expect(sale.items[0].quantity.toString()).toBe('12');expect((sale.items[0].conversionSnapshot as {tradeQuantity:string}).tradeQuantity).toBe('1');expect(sale.payments).toHaveLength(1);expect((await db.inventoryBalance.findUniqueOrThrow({where:{storeId_productId:{storeId:store.id,productId:product.id}}})).quantity.toString()).toBe('12');await expect(page.getByText(/Asl: 1 quti/)).toBeVisible();
});
test('Catalogue export UI recovers lost enqueue acknowledgement and real worker produces an exact scoped CSV download',async({page})=>{
 const origin={Origin:'https://localhost:3100'},phone='998'+Date.now();phones.push(phone);expect((await page.request.post('/api/auth/register',{headers:origin,data:{fullName:'Export owner',phone,password:'test-only-password',organizationName:'Export acceptance business'}})).ok()).toBe(true);const me=(await(await page.request.get('/api/auth/me')).json()).data;orgs.push(me.organization.id);users.push(me.user.id);await db.product.create({data:{organizationId:me.organization.id,name:'=SUM(1,2)',sku:randomUUID(),barcode:randomUUID(),unit:'dona',salePrice:'0.01',costPrice:'12345678901234.123456'}});
 await page.goto('/jobs');await page.getByLabel('Fon ishining turi',{exact:true}).selectOption('catalog_export');await page.getByLabel('Fon ishini tasdiqlash sababi',{exact:true}).fill('Owner approves exact full catalogue CSV');await page.getByRole('button',{name:'Katalog eksportini navbatga qo‘yish: oldindan ko‘rish',exact:true}).click();let dropped=false;await page.route('**/api/jobs',async route=>{if(route.request().method()==='POST'&&!dropped){dropped=true;const r=await route.fetch();expect(r.ok()).toBe(true);await route.abort('failed')}else await route.continue()});await page.getByRole('button',{name:'Amalni tasdiqlash',exact:true}).click();await expect(page.getByRole('button',{name:'Original amalni qayta tekshirish',exact:true})).toBeVisible();await page.reload();await page.getByRole('button',{name:'Saqlangan amalni qayta tekshirish',exact:true}).click();await expect(page.getByRole('heading',{name:'Katalog CSV eksporti · Navbatda',exact:true})).toBeVisible();expect(await db.backgroundJob.count({where:{organizationId:me.organization.id}})).toBe(1);
 execFileSync(process.execPath,['--require','./scripts/worker-resolver.cjs','.worker-build/scripts/workers/jobs.js','--once'],{env:{...process.env,NODE_ENV:'production',APP_ORIGIN:'https://localhost:3100'},timeout:30000,stdio:'pipe'});await page.getByRole('button',{name:'Fon ishlarini yangilash',exact:true}).click();await expect(page.getByRole('heading',{name:'Katalog CSV eksporti · Yakunlangan',exact:true})).toBeVisible();const [download]=await Promise.all([page.waitForEvent('download'),page.getByRole('button',{name:'Katalog CSV faylini yuklash',exact:true}).click()]);const content=readFileSync((await download.path())!,'utf8');expect(content).toContain("'=SUM(1,2)");expect(content).toContain('12345678901234.123456');expect(content.split('\r\n')).toHaveLength(3);const job=await db.backgroundJob.findFirstOrThrow({where:{organizationId:me.organization.id}});expect(await db.jobExport.count({where:{jobId:job.id}})).toBe(1);expect(await db.operation.count({where:{organizationId:me.organization.id,type:'job.enqueue'}})).toBe(1);expect(await db.auditLog.count({where:{entityId:job.id,action:'system_job_succeeded'}})).toBe(1)
});
test('Customer advance UI recovers lost receipt acknowledgement then allocates opening debt and refunds only unused cash once',async({page})=>{
 const origin={Origin:'https://localhost:3100'},phone='998'+Date.now();phones.push(phone)
 expect((await page.request.post('/api/auth/register',{headers:origin,data:{fullName:'Advance owner',phone,password:'test-only-password',organizationName:'Cash advance business'}})).ok()).toBe(true)
 const me=(await(await page.request.get('/api/auth/me')).json()).data;orgs.push(me.organization.id);users.push(me.user.id)
 const store=await db.store.findFirstOrThrow({where:{organizationId:me.organization.id}}),register=await db.register.findFirstOrThrow({where:{storeId:store.id}}),member=await db.organizationUser.findFirstOrThrow({where:{organizationId:me.organization.id,userId:me.user.id}})
 const shift=await db.shift.create({data:{registerId:register.id,organizationUserId:member.id,openingCash:0}}),customer=await db.customer.create({data:{organizationId:me.organization.id,fullName:'Advance customer',phone:randomUUID(),creditLimit:1000}})
 const accountResponse=await page.request.post('/api/finance/accounts',{headers:origin,data:{operationId:randomUUID(),storeId:store.id,registerId:register.id,name:'Advance cash account',kind:'cash',openingBalance:0,reason:'Physical till journal'}});expect(accountResponse.ok()).toBe(true);const account=(await accountResponse.json()).data
 const debtResponse=await page.request.post('/api/customers/'+customer.id+'/ledger',{headers:origin,data:{operationId:randomUUID(),kind:'opening',amount:'100',reason:'Original opening debt'}});expect(debtResponse.ok()).toBe(true);const debt=(await debtResponse.json()).data
 await page.goto('/customers/'+customer.id);const card=page.locator('div').filter({has:page.getByRole('heading',{name:'Mijoz avansi',exact:true})}).filter({has:page.getByLabel('Avans summasi')}).last()
 await page.getByLabel('Avans uchun naqd hisob').selectOption(account.id);await page.getByLabel('Avans summasi').fill('120.25');await page.getByLabel('Avans sababi').fill('Actual physical customer advance')
 let lost=false;await page.route('**/api/customers/'+customer.id+'/advances',async route=>{if(route.request().method()==='POST'&&!lost){lost=true;await route.fetch();await route.abort('failed')}else await route.continue()})
 await page.getByRole('button',{name:'Naqd avans qabul qilish: oldindan ko‘rish',exact:true}).click();await card.getByRole('button',{name:'Amalni tasdiqlash',exact:true}).click();await expect.poll(()=>db.customerAdvance.count({where:{customerId:customer.id}})).toBe(1)
 await page.reload();await card.getByRole('button',{name:'Original amalni qayta tekshirish',exact:true}).click();await expect(card).toContainText('Ishlatilmagan avans: 120.25')
 const a=await db.customerAdvance.findFirstOrThrow({where:{customerId:customer.id}});await page.getByLabel('Avans amali').selectOption('allocate');await page.getByLabel('Asl avans').selectOption(a.id);await page.getByLabel('Avans ajratiladigan qarz').selectOption('document:'+debt.id);await page.getByLabel('Avans summasi').fill('100');await page.getByLabel('Avans sababi').fill('Allocate original opening debt')
 await page.getByRole('button',{name:'Avansni qarzga ajratish: oldindan ko‘rish',exact:true}).click();await card.getByRole('button',{name:'Amalni tasdiqlash',exact:true}).click();await expect.poll(()=>db.customerAdvanceAllocation.count({where:{advanceId:a.id}})).toBe(1)
 await page.getByLabel('Avans amali').selectOption('refund');await page.getByLabel('Asl avans').selectOption(a.id);await page.getByLabel('Avans uchun naqd hisob').selectOption(account.id);await page.getByLabel('Avans summasi').fill('20.25');await page.getByLabel('Avans sababi').fill('Return original unused advance')
 await page.getByRole('button',{name:'Ishlatilmagan avansni qaytarish: oldindan ko‘rish',exact:true}).click();await card.getByRole('button',{name:'Amalni tasdiqlash',exact:true}).click();await expect.poll(()=>db.customerAdvanceRefund.count({where:{advanceId:a.id}})).toBe(1)
 expect((await db.debtEntry.aggregate({where:{customerId:customer.id},_sum:{amount:true}}))._sum.amount?.toString()).toBe('0');expect(await db.customerAdvance.count({where:{customerId:customer.id}})).toBe(1);expect((await db.cashMovement.aggregate({where:{shiftId:shift.id,movementType:'cash_in'},_sum:{amount:true}}))._sum.amount?.toString()).toBe('120.25');expect((await db.cashMovement.aggregate({where:{shiftId:shift.id,movementType:'cash_out'},_sum:{amount:true}}))._sum.amount?.toString()).toBe('20.25')
})


test('Maintenance UI preserves saved basket and original pending sale across drain and restores cash checkout once',async({page})=>{
 const statePath=process.env.POS_DEPLOYMENT_STATE_FILE;test.skip(statePath!=='/tmp/pos-maintenance-e2e-state.json','Dedicated operator state fixture required')
 const state=(maintenance:boolean)=>{const temp=statePath!+'.'+randomUUID();writeFileSync(temp,JSON.stringify({maintenance,message:maintenance?'Planned POS maintenance acceptance':'Service available'}),{mode:0o600});renameSync(temp,statePath!)}
 state(false)
 try{
  const origin={Origin:'https://localhost:3100'},phone='998'+Date.now();phones.push(phone);expect((await page.request.post('/api/auth/register',{headers:origin,data:{fullName:'Maintenance owner',phone,password:'test-only-password',organizationName:'Maintenance acceptance'}})).ok()).toBe(true)
  const me=(await(await page.request.get('/api/auth/me')).json()).data;orgs.push(me.organization.id);users.push(me.user.id)
  const store=await db.store.findFirstOrThrow({where:{organizationId:me.organization.id}}),register=await db.register.findFirstOrThrow({where:{storeId:store.id}}),member=await db.organizationUser.findFirstOrThrow({where:{organizationId:me.organization.id,userId:me.user.id}}),shift=await db.shift.create({data:{registerId:register.id,organizationUserId:member.id,openingCash:0}}),product=await db.product.create({data:{organizationId:me.organization.id,name:'Maintenance coffee',sku:'MAINT100',barcode:'MAINT100',unit:'dona',salePrice:'100.25',costPrice:40}})
  await db.inventoryBalance.create({data:{storeId:store.id,productId:product.id,quantity:3}})
  const body={operationId:randomUUID(),organizationId:me.organization.id,storeId:store.id,registerId:register.id,shiftId:shift.id,items:[{productId:product.id,quantity:1}]},created=await page.request.post('/api/sales',{headers:origin,data:body});expect(created.ok()).toBe(true);const sale=(await created.json()).data,completion={payments:[{paymentType:'cash',amount:'100.25'}]};expect((await page.request.post('/api/sales/'+sale.id+'/complete',{headers:origin,data:completion})).ok()).toBe(true)
  await page.goto('/pos');await page.getByLabel('POS mahsulot qidirish',{exact:true}).fill('MAINT100');await page.keyboard.press('Enter');await expect(page.getByRole('button',{name:"To'lovga o'tish",exact:true})).toBeEnabled()
  await expect.poll(()=>page.evaluate(async()=>{const request=indexedDB.open('shuni-pos-local-v1'),database=await new Promise<IDBDatabase>((resolve,reject)=>{request.onsuccess=()=>resolve(request.result);request.onerror=()=>reject(request.error)}),values=await new Promise<{value:{cart:{items:unknown[]}}}[]>(resolve=>{const query=database.transaction('drafts').objectStore('drafts').getAll();query.onsuccess=()=>resolve(query.result)});database.close();return values.some(v=>v.value.cart.items.length===1)})).toBe(true)
  state(true);expect((await page.request.get('/api/health/ready')).status()).toBe(503);expect((await page.request.post('/api/sales/'+sale.id+'/complete',{headers:origin,data:completion})).status()).toBe(200)
  await page.reload();await expect(page.getByText('Planned POS maintenance acceptance',{exact:true})).toBeVisible();await expect(page.getByRole('button',{name:"To'lovga o'tish",exact:true})).toBeDisabled()
  state(false);await page.reload();await expect(page.getByRole('button',{name:"To'lovga o'tish",exact:true})).toBeEnabled();await page.getByRole('button',{name:"To'lovga o'tish",exact:true}).click();await page.getByRole('button',{name:'Naqd pul',exact:true}).click();await page.getByLabel("Mijoz bergan naqd pul (so'm)").fill('100.25')
  // The operator drains between a successful quote/probe and the actual write.
  let interrupted=false;await page.route('**/api/sales',async route=>{if(route.request().method()==='POST'&&!interrupted){interrupted=true;state(true)}await route.continue()})
  const denied=page.waitForResponse(response=>new URL(response.url()).pathname==='/api/sales'&&response.request().method()==='POST'&&response.status()===503)
  await page.getByRole('button',{name:/Savdoni yakunlash/}).click();expect((await(await denied).json()).error.code).toBe('MAINTENANCE')
  await expect.poll(()=>page.evaluate(async()=>{const request=indexedDB.open('shuni-pos-local-v1'),database=await new Promise<IDBDatabase>((resolve,reject)=>{request.onsuccess=()=>resolve(request.result);request.onerror=()=>reject(request.error)});const drafts=await new Promise<{value:{attempt?:{operationId:string}}}[]>(resolve=>{const query=database.transaction('drafts').objectStore('drafts').getAll();query.onsuccess=()=>resolve(query.result)}),operations=await new Promise<{id:string;state:string}[]>(resolve=>{const query=database.transaction('operations').objectStore('operations').getAll();query.onsuccess=()=>resolve(query.result)});database.close();return drafts.some(d=>d.value.attempt?.operationId&&operations.some(o=>o.id===d.value.attempt?.operationId&&o.state==='pending'))})).toBe(true)
  await expect(page.getByRole('button',{name:'Natijani tekshirish',exact:true})).toBeVisible();expect(await db.sale.count({where:{organizationId:me.organization.id}})).toBe(1)
  await page.reload();await expect(page.getByRole('button',{name:'Natijani tekshirish',exact:true})).toBeVisible();state(false);await page.reload();await page.getByRole('button',{name:'Navbatni sinxronlash',exact:true}).click();await expect.poll(()=>db.sale.count({where:{organizationId:me.organization.id,status:'draft'}})).toBe(1)
  await page.getByRole('button',{name:'Qoralama to‘lovini davom ettirish',exact:true}).click();await page.getByRole('button',{name:'Naqd pul',exact:true}).click();await page.getByLabel("Mijoz bergan naqd pul (so'm)").fill('100.25');await page.getByRole('button',{name:/Savdoni yakunlash/}).click();await expect.poll(()=>db.sale.count({where:{organizationId:me.organization.id,status:'completed'}})).toBe(2)
  expect(await db.payment.count({where:{organizationId:me.organization.id,paymentType:'cash',direction:'in'}})).toBe(2);expect((await db.inventoryBalance.findUniqueOrThrow({where:{storeId_productId:{storeId:store.id,productId:product.id}}})).quantity.toString()).toBe('1')
 }finally{state(false)}
})


test('Independent finance drafts share one navigation decision and busy mutation blocks context exit',async({page})=>{
 const phone='guard-browser-'+randomUUID();phones.push(phone);
 const registration=await page.request.post('/api/auth/register',{headers:{Origin:'https://localhost:3100'},data:{fullName:'Guard owner',phone,password:'test-only-password',organizationName:'Guard business'}});expect(registration.ok()).toBe(true);
 const me=(await (await page.request.get('/api/auth/me')).json()).data;orgs.push(me.organization.id);users.push(me.user.id);
 await page.goto('/finance');
 let prompts=0;page.on('dialog',async dialog=>{prompts++;await dialog.dismiss();});
 const home=page.getByRole('link',{name:'Dashboard',exact:true});
 await expect(page.getByRole('button',{name:'Hisob yaratish: oldindan ko‘rish',exact:true})).toBeEnabled();
 await home.click();await expect(page).toHaveURL(/\/dashboard$/);expect(prompts).toBe(0);
 await page.locator('a[href="/finance"]').first().click();await expect(page).toHaveURL(/\/finance$/);
 await page.getByLabel('Hisob nomi',{exact:true}).fill('Guard bank draft');
 await page.getByLabel('Hisob ochish asosi',{exact:true}).fill('Verified manual bank opening');
 await page.getByLabel('Xarajat toifasi nomi',{exact:true}).fill('Unposted second draft');
 await home.click();await expect(page).toHaveURL(/\/finance$/);expect(prompts).toBe(1);
 await page.evaluate(()=>history.back());await expect.poll(()=>prompts).toBe(2);await expect(page).toHaveURL(/\/finance$/);
 await expect(page.getByLabel('Hisob nomi',{exact:true})).toHaveValue('Guard bank draft');
 await expect(page.getByLabel('Xarajat toifasi nomi',{exact:true})).toHaveValue('Unposted second draft');
 await page.getByRole('button',{name:'Hisob yaratish: oldindan ko‘rish',exact:true}).click();
 let release:(()=>void)|undefined;const gate=new Promise<void>(resolve=>{release=resolve});let started=false;
 await page.route('**/api/finance/accounts',async route=>{if(route.request().method()!=='POST'){await route.continue();return;}started=true;await gate;await route.continue();});
 await page.getByRole('button',{name:'Amalni tasdiqlash',exact:true}).click();
 await expect.poll(()=>started).toBe(true);await expect(page.getByText('Server tasdig‘i kutilmoqda…',{exact:true})).toBeVisible();
 await home.click();await expect(page).toHaveURL(/\/finance$/);expect(prompts).toBe(2);
 release!();
 await expect.poll(()=>db.financialAccount.count({where:{organizationId:me.organization.id,name:'Guard bank draft'}})).toBe(1);
 await expect(page.getByText('Serverda saqlandi.',{exact:true})).toBeVisible();
 await expect(page.getByLabel('Xarajat toifasi nomi',{exact:true})).toHaveValue('Unposted second draft');
 await home.click();await expect(page).toHaveURL(/\/finance$/);expect(prompts).toBe(3);
 expect(await db.expenseCategory.count({where:{organizationId:me.organization.id,name:'Unposted second draft'}})).toBe(0);
});


test('Dashboard boundary recovers a render failure without creating an economic operation or exposing input data',async({page})=>{
 const phone='boundary-browser-'+randomUUID();phones.push(phone);
 const registration=await page.request.post('/api/auth/register',{headers:{Origin:'https://localhost:3100'},data:{fullName:'Boundary owner',phone,password:'test-only-password',organizationName:'Boundary business'}});expect(registration.ok()).toBe(true);
 const me=(await (await page.request.get('/api/auth/me')).json()).data;orgs.push(me.organization.id);users.push(me.user.id);
 const before=await db.operation.count({where:{organizationId:me.organization.id}});let failed=false;
 await page.route('**/api/finance/accounts',async route=>{if(!failed&&route.request().method()==='GET'){failed=true;await route.fulfill({status:200,contentType:'application/json',body:JSON.stringify({success:true,data:{invalid:'private-test-canary'}})});}else await route.continue();});
 await page.goto('/finance');await expect(page.getByRole('heading',{name:'Sahifa ochilmadi',exact:true})).toBeVisible();
 await expect(page.locator('section[role="alert"]')).not.toContainText('private-test-canary');
 await page.getByRole('button',{name:'Sahifani qayta ochish',exact:true}).click();
 await expect(page.getByRole('heading',{name:'Hisoblar va biznes xarajatlari',exact:true})).toBeVisible();
 await expect(page.getByRole('heading',{name:'Sahifa ochilmadi',exact:true})).toHaveCount(0);
 expect(await db.operation.count({where:{organizationId:me.organization.id}})).toBe(before);
});
