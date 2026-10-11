import {test,expect} from '@playwright/test'
import {PrismaClient} from '@prisma/client'
import {randomUUID} from 'node:crypto'
const url=new URL(process.env.DATABASE_URL??'')
if(url.hostname!=='127.0.0.1'||url.port!=='55439'||url.pathname!=='/pos_test')throw new Error('Isolated DB only')
const db=new PrismaClient(),orgs:string[]=[],users:string[]=[],password='roles-browser-password'
test.afterAll(async()=>{await db.organization.deleteMany({where:{id:{in:orgs}}});await db.user.deleteMany({where:{id:{in:users}}});await db.$disconnect()})
test('Owner explicitly creates and assigns observer profile; actual staff admission and session invalidation follow policy edits',async({page,browser})=>{
 expect((await page.request.post('/api/auth/register',{headers:{Origin:'https://localhost:3100'},data:{fullName:'Roles owner',phone:'roles-owner-'+randomUUID(),password,organizationName:'Roles browser '+randomUUID()}})).ok()).toBe(true)
 const me=(await(await page.request.get('/api/auth/me')).json()).data;orgs.push(me.organization.id);users.push(me.user.id)
 const phone='roles-staff-'+randomUUID()
 const staffResult=await page.request.post(`/api/organizations/${me.organization.id}/users`,{headers:{Origin:'https://localhost:3100'},data:{fullName:'Observer staff',phone,password,role:'admin'}})
 expect(staffResult.ok()).toBe(true);const staff=(await staffResult.json()).data;users.push(staff.user.id)
 await page.goto('/roles');await page.getByRole('button',{name:'Rollarni yuklash',exact:true}).click()
 await page.getByRole('button',{name:'Kuzatuvchi namunasi',exact:true}).click()
 await page.getByLabel('Sabab',{exact:true}).fill('Explicit owner review for observer')
 await page.getByRole('button',{name:'Saqlash',exact:true}).click()
 await expect(page.getByText('Rol saqlandi. Vakolat o‘zgargan xodimlar qayta kirishi kerak.',{exact:true})).toBeVisible()
 const profile=await db.customRole.findFirstOrThrow({where:{organizationId:me.organization.id,name:'Kuzatuvchi'}})
 await page.getByLabel('Xodim',{exact:true}).selectOption(staff.id)
 await page.getByLabel('Ushbu sahifadagi profil',{exact:true}).selectOption(profile.id)
 await page.getByRole('button',{name:'Biriktirishni saqlash',exact:true}).click()
 await expect(page.getByText('Profil biriktirildi; xodim qayta kirishi kerak.',{exact:true})).toBeVisible()
 const context=await browser.newContext({baseURL:'https://localhost:3100',ignoreHTTPSErrors:true})
 try{
  expect((await context.request.post('/api/auth/login',{headers:{Origin:'https://localhost:3100'},data:{phone,password}})).ok()).toBe(true)
  const signed=(await(await context.request.get('/api/auth/me')).json()).data
  expect(signed.user.customRole.name).toBe('Kuzatuvchi')
  expect((await context.request.get('/api/products')).status()).toBe(200)
  expect((await context.request.post('/api/products',{headers:{Origin:'https://localhost:3100'},data:{}})).status()).toBe(403)
  await page.getByRole('button',{name:'Tahrirlash',exact:true}).click()
  await page.getByLabel('GET /api/products',{exact:true}).uncheck()
  await page.getByLabel('Sabab',{exact:true}).fill('Owner removed catalog listing permission')
  await page.getByRole('button',{name:'Saqlash',exact:true}).click()
  await expect(page.getByText('Rol saqlandi. Vakolat o‘zgargan xodimlar qayta kirishi kerak.',{exact:true})).toBeVisible()
  expect((await context.request.get('/api/auth/me')).status()).toBe(401)
  expect((await context.request.post('/api/auth/login',{headers:{Origin:'https://localhost:3100'},data:{phone,password}})).ok()).toBe(true)
  expect((await context.request.get('/api/products')).status()).toBe(403)
 }finally{await context.close()}
})
