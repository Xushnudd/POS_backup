import {test,expect} from '@playwright/test'
import {PrismaClient} from '@prisma/client'
import {randomUUID} from 'node:crypto'
const connection=new URL(process.env.DATABASE_URL??'')
if(connection.hostname!=='127.0.0.1'||connection.port!=='55439'||connection.pathname!=='/pos_test')throw Error('Isolated DB required')
const db=new PrismaClient(),orgs:string[]=[],users:string[]=[]
test.afterAll(async()=>{await db.organization.deleteMany({where:{id:{in:orgs}}});await db.user.deleteMany({where:{id:{in:users}}});await db.$disconnect()})
test('brand status lost acknowledgement preserves a separate name draft and original key retries once',async({page})=>{
 const headers={Origin:'https://localhost:3100'}
 expect((await page.request.post('/api/auth/register',{headers,data:{fullName:'Brand state owner',phone:'brand-state-'+randomUUID(),password:'test-only-password',organizationName:'Brand state business'}})).ok()).toBe(true)
 const me=(await(await page.request.get('/api/auth/me')).json()).data;orgs.push(me.organization.id);users.push(me.user.id)
 const created=await page.request.post('/api/brands',{headers,data:{operationId:randomUUID(),name:'Original brand'}});expect(created.ok()).toBe(true);const brand=(await created.json()).data
 await page.goto('/products/brands');await page.getByRole('button',{name:'Brendni tahrirlash: Original brand',exact:true}).click();await page.getByLabel('Brend nomi',{exact:true}).fill('Independent name draft')
 let prompts=0;page.on('dialog',async dialog=>{if(dialog.type()==='beforeunload')await dialog.accept();else{prompts++;await dialog.dismiss()}})
 await page.getByRole('link',{name:'Mahsulotlarga qaytish',exact:true}).click();await expect(page).toHaveURL(/\/products\/brands$/);expect(prompts).toBeGreaterThan(0)
 let lost=false;const bodies:string[]=[]
 await page.route('**/api/brands/'+brand.id,async route=>{if(route.request().method()!=='PUT')return route.continue();bodies.push(route.request().postData()??'');const response=await route.fetch();if(!lost&&response.ok()){lost=true;await route.abort('failed')}else await route.fulfill({response})})
 await page.getByRole('button',{name:'Brend holati: Original brand',exact:true}).click();await expect(page.getByRole('button',{name:'Original amalni qayta tekshirish',exact:true})).toHaveCount(1)
 await expect(page.getByLabel('Brend nomi',{exact:true})).toHaveValue('Independent name draft')
 await page.getByRole('button',{name:'Saqlangan amalni qayta tekshirish',exact:true}).click();await expect(page.getByRole('button',{name:'Saqlangan amalni qayta tekshirish',exact:true})).not.toBeVisible()
 await expect(page.getByLabel('Brend nomi',{exact:true})).toHaveValue('Independent name draft');expect(bodies).toHaveLength(2);expect(bodies[0]).toBe(bodies[1])
 await expect(page.getByRole('button',{name:'Brendni saqlash',exact:true})).toBeEnabled()
 await page.route('**/api/brands?**',route=>route.abort('failed'));await page.getByRole('button',{name:'Qayta yuklash',exact:true}).click();await expect(page.getByRole('alert').filter({hasText:'Oxirgi yuklangan'})).toBeVisible();await expect(page.getByLabel('Brend nomi',{exact:true})).toHaveValue('Independent name draft');await expect(page.getByRole('button',{name:'Brendni saqlash',exact:true})).toBeDisabled()
 await page.unroute('**/api/brands?**');await page.getByRole('button',{name:'Qayta yuklash',exact:true}).click();await expect(page.getByRole('button',{name:'Brendni saqlash',exact:true})).toBeEnabled();await page.getByRole('button',{name:'Brendni saqlash',exact:true}).click();await expect(page.getByLabel('Brend nomi',{exact:true})).toHaveValue('')
 const saved=await db.brand.findUniqueOrThrow({where:{id:brand.id}});expect(saved.name).toBe('Independent name draft');expect(saved.isActive).toBe(false);expect(await db.auditLog.count({where:{organizationId:me.organization.id,entityId:brand.id,action:'brand_updated'}})).toBe(2);expect(await db.inventoryMovement.count({where:{organizationId:me.organization.id}})).toBe(0)
})
