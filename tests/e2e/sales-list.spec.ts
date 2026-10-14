import {test,expect} from '@playwright/test';
import {PrismaClient} from '@prisma/client';
import {randomUUID} from 'node:crypto';
const url=new URL(process.env.DATABASE_URL??'');
if(url.hostname!=='127.0.0.1'||url.port!=='55439'||url.pathname!=='/pos_test'||url.username!=='pos_test')throw Error('Isolated pos_test only');
const db=new PrismaClient(),orgs:string[]=[],users:string[]=[];
test.afterAll(async()=>{await db.organization.deleteMany({where:{id:{in:orgs}}});await db.user.deleteMany({where:{id:{in:users}}});await db.$disconnect();});
test('Sales URL search/sort/pages survive reload and history; failure and stale response remain distinct from empty data',async({page})=>{
  test.setTimeout(120000);
  const response=await page.request.post('/api/auth/register',{headers:{Origin:'https://localhost:3100'},data:{phone:'sales-list-browser-'+randomUUID(),password:'test-only-password',fullName:'List browser owner',organizationName:'List browser fixture'}});
  expect(response.ok()).toBe(true);const me=(await response.json()).data;orgs.push(me.organization.id);users.push(me.user.id);
  const store=await db.store.findFirstOrThrow({where:{organizationId:me.organization.id}}),terminal=await db.register.findFirstOrThrow({where:{storeId:store.id}});
  const shift=await db.shift.create({data:{registerId:terminal.id,organizationUserId:me.user.organizationUserId,openingCash:0}});
  await db.sale.createMany({data:Array.from({length:43},(_,i)=>({organizationId:me.organization.id,storeId:store.id,registerId:terminal.id,shiftId:shift.id,cashierId:me.user.id,
    receiptNo:'BROWSER-LIST-'+String(i).padStart(3,'0'),subtotal:i,discountAmount:0,totalAmount:i,status:'draft',createdAt:new Date('2026-10-01T00:00:00Z')}))});
  await page.goto('/sales?sort=amount_desc');
  await expect(page.locator('tbody tr').first()).toContainText('BROWSER-LIST-042');
  await expect(page.locator('tbody tr')).toHaveCount(20);
  await page.getByRole('button',{name:'Keyingi',exact:true}).click();
  await expect(page).toHaveURL(/page=2/);await expect(page.locator('tbody tr').first()).toContainText('BROWSER-LIST-022');
  await page.reload();await expect(page.locator('tbody tr').first()).toContainText('BROWSER-LIST-022');
  await page.getByLabel('Chek yoki mijoz qidirish',{exact:true}).fill('BROWSER-LIST-001');
  await page.getByRole('button',{name:'Qidirish',exact:true}).click();await expect(page.locator('tbody tr')).toHaveCount(1);
  await expect(page.locator('tbody tr')).toContainText('BROWSER-LIST-001');await expect(page).toHaveURL(/page=1.*search=BROWSER-LIST-001/);
  await page.goBack();await expect(page.locator('tbody tr').first()).toContainText('BROWSER-LIST-022');
  await page.getByRole('button',{name:'Yakunlangan',exact:true}).click();await expect(page.getByText('Savdolar topilmadi',{exact:true})).toBeVisible();
  await page.getByRole('button',{name:'Filtrlarni tozalash',exact:true}).click();await expect(page.locator('tbody tr')).toHaveCount(20);

  let fail=true;
  await page.route('**/api/sales?**',async route=>{
    if(fail){fail=false;await route.fulfill({status:500,json:{success:false,error:{code:'INTERNAL_ERROR',message:'Synthetic list failure'}}});}
    else await route.continue();
  });
  await page.getByRole('button',{name:'Yangilash',exact:true}).click();await expect(page.getByRole('alert',{name:'Savdolar ro‘yxati xatosi',exact:true})).toContainText('Synthetic list failure');
  await expect(page.getByText('Savdolar topilmadi',{exact:true})).toHaveCount(0);
  await page.getByRole('button',{name:'Qayta yuklash',exact:true}).click();await expect(page.locator('tbody tr')).toHaveCount(20);
  await page.unroute('**/api/sales?**');

  let release!:()=>void;const held=new Promise<void>(resolve=>{release=resolve;});let started!:()=>void;const startedPromise=new Promise<void>(resolve=>{started=resolve;});
  await page.route('**/api/sales?**',async route=>{
    if(new URL(route.request().url()).searchParams.get('status')==='draft'){
      const original=await route.fetch();started();await held;await route.fulfill({response:original});
    }else await route.continue();
  });
  await page.getByRole('button',{name:'Qoralama',exact:true}).click();await startedPromise;
  await page.getByRole('button',{name:'Yakunlangan',exact:true}).click();await expect(page.getByText('Savdolar topilmadi',{exact:true})).toBeVisible();
  const finished=page.waitForResponse(r=>r.url().includes('/api/sales?')&&new URL(r.url()).searchParams.get('status')==='draft');
  release();await finished;await expect(page.getByText('Savdolar topilmadi',{exact:true})).toBeVisible();await expect(page.locator('tbody tr')).toHaveCount(0);
  await page.unroute('**/api/sales?**');
  await page.goto('/sales?page=0');await expect(page.getByRole('alert',{name:'Savdolar ro‘yxati xatosi',exact:true})).toContainText('URL dagi filtr yoki sahifa noto‘g‘ri');
  await page.getByRole('button',{name:'Filtrlarni tozalash',exact:true}).click();await expect(page.locator('tbody tr')).toHaveCount(20);
});

