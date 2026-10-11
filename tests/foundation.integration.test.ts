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

const connection=new URL(process.env.DATABASE_URL??'')
if (connection.pathname!=='/pos_test' || connection.hostname!=='127.0.0.1' || connection.port!=='55439' || connection.username!=='pos_test') throw new Error('Integration tests require an isolated localhost pos_test database')
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
 const {GET:saleList}=await import('@/app/api/sales/route')
 const cashSale=await prisma.sale.create({data:{...sales[0],id:randomUUID(),receiptNo:'CASH-ONLY'}})
 await prisma.payment.create({data:{organizationId:a.data.organization.id,storeId:a.store.id,shiftId:shift.id,saleId:cashSale.id,customerId:customer.id,paymentType:'cash',direction:'in',amount:10,receivedBy:a.data.user.id}})
 const otherCustomer=await prisma.customer.create({data:{organizationId:a.data.organization.id,fullName:'Unrelated',phone:randomUUID()}})
 await prisma.sale.create({data:{...sales[0],id:randomUUID(),receiptNo:'UNRELATED',customerId:otherCustomer.id}})
 const listed=await saleList(req(`/sales?organizationId=${a.data.organization.id}&customerId=${customer.id}&limit=20`,a.cookie),undefined)
 assert.equal(listed.status,200)
 const history=await listed.json();assert.equal(history.pagination.total,53);assert.equal(history.data.length,20)
 assert.ok(history.data.some((sale:{id:string;payments:{paymentType:string}[]})=>sale.id===cashSale.id&&sale.payments.some(payment=>payment.paymentType==='cash')))
 assert.ok(history.data.every((sale:{customerId:string;saleReturns:unknown[]})=>sale.customerId===customer.id&&Array.isArray(sale.saleReturns)))
 const foreignHistory=await saleList(req(`/sales?organizationId=${b.data.organization.id}&customerId=${customer.id}`,b.cookie),undefined)
 assert.equal(foreignHistory.status,404)
 const {GET:debt}=await import('@/app/api/customers/[id]/debt/route')
 const {GET:ledger}=await import('@/app/api/customers/[id]/ledger/route')
 const exportCall=(cookie:string)=>ledger(req(`/customers/${customer.id}/ledger?format=csv`,cookie),{params:Promise.resolve({id:customer.id})})
 const exported=await exportCall(a.cookie);assert.equal(exported.status,200)
 const csv=(await exported.json()).data.content as string
 const printable=await ledger(req(`/customers/${customer.id}/ledger?format=html`,a.cookie),{params:Promise.resolve({id:customer.id})})
 assert.equal(printable.status,200)
 const html=(await printable.json()).data.content as string
 assert.equal((html.match(/data-entry-id=/g)??[]).length,54)
 assert.ok(html.includes('513.75'));assert.ok(html.includes('Content-Security-Policy'));assert.ok(!html.includes('<script'))
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

