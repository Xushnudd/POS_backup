import {test, expect} from '@playwright/test'
import {PrismaClient} from '@prisma/client'
import {randomUUID} from 'node:crypto'
import {TOTP, URI} from 'otpauth'
const connection = new URL(process.env.DATABASE_URL ?? '')
if (connection.hostname !== '127.0.0.1' || connection.port !== '55439' || connection.pathname !== '/pos_test') throw new Error('Isolated DB required')
const db = new PrismaClient(), orgs: string[] = [], users: string[] = [], password = 'test-only-password'
test.afterAll(async () => {await db.organization.deleteMany({where:{id:{in:orgs}}}); await db.user.deleteMany({where:{id:{in:users}}}); await db.$disconnect()})
test('Critical billing UI requires MFA, cancellation has no effect and approved retry preserves the original body', async ({page}) => {
 const register = await page.request.post('/api/auth/register', {headers:{Origin:'https://localhost:3100'},data:{fullName:'Critical MFA owner',phone:'critical-'+randomUUID(),password,organizationName:'Critical MFA business'}})
 expect(register.ok()).toBe(true)
 const me = (await (await page.request.get('/api/auth/me')).json()).data; orgs.push(me.organization.id); users.push(me.user.id)
 const begin = await page.request.post('/api/auth/totp/enroll', {headers:{Origin:'https://localhost:3100'},data:{password}})
 expect(begin.ok()).toBe(true)
 const factor = (await begin.json()).data, totp = URI.parse(factor.provisioningUri) as TOTP
 expect((await page.request.post('/api/auth/totp/confirm',{headers:{Origin:'https://localhost:3100'},data:{factorId:factor.factorId,code:totp.generate({timestamp:Date.now()-30000})}})).ok()).toBe(true)
 await page.goto('/billing')
 const preview = page.getByRole('button',{name:'Muddat oxirida obunani bekor qilish: oldindan ko‘rish',exact:true})
 await expect(preview).toBeVisible()
 // This label belongs to the subscription cancellation DurableMutation.
 await page.getByLabel('Sabab',{exact:true}).first().fill('Reviewed critical MFA cancellation')
 await preview.click()
 const bodies:string[]=[]
 page.on('request', request => {if(request.url().endsWith('/api/billing/cancel'))bodies.push(request.postData()!)})
 await page.getByRole('button',{name:'Amalni tasdiqlash',exact:true}).click()
 const dialog = page.getByRole('dialog',{name:'Muhim amalni tasdiqlash'})
 await expect(dialog).toBeVisible()
 expect(await db.operation.count({where:{organizationId:me.organization.id,type:'billing.subscription.cancel'}})).toBe(0)
 await dialog.getByRole('button',{name:'Bekor qilish',exact:true}).click()
 await expect(dialog).toHaveCount(0)
 await expect(preview).toBeVisible()
 expect((await db.organizationSubscription.findUniqueOrThrow({where:{organizationId:me.organization.id}})).cancelAtPeriodEnd).toBe(false)
 bodies.length=0
 await preview.click(); await page.getByRole('button',{name:'Amalni tasdiqlash',exact:true}).click()
 await expect(dialog).toBeVisible()
 await dialog.getByLabel('Muhim amal uchun Authenticator kodi',{exact:true}).fill(totp.generate())
 await dialog.getByRole('button',{name:'Amalni tasdiqlash',exact:true}).click()
 await expect(dialog).toHaveCount(0)
 await expect(page.getByRole('button',{name:'Yangilash niyatini tiklash: oldindan ko‘rish',exact:true})).toBeVisible()
 expect(bodies).toHaveLength(2); expect(bodies[0]).toBe(bodies[1])
 expect(await db.operation.count({where:{organizationId:me.organization.id,type:'billing.subscription.cancel'}})).toBe(1)
 expect((await db.organizationSubscription.findUniqueOrThrow({where:{organizationId:me.organization.id}})).cancelAtPeriodEnd).toBe(true)
 const stored = await page.evaluate(() => JSON.stringify({local:{...localStorage},session:{...sessionStorage}}))
 expect(stored.includes(totp.secret.base32)).toBe(false)
})
