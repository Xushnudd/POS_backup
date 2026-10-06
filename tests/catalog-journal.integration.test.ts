import { test,after } from 'node:test'
import assert from 'node:assert/strict'
import { randomUUID } from 'node:crypto'
import { NextRequest } from 'next/server'
import { prisma } from '@/lib/prisma'
import { POST as register } from '@/app/api/auth/register/route'
import { GET as products } from '@/app/api/products/route'
import { GET as customers } from '@/app/api/customers/route'
import { GET as categories } from '@/app/api/categories/route'
import { PUT as updateCustomer,DELETE as deleteCustomer } from '@/app/api/customers/[id]/route'
import { GET as suppliers,POST as createSupplier } from '@/app/api/suppliers/route'
import { PUT as updateSupplier } from '@/app/api/suppliers/[id]/route'
import { GET as movements } from '@/app/api/inventory/movements/route'
import { GET as shifts } from '@/app/api/shifts/route'
import { GET as audit } from '@/app/api/audit/route'
import { POST as print } from '@/app/api/sales/[id]/print-requests/route'
import { clearLimit,consumeLimit } from '@/server/auth/rate-limit'
const connection=new URL(process.env.DATABASE_URL??'')
if(connection.hostname!=='127.0.0.1'||connection.pathname!=='/pos_test'||connection.port!=='55439'||connection.username!=='pos_test')throw new Error('Isolated test DB required')
const orgs:string[]=[],users:string[]=[],phones:string[]=[]
function req(path:string,cookie='',body?:unknown,method=body?'POST':'GET'){return new NextRequest('http://localhost:3000/api'+path,{method,headers:{cookie,origin:'http://localhost:3000','content-type':'application/json'},...(body?{body:JSON.stringify(body)}:{})})}
const params=(id:string)=>({params:Promise.resolve({id})})
after(async()=>{await prisma.organization.deleteMany({where:{id:{in:orgs}}});await prisma.user.deleteMany({where:{id:{in:users}}});for(const phone of phones)await clearLimit('register-account',phone);await prisma.$disconnect()})
async function account(){const phone='journal-'+randomUUID();phones.push(phone);const response=await register(req('/auth/register','',{phone,password:'test-only-password',fullName:'Journal owner',organizationName:'Journal POS'}),undefined);assert.equal(response.status,200);const data=(await response.json()).data;orgs.push(data.organization.id);users.push(data.user.id);const store=await prisma.store.findFirstOrThrow({where:{organizationId:data.organization.id}}),terminal=await prisma.register.findFirstOrThrow({where:{storeId:store.id}});return {data,store,terminal,cookie:response.headers.get('set-cookie')!.split(';')[0],org:data.organization.id as string}}
async function fixture(){const a=await account();const product=await prisma.product.create({data:{organizationId:a.org,name:'=Journal product',sku:randomUUID(),barcode:randomUUID(),unit:'dona',salePrice:100,costPrice:'0.123456'}});const shift=await prisma.shift.create({data:{registerId:a.terminal.id,organizationUserId:a.data.user.organizationUserId,openingCash:12.25}});return {...a,product,shift}}
test('Archive filters are explicit, tenant-safe and cashier cannot read archive; zero/nonzero ledger balance controls both archive paths',async()=>{
 const a=await fixture(),b=await account();const customer=await prisma.customer.create({data:{organizationId:a.org,fullName:'Archive customer',phone:randomUUID(),creditLimit:100}})
 for(const amount of ['10.25','-10.25']){
  const entry=await prisma.debtEntry.create({data:{organizationId:a.org,customerId:customer.id,sourceType:'debt_adjustment',sourceId:randomUUID(),amount}})
  for(const method of ['PUT','DELETE']){const response=method==='PUT'?await updateCustomer(req(`/customers/${customer.id}`,a.cookie,{isActive:false},'PUT'),params(customer.id)):await deleteCustomer(req(`/customers/${customer.id}`,a.cookie,undefined,'DELETE'),params(customer.id));assert.equal(response.status,409);assert.equal((await response.json()).error.code,'CUSTOMER_HAS_BALANCE')}
  await prisma.debtEntry.create({data:{organizationId:a.org,customerId:customer.id,sourceType:'debt_adjustment',sourceId:randomUUID(),amount:entry.amount.negated()}})
 }
 assert.equal((await updateCustomer(req(`/customers/${customer.id}`,a.cookie,{isActive:false},'PUT'),params(customer.id))).status,200)
 assert.equal((await customers(req(`/customers?organizationId=${a.org}&status=archived`,a.cookie),undefined).then(r=>r.json())).data[0].id,customer.id)
 assert.equal((await customers(req(`/customers?organizationId=${a.org}`,a.cookie),undefined).then(r=>r.json())).data.length,0)
 assert.equal((await updateCustomer(req(`/customers/${customer.id}`,a.cookie,{isActive:true},'PUT'),params(customer.id))).status,200)
 await prisma.product.update({where:{id:a.product.id},data:{isActive:false}})
 await prisma.category.create({data:{organizationId:a.org,name:'Archived category',isActive:false}})
 for(const [handler,path] of [[products,'products'],[categories,'categories']] as const){const response=await handler(req(`/${path}?organizationId=${a.org}&status=archived&limit=1`,a.cookie),undefined);assert.equal(response.status,200);assert.equal((await response.json()).pagination.total,1);assert.equal((await handler(req(`/${path}?organizationId=${b.org}&status=all`,a.cookie),undefined)).status,403);assert.equal((await handler(req(`/${path}?organizationId=${a.org}&status=bad`,a.cookie),undefined)).status,400)}
 await prisma.organizationUser.update({where:{id:a.data.user.organizationUserId},data:{role:'cashier'}})
 assert.equal((await products(req(`/products?organizationId=${a.org}&status=archived`,a.cookie),undefined)).status,403)
 assert.equal((await categories(req(`/categories?organizationId=${a.org}`,a.cookie),undefined)).status,200)
})
test('Archiving cannot overtake a concurrent debt posting holding the customer lock',async()=>{
 const a=await account(),customer=await prisma.customer.create({data:{organizationId:a.org,fullName:'Concurrent debt',phone:randomUUID(),creditLimit:100}})
 let signal!:()=>void,release!:()=>void
 const locked=new Promise<void>(resolve=>{signal=resolve}),hold=new Promise<void>(resolve=>{release=resolve})
 const posting=prisma.$transaction(async tx=>{
  await tx.$queryRaw`SELECT id FROM "Customer" WHERE id=${customer.id} FOR UPDATE`
  await tx.debtEntry.create({data:{organizationId:a.org,customerId:customer.id,sourceType:'debt_adjustment',sourceId:randomUUID(),amount:1}})
  signal();await hold
 },{timeout:10000})
 await locked
 const archiving=updateCustomer(req(`/customers/${customer.id}`,a.cookie,{isActive:false},'PUT'),params(customer.id))
 release();await posting
 assert.equal((await archiving).status,409)
 assert.equal((await prisma.customer.findUniqueOrThrow({where:{id:customer.id}})).isActive,true)
})
test('Supplier lifecycle keeps history, paginates opt-in, validates lengths and exports all filtered rows safely',async()=>{
 const a=await fixture(),b=await account()
 const invalid=await createSupplier(req('/suppliers',a.cookie,{organizationId:a.org,name:'x'.repeat(201)}),undefined);assert.equal(invalid.status,400)
 const created=await createSupplier(req('/suppliers',a.cookie,{organizationId:a.org,name:'=Supplier,"quoted"',phone:'123',tin:'456',note:'line\nnext'}),undefined);assert.equal(created.status,200);const supplier=(await created.json()).data
 const document=await prisma.stockDocument.create({data:{organizationId:a.org,storeId:a.store.id,supplierId:supplier.id,documentType:'purchase',documentNo:randomUUID(),createdBy:a.data.user.id,status:'draft'}})
 assert.equal((await updateSupplier(req(`/suppliers/${supplier.id}`,a.cookie,{isActive:false},'PUT'),params(supplier.id))).status,200)
 assert.equal((await suppliers(req(`/suppliers?organizationId=${a.org}`,a.cookie),undefined).then(r=>r.json())).data.length,0)
 assert.equal((await suppliers(req(`/suppliers?organizationId=${a.org}&status=archived&limit=1`,a.cookie),undefined).then(r=>r.json())).pagination.total,1)
 assert.equal((await prisma.stockDocument.findUniqueOrThrow({where:{id:document.id}})).supplierId,supplier.id)
 assert.equal((await updateSupplier(req(`/suppliers/${supplier.id}`,a.cookie,{isActive:true,name:'=Supplier updated'},'PUT'),params(supplier.id))).status,200)
 await prisma.supplier.createMany({data:Array.from({length:21},(_,index)=>({organizationId:a.org,name:'Supplier '+index}))})
 const csv=await suppliers(req(`/suppliers?organizationId=${a.org}&format=csv&page=2&limit=1`,a.cookie),undefined).then(r=>r.json());assert.equal((csv.data.content.match(/^"[0-9a-f-]{36}",/gm)??[]).length,22);assert.ok(csv.data.content.includes("'=Supplier updated"));assert.ok(csv.data.content.includes('line\nnext'))
 assert.equal((await suppliers(req(`/suppliers?organizationId=${b.org}&format=csv`,a.cookie),undefined)).status,403)
})
test('Inventory journal and CSV preserve signed precision, local-day boundaries, stable paging and assigned-branch scope',async()=>{
 const a=await fixture(),b=await account();const hidden=await prisma.store.create({data:{organizationId:a.org,name:'HIDDEN'}})
 const common={organizationId:a.org,storeId:a.store.id,productId:a.product.id,movementType:'adjustment',unitCost:'0.123456',sourceType:'adjustment',createdBy:a.data.user.id}
 await prisma.inventoryMovement.createMany({data:Array.from({length:21},()=>({...common,sourceId:randomUUID(),quantityDelta:'-1.123456',occurredAt:new Date('2026-01-01T19:30:00Z')}))})
 await prisma.inventoryMovement.createMany({data:[{...common,sourceId:randomUUID(),quantityDelta:9,occurredAt:new Date('2026-01-01T18:30:00Z')},{...common,storeId:hidden.id,sourceId:randomUUID(),quantityDelta:7,occurredAt:new Date('2026-01-01T19:30:00Z')}]})
 const path=`/inventory/movements?organizationId=${a.org}&from=2026-01-02&to=2026-01-02&movementType=adjustment`
 const first=await movements(req(path+'&limit=1',a.cookie),undefined).then(r=>r.json()),second=await movements(req(path+'&limit=1&page=2',a.cookie),undefined).then(r=>r.json());assert.equal(first.pagination.total,22);assert.notEqual(first.data[0].id,second.data[0].id)
 assert.equal((await movements(req(`/inventory/movements?organizationId=${a.org}&from=bad`,a.cookie),undefined)).status,400)
 await prisma.organizationUser.update({where:{id:a.data.user.organizationUserId},data:{role:'admin'}})
 const response=await movements(req(path+'&format=csv&limit=1&page=2',a.cookie),undefined);assert.equal(response.status,200);const csv=(await response.json()).data.content;assert.equal((csv.match(/^"[0-9a-f-]{36}",/gm)??[]).length,21);assert.ok(csv.includes('"-1.123456"'));assert.ok(csv.includes('"0.123456"'));assert.ok(!csv.includes('HIDDEN'));assert.ok(csv.includes("'=Journal product"))
 assert.equal((await movements(req(`/inventory/movements?organizationId=${b.org}`,a.cookie),undefined)).status,403)
 assert.equal((await movements(req(`/inventory/movements?organizationId=${a.org}&storeId=${hidden.id}`,a.cookie),undefined)).status,404)
})
test('Shift CSV uses frozen close amounts, omits unknown open settlement and scopes to assigned branch; audit CSV is owner-only and payload-free',async()=>{
 const a=await fixture();await prisma.shift.update({where:{id:a.shift.id},data:{status:'closed',closedAt:new Date(),expectedCash:12.25,countedCash:10,cashDifference:-2.25}})
 const open=await prisma.shift.create({data:{registerId:a.terminal.id,organizationUserId:a.data.user.organizationUserId,openingCash:0}})
 const hidden=await prisma.store.create({data:{organizationId:a.org,name:'HIDDEN'}}),terminal=await prisma.register.create({data:{storeId:hidden.id,name:'Hidden',code:'HIDDEN'}})
 await prisma.shift.create({data:{registerId:terminal.id,organizationUserId:a.data.user.organizationUserId,openingCash:99}})
 await prisma.auditLog.create({data:{organizationId:a.org,actorId:a.data.user.id,entityType:'ExportProof',entityId:open.id,action:'=requested',afterData:{private:'NEVER_EXPORT_PAYLOAD'},ipAddress:'NEVER_EXPORT_IP'}})
 const auditResponse=await audit(req('/audit?format=csv&entityType=ExportProof&limit=1',a.cookie),undefined);assert.equal(auditResponse.status,200);const auditCsv=(await auditResponse.json()).data.content;assert.ok(auditCsv.includes("'=requested"));assert.ok(!auditCsv.includes('NEVER_EXPORT'))
 await prisma.organizationUser.update({where:{id:a.data.user.organizationUserId},data:{role:'admin'}})
 const result=await shifts(req('/shifts?format=csv&limit=1',a.cookie),undefined);assert.equal(result.status,200);const csv=(await result.json()).data.content;assert.ok(csv.includes('"12.25","10.00","-2.25"'));assert.ok(!csv.includes('HIDDEN'));const openLine=csv.split('\r\n').find((line:string)=>line.startsWith('"'+open.id+'"'));assert.ok(openLine.endsWith('"0.00","","",""'))
 assert.equal((await audit(req('/audit?format=csv',a.cookie),undefined)).status,403)
 await prisma.organizationUser.update({where:{id:a.data.user.organizationUserId},data:{role:'cashier'}})
 assert.equal((await shifts(req('/shifts?format=csv',a.cookie),undefined)).status,403)
})
test('Print requests are idempotent under concurrency, reject altered intent and do not change any financial/stock rows',async()=>{
 const a=await fixture(),b=await fixture();const sale=await prisma.sale.create({data:{organizationId:a.org,storeId:a.store.id,registerId:a.terminal.id,shiftId:a.shift.id,cashierId:a.data.user.id,receiptNo:randomUUID(),subtotal:100,totalAmount:100,status:'completed'}})
 const operationId=randomUUID(),path=`/sales/${sale.id}/print-requests`,body={operationId,width:58,copy:true}
 const responses=await Promise.all([print(req(path,a.cookie,body),params(sale.id)),print(req(path,a.cookie,body),params(sale.id))]);assert.deepEqual(responses.map(r=>r.status),[200,200]);assert.equal(await prisma.auditLog.count({where:{organizationId:a.org,entityId:sale.id,action:'receipt_print_requested'}}),1)
 assert.equal((await print(req(path,a.cookie,{...body,width:80}),params(sale.id))).status,409)
 assert.equal((await print(req(path,b.cookie,body),params(sale.id))).status,404)
 assert.equal(await prisma.payment.count({where:{organizationId:a.org}}),0);assert.equal(await prisma.inventoryMovement.count({where:{organizationId:a.org}}),0);assert.equal((await prisma.sale.findUniqueOrThrow({where:{id:sale.id}})).totalAmount.toString(),'100')
 await prisma.organizationUser.update({where:{id:a.data.user.organizationUserId},data:{role:'cashier'}})
 assert.equal((await print(req(path,a.cookie,{...body,operationId:randomUUID()}),params(sale.id))).status,200)
 const coworker=await prisma.user.create({data:{phone:randomUUID(),fullName:'Coworker',passwordHash:'not-login'}});users.push(coworker.id)
 await prisma.organizationUser.create({data:{organizationId:a.org,userId:coworker.id,role:'cashier'}})
 const foreign=await prisma.sale.create({data:{organizationId:a.org,storeId:a.store.id,registerId:a.terminal.id,shiftId:a.shift.id,cashierId:coworker.id,receiptNo:randomUUID(),subtotal:100,totalAmount:100,status:'completed'}})
 assert.equal((await print(req(`/sales/${foreign.id}/print-requests`,a.cookie,{...body,operationId:randomUUID()}),params(foreign.id))).status,404)
 for(let index=0;index<30;index++)await consumeLimit('receipt.print',a.org+':'+a.data.user.id,100,60000)
 const limited=await print(req(path,a.cookie,{...body,operationId:randomUUID()}),params(sale.id));assert.equal(limited.status,429);assert.ok(Number(limited.headers.get('Retry-After'))>0)
})
test('Supplier, journal, shift and audit exports reject more than 10000 rows rather than truncating',async()=>{
 const a=await fixture();await prisma.supplier.createMany({data:Array.from({length:10001},()=>({organizationId:a.org,name:'Cap supplier'}))})
 await prisma.inventoryMovement.createMany({data:Array.from({length:10001},()=>({organizationId:a.org,storeId:a.store.id,productId:a.product.id,movementType:'adjustment',quantityDelta:0,unitCost:0,sourceType:'cap',sourceId:randomUUID(),createdBy:a.data.user.id}))})
 await prisma.shift.createMany({data:Array.from({length:10001},()=>({registerId:a.terminal.id,organizationUserId:a.data.user.organizationUserId,openingCash:0,status:'closed',closedAt:new Date(),expectedCash:0,countedCash:0,cashDifference:0}))})
 await prisma.auditLog.createMany({data:Array.from({length:10001},()=>({organizationId:a.org,entityType:'Cap',entityId:randomUUID(),action:'cap'}))})
 for(const [handler,path] of [[suppliers,`/suppliers?organizationId=${a.org}&format=csv`],[movements,`/inventory/movements?organizationId=${a.org}&format=csv`],[shifts,'/shifts?format=csv'],[audit,'/audit?format=csv&entityType=Cap']] as const)assert.equal((await handler(req(path,a.cookie),undefined)).status,413)
})