test('Catalog and customer URL pages reach records beyond the old truncation and keep filter state through reload',async({page})=>{
  test.setTimeout(120000);
  const registered=await page.request.post('/api/auth/register',{headers:{Origin:'https://localhost:3100'},data:{phone:'catalog-list-browser-'+randomUUID(),password:'test-only-password',fullName:'Catalog list browser owner',organizationName:'Catalog list browser fixture'}});
  expect(registered.ok()).toBe(true);const me=(await registered.json()).data;orgs.push(me.organization.id);users.push(me.user.id);
  await db.product.createMany({data:Array.from({length:105},(_,i)=>({organizationId:me.organization.id,name:'Paged item '+String(i).padStart(3,'0'),sku:randomUUID(),barcode:randomUUID(),unit:'dona',salePrice:i,costPrice:1}))});
  await db.customer.createMany({data:Array.from({length:105},(_,i)=>({organizationId:me.organization.id,fullName:'Paged customer '+String(i).padStart(3,'0'),phone:'paged-'+randomUUID()}))});
  for(const [path,label,last,first] of [
    ['/products','Mahsulot qidirish','Paged item 104','Paged item 000'],
    ['/customers','Mijoz qidirish','Paged customer 104','Paged customer 000'],
  ]){
    await page.goto(path+'?page=6');await expect(page.locator('tbody tr')).toHaveCount(5);await expect(page.locator('tbody tr').last()).toContainText(last);
    await page.getByLabel(label,{exact:true}).fill(first);await page.getByRole('button',{name:'Qidirish',exact:true}).click();
    await expect(page.locator('tbody tr')).toHaveCount(1);await expect(page.locator('tbody tr')).toContainText(first);await expect(page).toHaveURL(/page=1.*search=Paged/);
    await page.reload();await expect(page.getByLabel(label,{exact:true})).toHaveValue(first);await expect(page.locator('tbody tr')).toHaveCount(1);
    await page.getByRole('button',{name:'Filtrlarni tozalash',exact:true}).click();await page.getByLabel('Saralash',{exact:true}).selectOption('name_desc');
    await expect(page.locator('tbody tr').first()).toContainText(last);
    await page.getByLabel(label,{exact:true}).fill('No such fixture record');await page.getByRole('button',{name:'Qidirish',exact:true}).click();
    await expect(page.getByText(path==='/products'?'Mahsulotlar topilmadi':'Mijozlar topilmadi',{exact:true})).toBeVisible();
    await page.getByRole('button',{name:'Filtrlarni tozalash',exact:true}).click();await expect(page.locator('tbody tr')).toHaveCount(20);
  }
});

test('Category/unit URL search, state and pages preserve a separate unsaved editor through read navigation',async({page})=>{
  test.setTimeout(120000);
  const registered=await page.request.post('/api/auth/register',{headers:{Origin:'https://localhost:3100'},data:{phone:'reference-list-browser-'+randomUUID(),password:'test-only-password',fullName:'Reference list owner',organizationName:'Reference list fixture'}});
  expect(registered.ok()).toBe(true);const me=(await registered.json()).data;orgs.push(me.organization.id);users.push(me.user.id);
  await db.category.createMany({data:Array.from({length:43},(_,i)=>({organizationId:me.organization.id,name:'Reference '+String(i).padStart(3,'0'),sortOrder:i}))});
  await db.unit.createMany({data:Array.from({length:43},(_,i)=>({organizationId:me.organization.id,code:'ref_'+String(i).padStart(3,'0'),name:'Reference '+String(i).padStart(3,'0'),precision:0}))});
  for(const [path,editorLabel,stateLabel] of [
    ['/products/categories','Kategoriya nomi','Kategoriya holati'],
    ['/products/units','Nomi','Birlik holati'],
  ]){
    await page.goto(path+'?search=Reference&sort=name_desc&page=3');
    await expect(page.locator('tbody tr')).toHaveCount(3);await expect(page.locator('tbody tr').first()).toContainText('Reference 002');
    await page.reload();await expect(page.locator('tbody tr').first()).toContainText('Reference 002');
    await page.getByLabel(editorLabel,{exact:true}).fill('Unsubmitted original editor');
    await page.getByLabel(stateLabel,{exact:true}).selectOption('archived');
    await expect(page.getByText(path.endsWith('categories')?'Kategoriya topilmadi.':'Birlik topilmadi.',{exact:true})).toBeVisible();
    await expect(page.getByLabel(editorLabel,{exact:true})).toHaveValue('Unsubmitted original editor');
    await page.getByRole('button',{name:'Filtrlarni tozalash',exact:true}).click();await expect(page.locator('tbody tr')).toHaveCount(20);
    await expect(page.getByLabel(editorLabel,{exact:true})).toHaveValue('Unsubmitted original editor');
    page.once('dialog',dialog=>dialog.accept());await page.getByRole('button',{name:'Bekor qilish',exact:true}).click();
    await expect(page.getByLabel(editorLabel,{exact:true})).toHaveValue('');
  }
});

test('Supplier/brand/audit applied URL state survives history and reload; business draft survives filtering and errors never become zero rows',async({page})=>{
 test.setTimeout(120000);
 const response=await page.request.post('/api/auth/register',{headers:{Origin:'https://localhost:3100'},data:{phone:'extended-list-'+randomUUID(),password:'test-only-password',fullName:'Extended list owner',organizationName:'Extended list fixture'}});
 expect(response.ok()).toBe(true);const me=(await response.json()).data;orgs.push(me.organization.id);users.push(me.user.id);
 const rows=Array.from({length:43},(_,i)=>({organizationId:me.organization.id,name:'Extended browser '+String(i).padStart(3,'0')}));
 await db.supplier.createMany({data:rows});await db.brand.createMany({data:rows});
 await db.auditLog.createMany({data:rows.map((_,i)=>({organizationId:me.organization.id,actorId:me.user.id,entityType:'ExtendedBrowserAudit',entityId:String(i).padStart(3,'0'),action:'synthetic_extended_acceptance',createdAt:new Date(Date.UTC(2026,9,1,0,0,i))}))});
 for(const [path,label] of [['/suppliers','Nomi, telefon yoki STIR'],['/products/brands','Brend qidirish']] as const){
  await page.goto(path+'?sort=name_desc&page=3&status=all');await expect(page.locator('tbody tr')).toHaveCount(3);await expect(page.locator('tbody tr').last()).toContainText('Extended browser 000');
  await page.reload();await expect(page.locator('tbody tr')).toHaveCount(3);
  if(path==='/products/brands')await page.getByLabel('Brend nomi',{exact:true}).fill('Unsaved original brand');
  await page.getByLabel(label,{exact:true}).fill('Extended browser 042');await page.getByRole('button',{name:'Qidirish',exact:true}).click();await expect(page.locator('tbody tr')).toHaveCount(1);await expect(page).toHaveURL(/search=Extended\+browser\+042/);
  if(path==='/products/brands')await expect(page.getByLabel('Brend nomi',{exact:true})).toHaveValue('Unsaved original brand');
  await page.goBack();await expect(page.locator('tbody tr')).toHaveCount(3);
  if(path==='/products/brands')await page.getByLabel('Brend nomi',{exact:true}).fill('');
  await page.getByLabel(label,{exact:true}).fill('NO-MATCH');await page.getByRole('button',{name:'Qidirish',exact:true}).click();await expect(page.locator('tbody tr')).toHaveCount(0);
  await page.getByRole('button',{name:'Filtrlarni tozalash',exact:true}).click();await expect(page.locator('tbody tr')).toHaveCount(20);
  await page.route('**/api/'+(path==='/suppliers'?'suppliers':'brands')+'?**',route=>route.fulfill({status:500,json:{success:false,error:{code:'INTERNAL_ERROR',message:'Synthetic extended failure'}}}));
  await page.getByRole('button',{name:'Qayta yuklash',exact:true}).click();await expect(page.getByRole('alert').filter({hasText:'Synthetic extended failure'})).toBeVisible();
  await expect(page.getByText(path==='/suppliers'?'Yetkazib beruvchi topilmadi.':'Brend topilmadi.',{exact:true})).toHaveCount(0);
  await page.unroute('**/api/'+(path==='/suppliers'?'suppliers':'brands')+'?**');await page.getByRole('button',{name:'Qayta yuklash',exact:true}).click();await expect(page.locator('tbody tr')).toHaveCount(20);
 }
 await page.goto('/audit?search=ExtendedBrowserAudit&sort=oldest&page=3');await expect(page.locator('tbody tr')).toHaveCount(3);await expect(page.locator('tbody tr').first()).toContainText('040');
 await page.getByRole('button',{name:'Oldingi',exact:true}).click();await expect(page).toHaveURL(/page=2/);await page.reload();await expect(page.locator('tbody tr')).toHaveCount(20);
 await page.getByLabel('Resurs turi (masalan SaleReturn)',{exact:true}).fill('NO-SUCH-TYPE');await page.getByRole('button',{name:'Filtrlash',exact:true}).click();await expect(page.getByText('Hodisa topilmadi.',{exact:true})).toBeVisible();
 await page.goBack();await expect(page.locator('tbody tr')).toHaveCount(20);await expect(page.getByLabel('Resurs turi (masalan SaleReturn)',{exact:true})).toHaveValue('');
 await page.goto('/audit?page=0');await expect(page.getByRole('alert').filter({hasText:'URL filtri yoki sahifasi noto‘g‘ri'})).toBeVisible();await page.getByRole('button',{name:'Filtrlarni tozalash',exact:true}).click();await expect(page.locator('tbody tr').first()).toBeVisible();
});

