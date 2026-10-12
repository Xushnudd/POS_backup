import {test,expect} from '@playwright/test'
import {PrismaClient} from '@prisma/client'
import {randomUUID} from 'node:crypto'
const connection=new URL(process.env.DATABASE_URL??'')
if(connection.hostname!=='127.0.0.1'||connection.port!=='55439'||connection.pathname!=='/pos_test')throw Error('Isolated DB required')
const db=new PrismaClient(),orgs:string[]=[],users:string[]=[]
test.afterAll(async()=>{await db.organization.deleteMany({where:{id:{in:orgs}}});await db.user.deleteMany({where:{id:{in:users}}});await db.$disconnect()})
test('product unit and classification drafts survive failed reads and successful retries without losing navigation protection',async({page})=>{
 const headers={Origin:'https://localhost:3100'}
 expect((await page.request.post('/api/auth/register',{headers,data:{fullName:'Editor owner',phone:'editor-'+randomUUID(),password:'test-only-password',organizationName:'Product editor state'}})).ok()).toBe(true)
 const me=(await(await page.request.get('/api/auth/me')).json()).data;orgs.push(me.organization.id);users.push(me.user.id)
 const product=await db.product.create({data:{organizationId:me.organization.id,name:'Editor fixture',sku:randomUUID(),barcode:randomUUID(),unit:'dona',salePrice:'1',costPrice:'1'}})
 const unitPath='/products/'+product.id+'/units'
 await page.goto(unitPath);await page.getByLabel('Savdo birligi kodi',{exact:true}).fill('quti');await page.getByLabel('Asosiy birliklar soni',{exact:true}).fill('12');await page.getByLabel('Konvertatsiya sababi',{exact:true}).fill('Original reviewed box draft')
 await db.productUnitConversion.create({data:{productId:product.id,organizationId:me.organization.id,baseUnit:'dona',tradeUnit:'quti',ratio:'12',isActive:true}})
 let prompts=0;page.on('dialog',async dialog=>{if(dialog.type()==='beforeunload')await dialog.accept();else{prompts++;await dialog.dismiss()}})
 await page.locator('a[href="/products"]').first().click();await expect(page).toHaveURL(new RegExp(unitPath+'$'));expect(prompts).toBe(1)
 // Submit a known server rejection: existing quti is updated, so malformed ratio is used instead.
 await page.getByLabel('Asosiy birliklar soni',{exact:true}).fill('invalid')
 const unitRejected=page.waitForResponse(response=>new URL(response.url()).pathname==='/api'+unitPath&&response.request().method()==='POST')
 await page.getByRole('button',{name:'Konvertatsiyani saqlash: oldindan ko‘rish',exact:true}).click();await page.getByRole('button',{name:'Amalni tasdiqlash',exact:true}).click()
 expect((await unitRejected).status()).toBe(400)
 await expect(page.locator('p[role="alert"]')).toBeVisible();await expect(page.getByLabel('Konvertatsiya sababi',{exact:true})).toHaveValue('Original reviewed box draft')
 await page.getByLabel('Asosiy birliklar soni',{exact:true}).fill('12')
 await page.getByRole('button',{name:'Konvertatsiyani saqlash: oldindan ko‘rish',exact:true}).click();await page.getByRole('button',{name:'Amalni tasdiqlash',exact:true}).click()
 await expect(page.getByLabel('Konvertatsiya sababi',{exact:true})).toHaveValue('')
 await expect(page.getByRole('button',{name:'Nisbatni tanlash',exact:true})).toBeEnabled()
 await page.getByLabel('Konvertatsiya sababi',{exact:true}).fill('A new independent draft')
 await page.route('**/api'+unitPath,route=>route.abort('failed'));await page.getByRole('button',{name:'Birliklar ro‘yxatini yangilash',exact:true}).click();await expect(page.locator('p[role="alert"]')).toBeVisible();await expect(page.getByLabel('Konvertatsiya sababi',{exact:true})).toHaveValue('A new independent draft');await expect(page.getByRole('button',{name:'Konvertatsiyani saqlash: oldindan ko‘rish',exact:true})).toBeDisabled();await page.unroute('**/api'+unitPath);await page.locator('p[role="alert"]').getByRole('button',{name:'Qayta yuklash',exact:true}).click();await expect(page.getByRole('button',{name:'Konvertatsiyani saqlash: oldindan ko‘rish',exact:true})).toBeEnabled();await expect(page.getByLabel('Konvertatsiya sababi',{exact:true})).toHaveValue('A new independent draft');
 await page.getByRole('button',{name:'Nisbatni tanlash',exact:true}).click();expect(prompts).toBe(2);await expect(page.getByLabel('Konvertatsiya sababi',{exact:true})).toHaveValue('A new independent draft')
 await page.getByLabel('Konvertatsiya sababi',{exact:true}).fill('')
 const compliancePath='/products/'+product.id+'/compliance'
 await page.goto(compliancePath);await page.getByLabel('MXIK kodi',{exact:true}).fill('Reviewed local classification');await page.getByLabel('Tasnif o‘zgarishi sababi',{exact:true}).fill('Draft survives metadata reload')
 await page.route('**/api'+compliancePath,route=>route.abort('failed'));await page.getByRole('button',{name:'Tasnifni qayta tekshirish',exact:true}).click();await expect(page.locator('p[role="alert"]')).toBeVisible();await expect(page.getByLabel('MXIK kodi',{exact:true})).toHaveValue('Reviewed local classification');await expect(page.getByRole('button',{name:'Tasnifni saqlash: oldindan ko‘rish',exact:true})).toBeDisabled();await page.unroute('**/api'+compliancePath);await page.locator('p[role="alert"]').getByRole('button',{name:'Qayta yuklash',exact:true}).click();await expect(page.getByRole('button',{name:'Tasnifni saqlash: oldindan ko‘rish',exact:true})).toBeEnabled();await expect(page.getByLabel('MXIK kodi',{exact:true})).toHaveValue('Reviewed local classification');
 // Actual POST validation error (source too short) must keep the editor mounted.
 await page.getByLabel('MXIK tekshirilgan manbasi',{exact:true}).fill('x')
 const classificationRejected=page.waitForResponse(response=>new URL(response.url()).pathname==='/api'+compliancePath&&response.request().method()==='POST')
 await page.getByRole('button',{name:'Tasnifni saqlash: oldindan ko‘rish',exact:true}).click();await page.getByRole('button',{name:'Amalni tasdiqlash',exact:true}).click();await expect(page.locator('p[role="alert"]')).toBeVisible();expect((await classificationRejected).status()).toBe(400)
 await expect(page.getByLabel('MXIK kodi',{exact:true})).toHaveValue('Reviewed local classification')
 await page.locator('a[href="/products"]').first().click();await expect(page).toHaveURL(new RegExp(compliancePath+'$'));expect(prompts).toBe(3)
 await page.getByLabel('MXIK tekshirilgan manbasi',{exact:true}).fill('Actual owner supplied reference')
 await page.getByRole('button',{name:'Tasnifni saqlash: oldindan ko‘rish',exact:true}).click();await page.getByRole('button',{name:'Amalni tasdiqlash',exact:true}).click();await expect(page.getByLabel('Tasnif o‘zgarishi sababi',{exact:true})).toHaveValue('')
 expect(await db.auditLog.count({where:{entityId:product.id,action:'classification_updated'}})).toBe(1)
 expect(await db.auditLog.count({where:{entityId:product.id,action:'conversion_updated'}})).toBe(1)
})
test('Barcode metadata failure keeps alias draft and blocks new commands until retry',async({page})=>{
 expect((await page.request.post('/api/auth/register',{headers:{Origin:'https://localhost:3100'},data:{fullName:'Barcode editor',phone:'barcode-editor-'+randomUUID(),password:'test-only-password',organizationName:'Barcode editor fixture'}})).ok()).toBe(true)
 const me=(await(await page.request.get('/api/auth/me')).json()).data;orgs.push(me.organization.id);users.push(me.user.id)
 const product=await db.product.create({data:{organizationId:me.organization.id,name:'Barcode draft product',sku:randomUUID(),barcode:randomUUID(),unit:'dona',salePrice:'1',costPrice:'1'}})
 await page.goto('/products/'+product.id)
 const input=page.getByLabel('Qo‘shimcha barkod',{exact:true});await input.fill('independent-alias-'+randomUUID())
 const original=await input.inputValue()
 await page.route('**/api/products/'+product.id+'/barcodes?*',route=>route.abort('failed'))
 // Barcode pagination has a separate retry from the parent product read.
 const card=page.locator('div').filter({has:page.getByRole('heading',{name:'Mahsulot barkodlari',exact:true})}).filter({has:input}).last()
 await card.getByRole('button',{name:'Qayta yuklash',exact:true}).click()
 await expect(page.getByRole('alert').filter({hasText:'Yangi amal oldidan ro‘yxatni qayta yuklang'})).toBeVisible()
 await expect(input).toHaveValue(original)
 await expect(card.getByRole('button',{name:'Qo‘shish',exact:true})).toBeDisabled()
 await expect(card.getByRole('button',{name:'Ichki barkod yaratish',exact:true})).toBeDisabled()
 await page.unroute('**/api/products/'+product.id+'/barcodes?*')
 await card.getByRole('button',{name:'Qayta yuklash',exact:true}).click()
 await expect(input).toBeEnabled();await expect(input).toHaveValue(original)
 expect(await db.productBarcode.count({where:{productId:product.id,value:original}})).toBe(0)
})
