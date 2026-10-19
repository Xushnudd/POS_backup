import test,{after} from 'node:test';
import assert from 'node:assert/strict';
import {randomUUID} from 'node:crypto';
import {NextRequest} from 'next/server';
import {prisma} from '@/lib/prisma';
import {POST as register} from '@/app/api/auth/register/route';
import {GET as list} from '@/app/api/sales/route';
import {GET as productsList} from '@/app/api/products/route';
import {GET as customersList} from '@/app/api/customers/route';
import {GET as categoriesList} from '@/app/api/categories/route';
import {GET as unitsList} from '@/app/api/units/route';
import {GET as suppliersList} from '@/app/api/suppliers/route';
import {GET as brandsList} from '@/app/api/brands/route';
import {GET as auditList} from '@/app/api/audit/route';
import {GET as balancesList} from '@/app/api/inventory/balances/route';
import {GET as documentsList} from '@/app/api/stock-documents/route';
import {GET as transfersList} from '@/app/api/transfers/route';
import {GET as shiftsList} from '@/app/api/shifts/route';
import {GET as financeList} from '@/app/api/finance/documents/route';
import {verifyToken,getRequestToken} from '@/lib/auth';
import {openShift,closeShift} from '@/server/finance/shifts';
import {createAccount,createExpenseCategory,postExpense} from '@/server/finance/accounts';
import {GET as countsList} from '@/app/api/stock-counts/route';
import {startCount,finishCount} from '@/server/inventory/counts';
const url=new URL(process.env.DATABASE_URL??'');
if(url.hostname!=='127.0.0.1'||url.port!=='55439'||url.pathname!=='/pos_test'||url.username!=='pos_test')throw Error('Isolated pos_test only');
const orgs:string[]=[],users:string[]=[];
after(async()=>{await prisma.organization.deleteMany({where:{id:{in:orgs}}});await prisma.user.deleteMany({where:{id:{in:users}}});await prisma.$disconnect();});
function request(path:string,cookie='',body?:unknown){return new NextRequest('http://localhost:3000/api'+path,{method:body?'POST':'GET',headers:{cookie,origin:'http://localhost:3000','content-type':'application/json'},...(body?{body:JSON.stringify(body)}:{})});}
async function account(){
  const response=await register(request('/auth/register','',{phone:'sales-list-'+randomUUID(),password:'test-only-password',fullName:'List owner',organizationName:'List fixture'}),undefined);
  assert.equal(response.status,200);const data=(await response.json()).data;
  orgs.push(data.organization.id);users.push(data.user.id);
  const cookie=response.headers.get('set-cookie')!.split(';')[0];
  const store=await prisma.store.findFirstOrThrow({where:{organizationId:data.organization.id}});
  const terminal=await prisma.register.findFirstOrThrow({where:{storeId:store.id}});
  const shift=await prisma.shift.create({data:{registerId:terminal.id,organizationUserId:data.user.organizationUserId,openingCash:0}});
  return{data,cookie,store,terminal,shift};
}
test('Sales list filters, deterministic global sort, page boundaries, empty state and tenant isolation',async()=>{
  const a=await account(),b=await account();
  const customer=await prisma.customer.create({data:{organizationId:a.data.organization.id,fullName:'Unique list customer',phone:'list-customer-'+randomUUID()}});
  const rows=Array.from({length:43},(_,i)=>({id:randomUUID(),organizationId:a.data.organization.id,storeId:a.store.id,registerId:a.terminal.id,
    shiftId:a.shift.id,cashierId:a.data.user.id,customerId:i===42?customer.id:null,receiptNo:'LIST-'+String(i).padStart(3,'0'),
    subtotal:i,discountAmount:0,totalAmount:i,status:'draft',createdAt:new Date('2026-10-01T00:00:00Z')}));
  await prisma.sale.createMany({data:rows});
  const get=async(query:string)=>{const r=await list(request('/sales?organizationId='+a.data.organization.id+'&'+query,a.cookie),undefined);assert.equal(r.status,200);return r.json();};
  const first=await get('sort=amount_desc&page=1&limit=20'),second=await get('sort=amount_desc&page=2&limit=20'),last=await get('sort=amount_desc&page=3&limit=20');
  assert.equal(first.pagination.total,43);assert.equal(first.pagination.totalPages,3);assert.equal(last.data.length,3);
  assert.deepEqual([...first.data,...second.data,...last.data].map((r:{receiptNo:string})=>r.receiptNo),rows.slice().reverse().map(r=>r.receiptNo));
  const ascending=await get('sort=amount_asc&limit=200');assert.deepEqual(ascending.data.map((r:{receiptNo:string})=>r.receiptNo),rows.map(r=>r.receiptNo));
  const tied=await get('sort=newest&limit=200');assert.deepEqual(tied.data.map((r:{id:string})=>r.id),rows.map(r=>r.id).sort().reverse());
  assert.equal((await get('search=Unique%20list%20customer')).data[0].id,rows[42].id);
  assert.equal((await get('search=LIST-001')).data[0].id,rows[1].id);
  const empty=await get('status=completed');assert.equal(empty.pagination.total,0);assert.equal(empty.pagination.totalPages,0);assert.deepEqual(empty.data,[]);
  assert.deepEqual((await get('page=4')).data,[]);
  for(const q of ['limit=201','page=1x','page=0','sort=costPrice','status=unknown']){
    const response=await list(request('/sales?organizationId='+a.data.organization.id+'&'+q,a.cookie),undefined);assert.equal(response.status,400,q);
  }
  const foreign=await list(request('/sales?organizationId='+b.data.organization.id,a.cookie),undefined);assert.equal(foreign.status,403);
  const scoped=await list(request('/sales?organizationId='+b.data.organization.id,b.cookie),undefined);assert.equal(scoped.status,200);assert.deepEqual((await scoped.json()).data,[]);
});

