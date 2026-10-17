import {test,expect} from '@playwright/test'
import {PrismaClient} from '@prisma/client'
import {randomUUID} from 'node:crypto'
const connection=new URL(process.env.DATABASE_URL??'')
if(connection.hostname!=='127.0.0.1'||connection.port!=='55439'||connection.pathname!=='/pos_test')throw Error('Isolated DB required')
const db=new PrismaClient(),orgs:string[]=[],users:string[]=[]
test.afterAll(async()=>{await db.organization.deleteMany({where:{id:{in:orgs}}});await db.user.deleteMany({where:{id:{in:users}}});await db.$disconnect()})
for(const kind of ['categories','units'] as const)test(kind+' draft read failure and one held create ACK keep truthful saved state',async({page})=>{
 const headers={Origin:'https://localhost:3100'},suffix=randomUUID().replaceAll('-','').slice(0,12)
 expect((await page.request.post('/api/auth/register',{headers,data:{fullName:'Legacy catalogue owner',phone:'legacy-catalog-'+randomUUID(),password:'test-only-password',organizationName:'Legacy catalogue state'}})).ok()).toBe(true)
 const me=(await(await page.request.get('/api/auth/me')).json()).data;orgs.push(me.organization.id);users.push(me.user.id)
 const isCategory=kind==='categories',name='Acknowledged '+kind+' '+suffix,oldName='Previous '+kind+' '+suffix
 expect((await page.request.post('/api/'+kind,{headers,data:isCategory?{organizationId:me.organization.id,name:oldName,sortOrder:0,parentId:null}:{code:'old_'+suffix,name:oldName,precision:0}})).ok()).toBe(true)
 await page.goto('/products/'+kind);const input=page.getByLabel(isCategory?'Kategoriya nomi':'Nomi',{exact:true});await input.fill('V')
 let prompts=0;page.on('dialog',async dialog=>{if(dialog.type()==='beforeunload')await dialog.accept();else{prompts++;await dialog.dismiss()}})
 await page.getByRole('link',{name:'Mahsulotlarga qaytish',exact:true}).click();await expect(page).toHaveURL(new RegExp('/products/'+kind+'$'));expect(prompts).toBe(1)
 await input.fill(name);if(!isCategory)await page.getByLabel('Kod',{exact:true}).fill('new_'+suffix)
 const readPattern='**/api/'+kind+'?**'
 await page.route(readPattern,route=>route.abort('failed'));await page.getByRole('button',{name:'Qayta yuklash',exact:true}).click();await expect(page.getByRole('alert').filter({hasText:'Oxirgi ro‘yxat'})).toBeVisible();await expect(input).toHaveValue(name);await expect(page.getByRole('button',{name:'Saqlash',exact:true})).toBeDisabled();await expect(page.getByRole('cell',{name:oldName,exact:!isCategory})).toBeVisible()
 await page.unroute(readPattern);await page.getByRole('button',{name:'Qayta yuklash',exact:true}).click();await expect(page.getByRole('button',{name:'Saqlash',exact:true})).toBeEnabled();await expect(input).toHaveValue(name)
 let writes=0,release!:()=>void;const held=new Promise<void>(resolve=>{release=resolve})
 await page.route('**/api/'+kind,async route=>{if(route.request().method()!=='POST')return route.continue();writes++;const response=await route.fetch();expect(response.ok()).toBe(true);await held;await route.fulfill({response})})
 await page.getByRole('button',{name:'Saqlash',exact:true}).evaluate(button=>{(button as HTMLButtonElement).click();(button as HTMLButtonElement).click()})
 await expect.poll(()=>writes).toBe(1);await expect(input).toBeDisabled();await expect(page.getByRole('status').filter({hasText:'Server tasdig‘i kutilmoqda'})).toBeVisible();await page.getByRole('link',{name:'Mahsulotlarga qaytish',exact:true}).click();await expect(page).toHaveURL(new RegExp('/products/'+kind+'$'))
 await page.route(readPattern,route=>route.abort('failed'));release();await expect(page.getByRole('status').filter({hasText:isCategory?'Kategoriya serverda saqlandi':'Birlik serverda saqlandi'})).toBeVisible();await expect(page.getByRole('alert').filter({hasText:'Oxirgi ro‘yxat'})).toBeVisible();await expect(input).toHaveValue('');expect(writes).toBe(1)
 expect(isCategory?await db.category.count({where:{organizationId:me.organization.id,name}}):await db.unit.count({where:{organizationId:me.organization.id,name}})).toBe(1);expect(await db.inventoryMovement.count({where:{organizationId:me.organization.id}})).toBe(0)
 // A retained snapshot is valid only for the same filters/page. A failed new
 // query must never present the old rows as the results of that new query.
 await page.getByLabel(isCategory?'Kategoriya qidirish':'Birlik qidirish',{exact:true}).fill('Unloaded new filter')
 await page.getByRole('button',{name:'Qidirish',exact:true}).click()
 await expect(page.getByText('Ro‘yxat yuklanmadi; qayta yuklang.',{exact:true})).toBeVisible()
 await expect(page.getByRole('cell',{name:oldName,exact:!isCategory})).toHaveCount(0)
})
