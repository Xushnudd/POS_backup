import { test,after } from 'node:test'
import assert from 'node:assert/strict'
import { randomUUID } from 'node:crypto'
import { NextRequest } from 'next/server'
import { prisma } from '@/lib/prisma'
import { POST as register } from '@/app/api/auth/register/route'
import { GET as categories,POST as createCategory } from '@/app/api/categories/route'
import { PUT as updateCategory } from '@/app/api/categories/[id]/route'
import { GET as units } from '@/app/api/units/route'
import { GET as barcodes } from '@/app/api/products/[id]/barcodes/route'
import { GET as supplier } from '@/app/api/suppliers/[id]/route'
import { GET as history } from '@/app/api/suppliers/[id]/purchases/route'
import { GET as totals } from '@/app/api/suppliers/[id]/purchase-totals/route'
import { GET as documents } from '@/app/api/stock-documents/route'
import { GET as transfers } from '@/app/api/transfers/route'
import { GET as balances } from '@/app/api/inventory/balances/route'
import { clearLimit,consumeLimit } from '@/server/auth/rate-limit'
const connection=new URL(process.env.DATABASE_URL??'')
if(connection.hostname!=='127.0.0.1'||connection.pathname!=='/pos_test'||connection.port!=='55439'||connection.username!=='pos_test')throw new Error('Isolated test DB required')
const orgs:string[]=[],users:string[]=[],phones:string[]=[]
function req(path:string,cookie='',body?:unknown,method=body?'POST':'GET'){return new NextRequest('http://localhost:3000/api'+path,{method,headers:{cookie,origin:'http://localhost:3000','content-type':'application/json'},...(body?{body:JSON.stringify(body)}:{})})}
const params=(id:string)=>({params:Promise.resolve({id})})
after(async()=>{await prisma.organization.deleteMany({where:{id:{in:orgs}}});await prisma.user.deleteMany({where:{id:{in:users}}});for(const phone of phones)await clearLimit('register-account',phone);await prisma.$disconnect()})
async function account(){const phone='purchase-'+randomUUID();phones.push(phone);const response=await register(req('/auth/register','',{phone,password:'test-only-password',fullName:'Purchase owner',organizationName:'Purchase POS'}),undefined);assert.equal(response.status,200);const data=(await response.json()).data;orgs.push(data.organization.id);users.push(data.user.id);const store=await prisma.store.findFirstOrThrow({where:{organizationId:data.organization.id}});return {data,store,cookie:response.headers.get('set-cookie')!.split(';')[0],org:data.organization.id as string}}
async function fixture(){const a=await account(),product=await prisma.product.create({data:{organizationId:a.org,name:'=Purchase product',sku:randomUUID(),barcode:randomUUID(),unit:'dona',salePrice:1,costPrice:'0.123456',minStock:3}}),supplier=await prisma.supplier.create({data:{organizationId:a.org,name:'=Purchase supplier',phone:'123456789',tin:'987654321'}});return {...a,product,supplier}}
const csvRows=(content:string)=>(content.match(/^"[0-9a-f-]{36}",/gm)??[]).length
test('Category validation/search/sort and full CSV remain tenant/role safe beyond page 200',async()=>{
 const a=await account(),b=await account()
 for(const input of [{name:'x'.repeat(201),sortOrder:0},{name:'  ',sortOrder:0},{name:'Valid',sortOrder:0.5},{name:'Valid',sortOrder:2147483648}])assert.equal((await createCategory(req('/categories',a.cookie,{organizationId:a.org,...input}),undefined)).status,400)
 const created=await createCategory(req('/categories',a.cookie,{organizationId:a.org,name:'  CAT trimmed  ',sortOrder:-1}),undefined);assert.equal(created.status,200);const category=(await created.json()).data;assert.equal(category.name,'CAT trimmed')
 assert.equal((await updateCategory(req(`/categories/${category.id}`,a.cookie,{sortOrder:0.1},'PUT'),params(category.id))).status,400)
 await prisma.category.createMany({data:Array.from({length:205},(_,index)=>({organizationId:a.org,name:index===0?'=CAT,"quote"':'CAT '+index,sortOrder:0}))})
 await prisma.category.create({data:{organizationId:a.org,name:'CAT archived',isActive:false}})
 const base=`/categories?organizationId=${a.org}&search=cat`
 const page1=await categories(req(base+'&limit=200',a.cookie),undefined).then(r=>r.json()),page2=await categories(req(base+'&limit=200&page=2',a.cookie),undefined).then(r=>r.json());assert.equal(page1.pagination.total,206);assert.equal(page1.data[0].id,category.id);assert.equal(page2.data.length,6);assert.ok(!page1.data.some((row:{id:string})=>page2.data.some((other:{id:string})=>other.id===row.id)))
 const exported=await categories(req(base+'&format=csv&limit=1&page=2',a.cookie),undefined).then(r=>r.json());assert.equal(csvRows(exported.data.content),206);assert.ok(exported.data.content.includes("'=CAT,"));assert.ok(!exported.data.content.includes('archived'))
 assert.equal((await categories(req(`/categories?organizationId=${b.org}&format=csv`,a.cookie),undefined)).status,403)
 await prisma.organizationUser.update({where:{id:a.data.user.organizationUserId},data:{role:'cashier'}})
 assert.equal((await categories(req(base+'&format=csv',a.cookie),undefined)).status,403)
})
test('Unit and barcode search/paging expose all records, stable primary order and complete safe exports',async()=>{
 const a=await fixture(),b=await fixture()
 await prisma.unit.createMany({data:Array.from({length:205},(_,index)=>({organizationId:a.org,code:'u'+index,name:index===0?'=UNIT,"quote"':'UNIT '+index,precision:6}))})
 await prisma.unit.create({data:{organizationId:a.org,code:'archived_unit',name:'UNIT archived',precision:0,isActive:false}})
 const base='/units?search=unit&status=active'
 const first=await units(req(base+'&limit=200',a.cookie),undefined).then(r=>r.json()),second=await units(req(base+'&limit=200&page=2',a.cookie),undefined).then(r=>r.json());assert.equal(first.pagination.total,205);assert.equal(second.data.length,5);assert.notEqual(first.data[0].id,second.data[0].id)
 const unitCsv=await units(req(base+'&format=csv&limit=1',a.cookie),undefined).then(r=>r.json());assert.equal(csvRows(unitCsv.data.content),205);assert.ok(unitCsv.data.content.includes("'=UNIT,"));assert.ok(!unitCsv.data.content.includes('archived'))
 await prisma.productBarcode.createMany({data:Array.from({length:205},(_,index)=>({organizationId:a.org,productId:a.product.id,value:index===0?'=BARCODE,"quote"':'BARCODE-'+index}))})
 const barcodeBase=`/products/${a.product.id}/barcodes`
 const barcodeFirst=await barcodes(req(barcodeBase+'?limit=200',a.cookie),params(a.product.id)).then(r=>r.json()),barcodeSecond=await barcodes(req(barcodeBase+'?limit=200&page=2',a.cookie),params(a.product.id)).then(r=>r.json());assert.equal(barcodeFirst.pagination.total,206);assert.equal(barcodeFirst.data[0].isPrimary,true);assert.equal(barcodeSecond.data.length,6)
 const barcodeCsv=await barcodes(req(barcodeBase+'?search=barcode&format=csv&limit=1',a.cookie),params(a.product.id)).then(r=>r.json());assert.equal(csvRows(barcodeCsv.data.content),205);assert.ok(barcodeCsv.data.content.includes("'=BARCODE,"))
 assert.equal((await barcodes(req(barcodeBase,b.cookie),params(a.product.id))).status,404)
 await prisma.organizationUser.update({where:{id:a.data.user.organizationUserId},data:{role:'cashier'}})
 assert.equal((await barcodes(req(barcodeBase,a.cookie),params(a.product.id))).status,200)
 assert.equal((await barcodes(req(barcodeBase+'?format=csv',a.cookie),params(a.product.id))).status,403)
})
test('Supplier history and confirmed purchase totals use scoped event dates and Decimal reversals without counting drafts or other adjustments',async()=>{
 const a=await fixture(),b=await fixture(),hidden=await prisma.store.create({data:{organizationId:a.org,name:'Hidden purchase branch'}})
 const create=async(documentType:string,quantity:string,storeId=a.store.id,status='confirmed',createdAt=new Date('2026-01-01T19:30:00Z'),reversalOfId?:string)=>{
  const document=await prisma.stockDocument.create({data:{organizationId:a.org,storeId,supplierId:a.supplier.id,documentType,documentNo:randomUUID(),createdBy:a.data.user.id,status:'draft',createdAt,reversalOfId,items:{create:{productId:a.product.id,quantity,unitCost:'12.345678'}}}})
  return status==='confirmed'?prisma.stockDocument.update({where:{id:document.id},data:{status,confirmedAt:createdAt,confirmedBy:a.data.user.id}}):document
 }
 const purchase=await create('purchase','2'),old=await create('purchase','1',a.store.id,'confirmed',new Date('2026-01-01T18:30:00Z'))
 await create('reversal','-1',a.store.id,'confirmed',new Date('2026-01-01T19:30:00Z'),old.id)
 await create('purchase','50',hidden.id);await create('purchase','100',a.store.id,'draft');await create('adjustment','100')
 const path=`/suppliers/${a.supplier.id}`
 const card=await supplier(req(path,a.cookie),params(a.supplier.id));assert.equal(card.status,200);assert.equal((await card.json()).data.tin,'987654321')
 assert.equal((await supplier(req(path,b.cookie),params(a.supplier.id))).status,404)
 await prisma.organizationUser.update({where:{id:a.data.user.organizationUserId},data:{role:'admin'}})
 const query='?from=2026-01-02&to=2026-01-02'
 const summary=await totals(req(path+'/purchase-totals'+query,a.cookie),params(a.supplier.id));assert.equal(summary.status,200);const values=(await summary.json()).data;assert.deepEqual([values.purchases,values.reversals,values.purchaseValue,values.reversalValue,values.netPurchaseValue],[1,1,'24.69','12.35','12.34'])
 const allHistory=await history(req(path+'/purchases'+query+'&limit=1&page=2',a.cookie),params(a.supplier.id)).then(r=>r.json());assert.equal(allHistory.pagination.total,4);assert.equal(allHistory.data.length,1)
 const confirmed=await history(req(path+'/purchases'+query+'&status=confirmed',a.cookie),params(a.supplier.id)).then(r=>r.json());assert.equal(confirmed.pagination.total,3);assert.ok(confirmed.data.some((row:{id:string})=>row.id===purchase.id));assert.ok(!JSON.stringify(confirmed).includes('Hidden purchase branch'))
 const exported=await documents(req(`/stock-documents?organizationId=${a.org}&supplierId=${a.supplier.id}&from=2026-01-02&to=2026-01-02&status=confirmed&format=csv&limit=1`,a.cookie),undefined).then(r=>r.json());assert.equal(csvRows(exported.data.content),3);assert.ok(exported.data.content.includes('"-1.000000"'));assert.ok(exported.data.content.includes('"12.345678"'));assert.ok(exported.data.content.includes("'=Purchase supplier"));assert.ok(!exported.data.content.includes('Hidden purchase branch'))
 assert.equal((await totals(req(path+'/purchase-totals'+query+`&storeId=${hidden.id}`,a.cookie),params(a.supplier.id))).status,404)
 assert.equal((await history(req(path+`/purchases?supplierId=${b.supplier.id}`,a.cookie),params(a.supplier.id))).status,404)
 assert.equal((await totals(req(path+'/purchase-totals?status=draft',a.cookie),params(a.supplier.id))).status,400)
 await prisma.organizationUser.update({where:{id:a.data.user.organizationUserId},data:{role:'cashier'}})
 assert.equal((await history(req(path+'/purchases',a.cookie),params(a.supplier.id))).status,403)
})
test('Stock document and transfer filtering and CSV are stable, full, signed and branch-scoped',async()=>{
 const a=await fixture(),destination=await prisma.store.create({data:{organizationId:a.org,name:'Assigned destination'}}),hidden=await prisma.store.create({data:{organizationId:a.org,name:'HIDDEN'}})
 await prisma.userStore.create({data:{organizationUserId:a.data.user.organizationUserId,storeId:destination.id}})
 await prisma.stockDocument.createMany({data:Array.from({length:25},(_,index)=>({organizationId:a.org,storeId:a.store.id,supplierId:a.supplier.id,documentType:'purchase',status:'draft',createdBy:a.data.user.id,documentNo:'FILTER-'+index,createdAt:new Date('2026-01-01T19:30:00Z')}))})
 await prisma.stockDocument.create({data:{organizationId:a.org,storeId:hidden.id,documentType:'purchase',createdBy:a.data.user.id,documentNo:'FILTER-HIDDEN'}})
 const base=`/stock-documents?organizationId=${a.org}&search=FILTER&from=2026-01-02&to=2026-01-02&status=draft`
 const first=await documents(req(base+'&limit=1',a.cookie),undefined).then(r=>r.json()),second=await documents(req(base+'&limit=1&page=2',a.cookie),undefined).then(r=>r.json());assert.equal(first.pagination.total,25);assert.notEqual(first.data[0].id,second.data[0].id)
 const csv=await documents(req(base+'&format=csv&limit=1&page=2',a.cookie),undefined).then(r=>r.json());assert.equal(csvRows(csv.data.content),25)
 const create=async(toStoreId:string,note:string)=>prisma.stockTransfer.create({data:{organizationId:a.org,fromStoreId:a.store.id,toStoreId,status:'sent',note,createdBy:a.data.user.id,createdAt:new Date('2026-01-01T19:30:00Z'),items:{create:{productId:a.product.id,quantity:'2.123456',receivedQuantity:1,returnedQuantity:'0.123456',unitCost:'0.123456'}}}})
 for(let index=0;index<25;index++)await create(destination.id,index===0?'=TRANSFER,"quote"':'Transfer '+index)
 await create(hidden.id,'HIDDEN')
 await prisma.organizationUser.update({where:{id:a.data.user.organizationUserId},data:{role:'admin'}})
 const transferBase=`/transfers?organizationId=${a.org}&from=2026-01-02&to=2026-01-02&status=sent&fromStoreId=${a.store.id}&toStoreId=${destination.id}`
 const transferPage=await transfers(req(transferBase+'&limit=20&page=2',a.cookie),undefined).then(r=>r.json());assert.equal(transferPage.pagination.total,25);assert.equal(transferPage.data.length,5)
 const transferCsv=await transfers(req(transferBase+'&format=csv&limit=1&page=2',a.cookie),undefined).then(r=>r.json());assert.equal(csvRows(transferCsv.data.content),25);assert.ok(transferCsv.data.content.includes('"2.123456","1.000000","0.123456","1.000000","0.123456"'));assert.ok(transferCsv.data.content.includes("'=TRANSFER,"));assert.ok(!transferCsv.data.content.includes('HIDDEN'))
 assert.equal((await transfers(req(`/transfers?organizationId=${a.org}&toStoreId=${hidden.id}`,a.cookie),undefined)).status,404)
 for(const [handler,path] of [[documents,`/stock-documents?organizationId=${a.org}&documentType=bad`],[documents,`/stock-documents?organizationId=${a.org}&from=bad`],[transfers,`/transfers?organizationId=${a.org}&status=bad`]] as const)assert.equal((await handler(req(path,a.cookie),undefined)).status,400)
})
test('Stock balance CSV matches low-stock scope, preserves quantities/cost and does not truncate to its UI page',async()=>{
 const a=await fixture(),hidden=await prisma.store.create({data:{organizationId:a.org,name:'HIDDEN'}}),ids=Array.from({length:25},()=>randomUUID())
 await prisma.product.createMany({data:ids.map((id,index)=>({id,organizationId:a.org,name:'BALANCE '+index,sku:'BAL-'+index,barcode:'BAL-'+index,unit:'dona',salePrice:1,costPrice:'0.123456',minStock:3}))})
 await prisma.inventoryBalance.createMany({data:ids.map(productId=>({storeId:a.store.id,productId,quantity:'1.123456'}))})
 await prisma.inventoryBalance.createMany({data:[{storeId:hidden.id,productId:a.product.id,quantity:0},{storeId:a.store.id,productId:a.product.id,quantity:3}]})
 await prisma.organizationUser.update({where:{id:a.data.user.organizationUserId},data:{role:'admin'}})
 const base=`/inventory/balances?organizationId=${a.org}&lowStock=true`
 const page=await balances(req(base+'&limit=1&page=2',a.cookie),undefined).then(r=>r.json());assert.equal(page.pagination.total,25)
 const csv=await balances(req(base+'&format=csv&limit=1&page=2',a.cookie),undefined).then(r=>r.json());assert.equal(csvRows(csv.data.content),25);assert.ok(csv.data.content.includes('"1.123456","3.000000","1.876544","0.123456","0.14"'));assert.ok(!csv.data.content.includes('HIDDEN'))
 assert.equal((await balances(req(base+'&format=bad',a.cookie),undefined)).status,400)
 assert.equal((await balances(req(`/inventory/balances?lowStock=bad`,a.cookie),undefined)).status,400)
 const identity=a.org+':'+a.data.user.id;for(let index=0;index<10;index++)await consumeLimit('inventory-balance.export',identity,100,60000)
 const limited=await balances(req(base+'&format=csv',a.cookie),undefined);assert.equal(limited.status,429);assert.ok(Number(limited.headers.get('Retry-After'))>0)
})
test('Document and transfer CSV caps count child lines, not only parent documents; failure returns no partial content',async()=>{
 const a=await fixture(),destination=await prisma.store.create({data:{organizationId:a.org,name:'Destination'}}),ids=Array.from({length:500},()=>randomUUID())
 await prisma.product.createMany({data:ids.map((id,index)=>({id,organizationId:a.org,name:'CAP '+index,sku:'CAP-'+index,barcode:'CAP-'+index,unit:'dona',salePrice:1,costPrice:0}))})
 for(let index=0;index<21;index++){
  await prisma.stockDocument.create({data:{organizationId:a.org,storeId:a.store.id,documentType:'purchase',documentNo:'CAP-'+index,createdBy:a.data.user.id,items:{createMany:{data:ids.map(productId=>({productId,quantity:1,unitCost:0}))}}}})
  await prisma.stockTransfer.create({data:{organizationId:a.org,fromStoreId:a.store.id,toStoreId:destination.id,createdBy:a.data.user.id,items:{createMany:{data:ids.map(productId=>({productId,quantity:1,unitCost:0}))}}}})
 }
 for(const [handler,path] of [[documents,`/stock-documents?organizationId=${a.org}&format=csv`],[transfers,`/transfers?organizationId=${a.org}&format=csv`]] as const){const response=await handler(req(path,a.cookie),undefined);assert.equal(response.status,413);const body=await response.json();assert.equal(body.error.code,'EXPORT_TOO_LARGE');assert.equal(body.data,undefined)}
})
