import { test, expect } from '@playwright/test'
import { PrismaClient } from '@prisma/client'
import { randomUUID,createHash } from 'node:crypto'
import {formatLocaleMoney} from '../../src/i18n/format'
import {localizeCodeLabel} from '../../src/i18n/messages'
const url=new URL(process.env.DATABASE_URL??'')
if(url.hostname!=='127.0.0.1'||url.port!=='55439'||url.pathname!=='/pos_test')throw new Error('Isolated test DB only')
const db=new PrismaClient(),orgs:string[]=[],users:string[]=[]
test.afterAll(async()=>{await db.organization.deleteMany({where:{id:{in:orgs}}});await db.user.deleteMany({where:{id:{in:users}}});await db.$disconnect()})
test('Billing displays DB prices/Pro trial and recovers lost invoice acknowledgement without double billing',async({page})=>{
 await page.goto('/')
 const pricing=page.locator('#prices')
 const publicPlans=await db.billingPlan.findMany({where:{isActive:true},include:{currentVersion:true},orderBy:{code:'asc'}})
 expect(publicPlans.length).toBeGreaterThan(0)
 for(const plan of publicPlans){const version=plan.currentVersion;await expect(pricing.getByRole('article').filter({has:page.getByRole('heading',{name:version.name,exact:true})}).getByText((version.currency==='UZS'?formatLocaleMoney(version.monthlyPrice.toFixed(2),'uz'):version.monthlyPrice.toFixed(2)+' '+version.currency)+'/oy',{exact:true})).toBeVisible()}
 await expect(page.getByText('100+ do\'konlar bizni tanlagan',{exact:true})).toHaveCount(0)
 await expect(page.getByText('Cheksiz kassalar',{exact:true})).toHaveCount(0)
 await expect(page.getByRole('heading',{name:'Brauzer, qurilmalar va integratsiyalar'})).toBeVisible()
 const registration=await page.request.post('/api/auth/register',{headers:{Origin:'https://localhost:3100'},data:{fullName:'Billing owner',phone:'billing-browser-'+randomUUID(),password:'test-only-password',organizationName:'Billing browser business'}})
 expect(registration.ok()).toBe(true)
 const me=(await(await page.request.get('/api/auth/me')).json()).data
 orgs.push(me.organization.id);users.push(me.user.id)
 await page.goto('/billing')
 await expect(page.getByRole('heading',{name:'Tarif va obuna',exact:true})).toBeVisible()
 await expect(page.getByText('Amaldagi tarif: Pro')).toBeVisible()
 const start=publicPlans.find(plan=>plan.code==='start')!.currentVersion
 await expect(page.getByText((start.currency==='UZS'?formatLocaleMoney(start.monthlyPrice.toFixed(2),'uz'):start.monthlyPrice.toFixed(2)+' '+start.currency)+'/oy',{exact:true})).toBeVisible()
 await expect(page.getByRole('button',{name:'Tarifni tahrirlash'})).toHaveCount(0)
 let lost=false,originalKey=''
 await page.route('**/api/billing/invoices',async route=>{
  if(route.request().method()==='POST'&&!lost){lost=true;originalKey=route.request().postDataJSON().operationId;const response=await route.fetch();expect(response.ok()).toBe(true);await route.abort('failed')}
  else await route.continue()
 })
 const invoices=page.getByRole('region',{name:'Obuna invoicelari'})
 await invoices.getByLabel('Tarif',{exact:true}).selectOption('start')
 await invoices.getByRole('button',{name:'Oylik invoice yaratish: oldindan ko‘rish'}).click()
 await invoices.getByRole('button',{name:'Amalni tasdiqlash',exact:true}).click()
 await expect(invoices.getByRole('button',{name:'Original amalni qayta tekshirish'})).toBeVisible()
 await expect.poll(()=>db.billingInvoice.count({where:{organizationId:me.organization.id}})).toBe(1)
 await expect(invoices.getByRole('button',{name:'Original amalni qayta tekshirish'})).toBeEnabled()
 const budgetKey=createHash('sha256').update('api.write:'+me.organization.id+':'+me.user.id).digest('hex')
 await db.rateLimit.upsert({where:{key:budgetKey},create:{key:budgetKey,attempts:300,expiresAt:new Date(Date.now()+60000)},update:{attempts:300,expiresAt:new Date(Date.now()+60000)}})
 const limited=page.waitForResponse(response=>response.url().includes('/api/billing/invoices')&&response.request().method()==='POST')
 await invoices.getByRole('button',{name:'Original amalni qayta tekshirish'}).click()
 const denied=await limited;expect(denied.status()).toBe(429);expect(Number(denied.headers()['retry-after'])).toBeGreaterThan(0)
 await expect(invoices.getByText('Original kalit: '+originalKey,{exact:true})).toBeVisible()
 expect(await db.billingInvoice.count({where:{organizationId:me.organization.id}})).toBe(1)
 await db.rateLimit.update({where:{key:budgetKey},data:{expiresAt:new Date(Date.now()-1000)}})
 await page.reload()
 await expect(invoices.getByRole('button',{name:'Original amalni qayta tekshirish'})).toBeVisible()
 await invoices.getByRole('button',{name:'Original amalni qayta tekshirish'}).click()
 await expect(invoices.getByRole('button',{name:'Oylik invoice yaratish: oldindan ko‘rish'})).toBeVisible()
 expect(await db.billingInvoice.count({where:{organizationId:me.organization.id}})).toBe(1)
 expect(await db.billingPayment.count({where:{organizationId:me.organization.id}})).toBe(0)
 const invoice=(await db.billingInvoice.findFirstOrThrow({where:{organizationId:me.organization.id}}))
 await expect(invoices.getByText('Invoice: '+invoice.id,{exact:true})).toBeVisible()
 await invoices.getByLabel('Bekor qilish sababi').fill('Invoice unpaid; no bank transfer made')
 await invoices.getByRole('button',{name:'To‘lanmagan invoiceni bekor qilish: oldindan ko‘rish'}).click()
 await invoices.getByRole('button',{name:'Amalni tasdiqlash',exact:true}).click()
 await expect(invoices.getByText('Holat: '+localizeCodeLabel('cancelled','uz'),{exact:true})).toBeVisible()
 expect((await db.billingInvoice.findUniqueOrThrow({where:{id:invoice.id}})).state).toBe('cancelled')
})
