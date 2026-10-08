import {readFileSync} from 'node:fs'
import ts from 'typescript'
import { test, expect, type Locator } from '@playwright/test'
import { PrismaClient } from '@prisma/client'
import { randomUUID } from 'node:crypto'
const connection=new URL(process.env.DATABASE_URL??'')
if(connection.hostname!=='127.0.0.1'||connection.pathname!=='/pos_test')throw new Error('Isolated test DB required')
const db=new PrismaClient(),orgs:string[]=[],users:string[]=[],phones:string[]=[]
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
 await page.getByRole('dialog').getByRole('button',{name:'Smenani ochish',exact:true}).click()
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
 const customerResponse=await page.request.post('/api/customers',{headers:{Origin:'https://localhost:3100'},data:{organizationId:me.data.organization.id,fullName:'Browser debtor',phone:'998'+Date.now(),creditLimit:1000}})
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
 const returnMarkup=await (await import('node:fs/promises')).readFile((await returnHtml.path())!,'utf8');expect(returnMarkup).toContain('QAYTARMA CHEK — NUSXA');expect(returnMarkup).toContain(sale.id);expect(returnMarkup).toContain('Damaged refund recovery');expect(returnMarkup).toContain('tasdiq: owner');

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
 await supplierRow.getByRole('button',{name:'Arxivlash',exact:true}).click();await expect(supplierRow).not.toBeVisible();await page.getByLabel('Holat',{exact:true}).selectOption('archived');await expect(supplierRow).toBeVisible();await supplierRow.getByRole('button',{name:'Tiklash',exact:true}).click();await expect(supplierRow).not.toBeVisible();await page.getByLabel('Holat',{exact:true}).selectOption('active')
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
 await page.getByLabel('Joriy parol',{exact:true}).fill(password)
 await page.getByLabel('Yangi parol',{exact:true}).fill('browser-new-password')
 await page.getByLabel('Yangi parolni tasdiqlash',{exact:true}).fill('different-password')
 await page.getByRole('button',{name:'Parolni yangilash',exact:true}).click()
 await expect(page.getByText('Yangi parollar bir xil emas',{exact:true})).toBeVisible()
 await page.getByLabel('Yangi parolni tasdiqlash',{exact:true}).fill('browser-new-password')
 await page.getByRole('button',{name:'Parolni yangilash',exact:true}).click()
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
 await page.getByLabel('Hujjat raqami',{exact:true}).fill('CURRENT');await page.getByRole('button',{name:'Filtrlash',exact:true}).click();await expect(page.getByRole('row').filter({hasText:'BROWSER-CURRENT'})).toHaveCount(1);expect((await downloadText('Supplier tarixini CSV yuklash')).includes('BROWSER-DRAFT')).toBe(false)
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
 await page.getByLabel('Original yopilgan smena',{exact:true}).selectOption(original.id);await page.getByLabel('Tuzatish summasi',{exact:true}).fill('3.50');await page.getByLabel('Tuzatish sababi',{exact:true}).fill('Browser count correction')
 let originalInput='',retryInput=''
 await page.route('**/api/shifts/*/corrections',async route=>{if(route.request().method()==='POST'){originalInput=route.request().postData()??'';await route.fetch();await route.abort()}else await route.continue()})
 await page.getByRole('button',{name:'Tuzatishni yozish',exact:true}).click();await expect.poll(()=>db.shiftCorrection.count({where:{originalShiftId:original.id}})).toBe(1)
 await page.reload();await expect(page.getByRole('button',{name:'Tuzatish natijasini tekshirish',exact:true})).toBeVisible();await expect(page.getByLabel('Tuzatish summasi',{exact:true})).toBeDisabled()
 await page.unroute('**/api/shifts/*/corrections');await page.route('**/api/shifts/*/corrections',async route=>{if(route.request().method()==='POST')retryInput=route.request().postData()??'';await route.continue()})
 await page.getByRole('button',{name:'Tuzatish natijasini tekshirish',exact:true}).click();await expect(page.getByRole('button',{name:'Tuzatishni yozish',exact:true})).toBeVisible();expect(JSON.parse(retryInput)).toEqual(JSON.parse(originalInput))
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
 const source=ts.transpileModule(readFileSync('src/lib/offline.ts','utf8'),{compilerOptions:{target:ts.ScriptTarget.ES2022,module:ts.ModuleKind.ES2022}}).outputText
 const result=await page.evaluate(async source=>{
  const lib=await import('data:text/javascript;base64,'+btoa(unescape(encodeURIComponent(source))))
  const scope={organizationId:crypto.randomUUID(),userId:crypto.randomUUID(),deviceId:lib.deviceId()},foreign={...scope,userId:crypto.randomUUID()},otherDevice={...scope,deviceId:crypto.randomUUID()}
  await lib.saveDraft(scope,{marker:'own'});await lib.saveDraft(foreign,{marker:'foreign'})
  const minimalScope={...scope,deviceId:crypto.randomUUID()};await lib.saveDraft(minimalScope,{cart:{customer:{id:'customer',fullName:'Name',phone:'phone',email:'private',passwordHash:'never-persist'},items:[{product:{id:'sku',name:'Item',costPrice:'private',supplier:{secret:'never-persist'}}}]}});const minimal=JSON.stringify(await lib.loadDraft(minimalScope));const minimized=!minimal.includes('private')&&!minimal.includes('never-persist');
  const id=crypto.randomUUID(),op={id,scope,type:'sale.create',payload:{organizationId:scope.organizationId},state:'pending',createdAt:new Date().toISOString()}
  const race=await Promise.allSettled([lib.enqueue(op),lib.enqueue({...op,payload:{organizationId:'different'}})])
  const own=await lib.pendingOperations(scope),stranger=await lib.pendingOperations(foreign),device=await lib.pendingOperations(otherDevice)
  let blocked=false;try{await lib.clearScope(scope)}catch{blocked=true}
  const before=await lib.loadDraft(scope),foreignBefore=await lib.loadDraft(foreign)
  const fetchOriginal=globalThis.fetch;let invalidAckBlocked=false
  try{globalThis.fetch=async()=>new Response(JSON.stringify({data:[{operationId:crypto.randomUUID(),state:'synced',result:{id:'wrong'}}]}),{status:200,headers:{'content-type':'application/json'}});try{await lib.synchronize(scope)}catch{invalidAckBlocked=true}}finally{globalThis.fetch=fetchOriginal}
  const preservedAfterInvalidAck=(await lib.pendingOperations(scope)).length
  await Promise.all([lib.acknowledge(id,'synced',{id:'original'}),lib.acknowledge(id,'conflict',undefined,'STALE')])
  await lib.acknowledge(id,'synced',{id:'original'});const pending=await lib.pendingOperations(scope)
  await lib.clearScope(scope);const after=await lib.loadDraft(scope),foreignAfter=await lib.loadDraft(foreign)
  return {minimized,oneWinner:race.filter(r=>r.status==='fulfilled').length,own:own.length,stranger:stranger.length,device:device.length,blocked,invalidAckBlocked,preservedAfterInvalidAck,before,foreignBefore,pending:pending.length,after:after??null,foreignAfter,stableDevice:scope.deviceId===lib.deviceId()}
 },source)
 expect(result).toEqual({minimized:true,oneWinner:1,own:1,stranger:0,device:0,blocked:true,invalidAckBlocked:true,preservedAfterInvalidAck:1,before:{marker:'own'},foreignBefore:{marker:'foreign'},pending:0,after:null,foreignAfter:{marker:'foreign'},stableDevice:true})
})

