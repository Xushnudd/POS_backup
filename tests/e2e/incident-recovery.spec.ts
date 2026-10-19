import {test,expect} from '@playwright/test'
import {PrismaClient} from '@prisma/client'
import {randomUUID} from 'node:crypto'
const connection=new URL(process.env.DATABASE_URL??'')
if(connection.hostname!=='127.0.0.1'||connection.port!=='55439'||connection.pathname!=='/pos_test')throw Error('Isolated DB required')
const db=new PrismaClient(),orgs:string[]=[],users:string[]=[]
test.afterAll(async()=>{await db.organization.deleteMany({where:{id:{in:orgs}}});await db.user.deleteMany({where:{id:{in:users}}});await db.$disconnect()})
test('incident scan and resolution replay original intent without economic repair or clearing a newer reason',async({page})=>{
 const headers={Origin:'https://localhost:3100'}
 expect((await page.request.post('/api/auth/register',{headers,data:{fullName:'Incident owner',phone:'incident-'+randomUUID(),password:'test-only-password',organizationName:'Incident recovery'}})).ok()).toBe(true)
 const me=(await(await page.request.get('/api/auth/me')).json()).data;orgs.push(me.organization.id);users.push(me.user.id)
 const store=await db.store.findFirstOrThrow({where:{organizationId:me.organization.id}})
 const product=await db.product.create({data:{organizationId:me.organization.id,name:'Incident fixture',sku:randomUUID(),barcode:randomUUID(),unit:'dona',salePrice:'1',costPrice:'1'}})
 // Isolated corruption fixture: no legitimate movements exist, so expected balance is zero.
 await db.inventoryBalance.create({data:{storeId:store.id,productId:product.id,quantity:'2'}})
 await page.goto('/incidents')
 const bodies:Record<string,unknown>[]=[];let loseScan=true
 await page.route('**/api/incidents',async route=>{
  if(route.request().method()!=='POST')return route.continue()
  bodies.push(route.request().postDataJSON())
  if(loseScan){loseScan=false;const response=await route.fetch();expect(response.ok()).toBe(true);await route.abort('failed')}else await route.continue()
 })
 await page.getByRole('button',{name:'Hisoblarni solishtirish: oldindan ko‘rish',exact:true}).click()
 await page.getByRole('button',{name:'Amalni tasdiqlash',exact:true}).click()
 await expect(page.getByRole('button',{name:'Original amalni qayta tekshirish',exact:true})).toBeVisible()
 await page.reload();await page.getByRole('button',{name:'Original amalni qayta tekshirish',exact:true}).click()
 await expect(page.getByRole('button',{name:'Original amalni qayta tekshirish',exact:true})).toHaveCount(0)
 await expect(page.getByRole('article')).toContainText('Incident fixture')
 expect(bodies).toHaveLength(2);expect(bodies[1]).toEqual(bodies[0])
 expect(await db.auditLog.count({where:{organizationId:me.organization.id,action:'reconciliation_scanned'}})).toBe(1)
 const incident=await db.incident.findFirstOrThrow({where:{organizationId:me.organization.id,kind:'inventory'}})
 // Undo only the test's corruption. Production resolution must never perform this repair.
 await db.inventoryBalance.update({where:{storeId_productId:{storeId:store.id,productId:product.id}},data:{quantity:0}})
 await page.getByLabel('Yopish sababi',{exact:true}).fill('Verified original fixture correction')
 await page.getByRole('button',{name:'Tuzatilganini tekshirib yopish: oldindan ko‘rish',exact:true}).click()
 let entered!:()=>void,release!:()=>void,loseResolve=true
 const started=new Promise<void>(resolve=>{entered=resolve}),gate=new Promise<void>(resolve=>{release=resolve}),resolutions:Record<string,unknown>[]=[]
 await page.route('**/api/incidents/'+incident.id,async route=>{
  resolutions.push(route.request().postDataJSON())
  if(loseResolve){loseResolve=false;const response=await route.fetch();expect(response.ok()).toBe(true);entered();await gate;await route.abort('failed')}else await route.continue()
 })
 let prompts=0;page.on('dialog',async dialog=>{if(dialog.type()==='beforeunload')await dialog.accept();else{prompts++;await dialog.dismiss()}})
 try{
  await page.getByRole('button',{name:'Amalni tasdiqlash',exact:true}).click();await started
  await page.getByLabel('Yopish sababi',{exact:true}).fill('New independent review draft')
  await page.locator('a[href="/dashboard"]').first().click();await expect(page).toHaveURL(/\/incidents$/);expect(prompts).toBe(0)
 }finally{release()}
 await expect(page.getByRole('button',{name:'Original amalni qayta tekshirish',exact:true})).toBeVisible()
 await page.getByRole('button',{name:'Original amalni qayta tekshirish',exact:true}).click()
 await expect(page.getByRole('button',{name:'Original amalni qayta tekshirish',exact:true})).toHaveCount(0)
 await expect(page.getByLabel('Yopish sababi',{exact:true})).toHaveValue('New independent review draft')
 await page.locator('a[href="/dashboard"]').first().click();await expect(page).toHaveURL(/\/incidents$/);expect(prompts).toBe(1)
 expect(resolutions).toHaveLength(2);expect(resolutions[1]).toEqual(resolutions[0])
 expect((await db.incident.findUniqueOrThrow({where:{id:incident.id}})).resolutionReason).toBe('Verified original fixture correction')
 expect(await db.auditLog.count({where:{entityId:incident.id,action:'resolved'}})).toBe(1)
 expect(await db.operation.count({where:{organizationId:me.organization.id,type:'incident.resolve'}})).toBe(1)
 expect(await db.inventoryMovement.count({where:{organizationId:me.organization.id}})).toBe(0)
 expect(await db.payment.count({where:{organizationId:me.organization.id}})).toBe(0)
})