test('Inventory balances/documents and transfers keep applied filters in URL, allow error recovery and retain original business drafts',async({page})=>{
 test.setTimeout(120000);
 const response=await page.request.post('/api/auth/register',{headers:{Origin:'https://localhost:3100'},data:{phone:'inventory-list-browser-'+randomUUID(),password:'test-only-password',fullName:'Inventory list owner',organizationName:'Inventory list fixture'}});
 expect(response.ok()).toBe(true);const me=(await response.json()).data;orgs.push(me.organization.id);users.push(me.user.id);
 const store=await db.store.findFirstOrThrow({where:{organizationId:me.organization.id}}),other=await db.store.create({data:{organizationId:me.organization.id,name:'Inventory receiving branch'}});
 const products=await Promise.all(Array.from({length:43},(_,i)=>db.product.create({data:{organizationId:me.organization.id,name:'Inventory browser '+String(i).padStart(3,'0'),sku:randomUUID(),barcode:randomUUID(),unit:'dona',salePrice:'10',costPrice:'2'}})));
 await db.inventoryBalance.createMany({data:products.map((p,i)=>({storeId:store.id,productId:p.id,quantity:String(i)}))});
 await db.stockDocument.createMany({data:products.map((_,i)=>({organizationId:me.organization.id,storeId:store.id,documentType:'purchase',documentNo:'BROWSER-DOC-'+String(i).padStart(3,'0'),createdBy:me.user.id,createdAt:new Date(Date.UTC(2026,9,1,0,0,i))}))});
 await db.stockTransfer.createMany({data:products.map((_,i)=>({organizationId:me.organization.id,fromStoreId:store.id,toStoreId:other.id,note:'BROWSER-TRANSFER-'+String(i).padStart(3,'0'),createdBy:me.user.id,createdAt:new Date(Date.UTC(2026,9,1,0,0,i))}))});
 await page.goto('/inventory?sort=quantity_desc&page=3');await expect(page.locator('tbody tr')).toHaveCount(3);await expect(page.locator('tbody tr').last()).toContainText('Inventory browser 000');await page.reload();await expect(page.locator('tbody tr')).toHaveCount(3);
 await page.getByLabel('Mahsulot, SKU yoki barkod',{exact:true}).fill('Inventory browser 042');await page.getByRole('button',{name:'Filtrlash',exact:true}).click();await expect(page.locator('tbody tr')).toHaveCount(1);await expect(page).toHaveURL(/search=Inventory\+browser\+042/);
 await page.goBack();await expect(page.locator('tbody tr')).toHaveCount(3);await expect(page.getByLabel('Mahsulot, SKU yoki barkod',{exact:true})).toHaveValue('');
 await page.goto('/inventory?tab=documents&sort=oldest&page=3');await expect(page.locator('tbody tr')).toHaveCount(3);await expect(page.locator('tbody tr').first()).toContainText('BROWSER-DOC-040');await page.reload();await expect(page.locator('tbody tr')).toHaveCount(3);
 await page.getByLabel('Hujjat raqamini qidirish',{exact:true}).fill('NO-SUCH-DOCUMENT');await page.getByRole('button',{name:'Filtrlash',exact:true}).click();await expect(page.locator('tbody tr')).toHaveCount(0);await page.getByRole('button',{name:'Filtrlarni tozalash',exact:true}).click();await expect(page.locator('tbody tr')).toHaveCount(20);
 let fail=true;await page.route('**/api/stock-documents?**',async route=>{if(fail){fail=false;await route.fulfill({status:500,json:{success:false,error:{code:'INTERNAL_ERROR',message:'Synthetic inventory list failure'}}});}else await route.continue();});
 await page.getByRole('button',{name:'Qayta yuklash',exact:true}).click();await expect(page.getByRole('alert').filter({hasText:'Synthetic inventory list failure'})).toBeVisible();await expect(page.getByText('Hujjatlar topilmadi',{exact:true})).toHaveCount(0);await page.getByRole('button',{name:'Qayta yuklash',exact:true}).click();await expect(page.locator('tbody tr')).toHaveCount(20);await page.unroute('**/api/stock-documents?**');
 await page.goto('/inventory/transfers?sort=oldest&page=3');await expect(page.locator('tbody tr')).toHaveCount(3);await page.reload();await expect(page.locator('tbody tr')).toHaveCount(3);
 await page.getByLabel('Transfer izohi yoki filial qidirish',{exact:true}).fill('BROWSER-TRANSFER-000');await page.getByRole('button',{name:'Qidirish',exact:true}).click();await expect(page.locator('tbody tr')).toHaveCount(1);await expect(page).toHaveURL(/search=BROWSER-TRANSFER-000/);await page.goBack();await expect(page.locator('tbody tr')).toHaveCount(3);
 await page.getByLabel('Transfer holati filtri',{exact:true}).selectOption('sent');await page.getByRole('button',{name:'Filtrlash',exact:true}).click();await expect(page.getByText('Transferlar topilmadi',{exact:true})).toBeVisible();await page.goBack();await expect(page.locator('tbody tr')).toHaveCount(3);await expect(page.getByLabel('Transfer holati filtri',{exact:true})).toHaveValue('');
 await page.goto('/inventory?tab=documents&page=0');await expect(page.getByRole('alert').filter({hasText:'URL filtri yoki sahifasi noto‘g‘ri'})).toBeVisible();await page.getByRole('button',{name:'Filtrlarni tozalash',exact:true}).click();await expect(page.locator('tbody tr')).toHaveCount(20);
});

