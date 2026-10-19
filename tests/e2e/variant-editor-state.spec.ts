import {test,expect} from '@playwright/test'
import {PrismaClient} from '@prisma/client'
import {randomUUID} from 'node:crypto'
const connection=new URL(process.env.DATABASE_URL??'')
if(connection.hostname!=='127.0.0.1'||connection.port!=='55439'||connection.pathname!=='/pos_test')throw Error('Isolated DB required')
const db=new PrismaClient(),orgs:string[]=[],users:string[]=[]
test.afterAll(async()=>{await db.organization.deleteMany({where:{id:{in:orgs}}});await db.user.deleteMany({where:{id:{in:users}}});await db.$disconnect()})
test('variant option-only draft is guarded and successful creation stays acknowledged when list reload fails',async({page})=>{
 const headers={Origin:'https://localhost:3100'}
 expect((await page.request.post('/api/auth/register',{headers,data:{fullName:'Variant editor owner',phone:'variant-editor-'+randomUUID(),password:'test-only-password',organizationName:'Variant editor state'}})).ok()).toBe(true)
 const me=(await(await page.request.get('/api/auth/me')).json()).data;orgs.push(me.organization.id);users.push(me.user.id)
 const parent=await db.product.create({data:{organizationId:me.organization.id,name:'Original variant base',sku:randomUUID(),barcode:randomUUID(),unit:'dona',salePrice:'1',costPrice:'1'}}),path='/products/'+parent.id+'/variants'
 await page.goto(path);await page.getByLabel('Variant belgisi 1',{exact:true}).fill('color')
 let prompts=0;page.on('dialog',async dialog=>{if(dialog.type()==='beforeunload')await dialog.accept();else{prompts++;await dialog.dismiss()}})
 await page.getByRole('link',{name:'Mahsulotlarga qaytish',exact:true}).click();await expect(page).toHaveURL(new RegExp(path+'$'));expect(prompts).toBe(1)
 await page.getByLabel('Variant nomi',{exact:true}).fill('Independent red variant');await page.getByLabel('Variant SKU',{exact:true}).fill(randomUUID());await page.getByLabel('Variant barkodi',{exact:true}).fill(randomUUID());await page.getByLabel('Variant narxi',{exact:true}).fill('12.34');await page.getByLabel('Variant qiymati 1',{exact:true}).fill('Red');await page.getByLabel('Variant yaratish sababi',{exact:true}).fill('Verified independent variant')
 await page.route('**/api'+path+'?*',route=>route.abort('failed'))
 await page.getByRole('button',{name:'Mahsulot varianti: oldindan ko‘rish',exact:true}).click();await page.getByRole('button',{name:'Amalni tasdiqlash',exact:true}).evaluate(button=>{(button as HTMLButtonElement).click();(button as HTMLButtonElement).click()})
 await expect(page.getByLabel('Variant nomi',{exact:true})).toHaveValue('');await expect(page.getByLabel('Variant belgisi 1',{exact:true})).toHaveValue('rang')
 await expect(page.locator('p[role="alert"]')).toContainText('Oxirgi yuklangan');await expect(page.getByRole('table')).toContainText('Original variant base')
 await expect(page.getByRole('button',{name:'Mahsulot varianti: oldindan ko‘rish',exact:true})).toBeDisabled()
 await expect(page.getByRole('status').filter({hasText:'Serverda saqlandi.'})).toBeVisible()
 await page.unroute('**/api'+path+'?*');await page.getByRole('button',{name:'Qayta yuklash',exact:true}).click();await expect(page.getByRole('table')).toContainText('Independent red variant');await expect(page.getByRole('button',{name:'Mahsulot varianti: oldindan ko‘rish',exact:true})).toBeEnabled()
 await page.getByRole('button',{name:'Variant belgisi qo‘shish',exact:true}).click();await page.getByRole('link',{name:'Mahsulotlarga qaytish',exact:true}).click();await expect(page).toHaveURL(new RegExp(path+'$'));expect(prompts).toBe(2)
 expect(await db.product.count({where:{organizationId:me.organization.id,name:'Independent red variant'}})).toBe(1)
 expect(await db.inventoryMovement.count({where:{organizationId:me.organization.id}})).toBe(0)
})
