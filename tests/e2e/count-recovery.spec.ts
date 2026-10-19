import {test,expect} from '@playwright/test'
import {PrismaClient} from '@prisma/client'
import {randomUUID} from 'node:crypto'
const connection=new URL(process.env.DATABASE_URL??'')
if(connection.hostname!=='127.0.0.1'||connection.port!=='55439'||connection.pathname!=='/pos_test')throw Error('Isolated DB required')
const db=new PrismaClient(),orgs:string[]=[],users:string[]=[]
test.afterAll(async()=>{await db.organization.deleteMany({where:{id:{in:orgs}}});await db.user.deleteMany({where:{id:{in:users}}});await db.$disconnect()})
test('count start, reading and approval survive lost ACK and reload with exact quantities and one posting',async({page})=>{
 test.setTimeout(120000)
 const headers={Origin:'https://localhost:3100'}
 expect((await page.request.post('/api/auth/register',{headers,data:{fullName:'Count recovery owner',phone:'count-ui-'+randomUUID(),password:'test-only-password',organizationName:'Count recovery business'}})).ok()).toBe(true)
 const me=(await(await page.request.get('/api/auth/me')).json()).data
 orgs.push(me.organization.id);users.push(me.user.id)
 const store=await db.store.findFirstOrThrow({where:{organizationId:me.organization.id}})
 await db.unit.updateMany({where:{organizationId:me.organization.id,code:'kg'},data:{precision:6}})
 const product=await db.product.create({data:{organizationId:me.organization.id,name:'Count precise item',sku:randomUUID(),barcode:randomUUID(),unit:'kg',salePrice:'4',costPrice:'3'}})
 const opening=await page.request.post('/api/stock-documents',{headers,data:{operationId:randomUUID(),organizationId:me.organization.id,storeId:store.id,documentType:'opening',documentNo:randomUUID(),note:'Count test opening',items:[{productId:product.id,quantity:'5',unitCost:'3'}]}})
 expect(opening.ok()).toBe(true)
 const doc=(await opening.json()).data
 expect((await page.request.post(`/api/stock-documents/${doc.id}/confirm`,{headers,data:{}})).ok()).toBe(true)
 await page.goto('/inventory/counts')
 await expect(page.getByRole('button',{name:'Sanashni boshlash',exact:true})).toBeEnabled()
 page.on('dialog',async dialog=>{if(dialog.type()==='beforeunload')await dialog.accept();else await dialog.dismiss()})
 const replay=async(path:string,button:string)=>{
  const requests:unknown[]=[];let lose=true
  await page.route('**/api'+path,async route=>{
   if(route.request().method()!=='POST'){await route.continue();return}
   requests.push(route.request().postDataJSON())
   if(lose){lose=false;const actual=await route.fetch();expect(actual.ok()).toBe(true);await route.abort('failed')}
   else await route.continue()
  })
  await page.getByRole('button',{name:button,exact:true}).click()
  await expect(page.getByRole('button',{name:'Oldingi amalni qayta tekshirish',exact:true})).toBeVisible()
  await page.reload()
  await page.getByRole('button',{name:'Oldingi amalni qayta tekshirish',exact:true}).click()
  await expect(page.getByRole('button',{name:'Oldingi amalni qayta tekshirish',exact:true})).toHaveCount(0)
  await expect(page.getByText('Sanash serverda saqlandi.',{exact:true})).toBeVisible()
  expect(requests).toHaveLength(2);expect(requests[1]).toEqual(requests[0])
  await page.unroute('**/api'+path)
  return requests[0] as Record<string,unknown>
 }
 await replay('/stock-counts','Sanashni boshlash')
 const count=await db.stockCount.findFirstOrThrow({where:{organizationId:me.organization.id}})
 expect(await db.stockCount.count({where:{organizationId:me.organization.id}})).toBe(1)
 expect(await db.stockFreeze.count({where:{countId:count.id}})).toBe(1)
 const quantity=page.getByLabel(`${product.sku} sanalgan miqdor`,{exact:true})
 await quantity.fill('5.000001')
 await page.getByRole('button',{name:'Tekshirishga yuborish',exact:true}).click()
 await expect(quantity).toHaveValue('5.000001')
 expect((await db.stockCount.findUniqueOrThrow({where:{id:count.id}})).status).toBe('counting')
 const body=await replay(`/stock-counts/${count.id}`,'Sanalgan miqdorlarni saqlash')
 expect(body.items).toEqual([expect.objectContaining({quantity:'5.000001'})])
 expect(await db.stockCountReading.count({where:{line:{countId:count.id}}})).toBe(1)
 await page.getByRole('button',{name:'Tekshirishga yuborish',exact:true}).click()
 await expect(page.getByRole('button',{name:'Farqni tasdiqlash',exact:true})).toBeVisible()
 await page.getByLabel('Tasdiqlash yoki bekor qilish sababi',{exact:true}).fill('Double counted exact quantity')
 await page.getByRole('button',{name:'Farqni tasdiqlash',exact:true}).click()
 await expect(page.getByRole('alert').filter({hasText:'qayta sanang'})).toBeVisible()
 await expect(page.getByRole('button',{name:'Oldingi amalni qayta tekshirish',exact:true})).toHaveCount(0)
 await quantity.fill('5.000001')
 await page.getByRole('button',{name:'Sanalgan miqdorlarni saqlash',exact:true}).click()
 await expect(quantity).toHaveValue('')
 await expect(page.getByLabel('Tasdiqlash yoki bekor qilish sababi',{exact:true})).toHaveValue('Double counted exact quantity')
 await replay(`/stock-counts/${count.id}/approve`,'Farqni tasdiqlash')
 const finished=await db.stockCount.findUniqueOrThrow({where:{id:count.id}})
 expect(finished.status).toBe('approved');expect(finished.adjustmentId).toBeTruthy()
 expect(await db.stockCountReading.count({where:{line:{countId:count.id}}})).toBe(2)
 expect(await db.stockFreeze.count({where:{countId:count.id}})).toBe(0)
 expect(await db.inventoryMovement.count({where:{sourceId:finished.adjustmentId!}})).toBe(1)
 expect((await db.inventoryBalance.findUniqueOrThrow({where:{storeId_productId:{storeId:store.id,productId:product.id}}})).quantity.toString()).toBe('5.000001')
 expect(await db.auditLog.count({where:{entityId:count.id,action:'approved'}})).toBe(1)
})