test('Shift and finance URL pages reach original postings, preserve exact amounts and recover from a failed list read',async({page})=>{
 test.setTimeout(120000);const headers={Origin:'https://localhost:3100'};
 const registered=await page.request.post('/api/auth/register',{headers,data:{phone:'finance-list-browser-'+randomUUID(),password:'test-only-password',fullName:'Finance list owner',organizationName:'Finance list fixture'}});expect(registered.ok()).toBe(true);const me=(await registered.json()).data;orgs.push(me.organization.id);users.push(me.user.id);
 const store=await db.store.findFirstOrThrow({where:{organizationId:me.organization.id}}),register=await db.register.findFirstOrThrow({where:{storeId:store.id}});
 const post=async(path:string,body:Record<string,unknown>)=>{const response=await page.request.post(path,{headers,data:{operationId:randomUUID(),...body}});expect(response.ok(),await response.text()).toBe(true);return(await response.json()).data;};
 for(let i=0;i<21;i++){const shift=await post('/api/shifts',{registerId:register.id,organizationUserId:me.user.organizationUserId,openingCash:'0'});await post('/api/shifts/'+shift.id,{countedCash:'0'});}
 const account=await post('/api/finance/accounts',{storeId:store.id,name:'Finance list internal bank',kind:'bank',openingBalance:'1000',reason:'Actual isolated internal opening journal'}),category=await post('/api/finance/categories',{name:'Finance browser expense',treatment:'operating'});
 for(let i=1;i<=21;i++)await post('/api/finance/expenses',{accountId:account.id,expenseCategoryId:category.id,amount:String(i),reason:'BROWSER-FINANCE-'+String(i).padStart(3,'0')});
 await page.goto('/shifts?sort=oldest&page=2');await expect(page.locator('tbody tr')).toHaveCount(1);await page.reload();await expect(page.locator('tbody tr')).toHaveCount(1);
 await page.getByLabel('Smena holati',{exact:true}).selectOption('open');await expect(page.locator('tbody tr')).toHaveCount(0);await page.goBack();await expect(page.locator('tbody tr')).toHaveCount(1);
 await page.goto('/finance?kind=expense&sort=amount_desc&page=2');await expect(page.locator('tbody tr')).toHaveCount(1);await expect(page.locator('tbody tr')).toContainText('BROWSER-FINANCE-001');await page.reload();await expect(page.locator('tbody tr')).toHaveCount(1);
 await page.getByLabel('Hisob nomi',{exact:true}).fill('Retained unsaved bank draft');await page.getByLabel('Moliyaviy hujjat sababi qidirish',{exact:true}).fill('BROWSER-FINANCE-021');await page.getByRole('button',{name:'Qidirish',exact:true}).click();await expect(page.locator('tbody tr')).toHaveCount(1);await expect(page.locator('tbody tr')).toContainText('BROWSER-FINANCE-021');await expect(page.getByLabel('Hisob nomi',{exact:true})).toHaveValue('Retained unsaved bank draft');await page.goBack();await expect(page.locator('tbody tr')).toContainText('BROWSER-FINANCE-001');
 let fail=true;await page.route('**/api/finance/documents?**',async route=>{if(fail){fail=false;await route.fulfill({status:500,json:{success:false,error:{code:'INTERNAL_ERROR',message:'Synthetic finance list failure'}}});}else await route.continue();});await page.getByRole('button',{name:'Qayta yuklash',exact:true}).click();await expect(page.getByRole('alert').filter({hasText:'Synthetic finance list failure'})).toBeVisible();await expect(page.getByText('Hujjatlar yo‘q.',{exact:true})).toHaveCount(0);await page.getByRole('button',{name:'Qayta yuklash',exact:true}).click();await expect(page.locator('tbody tr')).toHaveCount(1);await page.unroute('**/api/finance/documents?**');
 expect(String((await db.accountEntry.aggregate({where:{accountId:account.id},_sum:{amount:true}}))._sum.amount)).toBe('769');
});

