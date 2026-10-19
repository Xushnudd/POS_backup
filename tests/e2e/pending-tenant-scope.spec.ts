import {test,expect} from '@playwright/test'
import {PrismaClient} from '@prisma/client'
import {randomUUID} from 'node:crypto'
const connection=new URL(process.env.DATABASE_URL??'')
if(connection.hostname!=='127.0.0.1'||connection.port!=='55439'||connection.pathname!=='/pos_test')throw Error('Isolated DB required')
const db=new PrismaClient(),orgs:string[]=[],users:string[]=[]
test.afterAll(async()=>{await db.organization.deleteMany({where:{id:{in:orgs}}});await db.user.deleteMany({where:{id:{in:users}}});await db.$disconnect()})
test('pending original stock intent blocks UI tenant switch and is never replayed under another authorized business',async({page})=>{
 const headers={Origin:'https://localhost:3100'},phone='scope-'+randomUUID()
 expect((await page.request.post('/api/auth/register',{headers,data:{fullName:'Scope owner',phone,password:'test-only-password',organizationName:'Original pending business'}})).ok()).toBe(true)
 const me=(await(await page.request.get('/api/auth/me')).json()).data;orgs.push(me.organization.id);users.push(me.user.id)
 const created=await page.request.post('/api/organizations',{headers,data:{name:'Other authorized business',phone}});expect(created.ok()).toBe(true);const other=(await created.json()).data;orgs.push(other.id)
 const store=await db.store.findFirstOrThrow({where:{organizationId:me.organization.id}}),product=await db.product.create({data:{organizationId:me.organization.id,name:'Original scoped threshold',sku:randomUUID(),barcode:randomUUID(),unit:'dona',salePrice:'1',costPrice:'1'}})
 await page.goto('/replenishment');await page.getByLabel('Qoldiq filiali',{exact:true}).selectOption(store.id);await page.getByLabel('Mahsulot',{exact:true}).selectOption(product.id);await page.getByLabel('Minimal qoldiq',{exact:true}).fill('3');await page.getByLabel('Maksimal qoldiq',{exact:true}).fill('10')
 let lost=true;const bodies:Record<string,unknown>[]=[]
 await page.route('**/api/inventory/thresholds',async route=>{bodies.push(route.request().postDataJSON());if(lost){lost=false;const response=await route.fetch();expect(response.ok()).toBe(true);await route.abort('failed')}else await route.continue()})
 await page.getByRole('button',{name:'Chegaralarni saqlash: oldindan ko‘rish',exact:true}).click();await page.getByRole('button',{name:'Amalni tasdiqlash',exact:true}).click();await expect(page.getByRole('button',{name:'Original amalni qayta tekshirish',exact:true})).toBeEnabled()
 await page.getByLabel('Biznesni almashtirish',{exact:true}).selectOption(other.id)
 await expect(page.getByText('Avval kutilayotgan savdo natijalarini tekshiring',{exact:false})).toBeVisible();await expect(page.getByLabel('Biznesni almashtirish',{exact:true})).toHaveValue(me.organization.id)
 // An authorized server context change simulates session replacement outside this page.
 expect((await page.request.post('/api/organizations/switch',{headers,data:{targetOrganizationId:other.id}})).ok()).toBe(true)
 await page.reload();await expect(page.getByLabel('Biznesni almashtirish',{exact:true})).toHaveValue(other.id)
 await expect(page.getByRole('button',{name:'Original amalni qayta tekshirish',exact:true})).toHaveCount(0)
 await expect(page.getByRole('button',{name:'Saqlangan amalni qayta tekshirish',exact:true})).toHaveCount(0)
 expect(bodies).toHaveLength(1);expect(await db.stockThreshold.count({where:{organizationId:other.id}})).toBe(0)
 await page.getByLabel('Biznesni almashtirish',{exact:true}).selectOption(me.organization.id);await expect(page).toHaveURL(/\/pos$/);await expect(page.getByLabel('Biznesni almashtirish',{exact:true})).toHaveValue(me.organization.id)
 await page.goto('/replenishment');await page.getByRole('button',{name:'Saqlangan amalni qayta tekshirish',exact:true}).click();await expect(page.getByRole('button',{name:'Saqlangan amalni qayta tekshirish',exact:true})).toHaveCount(0)
 expect(bodies).toHaveLength(2);expect(bodies[1]).toEqual(bodies[0])
 expect(await db.operation.count({where:{organizationId:me.organization.id,type:'stock.threshold'}})).toBe(1)
 expect(await db.auditLog.count({where:{organizationId:me.organization.id,action:'threshold_set'}})).toBe(1)
})
