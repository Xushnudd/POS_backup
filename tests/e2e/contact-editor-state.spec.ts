import {test,expect} from '@playwright/test'
import {PrismaClient} from '@prisma/client'
import {randomUUID} from 'node:crypto'
const connection=new URL(process.env.DATABASE_URL??'')
if(connection.hostname!=='127.0.0.1'||connection.port!=='55439'||connection.pathname!=='/pos_test')throw Error('Isolated DB required')
const db=new PrismaClient(),orgs:string[]=[],users:string[]=[]
const headers={Origin:'https://localhost:3100'}
test.afterAll(async()=>{await db.organization.deleteMany({where:{id:{in:orgs}}});await db.user.deleteMany({where:{id:{in:users}}});await db.$disconnect()})
async function owner(page:import('@playwright/test').Page){expect((await page.request.post('/api/auth/register',{headers,data:{fullName:'Contact editor owner',phone:'contact-editor-'+randomUUID(),password:'test-only-password',organizationName:'Contact editor state'}})).ok()).toBe(true);const me=(await(await page.request.get('/api/auth/me')).json()).data;orgs.push(me.organization.id);users.push(me.user.id);return me}
test('customer failed debt read is visibly unknown and retry restores actual ledger without false zero',async({page})=>{
 const me=await owner(page),phone='+99890'+String(Date.now()).slice(-7),created=await page.request.post('/api/customers',{headers,data:{organizationId:me.organization.id,fullName:'Actual debt reader',phone,creditLimit:'100'}});expect(created.ok()).toBe(true);const customer=(await created.json()).data
 expect((await page.request.post('/api/customers/'+customer.id+'/ledger',{headers,data:{operationId:randomUUID(),kind:'opening',amount:'7.25',reason:'Actual opening balance'}})).ok()).toBe(true)
 await page.goto('/customers');const row=page.getByRole('row').filter({hasText:'Actual debt reader'});await expect(row).toContainText('7.25 so‘m')
 await page.route('**/api/customers/'+customer.id+'/debt',route=>route.abort('failed'));await page.getByRole('button',{name:'Mijozlarni qayta yuklash',exact:true}).click();await expect(row).toContainText('Qarz yuklanmadi');await expect(row.getByRole('link',{name:'Qarzni undirish',exact:false})).toHaveCount(0);await expect(page.getByRole('alert').filter({hasText:'noma’lum qiymat nol'})).toBeVisible()
 await page.unroute('**/api/customers/'+customer.id+'/debt');await page.getByRole('button',{name:'Mijozlarni qayta yuklash',exact:true}).click();await expect(row).toContainText('7.25 so‘m');expect((await db.debtEntry.aggregate({where:{customerId:customer.id},_sum:{amount:true}}))._sum.amount?.toString()).toBe('7.25')
})
for(const kind of ['customers','suppliers'] as const)test(kind+' held acknowledgement admits one create and failed follow-up read keeps success',async({page})=>{
 const me=await owner(page),name='Held contact '+randomUUID(),isCustomer=kind==='customers'
 await page.goto('/'+kind);await page.getByRole('button',{name:isCustomer?"Yangi mijoz qo'shish":'Yangi yetkazib beruvchi',exact:true}).click();const dialog=page.getByRole('dialog');await dialog.getByLabel(isCustomer?"Mijoz to'liq ismi *":'Nomi',{exact:true}).fill(name);if(isCustomer)await dialog.getByLabel('Telefon raqami *',{exact:true}).fill('+99890'+String(Date.now()).slice(-7))
 let writes=0,release!:()=>void;const held=new Promise<void>(resolve=>{release=resolve})
 await page.route('**/api/'+kind,async route=>{if(route.request().method()!=='POST')return route.continue();writes++;const response=await route.fetch();expect(response.ok()).toBe(true);await held;await route.fulfill({response})})
 await dialog.getByRole('button',{name:isCustomer?"Qo'shish":'Saqlash',exact:true}).evaluate(button=>{(button as HTMLButtonElement).click();(button as HTMLButtonElement).click()});await expect.poll(()=>writes).toBe(1);await expect(dialog.getByLabel(isCustomer?"Mijoz to'liq ismi *":'Nomi',{exact:true})).toBeDisabled();await page.keyboard.press('Escape');await expect(dialog).toBeVisible()
 await page.route('**/api/'+kind+'?**',route=>route.abort('failed'));release();await expect(dialog).not.toBeVisible();await expect(page.getByRole('status').filter({hasText:isCustomer?'Mijoz serverda saqlandi':'Yetkazib beruvchi serverda saqlandi'})).toBeVisible();await expect(page.getByRole('alert').filter({hasText:'Oxirgi ro‘yxat'})).toBeVisible();expect(writes).toBe(1)
 expect(isCustomer?await db.customer.count({where:{organizationId:me.organization.id,fullName:name}}):await db.supplier.count({where:{organizationId:me.organization.id,name}})).toBe(1);expect(await db.inventoryMovement.count({where:{organizationId:me.organization.id}})).toBe(0)
})
test('unconfigured delivery stays disabled after read error and real retry never creates or verifies challenge',async({page})=>{
 const me=await owner(page);await page.goto('/security');const section=page.locator('section[aria-label="Aloqani tasdiqlash"]');await expect(section.getByRole('button',{name:'Tasdiqlash kodini so‘rash',exact:true})).toBeDisabled()
 await page.route('**/api/auth/delivery',route=>route.abort('failed'));await section.getByRole('button',{name:'Holatni qayta tekshirish',exact:true}).click();await expect(section.getByRole('alert').filter({hasText:'Oxirgi holat'})).toBeVisible();await expect(section.getByLabel('Tasdiqlash kanali',{exact:true})).toBeDisabled()
 await page.unroute('**/api/auth/delivery');await section.getByRole('button',{name:'Holatni qayta tekshirish',exact:true}).click();await expect(section.getByLabel('Tasdiqlash kanali',{exact:true})).toBeEnabled();await expect(section.getByRole('button',{name:'Tasdiqlash kodini so‘rash',exact:true})).toBeDisabled();expect(await db.authChallenge.count({where:{userId:me.user.id}})).toBe(0);expect(await db.verifiedContact.count({where:{userId:me.user.id}})).toBe(0)
})