test('Expired synthetic job sources and actual inventory-gap scan display all URL pages without exposing worker payload; errors retain business drafts',async({page})=>{
 test.setTimeout(120000);const headers={Origin:'https://localhost:3100'};
 const registered=await page.request.post('/api/auth/register',{headers,data:{phone:'operational-list-browser-'+randomUUID(),password:'test-only-password',fullName:'Operational list owner',organizationName:'Operational list fixture'}});expect(registered.ok()).toBe(true);const me=(await registered.json()).data;orgs.push(me.organization.id);users.push(me.user.id);
 const session=await db.session.findFirstOrThrow({where:{organizationId:me.organization.id,userId:me.user.id,revokedAt:null}}),store=await db.store.findFirstOrThrow({where:{organizationId:me.organization.id}});
 // Only isolated fixtures: original expired source authorization and its actual
 // cancellation journal. No production worker success/result is fabricated.
 for(let i=0;i<43;i++)await db.$transaction(async tx=>{
  const job=await tx.backgroundJob.create({data:{organizationId:me.organization.id,type:'reconciliation',payload:{storeId:store.id},expiresAt:new Date(Date.now()-1)}});
  await tx.jobAuthorization.create({data:{jobId:job.id,organizationId:me.organization.id,generation:0,userId:me.user.id,sessionId:session.id,reason:'Synthetic already-expired isolated source'}});
  await tx.backgroundJob.update({where:{id:job.id},data:{state:'cancelled',lastError:'JOB_EXPIRED',leaseToken:null,leaseUntil:null}});
  await tx.jobEvent.create({data:{jobId:job.id,event:'cancelled',attempt:0,generation:0,code:'JOB_EXPIRED'}});
 });
 const products=await Promise.all(Array.from({length:43},(_,i)=>db.product.create({data:{organizationId:me.organization.id,name:'Intentional physical fixture gap '+i,sku:randomUUID(),barcode:randomUUID(),unit:'dona',salePrice:'1',costPrice:'0'}})));
 await db.inventoryBalance.createMany({data:products.map(product=>({storeId:store.id,productId:product.id,quantity:'2'}))});
 expect((await page.request.post('/api/incidents',{headers,data:{operationId:randomUUID()}})).ok()).toBe(true);
 await page.goto('/jobs?state=cancelled&sort=oldest&page=3');await expect(page.locator('article')).toHaveCount(3);await page.reload();await expect(page.locator('article')).toHaveCount(3);
 await page.getByLabel('Fon ishini tasdiqlash sababi',{exact:true}).fill('Retained unsaved internal work reason');await page.getByLabel('Fon ishining holati',{exact:true}).selectOption('queued');await expect(page.getByText('Bu filtrda fon ishi yo‘q.',{exact:true})).toBeVisible();await page.goBack();await expect(page.locator('article')).toHaveCount(3);await expect(page.getByLabel('Fon ishini tasdiqlash sababi',{exact:true})).toHaveValue('Retained unsaved internal work reason');await page.getByLabel('Fon ishini tasdiqlash sababi',{exact:true}).fill('');
 let fail=true;await page.route('**/api/jobs?**',async route=>{if(fail){fail=false;await route.fulfill({status:500,json:{success:false,error:{code:'INTERNAL_ERROR',message:'Synthetic operational list failure'}}});}else await route.continue();});await page.getByRole('button',{name:'Fon ishlarini yangilash',exact:true}).click();await expect(page.getByRole('alert').filter({hasText:'Synthetic operational list failure'})).toBeVisible();await expect(page.getByText('Bu filtrda fon ishi yo‘q.',{exact:true})).toHaveCount(0);await page.getByRole('button',{name:'Qayta yuklash',exact:true}).click();await expect(page.locator('article')).toHaveCount(3);await page.unroute('**/api/jobs?**');
 await page.goto('/incidents?state=open&sort=oldest&page=3');await expect(page.locator('article')).toHaveCount(3);await page.reload();await expect(page.locator('article')).toHaveCount(3);
 await page.getByLabel('Yopish sababi',{exact:true}).fill('Retained unsaved discrepancy reason');await page.getByLabel('Tafovut holati',{exact:true}).selectOption('resolved');await expect(page.getByText('Ushbu holatda tafovut yo‘q.',{exact:false})).toBeVisible();await page.goBack();await expect(page.locator('article')).toHaveCount(3);await expect(page.getByLabel('Yopish sababi',{exact:true})).toHaveValue('Retained unsaved discrepancy reason');
 expect(await db.inventoryMovement.count({where:{organizationId:me.organization.id}})).toBe(0);expect(await db.inventoryBalance.count({where:{storeId:store.id,quantity:'2'}})).toBe(43);
});

test('Cancelled count and original damaged-return pages preserve native stock/refund history and URL filters',async({page})=>{
 test.setTimeout(120000);const headers={Origin:'https://localhost:3100'};
 const registered=await page.request.post('/api/auth/register',{headers,data:{phone:'count-return-list-'+randomUUID(),password:'test-only-password',fullName:'Count return owner',organizationName:'Count return list fixture'}});expect(registered.ok()).toBe(true);const me=(await registered.json()).data;orgs.push(me.organization.id);users.push(me.user.id);
 const store=await db.store.findFirstOrThrow({where:{organizationId:me.organization.id}}),register=await db.register.findFirstOrThrow({where:{storeId:store.id}}),product=await db.product.create({data:{organizationId:me.organization.id,name:'Original frozen return name',sku:randomUUID(),barcode:randomUUID(),unit:'dona',salePrice:'10',costPrice:'2'}});
 await db.inventoryBalance.create({data:{storeId:store.id,productId:product.id,quantity:'43'}});
 const post=async(path:string,body:Record<string,unknown>)=>{const response=await page.request.post(path,{headers,data:{operationId:randomUUID(),...body}});expect(response.ok(),await response.text()).toBe(true);return(await response.json()).data;};
 for(let i=0;i<21;i++){const count=await post('/api/stock-counts',{organizationId:me.organization.id,storeId:store.id,scope:'partial',blind:true,productIds:[product.id]});await post('/api/stock-counts/'+count.id+'/cancel',{reason:'Cancel original isolated count without a stock posting'});}
 const shift=await post('/api/shifts',{registerId:register.id,organizationUserId:me.user.organizationUserId,openingCash:'0'}),sale=await post('/api/sales',{organizationId:me.organization.id,storeId:store.id,registerId:register.id,shiftId:shift.id,discountAmount:0,items:[{productId:product.id,quantity:'43',discountAmount:0}]});await post('/api/sales/'+sale.id+'/complete',{payments:[{paymentType:'cash',amount:'430'}]});
 await db.product.update({where:{id:product.id},data:{name:'New current catalog name',costPrice:'999'}});
 for(let i=0;i<43;i++)await post('/api/sales/'+sale.id+'/returns',{shiftId:shift.id,reason:'Original unit inspected as damaged',items:[{saleItemId:sale.items[0].id,quantity:'1',disposition:'damaged'}]});
 await page.goto('/inventory/counts?filter=all&sort=oldest&page=2');await expect(page.locator('tbody tr')).toHaveCount(1);await page.reload();await expect(page.locator('tbody tr')).toHaveCount(1);await page.getByLabel('Yakunlangan sanashlarni ham ko‘rsatish',{exact:true}).uncheck();await expect(page.getByText('Sanash topilmadi.',{exact:true})).toBeVisible();await page.goBack();await expect(page.locator('tbody tr')).toHaveCount(1);
 await page.goto('/inventory/dispositions?search=Original+frozen&sort=oldest&page=3');await expect(page.locator('tbody tr')).toHaveCount(3);await expect(page.locator('tbody tr').first()).toContainText('Original frozen return name');await page.reload();await expect(page.locator('tbody tr')).toHaveCount(3);
 await page.getByLabel('Original mahsulot yoki SKU qidirish',{exact:true}).fill('New current catalog name');await page.getByRole('button',{name:'Qidirish',exact:true}).click();await expect(page.getByText('Yozuv topilmadi.',{exact:true})).toBeVisible();await page.goBack();await expect(page.locator('tbody tr')).toHaveCount(3);
 expect(String((await db.payment.aggregate({where:{saleId:sale.id,direction:'out'},_sum:{amount:true}}))._sum.amount)).toBe('430');expect((await db.inventoryBalance.findUniqueOrThrow({where:{storeId_productId:{storeId:store.id,productId:product.id}}})).quantity.toFixed()).toBe('0');
});