test('Catalog/customer sort and paging cover every record, preserve CSV filters and reject unsafe sorting',async()=>{
  const a=await account();
  const category=await prisma.category.create({data:{organizationId:a.data.organization.id,name:'List category'}});
  const products=Array.from({length:43},(_,i)=>({organizationId:a.data.organization.id,name:'Item '+String(i).padStart(3,'0'),
    sku:randomUUID(),barcode:randomUUID(),unit:'dona',salePrice:i,costPrice:1,categoryId:i%2?category.id:null}));
  await prisma.product.createMany({data:products});
  await prisma.customer.createMany({data:Array.from({length:43},(_,i)=>({organizationId:a.data.organization.id,
    fullName:'Customer '+String(i).padStart(3,'0'),phone:'list-'+randomUUID()}))});
  for(const [path,handler,sort,field,expected] of [
    ['/products',productsList,'price_desc','name',products.slice().reverse().map(r=>r.name)],
    ['/customers',customersList,'name_desc','fullName',Array.from({length:43},(_,i)=>'Customer '+String(42-i).padStart(3,'0'))],
  ] as const){
    const collected:string[]=[];
    for(let page=1;page<=3;page++){
      const response=await handler(request(path+'?organizationId='+a.data.organization.id+'&sort='+sort+'&page='+page,a.cookie),undefined);
      assert.equal(response.status,200);const body=await response.json();assert.equal(body.pagination.total,43);
      collected.push(...body.data.map((r:Record<string,string>)=>r[field]));
    }
    assert.deepEqual(collected,expected);
    for(const q of ['sort=costPrice','page=2147483648&limit=2','search='+ 'a'.repeat(201)]){
      const response=await handler(request(path+'?organizationId='+a.data.organization.id+'&'+q,a.cookie),undefined);assert.equal(response.status,400,q);
    }
    const empty=await handler(request(path+'?organizationId='+a.data.organization.id+'&search=does-not-exist',a.cookie),undefined);
    assert.equal(empty.status,200);assert.deepEqual((await empty.json()).data,[]);
  }
  const filtered=await productsList(request('/products?organizationId='+a.data.organization.id+'&categoryId='+category.id+'&sort=price_desc&limit=200',a.cookie),undefined);
  assert.equal(filtered.status,200);const rows=(await filtered.json()).data;
  assert.equal(rows.length,21);assert.equal(rows[0].name,'Item 041');
  const exported=await productsList(request('/products?organizationId='+a.data.organization.id+'&categoryId='+category.id+'&sort=price_desc&format=csv',a.cookie),undefined);
  assert.equal(exported.status,200);const content=(await exported.json()).data.content;
  assert.ok(content.indexOf('Item 041')<content.indexOf('Item 001'));assert.equal(content.includes('Item 042'),false);
});

