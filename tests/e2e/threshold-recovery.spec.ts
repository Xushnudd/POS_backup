import {test,expect} from '@playwright/test'
import {PrismaClient} from '@prisma/client'
import {randomUUID} from 'node:crypto'
const connection=new URL(process.env.DATABASE_URL??'')
if(connection.hostname!=='127.0.0.1'||connection.port!=='55439'||connection.pathname!=='/pos_test')throw Error('Isolated DB required')
const db=new PrismaClient(),orgs:string[]=[],users:string[]=[]
test.afterAll(async()=>{await db.organization.deleteMany({where:{id:{in:orgs}}});await db.user.deleteMany({where:{id:{in:users}}});await db.$disconnect()})
test('stock threshold preserves exact immutable intent after lost ACK and reload, with no duplicate audit or stock posting',async({page})=>{
 const origin={Origin:'https://localhost:3100'}
 expect((await page.request.post('/api/auth/register',{headers:origin,data:{fullName:'Threshold owner',phone:'threshold-ui-'+randomUUID(),password:'test-only-password',organizationName:'Threshold recovery'}})).ok()).toBe(true)
 const me=(await(await page.request.get('/api/auth/me')).json()).data;orgs.push(me.organization.id);users.push(me.user.id)
 const store=await db.store.findFirstOrThrow({where:{organizationId:me.organization.id}})
 await db.unit.updateMany({where:{organizationId:me.organization.id,code:'kg'},data:{precision:6}})
 const product=await db.product.create({data:{organizationId:me.organization.id,name:'Threshold exact item',sku:randomUUID(),barcode:randomUUID(),unit:'kg',salePrice:'1',costPrice:'1'}})
 await db.inventoryBalance.create({data:{storeId:store.id,productId:product.id,quantity:'2'}})
 await page.goto('/replenishment')
 await page.getByLabel('Qoldiq filiali',{exact:true}).selectOption(store.id)
 await page.getByLabel('Mahsulot',{exact:true}).selectOption(product.id)
 await page.getByLabel('Minimal qoldiq',{exact:true}).fill('3.000001')
 await page.getByLabel('Maksimal qoldiq',{exact:true}).fill('10.000001')
 let prompts=0;page.on('dialog',async dialog=>{if(dialog.type()==='beforeunload')await dialog.accept();else{prompts++;await dialog.dismiss()}})
 await page.locator('a[href="/dashboard"]').first().click();expect(prompts).toBe(1);await expect(page).toHaveURL(/\/replenishment$/)
 await page.getByRole('button',{name:'Chegaralarni saqlash: oldindan ko‘rish',exact:true}).click()
 let entered!:()=>void,release!:()=>void,lose=true
 const started=new Promise<void>(resolve=>{entered=resolve}),gate=new Promise<void>(resolve=>{release=resolve}),bodies:Record<string,unknown>[]=[]
 await page.route('**/api/inventory/thresholds',async route=>{
  bodies.push(route.request().postDataJSON())
  if(lose){lose=false;const response=await route.fetch();expect(response.ok()).toBe(true);entered();await gate;await route.abort('failed')}
  else await route.continue()
 })
 try{await page.getByRole('button',{name:'Amalni tasdiqlash',exact:true}).click();await started;await expect(page.getByLabel('Minimal qoldiq',{exact:true})).toBeDisabled();await page.locator('a[href="/dashboard"]').first().click();expect(prompts).toBe(1);await expect(page).toHaveURL(/\/replenishment$/);}finally{release()}
 await expect(page.getByRole('button',{name:'Original amalni qayta tekshirish',exact:true})).toBeVisible()
 await page.reload();await page.getByRole('button',{name:'Original amalni qayta tekshirish',exact:true}).click()
 await expect(page.getByRole('button',{name:'Original amalni qayta tekshirish',exact:true})).toHaveCount(0)
 await expect(page.getByRole('article')).toContainText('tavsiya 8.000001 kg')
 expect(bodies).toHaveLength(2);expect(bodies[1]).toEqual(bodies[0]);expect(bodies[0]).toMatchObject({storeId:store.id,productId:product.id,minimum:'3.000001',maximum:'10.000001'})
 const row=await db.stockThreshold.findUniqueOrThrow({where:{storeId_productId:{storeId:store.id,productId:product.id}}})
 expect(row.minimum.toString()).toBe('3.000001');expect(row.maximum?.toString()).toBe('10.000001')
 expect(await db.auditLog.count({where:{organizationId:me.organization.id,action:'threshold_set'}})).toBe(1)
 expect(await db.operation.count({where:{organizationId:me.organization.id,type:'stock.threshold'}})).toBe(1)
 expect(await db.inventoryMovement.count({where:{organizationId:me.organization.id}})).toBe(0)
})