test('Archive types and replenishment global sorting retain URL history and configured minimum-only advice without stock postings',async({page})=>{
 test.setTimeout(120000);const headers={Origin:'https://localhost:3100'};
 const registered=await page.request.post('/api/auth/register',{headers,data:{phone:'archive-restock-list-'+randomUUID(),password:'test-only-password',fullName:'Archive restock owner',organizationName:'Archive restock fixture'}});expect(registered.ok()).toBe(true);const me=(await registered.json()).data;orgs.push(me.organization.id);users.push(me.user.id);
 const store=await db.store.findFirstOrThrow({where:{organizationId:me.organization.id}}),names=Array.from({length:43},(_,i)=>'Archived list '+String(i).padStart(3,'0'));
 await db.product.createMany({data:names.map(name=>({organizationId:me.organization.id,name,sku:randomUUID(),barcode:randomUUID(),unit:'dona',salePrice:'10',costPrice:'2',isActive:false}))});
 await db.customer.createMany({data:names.map(fullName=>({organizationId:me.organization.id,fullName,phone:randomUUID(),isActive:false}))});await db.category.createMany({data:names.map(name=>({organizationId:me.organization.id,name,isActive:false}))});
 for(const kind of ['products','customers','categories']){
  await page.goto('/archive?kind='+kind+'&sort=name_desc&page=3');await expect(page.locator('tbody tr')).toHaveCount(3);await expect(page.locator('tbody tr').first()).toContainText('Archived list 002');await page.reload();await expect(page.locator('tbody tr')).toHaveCount(3);
  await page.getByLabel('Arxiv nomi qidirish',{exact:true}).fill('Archived list 042');await page.getByRole('button',{name:'Qidirish',exact:true}).click();await expect(page.locator('tbody tr')).toHaveCount(1);await page.goBack();await expect(page.locator('tbody tr')).toHaveCount(3);
 }
 const products=await Promise.all(Array.from({length:43},(_,i)=>db.product.create({data:{organizationId:me.organization.id,name:'Restock browser '+String(i).padStart(3,'0'),sku:randomUUID(),barcode:randomUUID(),unit:'dona',salePrice:'10',costPrice:'2',minStock:i===0?'50':String(i+1)}})));
 expect(products[0].minStock.toFixed()).toBe('50');
 expect(store.organizationId).toBe(me.organization.id);
 await page.goto('/replenishment?search=Restock+browser&sort=suggested_desc&page=3');await expect(page.locator('tbody tr')).toHaveCount(3);await page.reload();await expect(page.locator('tbody tr')).toHaveCount(3);
 await page.getByLabel('Tavsiya mahsuloti yoki filial qidirish',{exact:true}).fill('Restock browser 000');await page.getByRole('button',{name:'Qidirish',exact:true}).click();await expect(page.locator('tbody tr')).toHaveCount(1);await expect(page.locator('tbody tr')).toContainText('50');await expect(page.locator('tbody tr')).toContainText('(minimumgacha)');await page.goBack();await expect(page.locator('tbody tr')).toHaveCount(3);
 expect(await db.inventoryMovement.count({where:{organizationId:me.organization.id}})).toBe(0);
});

test('Purchase, supplier balance and sales breakdown URL pages share exact original source cutoff and filtered totals',async({page})=>{
 test.setTimeout(120000);const headers={Origin:'https://localhost:3100'};
 const registered=await page.request.post('/api/auth/register',{headers,data:{phone:'report-list-browser-'+randomUUID(),password:'test-only-password',fullName:'Report list owner',organizationName:'Report list fixture'}});expect(registered.ok()).toBe(true);const me=(await registered.json()).data;orgs.push(me.organization.id);users.push(me.user.id);
 const store=await db.store.findFirstOrThrow({where:{organizationId:me.organization.id}}),register=await db.register.findFirstOrThrow({where:{storeId:store.id}}),products=[];
 const post=async(path:string,body:Record<string,unknown>)=>{const response=await page.request.post(path,{headers,data:{operationId:randomUUID(),...body}});expect(response.ok(),await response.text()).toBe(true);return(await response.json()).data;};
 for(let i=0;i<21;i++){
  const supplier=await db.supplier.create({data:{organizationId:me.organization.id,name:'Browser report supplier '+String(i).padStart(3,'0')}}),product=await db.product.create({data:{organizationId:me.organization.id,name:'Browser report product '+String(i).padStart(3,'0'),sku:randomUUID(),barcode:randomUUID(),unit:'dona',salePrice:'100',costPrice:String(i+1)}});products.push(product);
  const doc=await post('/api/stock-documents',{organizationId:me.organization.id,storeId:store.id,supplierId:supplier.id,documentType:'purchase',documentNo:'BROWSER-REPORT-'+String(i).padStart(3,'0'),items:[{productId:product.id,quantity:'1',unitCost:String(i+1)}]});await post('/api/stock-documents/'+doc.id+'/confirm',{});
  await post('/api/suppliers/'+supplier.id+'/ledger',{supplierId:supplier.id,stockDocumentId:doc.id,referenceNo:doc.documentNo,reason:'Actual source-backed report invoice'});
 }
 const shift=await post('/api/shifts',{registerId:register.id,organizationUserId:me.user.organizationUserId,openingCash:'0'}),sale=await post('/api/sales',{organizationId:me.organization.id,storeId:store.id,registerId:register.id,shiftId:shift.id,discountAmount:0,items:products.map(product=>({productId:product.id,quantity:'1',discountAmount:0}))});await post('/api/sales/'+sale.id+'/complete',{payments:[{paymentType:'cash',amount:'2100'}]});
 for(const [path,query,label,last,first] of [
  ['/reports/purchases','view=history&sort=value_desc','Xarid mahsuloti, supplier yoki hujjat qidirish','Browser report product 000','Browser report product 020'],
  ['/reports/supplier-balances','sort=unpaid_desc','Supplier yoki filial nomi qidirish','Browser report supplier 000','Browser report supplier 020'],
  ['/reports/breakdowns','dimension=product&sort=name_desc','Kesim nomi yoki IDsi qidirish','Browser report product 000','Browser report product 020'],
 ] as const){
  await page.goto(path+'?'+query+'&page=2');await expect(page.locator('tbody tr')).toHaveCount(1);await expect(page.locator('tbody tr')).toContainText(last);await expect(page).toHaveURL(/asOf=/);const cutoff=new URL(page.url()).searchParams.get('asOf');
  await page.reload();await expect(page.locator('tbody tr')).toHaveCount(1);expect(new URL(page.url()).searchParams.get('asOf')).toBe(cutoff);
  await page.getByLabel(label,{exact:true}).fill(first);await page.getByRole('button',{name:'Qidirish',exact:true}).click();await expect(page.locator('tbody tr')).toHaveCount(1);await expect(page.locator('tbody tr')).toContainText(first);expect(new URL(page.url()).searchParams.get('asOf')).toBe(cutoff);
  await page.goBack();await expect(page.locator('tbody tr')).toContainText(last);expect(new URL(page.url()).searchParams.get('asOf')).toBe(cutoff);
  await page.getByLabel(label,{exact:true}).fill('NO-SUCH-REPORT');await page.getByRole('button',{name:'Qidirish',exact:true}).click();await expect(page.locator('tbody tr')).toHaveCount(0);
 }
 expect(String((await db.payment.aggregate({where:{saleId:sale.id},_sum:{amount:true}}))._sum.amount)).toBe('2100');expect(await db.supplierInvoice.count({where:{organizationId:me.organization.id}})).toBe(21);
});


