import {test,expect} from '@playwright/test'
import {PrismaClient} from '@prisma/client'
import {hash} from 'bcryptjs'
import {randomUUID} from 'node:crypto'
const url=new URL(process.env.DATABASE_URL??'');if(url.hostname!=='127.0.0.1'||url.port!=='55439'||url.pathname!=='/pos_test')throw new Error('Isolated readonly browser DB required')
const db=new PrismaClient(),orgs:string[]=[],users:string[]=[]
test.afterAll(async()=>{await db.organization.deleteMany({where:{id:{in:orgs}}});await db.user.deleteMany({where:{id:{in:users}}});await db.$disconnect()})
test('Expired owner signs in, sees read-only, reads catalog and creates renewal invoice while business POST is rejected',async({page})=>{
 const org=await db.$transaction(async tx=>{await tx.$executeRawUnsafe('ALTER TABLE "Organization" DISABLE TRIGGER billing_enroll_new_org');const row=await tx.organization.create({data:{name:'Read-only browser organization',phone:randomUUID()}});await tx.$executeRawUnsafe('ALTER TABLE "Organization" ENABLE TRIGGER billing_enroll_new_org');return row});orgs.push(org.id)
 const phone='readonly-'+randomUUID(),password='test-only-password',user=await db.user.create({data:{fullName:'Read-only owner',phone,passwordHash:await hash(password,10)}});users.push(user.id)
 await db.organizationUser.create({data:{organizationId:org.id,userId:user.id,role:'owner'}})
 const store=await db.store.create({data:{organizationId:org.id,name:'Retained branch'}})
 await db.register.create({data:{storeId:store.id,name:'Retained till',code:'READONLY'}})
 const product=await db.product.create({data:{organizationId:org.id,name:'Retained product',sku:randomUUID(),barcode:randomUUID(),unit:'dona',salePrice:'10',costPrice:'3'}})
 await db.organizationSubscription.create({data:{organizationId:org.id,planVersionId:'initial-pro-v1',trialStartedAt:new Date(Date.now()-22*86400000),trialEndsAt:new Date(Date.now()-8*86400000)}})
 const origin={Origin:'https://localhost:3100'}
 expect((await page.request.post('/api/auth/login',{headers:origin,data:{phone,password}})).ok()).toBe(true)
 await page.goto('/billing');await expect(page.getByText(/Tashkilot faqat o‘qish rejimida/)).toBeVisible()
 expect((await page.request.get('/api/products?organizationId='+org.id)).ok()).toBe(true)
 const denied=await page.request.post('/api/products',{headers:origin,data:{organizationId:org.id,name:'Denied product',sku:randomUUID(),barcode:randomUUID(),unit:'dona',salePrice:'10',costPrice:'3'}})
 expect(denied.status()).toBe(409);expect((await denied.json()).error.code).toBe('SUBSCRIPTION_EXPIRED')
 const invoices=page.getByRole('region',{name:'Obuna invoicelari'})
 await invoices.getByLabel('Tarif',{exact:true}).selectOption('start')
 await invoices.getByRole('button',{name:'Oylik invoice yaratish: oldindan ko‘rish'}).click();await invoices.getByRole('button',{name:'Amalni tasdiqlash',exact:true}).click()
 await expect.poll(()=>db.billingInvoice.count({where:{organizationId:org.id}})).toBe(1)
 expect(await db.product.count({where:{organizationId:org.id}})).toBe(1);expect((await db.product.findUniqueOrThrow({where:{id:product.id}})).name).toBe('Retained product')
 expect(await db.payment.count({where:{organizationId:org.id}})).toBe(0)
})
