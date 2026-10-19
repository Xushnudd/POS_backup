import {test,expect} from '@playwright/test'
import {PrismaClient} from '@prisma/client'
import {randomUUID} from 'node:crypto'
const connection=new URL(process.env.DATABASE_URL??'')
if(connection.hostname!=='127.0.0.1'||connection.port!=='55439'||connection.pathname!=='/pos_test')throw Error('Isolated DB required')
const db=new PrismaClient(),orgs:string[]=[],users:string[]=[]
test.afterAll(async()=>{await db.organization.deleteMany({where:{id:{in:orgs}}});await db.user.deleteMany({where:{id:{in:users}}});await db.$disconnect()})
for(const kind of ['stock','transfer'] as const)test(`${kind} draft UI preserves exact immutable request after lost ACK and reload, replay creates no duplicate`,async({page})=>{
 const origin={Origin:'https://localhost:3100'}
 const response=await page.request.post('/api/auth/register',{headers:origin,data:{fullName:'Draft recovery owner',phone:'draft-ui-'+randomUUID(),password:'test-only-password',organizationName:'Draft recovery business'}})
 expect(response.ok()).toBe(true)
 const me=(await(await page.request.get('/api/auth/me')).json()).data
 orgs.push(me.organization.id);users.push(me.user.id)
 const source=await db.store.findFirstOrThrow({where:{organizationId:me.organization.id}})
 const destination=await db.store.create({data:{organizationId:me.organization.id,name:'Destination'}})
 const member=await db.organizationUser.findFirstOrThrow({where:{organizationId:me.organization.id,userId:me.user.id}})
 await db.userStore.create({data:{organizationUserId:member.id,storeId:destination.id}})
 await db.unit.updateMany({where:{organizationId:me.organization.id,code:'kg'},data:{precision:6}})
 const exactCost='99999999999999.123456'
 await db.product.create({data:{organizationId:me.organization.id,name:'Exact draft item',sku:randomUUID(),barcode:randomUUID(),unit:'kg',salePrice:'1.01',costPrice:exactCost}})
 const pagePath=kind==='stock'?'/inventory':'/inventory/transfers',apiPath=kind==='stock'?'/api/stock-documents':'/api/transfers'
 const catalogLoaded=page.waitForResponse(result=>new URL(result.url()).pathname==='/api/products'&&result.status()===200)
 await page.goto(pagePath);await catalogLoaded
 if(kind==='transfer')await expect(page.locator(`select option[value="${destination.id}"]`).first()).toHaveCount(1)
 await page.getByRole('button',{name:kind==='stock'?'Yangi kirim hujjati':'Yangi transfer',exact:true}).click()
 const modal=page.getByRole('dialog',{name:kind==='stock'?'Yangi ombor hujjati (Kirim)':"Yangi do'konlararo transfer",exact:true})
 await expect(modal.locator('select option').filter({hasText:'Exact draft item'})).toHaveCount(1)
 if(kind==='transfer'){
  await modal.getByLabel("Qaysi do'kondan (Chiqim) *",{exact:true}).selectOption(source.id)
  await modal.getByLabel("Qaysi do'konga (Kirim) *",{exact:true}).selectOption(destination.id)
 }
 await modal.getByPlaceholder('Miqdor',{exact:true}).fill('2.000001')
 if(kind==='stock')await modal.getByPlaceholder('Asosiy birlik tannarxi',{exact:true}).fill(exactCost)
 const preview=kind==='stock'?'Hujjatni yaratish: oldindan ko‘rish':'Transferni yaratish: oldindan ko‘rish'
 await modal.getByRole('button',{name:preview,exact:true}).click()
 await expect(modal.getByRole('status').filter({hasText:'Amalni tekshiring'})).toContainText(exactCost)
 let entered!:()=>void,release!:()=>void
 const started=new Promise<void>(resolve=>{entered=resolve}),gate=new Promise<void>(resolve=>{release=resolve})
 const bodies:Record<string,unknown>[]=[],ids:string[]=[];let lose=true
 await page.route('**'+apiPath,async route=>{
  if(route.request().method()!=='POST'){await route.continue();return}
  bodies.push(route.request().postDataJSON())
  if(lose){lose=false;const actual=await route.fetch();expect(actual.ok()).toBe(true);ids.push((await actual.json()).data.id);entered();await gate;await route.abort('failed')}
  else await route.continue()
 })
 page.on('dialog',async dialog=>{if(dialog.type()==='beforeunload')await dialog.accept();else await dialog.dismiss()})
 try{
  await modal.getByRole('button',{name:'Amalni tasdiqlash',exact:true}).click();await started
  await expect(modal.getByPlaceholder('Miqdor',{exact:true})).toBeDisabled()
  await page.evaluate(()=>document.querySelector<HTMLAnchorElement>('a[href="/dashboard"]')!.click());await expect(page).toHaveURL(new RegExp(pagePath+'$'))
 }finally{release()}
 await expect(modal.getByRole('alert')).toBeVisible()
 expect((bodies[0].items as {quantity:string;unitCost:string}[])[0]).toMatchObject({quantity:'2.000001',unitCost:exactCost})
 await page.reload()
 await page.getByRole('button',{name:'Saqlangan amalni qayta tekshirish',exact:true}).click()
 await expect(page.getByRole('button',{name:'Saqlangan amalni qayta tekshirish',exact:true})).toHaveCount(0)
 expect(bodies).toHaveLength(2);expect(bodies[1]).toEqual(bodies[0]);expect(bodies[0].operationId).toEqual(expect.any(String))
 const id=ids[0]
 expect(kind==='stock'?await db.stockDocument.count({where:{organizationId:me.organization.id}}):await db.stockTransfer.count({where:{organizationId:me.organization.id}})).toBe(1)
 expect(await db.auditLog.count({where:{organizationId:me.organization.id,entityId:id,action:'create'}})).toBe(1)
 expect(await db.inventoryMovement.count({where:{organizationId:me.organization.id}})).toBe(0)
 const item=kind==='stock'?await db.stockDocumentItem.findFirstOrThrow({where:{stockDocumentId:id}}):await db.stockTransferItem.findFirstOrThrow({where:{stockTransferId:id}})
 expect(item.quantity.toString()).toBe('2.000001');expect(item.unitCost.toString()).toBe(exactCost)
})