test('Main report and reconciliation pages keep row filters separate from period cash totals and retain source cutoff through history',async({page})=>{
 test.setTimeout(120000);const headers={Origin:'https://localhost:3100'};
 const registered=await page.request.post('/api/auth/register',{headers,data:{phone:'main-report-list-'+randomUUID(),password:'test-only-password',fullName:'Main report owner',organizationName:'Main report fixture'}});expect(registered.ok()).toBe(true);const me=(await registered.json()).data;orgs.push(me.organization.id);users.push(me.user.id);
 const store=await db.store.findFirstOrThrow({where:{organizationId:me.organization.id}}),register=await db.register.findFirstOrThrow({where:{storeId:store.id}}),products=[];
 const post=async(path:string,body:Record<string,unknown>)=>{const response=await page.request.post(path,{headers,data:{operationId:randomUUID(),...body}});expect(response.ok(),await response.text()).toBe(true);return(await response.json()).data;};
 for(let i=0;i<21;i++)products.push(await db.product.create({data:{organizationId:me.organization.id,name:'Main report product '+String(i).padStart(3,'0'),sku:randomUUID(),barcode:randomUUID(),unit:'dona',salePrice:String(i+1),costPrice:'1'}}));
 const doc=await post('/api/stock-documents',{organizationId:me.organization.id,storeId:store.id,documentType:'purchase',documentNo:'MAIN-REPORT-SOURCE',items:products.map(product=>({productId:product.id,quantity:'1',unitCost:'1'}))});await post('/api/stock-documents/'+doc.id+'/confirm',{});
 const shift=await post('/api/shifts',{registerId:register.id,organizationUserId:me.user.organizationUserId,openingCash:'0'}),receipts=[];
 for(const product of products){const sale=await post('/api/sales',{organizationId:me.organization.id,storeId:store.id,registerId:register.id,shiftId:shift.id,discountAmount:0,items:[{productId:product.id,quantity:'1',discountAmount:0}]});await post('/api/sales/'+sale.id+'/complete',{payments:[{paymentType:'cash',amount:product.salePrice.toFixed()}]});receipts.push(sale.receiptNo);}
 for(const [query,label,last,first] of [
  ['tab=sales&dateMode=custom&sort=amount_desc','Hisobot cheki yoki mijoz qidirish',receipts[0],receipts[20]],
  ['tab=products&dateMode=custom&sort=amount_desc','Hisobot mahsuloti yoki SKU qidirish','Main report product 000','Main report product 020'],
 ] as const){
  await page.goto('/reports?'+query+'&page=2');await expect(page.locator('tbody tr')).toHaveCount(1);await expect(page.locator('tbody tr')).toContainText(last);await expect(page).toHaveURL(/asOf=/);const cutoff=new URL(page.url()).searchParams.get('asOf');await page.reload();await expect(page.locator('tbody tr')).toHaveCount(1);expect(new URL(page.url()).searchParams.get('asOf')).toBe(cutoff);
  await page.getByLabel(label,{exact:true}).fill(first);await page.getByRole('button',{name:'Qidirish',exact:true}).click();await expect(page.locator('tbody tr')).toHaveCount(1);await expect(page.locator('tbody tr')).toContainText(first);expect(new URL(page.url()).searchParams.get('asOf')).toBe(cutoff);
  if(query.includes('sales'))await expect(page.getByText('231',{exact:false}).first()).toBeVisible();
  await page.goBack();await expect(page.locator('tbody tr')).toContainText(last);await page.getByLabel(label,{exact:true}).fill('NO-MAIN-REPORT-SOURCE');await page.getByRole('button',{name:'Qidirish',exact:true}).click();await expect(page.locator('tbody tr')).toHaveCount(0);
 }
 const gaps=await Promise.all(Array.from({length:43},(_,i)=>db.product.create({data:{organizationId:me.organization.id,name:'Main reconcile gap '+String(i).padStart(3,'0'),sku:randomUUID(),barcode:randomUUID(),unit:'dona',salePrice:'1',costPrice:'0'}})));
 await db.inventoryBalance.createMany({data:gaps.map(product=>({storeId:store.id,productId:product.id,quantity:'2'}))});
 await page.goto('/reports/reconciliation?kind=inventory&search=Main+reconcile+gap&sort=expected_desc&page=3');await expect(page.locator('tbody tr')).toHaveCount(3);await page.reload();await expect(page.locator('tbody tr')).toHaveCount(3);
 await page.getByLabel('Tekshiruv mahsuloti, chek yoki ID qidirish',{exact:true}).fill('Main reconcile gap 042');await page.getByRole('button',{name:'Qidirish',exact:true}).click();await expect(page.locator('tbody tr')).toHaveCount(1);await page.goBack();await expect(page.locator('tbody tr')).toHaveCount(3);
 let fail=true;await page.route('**/api/reports/reconciliation?**',async route=>{if(fail){fail=false;await route.fulfill({status:500,json:{success:false,error:{code:'INTERNAL_ERROR',message:'Synthetic report list failure'}}});}else await route.continue();});await page.getByRole('button',{name:'Qayta tekshirish',exact:true}).click();await expect(page.getByRole('alert').filter({hasText:'Synthetic report list failure'})).toBeVisible();await expect(page.getByText('Tanlangan filtrda tafovut yo‘q.',{exact:true})).toHaveCount(0);await page.getByRole('button',{name:'Qayta yuklash',exact:true}).click();await expect(page.locator('tbody tr')).toHaveCount(3);await page.unroute('**/api/reports/reconciliation?**');
 expect(String((await db.payment.aggregate({where:{sale:{organizationId:me.organization.id}},_sum:{amount:true}}))._sum.amount)).toBe('231');
});


