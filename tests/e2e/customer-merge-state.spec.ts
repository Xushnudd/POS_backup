import {test,expect} from '@playwright/test'
import {PrismaClient} from '@prisma/client'
import {randomUUID,randomInt} from 'node:crypto'
const connection=new URL(process.env.DATABASE_URL??'')
if(connection.hostname!=='127.0.0.1'||connection.port!=='55439'||connection.pathname!=='/pos_test')throw Error('Isolated DB required')
const db=new PrismaClient(),orgs:string[]=[],users:string[]=[]
test.afterAll(async()=>{await db.organization.deleteMany({where:{id:{in:orgs}}});await db.user.deleteMany({where:{id:{in:users}}});await db.$disconnect()})
test('merge partial reason and selected named customer survive searches and failed history refresh',async({page})=>{
 expect((await page.request.post('/api/auth/register',{headers:{Origin:'https://localhost:3100'},data:{fullName:'Merge editor owner',phone:'merge-editor-'+randomUUID(),password:'test-only-password',organizationName:'Merge editor state'}})).ok()).toBe(true)
 const me=(await(await page.request.get('/api/auth/me')).json()).data;orgs.push(me.organization.id);users.push(me.user.id)
 const make=(fullName:string)=>db.customer.create({data:{organizationId:me.organization.id,fullName,phone:'+99890'+String(randomInt(10000000)).padStart(7,'0')}})
 const source=await make('Original merge source'),target=await make('Independent named target'),path='/customers/'+source.id+'/history'
 await page.goto(path);const reason=page.getByLabel('Mijoz merge sababi',{exact:true});await expect(reason).toBeEnabled();await reason.fill('V')
 let prompts=0;page.on('dialog',async dialog=>{if(dialog.type()==='beforeunload')await dialog.accept();else{prompts++;await dialog.dismiss()}})
 await page.locator('main').getByRole('link',{name:'Mijozlar',exact:true}).click();await expect(page).toHaveURL(new RegExp(path+'$'));expect(prompts).toBe(1)
 const selected=page.getByLabel('Merge asosiy mijozi',{exact:true});await selected.selectOption(target.id);await reason.fill('Independent source card review');await page.getByLabel('Asosiy karta qidirish',{exact:true}).fill('no-matching-customer-row');await expect(selected.locator('option')).toHaveCount(2);await expect(selected).toHaveValue(target.id);await expect(selected).toContainText(target.fullName)
 await page.route('**/api/customers/'+source.id+'/history?*',route=>route.abort('failed'));await page.getByRole('button',{name:'Mijoz tarixini qayta yuklash',exact:true}).click();await expect(page.locator('p[role="alert"]').filter({hasText:'Oxirgi ma’lumot'})).toBeVisible();await expect(reason).toHaveValue('Independent source card review');await expect(selected).toHaveValue(target.id);await expect(page.getByRole('button',{name:'Original kartani birlashtirish: oldindan ko‘rish',exact:true})).toBeDisabled()
 await page.unroute('**/api/customers/'+source.id+'/history?*');await page.getByRole('button',{name:'Mijoz tarixini qayta yuklash',exact:true}).click();await expect(reason).toBeEnabled();await expect(reason).toHaveValue('Independent source card review');await expect(selected).toContainText(target.fullName)
 await page.locator('main').getByRole('link',{name:'Mijozlar',exact:true}).click();await expect(page).toHaveURL(new RegExp(path+'$'));expect(prompts).toBe(2)
 expect((await db.customer.findUniqueOrThrow({where:{id:source.id}})).mergedIntoId).toBe(null);expect(await db.operation.count({where:{organizationId:me.organization.id,type:'customer.merge'}})).toBe(0)
})
