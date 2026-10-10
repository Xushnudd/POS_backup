import { test, expect } from '@playwright/test'
import { PrismaClient } from '@prisma/client'
import { randomUUID } from 'node:crypto'
import bcrypt from 'bcryptjs'
const connection=new URL(process.env.DATABASE_URL??'')
if(connection.hostname!=='127.0.0.1'||connection.port!=='55439'||connection.pathname!=='/pos_test')throw new Error('Isolated browser DB only')
const db=new PrismaClient(),orgs:string[]=[],users:string[]=[]
const origin={Origin:'https://localhost:3100'}
test.afterAll(async()=>{await db.organization.deleteMany({where:{id:{in:orgs}}});await db.user.deleteMany({where:{id:{in:users}}});await db.$disconnect()})
async function owner(page:import('@playwright/test').Page){
 const response=await page.request.post('/api/auth/register',{headers:origin,data:{fullName:'Original receipt cashier',phone:'receipt-'+randomUUID(),password:'test-only-password',organizationName:'Original receipt organization'}})
 expect(response.ok()).toBe(true);const me=(await(await page.request.get('/api/auth/me')).json()).data;orgs.push(me.organization.id);users.push(me.user.id)
 const store=await db.store.findFirstOrThrow({where:{organizationId:me.organization.id}}),register=await db.register.findFirstOrThrow({where:{storeId:store.id}}),member=await db.organizationUser.findFirstOrThrow({where:{organizationId:me.organization.id,userId:me.user.id}})
 return {me,store,register,member}
}
test('Production HTTP role decisions deny privileged mutations and revoke a live cashier without economic effects',async({page,browser})=>{
 const f=await owner(page)
 expect((await page.request.get(`/api/organizations/${f.me.organization.id}/users`)).status()).toBe(200)
 const hash=await bcrypt.hash('test-only-password',10)
 for(const role of ['admin','cashier']){
  const user=await db.user.create({data:{fullName:'Role actor',phone:role+'-'+randomUUID(),passwordHash:hash}});users.push(user.id)
  const member=await db.organizationUser.create({data:{organizationId:f.me.organization.id,userId:user.id,role,userStores:{create:{storeId:f.store.id}}}})
  const context=await browser.newContext({baseURL:'https://localhost:3100',ignoreHTTPSErrors:true})
  try{
   expect((await context.request.post('/api/auth/login',{headers:origin,data:{phone:user.phone,password:'test-only-password'}})).status()).toBe(200)
   expect((await context.request.get('/api/products?organizationId='+f.me.organization.id)).status()).toBe(200)
   expect((await context.request.get(`/api/organizations/${f.me.organization.id}/users`)).status()).toBe(403)
   if(role==='cashier'){
    expect((await context.request.post('/api/categories',{headers:origin,data:{organizationId:f.me.organization.id,name:'Forbidden category'}})).status()).toBe(403)
    expect((await context.request.get('/api/reports/profit?organizationId='+f.me.organization.id)).status()).toBe(403)
   }
   await db.organizationUser.update({where:{id:member.id},data:{isActive:false}})
   expect((await context.request.get('/api/products?organizationId='+f.me.organization.id)).status()).toBe(401)
  }finally{await context.close()}
 }
 expect(await db.category.count({where:{organizationId:f.me.organization.id,name:'Forbidden category'}})).toBe(0)
 expect(await db.sale.count({where:{organizationId:f.me.organization.id}})).toBe(0)
})
test('58 and 80mm copies retain original organization, branch, cashier and footer after all live identities change',async({page})=>{
 // Exercise the real rendered receipt and HTTP audit boundary; native OS print
 // dialogs/hardware are outside this browser test and otherwise block Firefox.
 await page.addInitScript(()=>{window.print=()=>{}})
 const f=await owner(page)
 await db.store.update({where:{id:f.store.id},data:{name:'Original receipt branch',address:'Original receipt address'}})
 await db.organization.update({where:{id:f.me.organization.id},data:{receiptFooter:'Original receipt footer'}})
 const shift=await db.shift.create({data:{registerId:f.register.id,organizationUserId:f.member.id,openingCash:0}})
 const product=await db.product.create({data:{organizationId:f.me.organization.id,name:'Receipt snapshot item',sku:randomUUID(),barcode:randomUUID(),unit:'dona',salePrice:'23.50',costPrice:'1.00'}})
 await db.inventoryBalance.create({data:{storeId:f.store.id,productId:product.id,quantity:2}})
 const draftResponse=await page.request.post('/api/sales',{headers:origin,data:{operationId:randomUUID(),organizationId:f.me.organization.id,storeId:f.store.id,registerId:f.register.id,shiftId:shift.id,items:[{productId:product.id,quantity:1}]}});expect(draftResponse.ok()).toBe(true)
 const sale=(await draftResponse.json()).data
 const completed=await page.request.post(`/api/sales/${sale.id}/complete`,{headers:origin,data:{operationId:randomUUID(),payments:[{paymentType:'cash',amount:'23.50'}]}});expect(completed.ok()).toBe(true)
 await db.organization.update({where:{id:f.me.organization.id},data:{name:'Changed organization',receiptFooter:'Changed footer',timezone:'UTC'}})
 await db.store.update({where:{id:f.store.id},data:{name:'Changed branch',address:'Changed address'}})
 await db.user.update({where:{id:f.me.user.id},data:{fullName:'Changed cashier'}})
 await page.goto(`/sales/${sale.id}`);await page.getByRole('button',{name:'Chekni chop etish',exact:true}).click()
 const receipt=page.locator('#printable-receipt')
 for(const text of ['Original receipt organization','Original receipt branch','Original receipt address','Original receipt cashier','Original receipt footer','23.50','CHEK NUSXASI'])await expect(receipt).toContainText(text)
 await expect(receipt).not.toContainText('Changed')
 for(const width of ['58','80']){
  await page.getByLabel('Chek qog‘ozi eni',{exact:true}).selectOption(width)
  await page.getByRole('dialog').getByRole('button',{name:'Chekni chop etish',exact:true}).click()
  const frame=page.locator('iframe[title="Chek chop etish"]').last();await expect(frame).toBeAttached()
  await expect(frame).toHaveAttribute('srcdoc',new RegExp(`size:${width}mm`))
  const html=await frame.getAttribute('srcdoc');expect(html).toContain(`size:${width}mm`);expect(html).toContain('Original receipt organization');expect(html).not.toContain('Changed organization')
 }
 expect(await db.sale.count({where:{organizationId:f.me.organization.id,status:'completed'}})).toBe(1)
 expect(await db.payment.count({where:{organizationId:f.me.organization.id}})).toBe(1)
})
