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