test('Category/unit list URL sort keeps legacy defaults, filters, native order and full export',async()=>{
  const a=await account();
  await prisma.category.createMany({data:Array.from({length:43},(_,i)=>({organizationId:a.data.organization.id,name:'Reference '+String(i).padStart(3,'0'),sortOrder:42-i,isActive:i!==42}))});
  await prisma.unit.createMany({data:Array.from({length:43},(_,i)=>({organizationId:a.data.organization.id,code:'ref_'+String(i).padStart(3,'0'),name:'Reference '+String(i).padStart(3,'0'),precision:0,isActive:i!==42}))});
  for(const [path,handler] of [['/categories',categoriesList],['/units',unitsList]] as const){
    const response=await handler(request(path+'?organizationId='+a.data.organization.id+'&search=Reference&status=all&sort=name_desc&page=3&limit=20',a.cookie),undefined);
    assert.equal(response.status,200);const body=await response.json();assert.equal(body.pagination.total,43);assert.deepEqual(body.data.map((r:{name:string})=>r.name),['Reference 002','Reference 001','Reference 000']);
    const archived=await handler(request(path+'?organizationId='+a.data.organization.id+'&status=archived&search=Reference',a.cookie),undefined);assert.equal(archived.status,200);assert.equal((await archived.json()).data[0].name,'Reference 042');
    const bad=await handler(request(path+'?organizationId='+a.data.organization.id+'&sort=arbitrary',a.cookie),undefined);assert.equal(bad.status,400);
    const csv=await handler(request(path+'?organizationId='+a.data.organization.id+'&status=all&search=Reference&sort=name_desc&format=csv&page=3',a.cookie),undefined);assert.equal(csv.status,200);
    const content=(await csv.json()).data.content;assert.ok(content.indexOf('Reference 042')<content.indexOf('Reference 000'));
  }
  const original=await categoriesList(request('/categories?organizationId='+a.data.organization.id,a.cookie),undefined);assert.equal(original.status,200);
  const originalBody=await original.json();assert.equal(originalBody.pagination,undefined);assert.equal(originalBody.data.length,42);assert.equal(originalBody.data[0].name,'Reference 041');
  const defaultUnits=await unitsList(request('/units',a.cookie),undefined);assert.equal(defaultUnits.status,200);assert.equal((await defaultUnits.json()).pagination.limit,200);
});

test('Supplier and brand global sorting, bounded pages, zero state and filtered export share the authorized query',async()=>{
 const a=await account(),b=await account();
 const rows=Array.from({length:43},(_,i)=>({organizationId:a.data.organization.id,name:'Extended list '+String(i).padStart(3,'0')}));
 await prisma.supplier.createMany({data:rows});await prisma.brand.createMany({data:rows});
 for(const [path,handler] of [['/suppliers',suppliersList],['/brands',brandsList]] as const){
  const names:string[]=[];
  for(let page=1;page<=3;page++){
   const response=await handler(request(path+'?organizationId='+a.data.organization.id+'&status=all&sort=name_desc&page='+page,a.cookie),undefined);
   assert.equal(response.status,200);const result=await response.json();assert.equal(result.pagination.total,43);names.push(...result.data.map((r:{name:string})=>r.name));
  }
  assert.deepEqual(names,rows.map(r=>r.name).reverse());
  const empty=await handler(request(path+'?organizationId='+a.data.organization.id+'&status=all&search=DOES-NOT-EXIST',a.cookie),undefined);assert.equal((await empty.json()).pagination.total,0);
  for(const invalid of ['sort=costPrice','page=1.5','page=0','limit=201'])assert.equal((await handler(request(path+'?organizationId='+a.data.organization.id+'&'+invalid,a.cookie),undefined)).status,400,invalid);
  const foreign=await handler(request(path+'?organizationId='+b.data.organization.id,b.cookie),undefined);assert.deepEqual((await foreign.json()).data,[]);
 }
 const csv=await suppliersList(request('/suppliers?organizationId='+a.data.organization.id+'&status=all&sort=name_desc&search=Extended%20list&format=csv&page=3',a.cookie),undefined);
 const text=(await csv.json()).data.content as string;assert.equal(text.split('\r\n').filter(Boolean).length,44);assert.ok(text.indexOf('Extended list 042')<text.indexOf('Extended list 000'));
});
test('Audit summary search/date sort/page and CSV retain original journals without exposing source payloads',async()=>{
 const a=await account();
 await prisma.auditLog.createMany({data:Array.from({length:43},(_,i)=>({organizationId:a.data.organization.id,actorId:a.data.user.id,entityType:'ExtendedAuditFixture',entityId:String(i).padStart(3,'0'),action:'synthetic_list_acceptance',createdAt:new Date(Date.UTC(2026,9,1,0,0,i)),afterData:{private:'must-not-be-returned'}}))});
 const values:string[]=[];
 for(let page=1;page<=3;page++){
  const response=await auditList(request('/audit?view=summary&search=ExtendedAuditFixture&sort=oldest&limit=20&page='+page,a.cookie),undefined);assert.equal(response.status,200);const result=await response.json();assert.equal(result.pagination.total,43);assert.ok(result.data.every((row:Record<string,unknown>)=>!('afterData' in row)&&!('beforeData' in row)));values.push(...result.data.map((r:{entityId:string})=>r.entityId));
 }
 assert.deepEqual(values,Array.from({length:43},(_,i)=>String(i).padStart(3,'0')));
 for(const invalid of ['sort=afterData','page=0','page=NaN','limit=201'])assert.equal((await auditList(request('/audit?view=summary&'+invalid,a.cookie),undefined)).status,400,invalid);
 const empty=await auditList(request('/audit?view=summary&search=NO-SUCH-ENTITY',a.cookie),undefined);assert.equal((await empty.json()).pagination.total,0);
 const csv=await auditList(request('/audit?view=summary&search=ExtendedAuditFixture&sort=oldest&format=csv&page=3',a.cookie),undefined);const text=(await csv.json()).data.content as string;assert.equal(text.split('\r\n').filter(Boolean).length,44);assert.equal(text.includes('must-not-be-returned'),false);
});

