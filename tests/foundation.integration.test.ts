import { test, after } from 'node:test'
import assert from 'node:assert/strict'
import { randomUUID } from 'node:crypto'
import { NextRequest } from 'next/server'
import { prisma } from '@/lib/prisma'
import { POST as register } from '@/app/api/auth/register/route'
import { GET as products } from '@/app/api/products/route'
import { POST as transfer } from '@/app/api/transfers/route'
import { PUT as editSale } from '@/app/api/sales/[id]/route'
import { GET as report } from '@/app/api/reports/sales/route'
import { POST as cancelIntent } from '@/app/api/operations/cancel/route'
import { POST as logout } from '@/app/api/auth/logout/route'

const url=process.env.DATABASE_URL ?? ''
if (!url.includes('/pos_test') || !['127.0.0.1','localhost'].includes(new URL(url).hostname)) throw new Error('Integration tests require an isolated localhost pos_test database')
const orgs:string[]=[];const users:string[]=[]
after(async()=>{
  await prisma.organization.deleteMany({where:{id:{in:orgs}}})
  await prisma.user.deleteMany({where:{id:{in:users}}})
  await prisma.$disconnect()
})
function req(path:string,cookie='',body?:unknown,method='GET') {
  return new NextRequest(`http://localhost:3000/api${path}`, {method,headers:{cookie,'content-type':'application/json',origin:'http://localhost:3000'},...(body!==undefined && {body:JSON.stringify(body)})})
}
async function account() {
 const r=await register(req('/auth/register','',{fullName:'Test Owner',phone:'test-'+randomUUID(),password:'test-only-password',organizationName:'Isolated Test'},'POST'),undefined)
 assert.equal(r.status,200); const data=(await r.json()).data
 orgs.push(data.organization.id);users.push(data.user.id)
 assert.equal(data.role,'owner');assert.ok(data.user.organizationUserId)
 assert.equal(data.token,'cookie-session');assert.match(r.headers.get('set-cookie')??'',/HttpOnly/i)
 const cookie=r.headers.get('set-cookie')!.split(';')[0]
 const store=await prisma.store.findFirstOrThrow({where:{organizationId:data.organization.id}})
 const registerRow=await prisma.register.findFirstOrThrow({where:{storeId:store.id}})
 return {data,cookie,store,register:registerRow}
}
test('Tenant API, draft edits, nested transfer, global totals, revoke and constraints',async()=>{
 const a=await account(),b=await account()
 const product=await prisma.product.create({data:{organizationId:a.data.organization.id,name:'P',sku:'SKU',barcode:'BAR',unit:'dona',salePrice:100,costPrice:50}})
 await prisma.product.create({data:{organizationId:b.data.organization.id,name:'P',sku:'SKU',barcode:'BAR',unit:'dona',salePrice:100,costPrice:50}})
 await assert.rejects(()=>prisma.product.create({data:{organizationId:a.data.organization.id,name:'P',sku:'SKU',barcode:'OTHER',unit:'dona',salePrice:100,costPrice:50}}))
 const cross=await products(req(`/products?organizationId=${b.data.organization.id}`,a.cookie),undefined)
 assert.equal(cross.status,403)
 const own=await products(req(`/products?organizationId=${a.data.organization.id}`,a.cookie),undefined)
 assert.equal(own.status,200);assert.equal((await own.json()).data.length,1)
 const destination=await prisma.store.create({data:{organizationId:a.data.organization.id,name:'Destination'}})
 const tr=await transfer(req('/transfers',a.cookie,{organizationId:a.data.organization.id,fromStoreId:a.store.id,toStoreId:destination.id,items:[{productId:product.id,quantity:2,unitCost:50}]},'POST'),undefined)
 assert.equal(tr.status,200);assert.equal((await tr.json()).data.items.length,1)
 const shift=await prisma.shift.create({data:{registerId:a.register.id,organizationUserId:a.data.user.organizationUserId,openingCash:0}})
 await assert.rejects(()=>prisma.shift.create({data:{registerId:a.register.id,organizationUserId:a.data.user.organizationUserId,openingCash:0}}))
 const sale=await prisma.sale.create({data:{organizationId:a.data.organization.id,storeId:a.store.id,registerId:a.register.id,shiftId:shift.id,cashierId:a.data.user.id,receiptNo:randomUUID(),subtotal:100,discountAmount:10,totalAmount:90,items:{create:{productId:product.id,productName:'P',sku:'SKU',quantity:1,unitPrice:100,discountAmount:0,lineTotal:100,unitCost:50}}},include:{items:true}})
 const note=await editSale(req(`/sales/${sale.id}`,a.cookie,{note:'Only note'},'PUT'),{params:Promise.resolve({id:sale.id})})
 assert.equal(note.status,200);const afterNote=(await note.json()).data
 assert.equal(afterNote.items[0].id,sale.items[0].id);assert.equal(afterNote.totalAmount,'90')
 const zero=await editSale(req(`/sales/${sale.id}`,a.cookie,{discountAmount:0},'PUT'),{params:Promise.resolve({id:sale.id})})
 assert.equal(zero.status,200);assert.equal((await zero.json()).data.totalAmount,'100')
 await prisma.sale.update({where:{id:sale.id},data:{status:'completed',completedAt:new Date()}})
 await prisma.sale.create({data:{organizationId:a.data.organization.id,storeId:a.store.id,registerId:a.register.id,shiftId:shift.id,cashierId:a.data.user.id,receiptNo:randomUUID(),status:'completed',completedAt:new Date(),subtotal:200,totalAmount:200}})
 const reportResponse=await report(req(`/reports/sales?organizationId=${a.data.organization.id}&limit=1`,a.cookie),undefined)
 assert.equal(reportResponse.status,200);const result=await reportResponse.json()
 assert.equal(result.data.length,1);assert.equal(result.summary.totalRevenue,'300');assert.equal(result.summary.averageSale,'150')
 const csrf=await products(new NextRequest('http://localhost:3000/api/products',{method:'GET',headers:{cookie:a.cookie}}),undefined)
 assert.equal(csrf.status,400) // Existing contract still requires organizationId.
 const cancelKey=randomUUID()
 const intent={organizationId:a.data.organization.id,storeId:a.store.id,registerId:a.register.id,shiftId:shift.id,cashierId:a.data.user.id,items:[{productId:randomUUID(),quantity:1,unitPrice:100}]}
 const cancelled=await cancelIntent(req('/operations/cancel',a.cookie,{operationId:cancelKey,payload:intent},'POST'),undefined)
 assert.equal(cancelled.status,200);assert.equal((await cancelled.json()).data.state,'cancelled')
 const foreignCancel=await cancelIntent(req('/operations/cancel',a.cookie,{operationId:randomUUID(),payload:{...intent,organizationId:b.data.organization.id}},'POST'),undefined)
 assert.equal(foreignCancel.status,403)
 const badLogout=await logout(new NextRequest('http://localhost:3000/api/auth/logout',{method:'POST',headers:{cookie:a.cookie,origin:'https://attacker.invalid','content-type':'application/json'},body:'{}'}),undefined)
 assert.equal(badLogout.status,403)
 assert.equal((await logout(req('/auth/logout',a.cookie,{},'POST'),undefined)).status,200)
 assert.equal((await products(req(`/products?organizationId=${a.data.organization.id}`,a.cookie),undefined)).status,401)
 const repeatedLogout=await logout(req('/auth/logout',a.cookie,{},'POST'),undefined)
 assert.equal(repeatedLogout.status,200);assert.match(repeatedLogout.headers.get('set-cookie')??'',/Max-Age=0/i)
})
