import {test,expect} from '@playwright/test'
import {PrismaClient} from '@prisma/client'
import {randomUUID} from 'node:crypto'
const connection=new URL(process.env.DATABASE_URL??'')
if(connection.hostname!=='127.0.0.1'||connection.port!=='55439'||connection.pathname!=='/pos_test')throw Error('Isolated DB required')
const db=new PrismaClient(),orgs:string[]=[],users:string[]=[]
test.afterAll(async()=>{await db.organization.deleteMany({where:{id:{in:orgs}}});await db.user.deleteMany({where:{id:{in:users}}});await db.$disconnect()})
test('tax forms protect partial drafts and archive replays the original PUT once after reload',async({page})=>{
 const headers={Origin:'https://localhost:3100'}
 expect((await page.request.post('/api/auth/register',{headers,data:{fullName:'Tax recovery owner',phone:'tax-recovery-'+randomUUID(),password:'test-only-password',organizationName:'Tax recovery'}})).ok()).toBe(true)
 const me=(await(await page.request.get('/api/auth/me')).json()).data;orgs.push(me.organization.id);users.push(me.user.id)
 const first=await db.taxProfile.create({data:{organizationId:me.organization.id,name:'Recovery first'}}),second=await db.taxProfile.create({data:{organizationId:me.organization.id,name:'Recovery second'}})
 await page.goto('/settings/taxes');await expect(page.getByRole('button',{name:'Soliq tarixini ochish: Recovery first',exact:true})).toBeEnabled()
 let prompts=0;page.on('dialog',async dialog=>{if(dialog.type()==='beforeunload')await dialog.accept();else{prompts++;await dialog.dismiss()}})
 await page.getByLabel('Soliq profili nomi',{exact:true}).fill('A')
 await page.locator('a[href="/dashboard"]').first().click();await expect(page).toHaveURL(/\/settings\/taxes$/);expect(prompts).toBe(1)
 await page.getByLabel('Soliq profili nomi',{exact:true}).fill('')
 await page.getByRole('button',{name:'Soliq tarixini ochish: Recovery first',exact:true}).click()
 await page.getByLabel('Soliq stavkasi foiz',{exact:true}).fill('12.34')
 await page.getByRole('button',{name:'Soliq tarixini ochish: Recovery second',exact:true}).click();expect(prompts).toBe(2);await expect(page.getByLabel('Soliq stavkasi foiz',{exact:true})).toHaveValue('12.34')
 await page.getByLabel('Soliq stavkasi foiz',{exact:true}).fill('0')
 const bodies:Record<string,unknown>[]=[];let lost=true,entered!:()=>void,release!:()=>void
 const started=new Promise<void>(resolve=>{entered=resolve}),gate=new Promise<void>(resolve=>{release=resolve})
 await page.route('**/api/taxes/'+first.id,async route=>{
  expect(route.request().method()).toBe('PUT');bodies.push(route.request().postDataJSON())
  if(lost){lost=false;const response=await route.fetch();expect(response.ok()).toBe(true);entered();await gate;await route.abort('failed')}else await route.continue()
 })
 await page.getByRole('button',{name:'Soliq profilini arxivlash: Recovery first: oldindan ko‘rish',exact:true}).click()
 try{await page.getByRole('button',{name:'Amalni tasdiqlash',exact:true}).evaluate(button=>{(button as HTMLButtonElement).click();(button as HTMLButtonElement).click()});await started;await page.locator('a[href="/dashboard"]').first().click();await expect(page).toHaveURL(/\/settings\/taxes$/);expect(prompts).toBe(2);}finally{release()}
 await expect(page.getByRole('button',{name:'Original amalni qayta tekshirish',exact:true})).toBeVisible()
 await page.reload();await page.getByRole('button',{name:'Saqlangan amalni qayta tekshirish',exact:true}).click()
 await expect(page.getByRole('button',{name:'Saqlangan amalni qayta tekshirish',exact:true})).toHaveCount(0)
 expect(bodies).toHaveLength(2);expect(bodies[1]).toEqual(bodies[0]);expect(bodies[0]).toMatchObject({isActive:false})
 expect((await db.taxProfile.findUniqueOrThrow({where:{id:first.id}})).isActive).toBe(false)
 expect((await db.taxProfile.findUniqueOrThrow({where:{id:second.id}})).isActive).toBe(true)
 expect(await db.auditLog.count({where:{entityId:first.id,action:'tax_profile_changed'}})).toBe(1)
 expect(await db.taxProfileVersion.count({where:{organizationId:me.organization.id}})).toBe(0)
 expect(await db.payment.count({where:{organizationId:me.organization.id}})).toBe(0)
})
