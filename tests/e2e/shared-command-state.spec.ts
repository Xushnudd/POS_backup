import {test,expect,type Page} from '@playwright/test'
import {PrismaClient} from '@prisma/client'
import {randomUUID} from 'node:crypto'
const connection=new URL(process.env.DATABASE_URL??'')
if(connection.hostname!=='127.0.0.1'||connection.port!=='55439'||connection.pathname!=='/pos_test')throw Error('Isolated DB required')
const db=new PrismaClient(),orgs:string[]=[],users:string[]=[]
test.afterAll(async()=>{await db.organization.deleteMany({where:{id:{in:orgs}}});await db.user.deleteMany({where:{id:{in:users}}});await db.$disconnect()})
async function owner(page:Page){expect((await page.request.post('/api/auth/register',{headers:{Origin:'https://localhost:3100'},data:{fullName:'Shared command owner',phone:'shared-command-'+randomUUID(),password:'test-only-password',organizationName:'Shared command state'}})).ok()).toBe(true);const me=(await(await page.request.get('/api/auth/me')).json()).data;orgs.push(me.organization.id);users.push(me.user.id);return me}
test('onboarding partial reason is guarded and pending organization step does not occupy the next register step',async({page})=>{
 const me=await owner(page);await page.goto('/onboarding');const reason=page.getByLabel('Sozlash bosqichini tasdiqlash sababi',{exact:true});await reason.fill('V')
 let prompts=0;page.on('dialog',async dialog=>{if(dialog.type()==='beforeunload')await dialog.accept();else{prompts++;await dialog.dismiss()}})
 await page.getByRole('link',{name:'Katalog importi bo‘limiga o‘tish',exact:true}).click();await expect(page).toHaveURL(/\/onboarding$/);expect(prompts).toBe(1)
 await reason.fill('Verified original organization');const bodies:string[]=[];let lost=false
 await page.route('**/api/onboarding',async route=>{if(route.request().method()==='POST'){bodies.push(route.request().postData()??'');const response=await route.fetch();if(!lost&&response.ok()){lost=true;await route.abort('failed')}else await route.fulfill({response})}else await route.continue()})
 await page.getByRole('button',{name:'Tashkilot ma’lumoti bosqichini tasdiqlash: oldindan ko‘rish',exact:true}).click();await page.getByRole('button',{name:'Amalni tasdiqlash',exact:true}).click();await expect(page.getByRole('button',{name:'Original amalni qayta tekshirish',exact:true})).toHaveCount(1)
 await page.getByRole('button',{name:'Bosqichlarni qayta tekshirish',exact:true}).click();await expect(page.getByRole('status').filter({hasText:'Tasdiqlangan bosqichlar:'})).toHaveText('Tasdiqlangan bosqichlar: 1 / 6');await expect(page.getByRole('button',{name:'Original amalni qayta tekshirish',exact:true})).toHaveCount(1)
 await reason.fill('Independent register step');await page.getByRole('button',{name:'Filial va kassa bosqichini tasdiqlash: oldindan ko‘rish',exact:true}).click();await expect(page.getByRole('button',{name:'Amalni tasdiqlash',exact:true})).toHaveCount(1)
 await page.getByRole('button',{name:'Saqlangan amalni qayta tekshirish',exact:true}).click();await expect(page.getByRole('button',{name:'Saqlangan amalni qayta tekshirish',exact:true})).not.toBeVisible();await expect(reason).toHaveValue('Independent register step');expect(bodies).toHaveLength(2);expect(bodies[0]).toBe(bodies[1])
 await page.getByRole('button',{name:'Amalni tasdiqlash',exact:true}).click();await expect(reason).toHaveValue('');expect(await db.onboardingCheckpoint.count({where:{organizationId:me.organization.id}})).toBe(2);expect(await db.operation.count({where:{organizationId:me.organization.id,type:'onboarding.checkpoint'}})).toBe(2)
})
test('saved catalog job recovery leaves an independent report filter and reason intact',async({page})=>{
 const me=await owner(page);await page.goto('/jobs');await page.getByLabel('Fon ishining turi',{exact:true}).selectOption('catalog_export');await page.getByLabel('Fon ishini tasdiqlash sababi',{exact:true}).fill('Original catalog export only')
 const bodies:string[]=[];let lost=false
 await page.route('**/api/jobs',async route=>{if(route.request().method()==='POST'){bodies.push(route.request().postData()??'');const response=await route.fetch();if(!lost&&response.ok()){lost=true;await route.abort('failed')}else await route.fulfill({response})}else await route.continue()})
 await page.getByRole('button',{name:'Katalog eksportini navbatga qo‘yish: oldindan ko‘rish',exact:true}).click();await page.getByRole('button',{name:'Amalni tasdiqlash',exact:true}).click();await expect(page.getByRole('button',{name:'Original amalni qayta tekshirish',exact:true})).toHaveCount(1)
 await page.reload();await page.getByLabel('Fon ishining turi',{exact:true}).selectOption('report_export');await expect(page.getByRole('button',{name:'Original amalni qayta tekshirish',exact:true})).toHaveCount(0)
 await page.getByLabel('Eksport hisoboti',{exact:true}).selectOption('products');await page.getByLabel('Qidiruv',{exact:true}).fill('Independent report filter');await page.getByLabel('Fon ishini tasdiqlash sababi',{exact:true}).fill('Independent report reason')
 let prompts=0;page.on('dialog',async dialog=>{if(dialog.type()==='beforeunload')await dialog.accept();else{prompts++;await dialog.dismiss()}})
 await page.getByRole('link',{name:'POS Kassa',exact:true}).click();await expect(page).toHaveURL(/\/jobs$/);expect(prompts).toBe(1)
 await page.getByRole('button',{name:'Saqlangan amalni qayta tekshirish',exact:true}).click();await expect(page.getByRole('button',{name:'Saqlangan amalni qayta tekshirish',exact:true})).not.toBeVisible();await expect(page.getByLabel('Qidiruv',{exact:true})).toHaveValue('Independent report filter');await expect(page.getByLabel('Fon ishini tasdiqlash sababi',{exact:true})).toHaveValue('Independent report reason');expect(bodies).toHaveLength(2);expect(bodies[0]).toBe(bodies[1]);expect(await db.backgroundJob.count({where:{organizationId:me.organization.id}})).toBe(1);expect(await db.backgroundJob.count({where:{organizationId:me.organization.id,type:'report_export'}})).toBe(0)
})
