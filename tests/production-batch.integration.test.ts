import { test, after } from 'node:test'
import assert from 'node:assert/strict'
import { randomUUID } from 'node:crypto'
import { NextRequest } from 'next/server'
import { prisma } from '@/lib/prisma'
import { POST as register } from '@/app/api/auth/register/route'
import { GET as products } from '@/app/api/products/route'
import { GET as customers } from '@/app/api/customers/route'
import { GET as salesReport } from '@/app/api/reports/sales/route'
import { GET as productReport } from '@/app/api/reports/products/route'
import { consumeLimit, clearLimit } from '@/server/auth/rate-limit'
const connection=new URL(process.env.DATABASE_URL??'')
if(connection.hostname!=='127.0.0.1'||connection.pathname!=='/pos_test'||connection.port!=='55439'||connection.username!=='pos_test')throw new Error('Isolated test DB required')
const orgs:string[]=[],users:string[]=[],phones:string[]=[]
function req(path:string,cookie='',body?:unknown){return new NextRequest('http://localhost:3000/api'+path,{method:body?'POST':'GET',headers:{cookie,origin:'http://localhost:3000','content-type':'application/json'},...(body?{body:JSON.stringify(body)}:{})})}
after(async()=>{await prisma.organization.deleteMany({where:{id:{in:orgs}}});await prisma.user.deleteMany({where:{id:{in:users}}});for(const phone of phones)await clearLimit('register-account',phone);await prisma.$disconnect()})
async function account(){
 const phone='batch-'+randomUUID();phones.push(phone)
 const response=await register(req('/auth/register','',{phone,password:'test-only-password',fullName:'Batch Owner',organizationName:'Batch POS'}),undefined)
 assert.equal(response.status,200);const data=(await response.json()).data;orgs.push(data.organization.id);users.push(data.user.id)
 const store=await prisma.store.findFirstOrThrow({where:{organizationId:data.organization.id}}),registerRow=await prisma.register.findFirstOrThrow({where:{storeId:store.id}})
 return {data,store,registerRow,cookie:response.headers.get('set-cookie')!.split(';')[0]}
}
test('Registration budgets reject before creating a business and new passwords cannot truncate',async()=>{
 const phone='limited-'+randomUUID();phones.push(phone)
 const body={phone,password:'test-only-password',fullName:'Limited',organizationName:'Not created'}
 for(let index=0;index<5;index++)await consumeLimit('register-account',phone,5,15*60*1000)
 const response=await register(req('/auth/register','',body),undefined);assert.equal(response.status,429);assert.ok(Number(response.headers.get('Retry-After'))>0)
 assert.equal(await prisma.user.count({where:{phone}}),0)
 const invalid=await register(req('/auth/register','',{...body,phone:'unicode-'+randomUUID(),password:'я'.repeat(40)}),undefined)
 assert.equal(invalid.status,400)
 const originalProxy=process.env.TRUST_PROXY_IP,ipPhone='ip-limited-'+randomUUID();phones.push(ipPhone)
 try{
  process.env.TRUST_PROXY_IP='true'
  for(let index=0;index<30;index++)await consumeLimit('register-ip','unknown',30,15*60*1000)
  assert.equal((await register(req('/auth/register','',{...body,phone:ipPhone}),undefined)).status,429)
  assert.equal(await prisma.user.count({where:{phone:ipPhone}}),0)
 }finally{if(originalProxy===undefined)delete process.env.TRUST_PROXY_IP;else process.env.TRUST_PROXY_IP=originalProxy;await clearLimit('register-ip','unknown')}
})
test('Staff and invitation account entrypoints enforce the shared Unicode password boundary',async()=>{
 const {POST:staff}=await import('@/app/api/organizations/[id]/users/route')
 const {POST:accept}=await import('@/app/api/auth/invitations/accept/route')
 const a=await account(),phone='staff-unicode-'+randomUUID()
 const staffResponse=await staff(req(`/organizations/${a.data.organization.id}/users`,a.cookie,{fullName:'Unicode staff',phone,password:'я'.repeat(40),role:'cashier',storeIds:[a.store.id]}),{params:Promise.resolve({id:a.data.organization.id})})
 assert.equal(staffResponse.status,400);assert.equal(await prisma.user.count({where:{phone}}),0)
 const inviteResponse=await accept(req('/auth/invitations/accept','',{token:'a'.repeat(43),password:'я'.repeat(40),fullName:'Unicode staff'}),undefined)
 assert.equal(inviteResponse.status,400)
})
test('Audit DB guard rejects updates/deletes, supports actor anonymization and tenant cascade',async()=>{
 const a=await account(),actor=await prisma.user.create({data:{phone:randomUUID(),fullName:'Deleted actor',passwordHash:'not-login'}});users.push(actor.id)
 const row=await prisma.auditLog.create({data:{organizationId:a.data.organization.id,actorId:actor.id,entityType:'Test',entityId:randomUUID(),action:'recorded'}})
 await assert.rejects(()=>prisma.auditLog.update({where:{id:row.id},data:{action:'rewritten'}}))
 await assert.rejects(()=>prisma.auditLog.delete({where:{id:row.id}}))
 await assert.rejects(()=>prisma.auditLog.update({where:{id:row.id},data:{actorId:null}}))
 await prisma.user.delete({where:{id:actor.id}})
 assert.equal((await prisma.auditLog.findUniqueOrThrow({where:{id:row.id}})).actorId,null)
 await prisma.organization.delete({where:{id:a.data.organization.id}})
 assert.equal(await prisma.auditLog.count({where:{id:row.id}}),0)
})
test('Full catalog/customer/report CSV exports ignore UI pagination, protect formulas and preserve scope/money',async()=>{
 const a=await account(),b=await account(),org=a.data.organization.id
 const shift=await prisma.shift.create({data:{registerId:a.registerRow.id,organizationUserId:a.data.user.organizationUserId,openingCash:0}})
 const ids=Array.from({length:55},()=>randomUUID())
 await prisma.product.createMany({data:ids.map((id,index)=>({id,organizationId:org,name:index===0?'=EXPORT,"quoted"':'EXPORT '+index,sku:'EXPORT-'+index,barcode:'CODE-'+index,unit:'dona',salePrice:1,costPrice:0.5}))})
 await prisma.product.create({data:{organizationId:org,name:'EXPORT archived',sku:'ARCHIVED',barcode:'ARCHIVED',unit:'dona',salePrice:1,costPrice:0,isActive:false}})
 const customerIds=Array.from({length:55},()=>randomUUID())
 await prisma.customer.createMany({data:customerIds.map((id,index)=>({id,organizationId:org,fullName:index===0?'=EXPORT CUSTOMER':'EXPORT CUSTOMER '+index,phone:'test-'+index,creditLimit:100}))})
 await prisma.debtEntry.create({data:{organizationId:org,customerId:customerIds[0],sourceType:'opening_debt',sourceId:randomUUID(),amount:12.25}})
 const common={organizationId:org,storeId:a.store.id,registerId:a.registerRow.id,shiftId:shift.id,cashierId:a.data.user.id,status:'draft',subtotal:1,totalAmount:1}
 for(let index=0;index<55;index++){const posted=await prisma.sale.create({data:{...common,receiptNo:index===0?'=EXPORT RECEIPT':'EXPORT-'+index,completedAt:new Date('2026-01-02T12:00:00Z'),items:{create:{productId:ids[index],productName:'Frozen',sku:'FROZEN',unit:'dona',quantity:1,unitPrice:1,lineTotal:1,unitCost:0.5}}}});await prisma.sale.update({where:{id:posted.id},data:{status:'completed'}})}
 const old=await prisma.sale.create({data:{...common,receiptNo:'OUTSIDE-PERIOD',completedAt:new Date('2026-01-01T12:00:00Z'),items:{create:{productId:ids[0],productName:'Frozen',sku:'FROZEN',unit:'dona',quantity:1,unitPrice:1,lineTotal:1,unitCost:0.5}}},include:{items:true}})
 await prisma.sale.update({where:{id:old.id},data:{status:'completed'}})
 await prisma.saleReturn.create({data:{saleId:old.id,returnReceiptNo:'RETURN-IN-PERIOD',refundAmount:1,processedBy:a.data.user.id,returnedAt:new Date('2026-01-02T13:00:00Z'),items:{create:{saleItemId:old.items[0].id,productId:ids[0],quantity:1,unitPrice:1,lineTotal:1,disposition:'damaged'}}}})
 const call=async(route:typeof products,path:string,cookie=a.cookie)=>{const response=await route(req(path,cookie),undefined);assert.equal(response.status,200);return (await response.json()).data.content as string}
 const catalog=await call(products,`/products?organizationId=${org}&format=csv&search=EXPORT&limit=1&page=2`)
 assert.equal((catalog.match(/^"[0-9a-f-]{36}",/gm)??[]).length,55);assert.ok(catalog.includes("\"'=EXPORT,"));assert.ok(catalog.includes('""quoted""'));assert.ok(!catalog.includes('archived'));assert.ok(catalog.includes('"0.500000"'))
 const customerCsv=await call(customers,`/customers?organizationId=${org}&format=csv&search=EXPORT&limit=1`)
 assert.equal((customerCsv.match(/^"[0-9a-f-]{36}",/gm)??[]).length,55);assert.ok(customerCsv.includes("'=EXPORT CUSTOMER"));assert.ok(customerCsv.includes('"12.25"'))
 const query=`?organizationId=${org}&format=csv&startDate=2026-01-02&endDate=2026-01-02&limit=1`
 const saleCsv=await call(salesReport,'/reports/sales'+query)
 assert.equal((saleCsv.match(/^"sale",/gm)??[]).length,55);assert.equal((saleCsv.match(/^"return",/gm)??[]).length,1);assert.ok(saleCsv.includes('"Sof tovar tushumi","54.00"'));assert.ok(saleCsv.includes("'=EXPORT RECEIPT"))
 const productCsv=await call(productReport,'/reports/products'+query)
 assert.equal((productCsv.match(/^"[0-9a-f-]{36}",/gm)??[]).length,55);assert.ok(productCsv.includes('"0.500000"'))
 assert.equal((await products(req(`/products?organizationId=${org}&format=csv`,b.cookie),undefined)).status,403)
 await prisma.organizationUser.update({where:{id:a.data.user.organizationUserId},data:{role:'admin'}})
 const hiddenStore=await prisma.store.create({data:{organizationId:org,name:'Hidden branch'}})
 const hiddenRegister=await prisma.register.create({data:{storeId:hiddenStore.id,name:'Hidden till',code:'HIDDEN'}})
 const hiddenShift=await prisma.shift.create({data:{registerId:hiddenRegister.id,organizationUserId:a.data.user.organizationUserId,openingCash:0}})
 await prisma.sale.create({data:{...common,storeId:hiddenStore.id,registerId:hiddenRegister.id,shiftId:hiddenShift.id,receiptNo:'HIDDEN-RECEIPT',completedAt:new Date('2026-01-02T12:00:00Z'),items:{create:{productId:ids[0],productName:'Frozen',sku:'FROZEN',unit:'dona',quantity:1,unitPrice:1,lineTotal:1,unitCost:0.5}}}})
 const adminSales=await call(salesReport,'/reports/sales'+query);assert.ok(!adminSales.includes('HIDDEN-RECEIPT'));assert.equal((adminSales.match(/^"sale",/gm)??[]).length,55)
 const adminProducts=await call(productReport,'/reports/products'+query);assert.equal(adminProducts,productCsv)
 assert.equal((await customers(req(`/customers?organizationId=${org}&format=csv`,a.cookie),undefined)).status,403)
 assert.equal((await productReport(req('/reports/products'+query+`&storeId=${b.store.id}`,a.cookie),undefined)).status,404)
 await prisma.organizationUser.update({where:{id:a.data.user.organizationUserId},data:{role:'cashier'}})
 assert.equal((await products(req(`/products?organizationId=${org}&format=csv`,a.cookie),undefined)).status,403)
 assert.equal((await salesReport(req('/reports/sales'+query,a.cookie),undefined)).status,403)
})
test('Catalog/customer exports enforce the full-result cap before returning a partial file',async()=>{
 const a=await account(),org=a.data.organization.id
 await prisma.product.createMany({data:Array.from({length:10001},(_,index)=>({organizationId:org,name:'Cap '+index,sku:'CAP-'+index,barcode:'CAP-'+index,unit:'dona',salePrice:0,costPrice:0}))})
 await prisma.customer.createMany({data:Array.from({length:10001},(_,index)=>({organizationId:org,fullName:'Cap '+index,phone:'CAP-'+index}))})
 const shift=await prisma.shift.create({data:{registerId:a.registerRow.id,organizationUserId:a.data.user.organizationUserId,openingCash:0}})
 const product=await prisma.product.findFirstOrThrow({where:{organizationId:org}})
 const saleIds=Array.from({length:10001},()=>randomUUID())
 await prisma.sale.createMany({data:saleIds.map((id,index)=>({id,organizationId:org,storeId:a.store.id,registerId:a.registerRow.id,shiftId:shift.id,cashierId:a.data.user.id,receiptNo:'CAP-'+index,status:'draft',subtotal:0,totalAmount:0,completedAt:new Date('2026-01-02T12:00:00Z')}))})
 const productRows=await prisma.product.findMany({where:{organizationId:org},select:{id:true},orderBy:{id:'asc'}})
 await prisma.saleItem.createMany({data:saleIds.map((saleId,index)=>({saleId,productId:productRows[index]?.id??product.id,productName:'Cap',sku:'CAP',quantity:1,unitPrice:0,lineTotal:0,unitCost:0}))})
 await prisma.sale.updateMany({where:{id:{in:saleIds}},data:{status:'completed'}})
 for(const [route,path] of [[products,'/products'],[customers,'/customers']] as const){
  const response=await route(req(`${path}?organizationId=${org}&format=csv&limit=1`,a.cookie),undefined);assert.equal(response.status,413);assert.equal((await response.json()).error.code,'EXPORT_TOO_LARGE')
 }
 for(const [route,path] of [[salesReport,'/reports/sales'],[productReport,'/reports/products']] as const){
  const response=await route(req(`${path}?organizationId=${org}&format=csv&limit=1`,a.cookie),undefined);assert.equal(response.status,413);assert.equal((await response.json()).error.code,'EXPORT_TOO_LARGE')
 }
})