test('Return history is paginated, uses frozen item names and enforces sale scope',async()=>{
 const {GET:history}=await import('@/app/api/sales/[id]/returns/route')
 const a=await account(),b=await account()
 const register=await prisma.register.create({data:{storeId:a.store.id,name:'Till',code:randomUUID()}})
 const shift=await prisma.shift.create({data:{registerId:register.id,organizationUserId:a.data.user.organizationUserId,openingCash:0}})
 const product=await prisma.product.create({data:{organizationId:a.data.organization.id,name:'Changed catalog name',sku:randomUUID(),barcode:randomUUID(),unit:'dona',salePrice:1,costPrice:0}})
 const sale=await prisma.sale.create({data:{organizationId:a.data.organization.id,storeId:a.store.id,registerId:register.id,shiftId:shift.id,cashierId:a.data.user.id,receiptNo:randomUUID(),status:'draft',subtotal:21,totalAmount:21,items:{create:{productId:product.id,productName:'Frozen original name',sku:'ORIGINAL',unit:'dona',quantity:21,unitPrice:1,lineTotal:21,unitCost:0}}},include:{items:true}})
 for(let index=0;index<21;index++)await prisma.saleReturn.create({data:{saleId:sale.id,returnReceiptNo:'HISTORY-'+index,refundAmount:1,reason:'<script>Literal reason</script>',processedBy:a.data.user.id,returnedAt:new Date(2026,0,1,0,index),items:{create:{saleItemId:sale.items[0].id,productId:product.id,quantity:1,unitPrice:1,lineTotal:1,disposition:index%2?'damaged':'write_off'}}}})
 await prisma.sale.update({where:{id:sale.id},data:{status:'returned'}})
 const call=(cookie:string,query='')=>history(req(`/sales/${sale.id}/returns${query}`,cookie),{params:Promise.resolve({id:sale.id})})
 const first=await call(a.cookie,'?page=1&limit=20');assert.equal(first.status,200)
 const body=await first.json();assert.equal(body.pagination.total,21);assert.equal(body.data.length,20);assert.equal(body.data[0].returnReceiptNo,'HISTORY-20')
 assert.equal(body.data[0].items[0].saleItem.productName,'Frozen original name');assert.equal(body.data[0].items[0].disposition,'write_off');assert.equal(body.data[0].refundAmount,'1')
 assert.equal(body.data[0].processor.fullName,'Test Owner');assert.ok(!('passwordHash' in body.data[0].processor))
 const second=await (await call(a.cookie,'?page=2&limit=20')).json();assert.equal(second.data.length,1);assert.equal(second.data[0].returnReceiptNo,'HISTORY-0')
 assert.equal((await call(b.cookie)).status,404);assert.equal((await call(a.cookie,'?page=0')).status,400)
 await prisma.organizationUser.update({where:{id:a.data.user.organizationUserId},data:{role:'cashier'}})
 assert.equal((await call(a.cookie)).status,200)
 const other=await prisma.user.create({data:{fullName:'Other cashier',phone:randomUUID(),passwordHash:'not-a-login'}});users.push(other.id)
 await prisma.organizationUser.create({data:{organizationId:a.data.organization.id,userId:other.id,role:'cashier'}})
 await assert.rejects(()=>prisma.sale.update({where:{id:sale.id},data:{cashierId:other.id}}))
 const foreign=await prisma.sale.create({data:{organizationId:a.data.organization.id,storeId:a.store.id,registerId:register.id,shiftId:shift.id,cashierId:other.id,receiptNo:randomUUID(),status:'completed',subtotal:0,totalAmount:0}})
 assert.equal((await history(req(`/sales/${foreign.id}/returns`,a.cookie),{params:Promise.resolve({id:foreign.id})})).status,404)
})
test('Owner audit summary filters a timezone snapshot and omits sensitive payloads',async()=>{
 const {GET:read}=await import('@/app/api/audit/route')
 const {clearLimit}=await import('@/server/auth/rate-limit')
 const a=await account(),b=await account(),entityId=randomUUID()
 try{
  await prisma.organization.update({where:{id:a.data.organization.id},data:{timezone:'Asia/Tashkent'}})
  const common={organizationId:a.data.organization.id,actorId:a.data.user.id,entityType:'SaleReturn',entityId,action:'returned',afterData:{secret:'must-not-be-exposed',customerPhone:'private'},ipAddress:'127.0.0.1'}
  await prisma.auditLog.createMany({data:[{...common,createdAt:new Date('2026-01-01T18:59:59Z')},{...common,createdAt:new Date('2026-01-01T19:00:00Z')},{...common,createdAt:new Date('2026-01-02T18:59:59Z')},{...common,createdAt:new Date('2026-01-02T19:00:00Z')}]})
  const query=`/audit?view=summary&from=2026-01-02&to=2026-01-02&entityType=SaleReturn&entityId=${entityId}&actorId=${a.data.user.id}&action=returned&limit=1`
  const first=await read(req(query,a.cookie),undefined);assert.equal(first.status,200)
  const body=await first.json();assert.equal(body.pagination.total,2);assert.equal(body.data.length,1);assert.equal(body.data[0].createdAt,'2026-01-02T18:59:59.000Z');assert.equal(body.data[0].actor.fullName,'Test Owner')
  for(const field of ['afterData','beforeData','ipAddress','passwordHash'])assert.ok(!JSON.stringify(body).includes(field))
  const second=await (await read(req(query+'&page=2',a.cookie),undefined)).json();assert.equal(second.data[0].createdAt,'2026-01-01T19:00:00.000Z')
  const foreign=await (await read(req(query,b.cookie),undefined)).json();assert.equal(foreign.pagination.total,0)
  assert.equal((await read(req('/audit?view=summary&actorId=bad',a.cookie),undefined)).status,400)
  assert.equal((await read(req('/audit?view=summary&from=2026-02-30',a.cookie),undefined)).status,400)
  const legacy=await read(req(query.replace('view=summary&',''),a.cookie),undefined)
  assert.equal(legacy.status,200)
  const legacyBody=await legacy.json();assert.equal(legacyBody.pagination.total,2);assert.equal(legacyBody.data[0].afterData.customerPhone,'private');assert.ok(!('ipAddress' in legacyBody.data[0]));assert.ok(!('secret' in legacyBody.data[0].afterData))
  assert.equal((await read(req('/audit?view=raw',a.cookie),undefined)).status,400)
  assert.equal((await read(req('/audit?actorId=bad',a.cookie),undefined)).status,400)
  assert.equal((await read(req('/audit?page=2147483647&limit=200',a.cookie),undefined)).status,400)
  const versionId='retention-policy:initial-v1'
  await prisma.auditLog.create({data:{organizationId:a.data.organization.id,actorId:a.data.user.id,entityType:'RetentionPolicyVersion',entityId:versionId,action:'reviewed',beforeData:{secretHash:'OLD_SECRET_HASH'},afterData:{nested:[{sealedSecret:'SEALED_AUTH_SECRET',leaseToken:'WORKER_CAPABILITY',recoveryCodes:['RECOVERY_CAPABILITY'],version:1}]}}})
  const versionQuery='/audit?entityId='+encodeURIComponent(versionId)
  const versionResponse=await read(req(versionQuery,a.cookie),undefined);assert.equal(versionResponse.status,200)
  const versionBody=await versionResponse.json();assert.equal(versionBody.pagination.total,1);assert.equal(versionBody.data[0].entityId,versionId)
  assert.deepEqual(versionBody.data[0].beforeData,{});assert.deepEqual(versionBody.data[0].afterData,{nested:[{version:1}]})
  const outsider=await(await read(req(versionQuery,b.cookie),undefined)).json();assert.equal(outsider.pagination.total,0)
  for(const value of ['', ' '.repeat(2), 'x'.repeat(201), 'line\nbreak'])assert.equal((await read(req('/audit?entityId='+encodeURIComponent(value),a.cookie),undefined)).status,400)
  const injected=await(await read(req('/audit?entityId='+encodeURIComponent("' OR 1=1 --"),a.cookie),undefined)).json();assert.equal(injected.pagination.total,0)
  const {consumeLimit}=await import('@/server/auth/rate-limit')
  await clearLimit('audit.summary',a.data.organization.id+':'+a.data.user.id)
  for(let index=0;index<59;index++)await consumeLimit('audit.summary',a.data.organization.id+':'+a.data.user.id,60,60000)
  assert.equal((await read(req('/audit?view=summary',a.cookie),undefined)).status,200)
  const limited=await read(req('/audit',a.cookie),undefined);assert.equal(limited.status,429);assert.ok(Number(limited.headers.get('Retry-After'))>0)
  await prisma.organizationUser.update({where:{id:a.data.user.organizationUserId},data:{role:'admin'}})
  assert.equal((await read(req(query,a.cookie),undefined)).status,403)
  assert.equal((await read(req('/audit',a.cookie),undefined)).status,403)
  await prisma.organizationUser.update({where:{id:a.data.user.organizationUserId},data:{role:'cashier'}})
  assert.equal((await read(req(query,a.cookie),undefined)).status,403)
 }finally{for(const owner of [a,b])await clearLimit('audit.summary',owner.data.organization.id+':'+owner.data.user.id)}
})
test('Session management exposes only own live sessions and revokes another session exactly once',async()=>{
 const {GET:list,POST:revoke}=await import('@/app/api/auth/sessions/route')
 const {createSession,verifySession}=await import('@/server/auth/session')
 const {clearLimit}=await import('@/server/auth/rate-limit')
 const a=await account(),b=await account()
 try{
  const token=await prisma.$transaction(tx=>createSession(tx,a.data.user.id,a.data.organization.id))
  const other=await verifySession(token);assert.ok(other)
  const current=await verifySession(a.cookie.split('=')[1].split(';')[0]);assert.ok(current)
  await prisma.session.create({data:{userId:a.data.user.id,organizationId:a.data.organization.id,tokenHash:randomUUID(),expiresAt:new Date(0),idleExpiresAt:new Date(0)}})
  const response=await list(req('/auth/sessions?limit=1',a.cookie),undefined);assert.equal(response.status,200)
  const body=await response.json();assert.equal(body.pagination.total,2);assert.equal(body.data.length,1);assert.ok(!JSON.stringify(body).includes('tokenHash'))
  const all=(await (await list(req('/auth/sessions',a.cookie),undefined)).json()).data;assert.equal(all.filter((row:{current:boolean})=>row.current).length,1)
  assert.ok(all.every((row:{organizationId:string})=>row.organizationId===a.data.organization.id))
  const call=(cookie:string,id:string)=>revoke(req('/auth/sessions',cookie,{sessionId:id},'POST'),undefined)
  assert.equal((await call(b.cookie,other.sessionId)).status,404)
  assert.equal((await call(a.cookie,current.sessionId)).status,409)
  const results=await Promise.all([call(a.cookie,other.sessionId),call(a.cookie,other.sessionId)]);assert.ok(results.every(response=>response.status===200))
  assert.equal(await verifySession(token),null);assert.ok(await verifySession(a.cookie.split('=')[1].split(';')[0]))
  assert.equal(await prisma.auditLog.count({where:{organizationId:a.data.organization.id,entityId:other.sessionId,action:'session_revoked'}}),1)
  await prisma.organizationUser.update({where:{id:a.data.user.organizationUserId},data:{role:'cashier'}})
  assert.equal((await list(req('/auth/sessions',a.cookie),undefined)).status,200)
 }finally{for(const account of [a,b])for(const category of ['session.read','session.revoke'])await clearLimit(category,account.data.user.id)}
})
test('Password changes reject bad credentials and UTF-8 truncation; competing requests cannot overwrite',async()=>{
 const {POST:change}=await import('@/app/api/auth/change-password/route')
 const {verifyPassword}=await import('@/lib/auth')
 const {verifySession}=await import('@/server/auth/session')
 const {clearLimit}=await import('@/server/auth/rate-limit')
 const a=await account()
 const call=(currentPassword:string,newPassword:string)=>change(req('/auth/change-password',a.cookie,{currentPassword,newPassword},'POST'),undefined)
 try{
  assert.equal((await call('wrong','valid-new-password')).status,403)
  assert.equal((await call('test-only-password','я'.repeat(40))).status,400)
  const results=await Promise.all([call('test-only-password','new-password-one'),call('test-only-password','new-password-two')])
  assert.equal(results.filter(result=>result.status===200).length,1)
  assert.ok(results.filter(result=>result.status!==200).every(result=>[401,403,409].includes(result.status)))
  const winner=results[0].status===200?'new-password-one':'new-password-two'
  const user=await prisma.user.findUniqueOrThrow({where:{id:a.data.user.id}})
  assert.ok(await verifyPassword(winner,user.passwordHash));assert.equal(await verifyPassword('test-only-password',user.passwordHash),false)
  assert.equal(await verifySession(a.cookie.split('=')[1]),null)
  assert.equal(await prisma.session.count({where:{userId:user.id,revokedAt:null}}),0)
  assert.equal(await prisma.auditLog.count({where:{organizationId:a.data.organization.id,action:'password_changed'}}),1)
 }finally{await clearLimit('password-change',a.data.user.id)}
})
test('Customer exports share an atomic format/customer budget and expose a bounded retry delay',async()=>{
 const {GET:ledger}=await import('@/app/api/customers/[id]/ledger/route')
 const {clearLimit}=await import('@/server/auth/rate-limit')
 const a=await account(),b=await account()
 const customers=await Promise.all([0,1].map(index=>prisma.customer.create({data:{organizationId:a.data.organization.id,fullName:'Limit '+index,phone:randomUUID()}})))
 try{
  const formats=['csv','commercial-csv','html']
  const calls=Array.from({length:12},(_,index)=>{
   const id=customers[index%2].id
   return ledger(req(`/customers/${id}/ledger?format=${formats[index%3]}`,a.cookie),{params:Promise.resolve({id})})
  })
  const results=await Promise.all(calls)
  assert.equal(results.filter(response=>response.status===200).length,10)
  const limited=results.filter(response=>response.status===429)
  assert.equal(limited.length,2)
  for(const response of limited){
   const delay=Number(response.headers.get('Retry-After'))
   assert.ok(delay>=1&&delay<=60)
   assert.equal((await response.json()).error.code,'RATE_LIMITED')
  }
  const id=customers[0].id
  const normal=await ledger(req(`/customers/${id}/ledger`,a.cookie),{params:Promise.resolve({id})})
  assert.equal(normal.status,200)
  const otherCustomer=await prisma.customer.create({data:{organizationId:b.data.organization.id,fullName:'Other owner',phone:randomUUID()}})
  const independent=await ledger(req(`/customers/${otherCustomer.id}/ledger?format=csv`,b.cookie),{params:Promise.resolve({id:otherCustomer.id})})
  assert.equal(independent.status,200)
 }finally{
  for(const account of [a,b])for(const category of ['customer.export','customer.statement'])await clearLimit(category,account.data.organization.id+':'+account.data.user.id)
 }
})

