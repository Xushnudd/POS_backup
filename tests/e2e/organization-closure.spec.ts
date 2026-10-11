import {test,expect} from '@playwright/test'
import {PrismaClient} from '@prisma/client'
import {randomUUID} from 'node:crypto'
import {execFileSync} from 'node:child_process'
const connection=new URL(process.env.DATABASE_URL??'');if(connection.hostname!=='127.0.0.1'||connection.port!=='55439'||connection.pathname!=='/pos_test')throw new Error('Isolated closure browser DB only')
const db=new PrismaClient(),orgs:string[]=[],users:string[]=[]
test.afterAll(async()=>{await db.organization.deleteMany({where:{id:{in:orgs}}});await db.user.deleteMany({where:{id:{in:users}}});await db.$disconnect()})
test('Owner closes with downloaded export, recovers lost ACK without stored password, and cancels with fresh reauth',async({page})=>{
 const password='test-only-password',origin={Origin:'https://localhost:3100'}
 expect((await page.request.post('/api/auth/register',{headers:origin,data:{fullName:'Closure owner',phone:'closure-'+randomUUID(),password,organizationName:'Closure browser business'}})).ok()).toBe(true)
 const me=(await(await page.request.get('/api/auth/me')).json()).data;orgs.push(me.organization.id);users.push(me.user.id)
 const product=await db.product.create({data:{organizationId:me.organization.id,name:'Retained closure product',sku:randomUUID(),barcode:randomUUID(),unit:'dona',salePrice:'10',costPrice:'3'}})
 const enqueue=await page.request.post('/api/jobs',{headers:origin,data:{operationId:randomUUID(),type:'tenant_export',reason:'Owner reviewed export before closing business'}});expect(enqueue.ok()).toBe(true)
 const job=(await enqueue.json()).data
 execFileSync(process.execPath,['--require','./scripts/worker-resolver.cjs','.worker-build/scripts/workers/jobs.js','--once'],{env:{...process.env,NODE_ENV:'production',APP_ORIGIN:'https://localhost:3100'},timeout:30000,stdio:'pipe'})
 expect((await page.request.get('/api/jobs/'+job.id+'/export')).ok()).toBe(true)
 await page.goto('/billing')
 const panel=page.getByRole('region',{name:'Tashkilotni yopish'})
 await panel.getByLabel('Yuklab olingan biznes eksportining job IDsi').fill(job.id)
 await panel.getByLabel('Yopish yoki bekor qilish sababi').fill('Owner reviewed and requests closure')
 await panel.getByRole('button',{name:'Amalni ko‘rib chiqish',exact:true}).click()
 await panel.getByLabel('Joriy parol bilan tasdiqlash').fill(password)
 let dropped=false,first='',replay=''
 await page.route('**/api/billing/closure',async route=>{if(route.request().method()==='POST'){if(!dropped){first=route.request().postData()!;dropped=true;expect((await route.fetch()).ok()).toBe(true);await route.abort('failed')}else{replay=route.request().postData()!;await route.continue()}}else await route.continue()})
 await panel.getByRole('button',{name:'Yopish amalini tasdiqlash',exact:true}).click()
 await expect(panel.getByRole('button',{name:'Oldingi amalni qayta tekshirish',exact:true})).toBeVisible()
 const key='pos-closure-intent:'+me.organization.id
 const persisted=await page.evaluate(key=>localStorage.getItem(key),key)
 expect(persisted).not.toContain(password);expect(JSON.parse(persisted!).body).not.toHaveProperty('password')
 await page.reload();await panel.getByLabel('Joriy parol bilan tasdiqlash').fill(password)
 await panel.getByRole('button',{name:'Oldingi amalni qayta tekshirish',exact:true}).click()
 await expect(panel.getByText(/Faol so‘rov:/)).toBeVisible()
 expect(JSON.parse(replay)).toEqual(JSON.parse(first));expect(await db.organizationClosure.count({where:{organizationId:me.organization.id}})).toBe(1)
 await expect.poll(()=>page.evaluate(key=>localStorage.getItem(key),key)).toBeNull()
 const denied=await page.request.post('/api/products',{headers:origin,data:{organizationId:me.organization.id,name:'Denied closing product',sku:randomUUID(),barcode:randomUUID(),unit:'dona',salePrice:'1',costPrice:'1'}})
 expect(denied.status()).toBe(409);expect((await denied.json()).error.code).toBe('ORGANIZATION_CLOSING')
 expect((await page.request.get('/api/products?organizationId='+me.organization.id)).ok()).toBe(true)
 await panel.getByLabel('Yopish yoki bekor qilish sababi').fill('Owner cancels closing request')
 await panel.getByRole('button',{name:'Amalni ko‘rib chiqish',exact:true}).click()
 await panel.getByLabel('Joriy parol bilan tasdiqlash').fill(password)
 await panel.getByRole('button',{name:'Yopish amalini tasdiqlash',exact:true}).click()
 await expect(panel.getByText(/Faol so‘rov:/)).toHaveCount(0)
 await expect.poll(()=>db.organizationClosure.count({where:{organizationId:me.organization.id,cancelledAt:{not:null}}})).toBe(1)
 const status=(await(await page.request.get('/api/billing')).json()).data;expect(status.businessWritesAllowed).toBe(true)
 expect((await db.product.findUniqueOrThrow({where:{id:product.id}})).name).toBe('Retained closure product')
 expect(await db.payment.count({where:{organizationId:me.organization.id}})).toBe(0)
})