test('Inventory quantity sorting and original document/transfer chronological sorting cover all pages and preserve zero/error boundaries',async()=>{
 const a=await account(),store=await prisma.store.create({data:{organizationId:a.data.organization.id,name:'Extended receiving branch'}});
 const products=await Promise.all(Array.from({length:43},(_,i)=>prisma.product.create({data:{organizationId:a.data.organization.id,name:'Inventory list '+String(i).padStart(3,'0'),sku:randomUUID(),barcode:randomUUID(),unit:'dona',salePrice:'10',costPrice:'2'}})));
 await prisma.inventoryBalance.createMany({data:products.map((p,i)=>({storeId:a.store.id,productId:p.id,quantity:String(i)}))});
 await prisma.stockDocument.createMany({data:products.map((_,i)=>({organizationId:a.data.organization.id,storeId:a.store.id,documentType:'purchase',documentNo:'EXTENDED-DOC-'+String(i).padStart(3,'0'),createdBy:a.data.user.id,createdAt:new Date(Date.UTC(2026,9,1,0,0,i))}))});
 await prisma.stockTransfer.createMany({data:products.map((_,i)=>({organizationId:a.data.organization.id,fromStoreId:a.store.id,toStoreId:store.id,note:'EXTENDED-TRANSFER-'+String(i).padStart(3,'0'),createdBy:a.data.user.id,createdAt:new Date(Date.UTC(2026,9,1,0,0,i))}))});
 for(const [path,handler,sort,field,prefix] of [['/inventory/balances',balancesList,'quantity_desc','quantity',''],['/stock-documents',documentsList,'oldest','documentNo','EXTENDED-DOC-'],['/transfers',transfersList,'oldest','note','EXTENDED-TRANSFER-']] as const){
  const all:string[]=[];
  for(let page=1;page<=3;page++){
   const response=await handler(request(path+'?organizationId='+a.data.organization.id+'&sort='+sort+'&page='+page+'&limit=20',a.cookie),undefined);assert.equal(response.status,200);const result=await response.json();assert.equal(result.pagination.total,43);all.push(...result.data.map((r:Record<string,unknown>)=>String(r[field])));
  }
  const expected=Array.from({length:43},(_,i)=>prefix?prefix+String(i).padStart(3,'0'):String(42-i));assert.deepEqual(all,expected);
  for(const invalid of ['page=0','sort=costPrice','limit=201'])assert.equal((await handler(request(path+'?organizationId='+a.data.organization.id+'&'+invalid,a.cookie),undefined)).status,400);
  const empty=await handler(request(path+'?organizationId='+a.data.organization.id+'&search=NO-SUCH-LIST-RECORD',a.cookie),undefined);assert.equal((await empty.json()).pagination.total,0);
 }
});