test('Report endpoints share actor/tenant throttling and reconciliation has a tighter budget',async()=>{
 const {consumeLimit,clearLimit}=await import('@/server/auth/rate-limit')
 const {GET:dashboard}=await import('@/app/api/reports/dashboard/route')
 const {GET:productReport}=await import('@/app/api/reports/products/route')
 const {GET:reconciliation}=await import('@/app/api/reports/reconciliation/route')
 const a=await account(),b=await account()
 const identity=a.data.organization.id+':'+a.data.user.id
 try{
  for(let index=0;index<58;index++)await consumeLimit('report.read',identity,60,60000)
  const query=`?organizationId=${a.data.organization.id}`
  assert.equal((await report(req('/reports/sales'+query,a.cookie),undefined)).status,200)
  assert.equal((await productReport(req('/reports/products'+query,a.cookie),undefined)).status,200)
  const blocked=await dashboard(req('/reports/dashboard'+query,a.cookie),undefined)
  assert.equal(blocked.status,429);assert.ok(Number(blocked.headers.get('Retry-After'))>0)
  assert.equal((await reconciliation(req('/reports/reconciliation'+query+'&kind=inventory',a.cookie),undefined)).status,429)
  assert.equal((await dashboard(req(`/reports/dashboard?organizationId=${b.data.organization.id}`,b.cookie),undefined)).status,200)
  await clearLimit('report.read',identity)
  for(let index=0;index<9;index++)await consumeLimit('report.reconciliation',identity,10,60000)
  assert.equal((await reconciliation(req('/reports/reconciliation'+query+'&kind=inventory',a.cookie),undefined)).status,200)
  assert.equal((await reconciliation(req('/reports/reconciliation'+query+'&kind=sales',a.cookie),undefined)).status,429)
  await prisma.organizationUser.update({where:{id:a.data.user.organizationUserId},data:{role:'cashier'}})
  assert.equal((await dashboard(req('/reports/dashboard'+query,a.cookie),undefined)).status,403)
 }finally{
  for(const account of [a,b])for(const category of ['report.read','report.reconciliation'])await clearLimit(category,account.data.organization.id+':'+account.data.user.id)
 }
})