test('Business switching keeps catalogs, local baskets and terminal selection scoped; label HTML downloads safely',async({page,browser})=>{
 const phone='998'+Date.now();phones.push(phone)
 await page.goto('/register');await page.getByLabel('Ism va Familiya').fill('Switch Owner');await page.getByLabel('Telefon raqam',{exact:true}).fill(phone);await page.getByLabel("Do'kon yoki Biznes nomi").fill('Switch A');await page.getByLabel(/Parol \(/).fill('test-only-password');await page.getByRole('button',{name:'Hisob yaratish va Boshlash'}).click();await expect(page).toHaveURL(/\/dashboard$/)
 const me=(await (await page.request.get('/api/auth/me')).json()).data,first=await db.store.findFirstOrThrow({where:{organizationId:me.organization.id}})
 const second=await db.organization.create({data:{name:'Switch B',phone:randomUUID()}});orgs.push(second.id)
 await db.organizationUser.create({data:{organizationId:second.id,userId:me.user.id,role:'owner'}})
 const secondStore=await db.store.create({data:{organizationId:second.id,name:'B store'}})
 await db.register.create({data:{storeId:secondStore.id,name:'B terminal',code:randomUUID()}})
 const a=await db.product.create({data:{organizationId:me.organization.id,name:'ONLY_A',sku:randomUUID(),barcode:'00123456789',unit:'dona',salePrice:10,costPrice:1}})
 await db.product.create({data:{organizationId:second.id,name:'ONLY_B',sku:randomUUID(),barcode:'987654321',unit:'dona',salePrice:10,costPrice:1}})
 await page.goto('/pos');await page.getByRole('button',{name:'Smenani ochish',exact:true}).click();await page.getByRole('dialog').getByRole('button',{name:'Smenani ochish',exact:true}).click();await expect(page.getByRole('dialog')).not.toBeVisible();await page.getByRole('heading',{name:'ONLY_A',exact:true}).click();await expect(page.getByRole('button',{name:"To'lovga o'tish"})).toBeEnabled()
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
 await page.goto('/settings');await page.getByRole('button',{name:'Xodimlar (Foydalanuvchilar)',exact:true}).click()
 page.on('dialog',dialog=>void dialog.accept())
 await page.getByRole('row').filter({hasText:'Recipient owner'}).getByRole('button',{name:'Arxivlash',exact:true}).click()
 await expect(page.getByRole('row').filter({hasText:'Recipient owner'}).getByText('Arxivlangan',{exact:true})).toBeVisible()
 await expect(page.getByRole('row').filter({hasText:'Recipient owner'}).getByRole('button',{name:'Faollashtirish',exact:true})).toHaveCount(0)
 await page.reload();await page.getByRole('button',{name:'Xodimlar (Foydalanuvchilar)',exact:true}).click()
 await page.getByRole('row').filter({hasText:'Recipient owner'}).getByRole('button',{name:'Arxivdan tiklash',exact:true}).click()
 await expect(page.getByRole('row').filter({hasText:'Recipient owner'}).getByText('Bloklangan',{exact:true})).toBeVisible()
 await page.getByRole('row').filter({hasText:'Recipient owner'}).getByRole('button',{name:'Faollashtirish',exact:true}).click()
 await expect(page.getByRole('row').filter({hasText:'Recipient owner'}).getByText('Faol',{exact:true})).toBeVisible()
 await page.getByRole('row').filter({hasText:'Recipient owner'}).getByRole('button',{name:'Egalikni topshirish',exact:true}).click()
 await expect.poll(()=>db.ownershipTransfer.count({where:{organizationId:me.organization.id,state:'pending'}})).toBe(1)
 expect((await db.organizationUser.findUniqueOrThrow({where:{id:member.id}})).role).toBe('cashier')
 const recipient=await browser.newContext({ignoreHTTPSErrors:true})
 try{
  expect((await recipient.request.post('https://localhost:3100/api/auth/login',{headers:{Origin:'https://localhost:3100'},data:{phone:target.phone,password:'test-only-password'}})).ok()).toBe(true)
  const recipientPage=await recipient.newPage();recipientPage.on('dialog',dialog=>void dialog.accept());await recipientPage.goto('https://localhost:3100/pos')
  await recipientPage.getByRole('button',{name:'Qabul qilish',exact:true}).click()
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
 await page.goto('/pos');await page.getByRole('button',{name:'Smenani ochish',exact:true}).click();await page.getByRole('dialog').getByRole('button',{name:'Smenani ochish',exact:true}).click();await expect(page.getByRole('dialog')).not.toBeVisible()
 await page.getByRole('button',{name:'Conflict item — savatga qo‘shish',exact:true}).click()
 await db.product.update({where:{id:product.id},data:{salePrice:120}})
 await page.getByRole('button',{name:"To'lovga o'tish"}).click();await page.getByRole('button',{name:/Savdoni yakunlash/}).click()
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
  const cashier=await context.newPage();await cashier.goto('https://localhost:3100/training');await cashier.getByRole('button',{name:'Mashq mahsulotini qo‘shish',exact:true}).click();await cashier.getByRole('button',{name:'Mashq to‘loviga o‘tish',exact:true}).click();await cashier.getByLabel('Mashqda berilgan naqd',{exact:true}).fill('15000');await cashier.getByRole('button',{name:'Faqat mashqni yakunlash',exact:true}).click();await expect(cashier.getByRole('status').filter({hasText:'Mashq yakunlandi'})).toBeVisible();expect(await db.sale.count({where:{organizationId:me.organization.id}})).toBe(0);await cashier.goto('https://localhost:3100/pos');await cashier.getByRole('button',{name:'Smenani ochish',exact:true}).click();await cashier.getByLabel("Boshlang'ich naqd pul (so'm)").fill('50');await cashier.getByRole('dialog').getByRole('button',{name:'Smenani ochish',exact:true}).click();await expect(cashier.getByRole('dialog')).not.toBeVisible()
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
  await cashier.goto('https://localhost:3100/pos');await cashier.getByRole('button',{name:'Smenani ochish',exact:true}).click();await cashier.getByLabel(/Oldingi smenani qabul qilish/).check();await expect(cashier.getByLabel("Boshlang'ich naqd pul (so'm)")).toHaveValue('50');await cashier.getByRole('dialog').getByRole('button',{name:'Smenani ochish',exact:true}).click();await expect(cashier.getByRole('dialog')).not.toBeVisible()
  const next=await db.shift.findFirstOrThrow({where:{handoverFromId:closed.id}});expect(next.openingCash.toString()).toBe('50')
 }finally{await context.close()}
})

test('Owner mobile dashboard and cashier touch controls remain reachable at 360, 768 and 1280 pixels',async({page})=>{
 const phone='998'+Date.now();phones.push(phone)
 await page.goto('/register');await page.getByLabel('Ism va Familiya').fill('Mobile Owner');await page.getByLabel('Telefon raqam',{exact:true}).fill(phone);await page.getByLabel("Do'kon yoki Biznes nomi").fill('Mobile POS');await page.getByLabel(/Parol \(/).fill('test-only-password');await page.getByRole('button',{name:'Hisob yaratish va Boshlash'}).click();await expect(page).toHaveURL(/\/dashboard$/)
 const me=(await (await page.request.get('/api/auth/me')).json()).data;orgs.push(me.organization.id);users.push(me.user.id)
 await db.product.create({data:{organizationId:me.organization.id,name:'Touch item',sku:randomUUID(),barcode:randomUUID(),unit:'dona',salePrice:10,costPrice:1}})
 await page.goto('/pos');await page.getByRole('button',{name:'Smenani ochish',exact:true}).click();await page.getByRole('dialog').getByRole('button',{name:'Smenani ochish',exact:true}).click();await expect(page.getByRole('dialog')).not.toBeVisible()
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
 await page.goto('/pos');await page.getByRole('button',{name:'Smenani ochish',exact:true}).click();await page.getByRole('dialog').getByRole('button',{name:'Smenani ochish',exact:true}).click();await expect(page.getByRole('dialog')).not.toBeVisible()
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
 await page.goto('/incidents');await page.getByRole('button',{name:'Hisoblarni solishtirish',exact:true}).click();await expect(page.getByRole('article')).toContainText('Ombor qoldig‘i');await expect(page.getByRole('article')).toContainText('Jiddiy')
 await page.getByLabel('Yopish sababi',{exact:true}).fill('Checked in browser');await page.getByRole('button',{name:'Tuzatilganini tekshirib yopish',exact:true}).click();await expect(page.getByRole('alert').filter({hasText:'Farq hali bor'})).toContainText('Farq hali bor')
 expect((await db.inventoryBalance.findUniqueOrThrow({where:{storeId_productId:{storeId:store.id,productId:product.id}}})).quantity.toString()).toBe('2')
 await page.goto('/replenishment');await page.getByLabel('Qoldiq filiali',{exact:true}).selectOption(store.id);await page.getByLabel('Mahsulot qidirish',{exact:true}).fill('Alert item');await page.getByLabel('Mahsulot',{exact:true}).selectOption(product.id);await page.getByLabel('Minimal qoldiq',{exact:true}).fill('3');await page.getByLabel('Maksimal qoldiq',{exact:true}).fill('10');await page.getByRole('button',{name:'Chegaralarni saqlash',exact:true}).click();await expect(page.getByRole('article')).toContainText('tavsiya 8 dona')
 await page.goto('/help');await expect(page.getByRole('heading',{name:'Internet yoki server javobi kelmadi'})).toBeVisible();await expect(page.getByRole('heading',{name:'Chek chop etilmadi'})).toBeVisible();await expect(page.getByRole('heading',{name:'Katalog va import xatolari'})).toBeVisible();await page.getByRole('link',{name:'Navbatni tekshirish',exact:true}).click();await expect(page.getByRole('heading',{name:'Navbat va konfliktlar',exact:true})).toBeVisible()
})

test('Training is isolated from real money and keyboard-only payment modal traps and restores focus',async({page})=>{
 const phone='998'+Date.now();phones.push(phone)
 await page.goto('/register');await page.getByLabel('Ism va Familiya').fill('Keyboard Owner');await page.getByLabel('Telefon raqam',{exact:true}).fill(phone);await page.getByLabel("Do'kon yoki Biznes nomi").fill('Keyboard POS');await page.getByLabel(/Parol \(/).fill('test-only-password');await page.getByRole('button',{name:'Hisob yaratish va Boshlash'}).click();await expect(page).toHaveURL(/\/dashboard$/)
 const me=(await (await page.request.get('/api/auth/me')).json()).data;orgs.push(me.organization.id);users.push(me.user.id)
 await page.goto('/training');await page.getByRole('button',{name:'Mashq mahsulotini qo‘shish',exact:true}).click();await page.getByRole('button',{name:'Mashq to‘loviga o‘tish',exact:true}).click();await page.getByLabel('Mashqda berilgan naqd',{exact:true}).fill('15000');await expect(page.getByText('Qaytim: 5000 so‘m',{exact:true})).toBeVisible();await page.getByRole('button',{name:'Faqat mashqni yakunlash',exact:true}).click();await expect(page.getByRole('status').filter({hasText:'Mashq yakunlandi'})).toBeVisible();expect(await db.sale.count({where:{organizationId:me.organization.id}})).toBe(0);expect(await db.payment.count({where:{organizationId:me.organization.id}})).toBe(0)
 const store=await db.store.findFirstOrThrow({where:{organizationId:me.organization.id}}),product=await db.product.create({data:{organizationId:me.organization.id,name:'Keyboard item',sku:randomUUID(),barcode:randomUUID(),unit:'dona',salePrice:10,costPrice:4}});await db.inventoryBalance.create({data:{storeId:store.id,productId:product.id,quantity:3}})
 await page.goto('/pos');const open=page.getByRole('button',{name:'Smenani ochish',exact:true});await expect(page.getByRole('button',{name:'Keyboard item — savatga qo‘shish',exact:true})).toBeVisible();await open.press('Enter');await page.getByRole('dialog').getByRole('button',{name:'Smenani ochish',exact:true}).press('Enter');await expect(page.getByRole('dialog')).not.toBeVisible()
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
 await page.getByLabel('Konflikt ko‘rib chiqish sababi',{exact:true}).fill('Original draft reviewed');await page.getByRole('button',{name:'Terminal natija dalili bilan hal qilish',exact:true}).click();await expect(page.getByRole('alert').filter({hasText:'Avval asl amal natijasini tekshiring'})).toContainText('Avval asl amal natijasini tekshiring')
 expect((await page.request.post(`/api/sales/${draft.id}/void`,{headers:{Origin:'https://localhost:3100'},data:{}})).ok()).toBe(true)
 await page.getByRole('button',{name:'Terminal natija dalili bilan hal qilish',exact:true}).click();await page.getByRole('button',{name:'Rahbar dalilini lokal navbatga saqlash',exact:true}).click();await expect(page.getByRole('article').filter({hasText:id}).first()).toContainText('rejected')
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
