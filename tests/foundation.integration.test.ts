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

test('Debt allocation targets paginate positive scoped balances and require owner access',async()=>{
 const a=await account(),b=await account()
 const customer=await prisma.customer.create({data:{organizationId:a.data.organization.id,fullName:'Targets customer',phone:randomUUID()}})
 const shift=await prisma.shift.create({data:{registerId:a.register.id,organizationUserId:a.data.user.organizationUserId,openingCash:0}})
 const sales=Array.from({length:52},(_,index)=>({id:randomUUID(),organizationId:a.data.organization.id,storeId:a.store.id,registerId:a.register.id,shiftId:shift.id,cashierId:a.data.user.id,customerId:customer.id,receiptNo:'TARGET-'+index,subtotal:10,totalAmount:10,status:'completed' as const}))
 await prisma.sale.createMany({data:sales})
 await prisma.debtEntry.createMany({data:sales.map((sale,index)=>({organizationId:a.data.organization.id,customerId:customer.id,saleId:sale.id,sourceType:'sale',sourceId:sale.id,amount:10,effectiveAt:new Date(2026,0,1,index)}))})
 await prisma.debtEntry.create({data:{organizationId:a.data.organization.id,customerId:customer.id,saleId:sales[0].id,sourceType:'collection',sourceId:randomUUID(),amount:-10}})
 await prisma.debtEntry.create({data:{organizationId:a.data.organization.id,customerId:customer.id,sourceType:'opening_debt',sourceId:randomUUID(),amount:3.75}})
 const {GET:debt}=await import('@/app/api/customers/[id]/debt/route')
 const {GET:ledger}=await import('@/app/api/customers/[id]/ledger/route')
 const exportCall=(cookie:string)=>ledger(req(`/customers/${customer.id}/ledger?format=csv`,cookie),{params:Promise.resolve({id:customer.id})})
 const exported=await exportCall(a.cookie);assert.equal(exported.status,200)
 const csv=(await exported.json()).data.content as string
 assert.ok(csv.startsWith('\uFEFF'));assert.ok(csv.includes('513.75'))
 for(const sale of sales)assert.ok(csv.includes(sale.receiptNo))
 assert.equal(exported.headers.get('Cache-Control'),'private, no-store')
 assert.equal((await exportCall(b.cookie)).status,404)
 const call=(cookie:string,page:string)=>debt(req(`/customers/${customer.id}/debt?targetsPage=${page}`,cookie),{params:Promise.resolve({id:customer.id})})
 const first=await call(a.cookie,'1');assert.equal(first.status,200)
 const one=(await first.json()).data.allocationTargets
 assert.equal(one.items.length,50);assert.equal(one.hasMore,true)
 assert.ok(one.items.every((item:{saleId:string})=>item.saleId!==sales[0].id))
 const second=await call(a.cookie,'2');assert.equal(second.status,200)
 const two=(await second.json()).data.allocationTargets
 assert.equal(two.items.length,2);assert.equal(two.hasMore,false)
 assert.equal(two.items.find((item:{saleId:string|null})=>item.saleId===null).balance,'3.75')
 assert.equal((await call(a.cookie,'0')).status,400)
 assert.equal((await call(b.cookie,'1')).status,404)
 await prisma.organizationUser.update({where:{id:a.data.user.organizationUserId},data:{role:'admin'}})
 assert.equal((await call(a.cookie,'1')).status,403)
 assert.equal((await exportCall(a.cookie)).status,403)
})
