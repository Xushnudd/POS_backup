import {test,expect} from '@playwright/test'
import {PrismaClient} from '@prisma/client'
import {randomUUID} from 'node:crypto'
const connection=new URL(process.env.DATABASE_URL??'')
if(connection.hostname!=='127.0.0.1'||connection.port!=='55439'||connection.pathname!=='/pos_test')throw Error('Isolated DB required')
const db=new PrismaClient(),orgs:string[]=[],users:string[]=[]
test.afterAll(async()=>{await db.organization.deleteMany({where:{id:{in:orgs}}});await db.user.deleteMany({where:{id:{in:users}}});await db.$disconnect()})
test('zone and reservation drafts remain independent through relocation ACK and failed stock metadata refresh',async({page})=>{
 const headers={Origin:'https://localhost:3100'}
 expect((await page.request.post('/api/auth/register',{headers,data:{fullName:'Location editor owner',phone:'location-editor-'+randomUUID(),password:'test-only-password',organizationName:'Location editor state'}})).ok()).toBe(true)
 const me=(await(await page.request.get('/api/auth/me')).json()).data;orgs.push(me.organization.id);users.push(me.user.id)
 const store=await db.store.findFirstOrThrow({where:{organizationId:me.organization.id}}),product=await db.product.create({data:{organizationId:me.organization.id,name:'Original stock item',sku:randomUUID(),barcode:randomUUID(),unit:'dona',salePrice:'1',costPrice:'1'}})
 await db.inventoryBalance.create({data:{storeId:store.id,productId:product.id,quantity:'5'}})
 await page.goto('/inventory/locations');await expect(page.getByLabel('Zona nomi',{exact:true})).toBeEnabled();await page.getByLabel('Zona nomi',{exact:true}).fill('S')
 let prompts=0;page.on('dialog',async dialog=>{if(dialog.type()==='beforeunload')await dialog.accept();else{prompts++;await dialog.dismiss()}})
 await page.getByRole('link',{name:'Omborga qaytish',exact:true}).click();await expect(page).toHaveURL(/\/inventory\/locations$/);expect(prompts).toBe(1)
 const confirm=async(label:string)=>{await page.getByRole('button',{name:label+': oldindan ko‘rish',exact:true}).click();await page.getByRole('button',{name:'Amalni tasdiqlash',exact:true}).click()}
 await page.getByLabel('Zona nomi',{exact:true}).fill('Shelf independent');await confirm('Zona yaratish');await expect(page.getByLabel('Zona nomi',{exact:true})).toHaveValue('');await expect(page.getByLabel('Zona mahsuloti',{exact:true})).toContainText(product.name)
 await page.getByLabel('Zona mahsuloti',{exact:true}).selectOption(product.id);await expect(page.getByLabel('Rezerv yaratish sababi',{exact:true})).toBeEnabled()
 await page.getByLabel('Rezerv yaratish sababi',{exact:true}).fill('Independent hold draft');await page.getByLabel('Rezerv miqdori',{exact:true}).fill('2')
 await page.getByLabel('Zona miqdori',{exact:true}).fill('3');await page.getByLabel('Zona ko‘chirish sababi',{exact:true}).fill('Physically move three only')
 const zone=await db.stockLocation.findFirstOrThrow({where:{storeId:store.id}});await page.getByLabel('Qabul zona',{exact:true}).selectOption(zone.id);await confirm('Zonaga ko‘chirish')
 await expect(page.getByLabel('Zona ko‘chirish sababi',{exact:true})).toHaveValue('');await expect(page.getByLabel('Rezerv yaratish sababi',{exact:true})).toHaveValue('Independent hold draft');await expect(page.getByLabel('Rezerv miqdori',{exact:true})).toHaveValue('2');await expect(page.getByText(/Fizik: 5 · Rezerv: 0 · Mavjud: 5 · Biriktirilmagan: 2/)).toBeVisible()
 await page.getByLabel('Zona uchun mahsulot qidirish',{exact:true}).fill('no-matching-catalog-item');await expect(page.getByLabel('Zona mahsuloti',{exact:true}).locator('option')).toHaveCount(2);await expect(page.getByLabel('Zona mahsuloti',{exact:true})).toHaveValue(product.id)
 await page.route('**/api/inventory/locations?*',route=>route.abort('failed'));await page.getByRole('button',{name:'Ombor ma’lumotini qayta yuklash',exact:true}).click();await expect(page.locator('p[role="alert"]').filter({hasText:'Oxirgi yuklangan'})).toBeVisible();await expect(page.getByLabel('Rezerv yaratish sababi',{exact:true})).toHaveValue('Independent hold draft');await expect(page.getByRole('button',{name:'Qoldiqni rezervlash: oldindan ko‘rish',exact:true})).toBeDisabled()
 await page.unroute('**/api/inventory/locations?*');await page.getByRole('button',{name:'Ombor ma’lumotini qayta yuklash',exact:true}).click();await expect(page.getByRole('button',{name:'Qoldiqni rezervlash: oldindan ko‘rish',exact:true})).toBeEnabled();await expect(page.getByLabel('Rezerv miqdori',{exact:true})).toHaveValue('2')
 await page.getByRole('link',{name:'Omborga qaytish',exact:true}).click();await expect(page).toHaveURL(/\/inventory\/locations$/);expect(prompts).toBe(2)
 expect(await db.stockReservation.count({where:{organizationId:me.organization.id}})).toBe(0);expect(await db.inventoryMovement.count({where:{organizationId:me.organization.id}})).toBe(0);expect(await db.locationEntry.count({where:{organizationId:me.organization.id}})).toBe(1);expect((await db.inventoryBalance.findUniqueOrThrow({where:{storeId_productId:{storeId:store.id,productId:product.id}}})).quantity.toString()).toBe('5')
})