test('Price and reservation histories keep applied URL state while separate price and stock drafts survive filters and Back',async({page})=>{
 test.setTimeout(120000);const headers={Origin:'https://localhost:3100'};
 const registered=await page.request.post('/api/auth/register',{headers,data:{phone:'price-reserve-list-'+randomUUID(),password:'test-only-password',fullName:'Price reserve owner',organizationName:'Price reserve fixture'}});expect(registered.ok()).toBe(true);const me=(await registered.json()).data;orgs.push(me.organization.id);users.push(me.user.id);
 const store=await db.store.findFirstOrThrow({where:{organizationId:me.organization.id}});
 const products=await Promise.all(Array.from({length:43},(_,i)=>db.product.create({data:{organizationId:me.organization.id,name:'Price history browser '+String(i).padStart(3,'0'),sku:randomUUID(),barcode:randomUUID(),unit:'dona',salePrice:'10',costPrice:'1'}})));
 await db.inventoryBalance.create({data:{storeId:store.id,productId:products[0].id,quantity:'1'}});
 const post=async(path:string,body:Record<string,unknown>)=>{const response=await page.request.post(path,{headers,data:{operationId:randomUUID(),...body}});expect(response.ok(),await response.text()).toBe(true);return(await response.json()).data;};
 for(let i=0;i<21;i++){const hold=await post('/api/inventory/reservations',{storeId:store.id,expiresAt:new Date(Date.now()+600000).toISOString(),reason:'Reservation browser '+String(i).padStart(3,'0'),items:[{productId:products[0].id,locationId:null,quantity:'1'}]});await post('/api/inventory/reservations/'+hold.id+'/release',{reason:'Actual cancelled browser hold source'});}
 await page.goto('/products/prices?history_search=Price+history+browser&history_sort=oldest&history_page=3');const history=page.locator('div').filter({has:page.getByRole('heading',{name:'Narxlar tarixi',exact:true})}).last();
 await expect(page.getByRole('heading',{name:'Narxlar tarixi',exact:true})).toBeVisible();await expect(page.locator('table').last().locator('tbody tr')).toHaveCount(3);await page.reload();await expect(page.locator('table').last().locator('tbody tr')).toHaveCount(3);
 await page.getByLabel('O‘zgartirish sababi',{exact:true}).fill('Retained original price review reason');await page.getByLabel('Yangi narx Price history browser 000',{exact:true}).fill('12');
 await page.getByLabel('Narx tarixi mahsuloti, SKU yoki manba qidirish',{exact:true}).fill('Price history browser 042');await page.getByRole('button',{name:'Qidirish',exact:true}).last().click();await expect(page.locator('table').last().locator('tbody tr')).toHaveCount(1);await expect(page.getByLabel('Yangi narx Price history browser 000',{exact:true})).toHaveValue('12');await page.goBack();await expect(page.locator('table').last().locator('tbody tr')).toHaveCount(3);await expect(page.getByLabel('O‘zgartirish sababi',{exact:true})).toHaveValue('Retained original price review reason');await page.getByLabel('Yangi narx Price history browser 000',{exact:true}).fill('10');await page.getByLabel('O‘zgartirish sababi',{exact:true}).fill('');
 await page.goto('/inventory/locations?reservation_status=released&reservation_sort=oldest&reservation_page=2');await expect(page.locator('article')).toHaveCount(1);await page.reload();await expect(page.locator('article')).toHaveCount(1);
 await page.getByLabel('Zona nomi',{exact:true}).fill('Retained unsubmitted physical zone');await page.getByLabel('Rezerv sababi yoki ID qidirish',{exact:true}).fill('Reservation browser 020');await page.getByRole('button',{name:'Qidirish',exact:true}).click();await expect(page.locator('article')).toHaveCount(1);await page.goBack();await expect(page.locator('article')).toHaveCount(1);await expect(page.getByLabel('Zona nomi',{exact:true})).toHaveValue('Retained unsubmitted physical zone');
 await page.getByLabel('Rezerv holati',{exact:true}).selectOption('active');await expect(page.getByText('Bu filtrda rezerv topilmadi.',{exact:true})).toBeVisible();await page.goBack();await expect(page.locator('article')).toHaveCount(1);
 let fail=true;await page.route('**/api/inventory/locations?**',async route=>{if(fail){fail=false;await route.fulfill({status:500,json:{success:false,error:{code:'INTERNAL_ERROR',message:'Synthetic reservation list failure'}}});}else await route.continue();});await page.getByRole('button',{name:'Ombor ma’lumotini qayta yuklash',exact:true}).click();await expect(page.getByRole('alert').filter({hasText:'Synthetic reservation list failure'})).toBeVisible();await expect(page.getByText('Bu filtrda rezerv topilmadi.',{exact:true})).toHaveCount(0);await page.getByRole('button',{name:'Ombor ma’lumotini qayta yuklash',exact:true}).click();await expect(page.locator('article')).toHaveCount(1);await page.unroute('**/api/inventory/locations?**');
 expect((await db.inventoryBalance.findUniqueOrThrow({where:{storeId_productId:{storeId:store.id,productId:products[0].id}}})).quantity.toFixed()).toBe('1');expect(await db.inventoryMovement.count({where:{organizationId:me.organization.id}})).toBe(0);
 void history;
});
