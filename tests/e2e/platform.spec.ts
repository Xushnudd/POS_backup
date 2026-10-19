import {test,expect} from '@playwright/test'
import {PrismaClient} from '@prisma/client'
import {randomUUID} from 'node:crypto'
import {URI,TOTP} from 'otpauth'
const url=new URL(process.env.DATABASE_URL??'')
if(url.hostname!=='127.0.0.1'||url.port!=='55439'||url.pathname!=='/pos_test')throw new Error('Isolated DB only')
const db=new PrismaClient(),orgs:string[]=[],users:string[]=[],password='test-only-password'
test.afterAll(async()=>{await db.organization.deleteMany({where:{id:{in:orgs}}});await db.user.deleteMany({where:{id:{in:users}}});await db.$disconnect()})
test('Platform panel rejects an ordinary owner, then requires MFA for an assigned operator and shows safe service/tenant metadata',async({page})=>{
 const name='Platform browser '+randomUUID()
 expect((await page.request.post('/api/auth/register',{headers:{Origin:'https://localhost:3100'},data:{fullName:'Platform owner',phone:'platform-'+randomUUID(),password,organizationName:name}})).ok()).toBe(true)
 const me=(await(await page.request.get('/api/auth/me')).json()).data;orgs.push(me.organization.id);users.push(me.user.id)
 await page.goto('/platform')
 const button=page.getByRole('button',{name:'Platforma ma’lumotlarini ko‘rish',exact:true})
 await page.getByLabel('Tashkilot nomi',{exact:true}).fill(name)
 await button.click()
 await expect(page.locator('main').getByRole('alert')).toBeVisible()
 await expect(page.getByRole('region',{name:'Platforma tashkilotlari'})).toHaveCount(0)
 const begin=await page.request.post('/api/auth/totp/enroll',{headers:{Origin:'https://localhost:3100'},data:{password}});expect(begin.ok()).toBe(true)
 const source=(await begin.json()).data,totp=URI.parse(source.provisioningUri) as TOTP
 expect((await page.request.post('/api/auth/totp/confirm',{headers:{Origin:'https://localhost:3100'},data:{factorId:source.factorId,code:totp.generate({timestamp:Date.now()-30000})}})).ok()).toBe(true)
 await db.platformOperator.create({data:{userId:me.user.id,role:'platform_admin'}})
 await button.click()
 const dialog=page.getByRole('dialog',{name:'Muhim amalni tasdiqlash'})
 await expect(dialog).toBeVisible();await expect(dialog.getByText('Amal: Platforma boshqaruv panelini ko‘rish',{exact:true})).toBeVisible()
 await dialog.getByLabel('Muhim amal uchun Authenticator kodi',{exact:true}).fill(totp.generate())
 await dialog.getByRole('button',{name:'Amalni tasdiqlash',exact:true}).click()
 const organizations=page.getByRole('region',{name:'Platforma tashkilotlari'})
 await expect(organizations.getByRole('cell',{name,exact:true})).toBeVisible()
 await expect(organizations.getByText('Tashkilotlar — jami 1',{exact:true})).toBeVisible()
 await expect(page.getByRole('region',{name:'Platforma tariflari'}).getByText(/Start:/)).toBeVisible()
 await expect(page.getByRole('region',{name:'Platforma xizmat holati'})).toBeVisible()
 await expect(page.getByRole('region',{name:'Platforma hodisalari'})).toBeVisible()
 expect(await db.auditLog.count({where:{organizationId:me.organization.id,entityType:'PlatformOverview',action:'platform_overview_viewed'}})).toBe(1)
 expect(await db.operation.count({where:{organizationId:me.organization.id,type:'platform.overview'}})).toBe(0)
 await db.platformOperator.update({where:{userId:me.user.id},data:{isActive:false}})
 await button.click();await expect(page.locator('main').getByRole('alert')).toBeVisible();await expect(organizations).toHaveCount(0)
})