test('Sale HTTP contract rejects bad input, recovers original operation and rejects changed retry',async()=>{
 const {POST:create}=await import('@/app/api/sales/route')
 const {POST:complete}=await import('@/app/api/sales/[id]/complete/route')
 const {GET:operation}=await import('@/app/api/operations/route')
 const a=await account(),b=await account()
 const shift=await prisma.shift.create({data:{registerId:a.register.id,organizationUserId:a.data.user.organizationUserId,openingCash:0}})
 const product=await prisma.product.create({data:{organizationId:a.data.organization.id,name:'HTTP',sku:randomUUID(),barcode:randomUUID(),unit:'dona',salePrice:100,costPrice:50}})
 await prisma.inventoryBalance.create({data:{storeId:a.store.id,productId:product.id,quantity:1}})
 const base={organizationId:a.data.organization.id,storeId:a.store.id,registerId:a.register.id,shiftId:shift.id,items:[{productId:product.id,quantity:1}]}
 for(const [body,status] of [[{...base,items:[]},400],...[0,-1,'NaN','Infinity'].map(quantity=>[{...base,items:[{productId:product.id,quantity}]},400] as const),[{...base,discountAmount:101},409],[{...base,storeId:'bad-id'},400],[{...base,organizationId:b.data.organization.id},403]] as const){
  const response=await create(req('/sales',a.cookie,{...body,operationId:randomUUID()},'POST'),undefined)
  assert.equal(response.status,status);assert.ok(response.headers.get('x-request-id'))
 }
 assert.equal(await prisma.sale.count({where:{organizationId:a.data.organization.id}}),0)
 const key=randomUUID(),response=await create(req('/sales',a.cookie,{...base,operationId:key,cashierId:a.data.user.id,totalAmount:1,items:[{productId:product.id,quantity:1,unitPrice:1,unitCost:0,unit:'kg'}]},'POST'),undefined)
 assert.equal(response.status,200);const sale=(await response.json()).data
 assert.equal(sale.totalAmount,'100');assert.equal(sale.items[0].unitPrice,'100');assert.equal(sale.items[0].unitCost,'50');assert.equal(sale.items[0].unit,'dona');assert.equal(sale.cashierId,a.data.user.id)
 const call=(payments:unknown)=>complete(req(`/sales/${sale.id}/complete`,a.cookie,{operationId:sale.id,payments},'POST'),{params:Promise.resolve({id:sale.id})})
 assert.equal((await call([{paymentType:'cash',amount:'NaN'}])).status,400)
 assert.equal((await call([{paymentType:'cash',amount:99}])).status,400)
 assert.equal((await call([{paymentType:'cash',amount:100}])).status,200)
 const recovered=await operation(req(`/operations?organizationId=${a.data.organization.id}&operationId=${sale.id}&type=sale.complete`,a.cookie),undefined)
 assert.equal(recovered.status,200);assert.equal((await recovered.json()).data.result.id,sale.id)
 assert.equal((await call([{paymentType:'cash',amount:100}])).status,200)
 const conflict=await call([{paymentType:'cash',amount:99}]);assert.equal(conflict.status,409);assert.equal((await conflict.json()).error.code,'OPERATION_PAYLOAD_CONFLICT')
 assert.equal((await editSale(req(`/sales/${sale.id}`,a.cookie,{note:'Hidden edit'},'PUT'),{params:Promise.resolve({id:sale.id})})).status,400)
 assert.equal(await prisma.payment.count({where:{saleId:sale.id}}),1)
 assert.equal(await prisma.inventoryMovement.count({where:{sourceId:sale.id}}),1)
})