test('Paged shift history keeps legacy unpaged consumers; financial amounts sort in the database and filtered exports include every original posting',async()=>{
 const a=await account(),ctx=(await verifyToken(getRequestToken(request('/shifts',a.cookie))!))!;
 await closeShift(ctx,a.shift.id,{operationId:randomUUID(),countedCash:'0'});
 for(let i=0;i<42;i++){
  const shift=await openShift(ctx,{operationId:randomUUID(),registerId:a.terminal.id,organizationUserId:ctx.organizationUserId,openingCash:'0',note:'Original list history fixture'});
  await closeShift(ctx,shift.id,{operationId:randomUUID(),countedCash:'0'});
 }
 const legacy=await shiftsList(request('/shifts?registerId='+a.terminal.id,a.cookie),undefined),legacyData=await legacy.json();assert.equal(legacyData.data.length,43);assert.equal('pagination' in legacyData,false);
 const shiftIds:string[]=[];
 for(let page=1;page<=3;page++){
  const response=await shiftsList(request('/shifts?registerId='+a.terminal.id+'&sort=oldest&page='+page+'&limit=20',a.cookie),undefined);assert.equal(response.status,200);const result=await response.json();assert.equal(result.pagination.total,43);shiftIds.push(...result.data.map((r:{id:string})=>r.id));
 }
 assert.equal(new Set(shiftIds).size,43);assert.equal(shiftIds[0],a.shift.id);
 const bank=await createAccount(ctx,{operationId:randomUUID(),storeId:a.store.id,name:'List real internal bank book',kind:'bank',openingBalance:'10000',reason:'Explicit synthetic original source opening'}),category=await createExpenseCategory(ctx,{operationId:randomUUID(),name:'List expense category',treatment:'operating'});
 for(let i=1;i<=43;i++)await postExpense(ctx,{operationId:randomUUID(),accountId:bank.id,expenseCategoryId:category.id,amount:String(i),reason:'Financial list original '+String(i).padStart(3,'0')});
 const amounts:string[]=[];
 for(let page=1;page<=3;page++){
  const response=await financeList(request('/finance/documents?kind=expense&search=Financial%20list%20original&sort=amount_desc&limit=20&page='+page,a.cookie),undefined);assert.equal(response.status,200);const result=await response.json();assert.equal(result.pagination.total,43);amounts.push(...result.data.map((r:{amount:string})=>r.amount));
 }
 assert.deepEqual(amounts,Array.from({length:43},(_,i)=>String(43-i)));
 const csv=await financeList(request('/finance/documents?kind=expense&search=Financial%20list%20original&sort=amount_desc&format=csv&page=3',a.cookie),undefined);assert.equal((await csv.json()).data.content.split('\r\n').filter(Boolean).length,44);
 for(const [path,handler] of [['/shifts',shiftsList],['/finance/documents',financeList]] as const){
  for(const invalid of ['page=0','sort=afterData','limit=201','from=2026-10-32'])assert.equal((await handler(request(path+'?'+invalid,a.cookie),undefined)).status,400,invalid);
  const zero=await handler(request(path+'?search=NO-SUCH-POSTING',a.cookie),undefined);assert.equal((await zero.json()).pagination.total,0);
 }
 assert.equal((await prisma.accountEntry.aggregate({where:{accountId:bank.id},_sum:{amount:true}}))._sum.amount?.toFixed(2),'9054.00');
});

test('Original cancelled stock counts have scoped stable pages without exposing blind expected quantities',async()=>{
 const a=await account(),ctx=(await verifyToken(getRequestToken(request('/stock-counts',a.cookie))!))!,product=await prisma.product.create({data:{organizationId:a.data.organization.id,name:'Blind count list source',sku:randomUUID(),barcode:randomUUID(),unit:'dona',salePrice:'10',costPrice:'2'}});
 const ids:string[]=[];
 for(let i=0;i<43;i++){
  const row=await startCount(ctx,{operationId:randomUUID(),organizationId:a.data.organization.id,storeId:a.store.id,scope:'partial',blind:true,productIds:[product.id]});ids.push(row.id);
  await finishCount(ctx,row.id,{operationId:randomUUID(),reason:'Cancel synthetic source without changing physical stock'},true);
 }
 const collected:string[]=[];
 for(let page=1;page<=3;page++){
  const response=await countsList(request('/stock-counts?filter=all&sort=oldest&limit=20&page='+page,a.cookie),undefined);assert.equal(response.status,200);const result=await response.json();assert.equal(result.pagination.total,43);assert.ok(result.data.every((row:Record<string,unknown>)=>!('lines' in row)&&!('expectedQuantity' in row)));collected.push(...result.data.map((r:{id:string})=>r.id));
 }
 assert.deepEqual(collected,ids);
 assert.equal((await(await countsList(request('/stock-counts?filter=active',a.cookie),undefined)).json()).pagination.total,0);
 assert.equal((await(await countsList(request('/stock-counts?filter=all&search='+ids[42],a.cookie),undefined)).json()).pagination.total,1);
 for(const bad of ['page=0','sort=expectedQuantity','limit=201','filter=unknown'])assert.equal((await countsList(request('/stock-counts?'+bad,a.cookie),undefined)).status,400);
 assert.equal(await prisma.inventoryMovement.count({where:{organizationId:a.data.organization.id}}),0);
});
