import {test,expect} from '@playwright/test';
import {PrismaClient} from '@prisma/client';
import {randomUUID} from 'node:crypto';
const connection=new URL(process.env.DATABASE_URL??'');
if(connection.hostname!=='127.0.0.1'||connection.port!=='55439'||connection.pathname!=='/pos_test')throw new Error('Isolated database only');
const db=new PrismaClient(),organizations:string[]=[],users:string[]=[];
test.afterAll(async()=>{await db.organization.deleteMany({where:{id:{in:organizations}}});await db.user.deleteMany({where:{id:{in:users}}});await db.$disconnect();});

test('Product editor retries failed loading, protects both drafts and preserves exact decimals through a delayed save',async({page})=>{
 const registered=await page.request.post('/api/auth/register',{headers:{Origin:'https://localhost:3100'},data:{fullName:'Product editor owner',phone:'product-editor-'+randomUUID(),password:'test-only-password',organizationName:'Product editor fixture'}});
 expect(registered.ok()).toBe(true);
 const identity=(await(await page.request.get('/api/auth/me')).json()).data;
 organizations.push(identity.organization.id);users.push(identity.user.id);
 const product=await db.product.create({data:{organizationId:identity.organization.id,name:'Product original',sku:randomUUID(),barcode:randomUUID(),unit:'dona',costPrice:'1.123456',salePrice:'2.25',minStock:'0'}});
 const endpoint='**/api/products/'+product.id;
 await page.route(endpoint,route=>route.fulfill({status:503,contentType:'application/json',body:JSON.stringify({success:false,error:{code:'INTERNAL_ERROR',message:'Fixture unavailable'}})}));
 await page.goto('/products/'+product.id);
 await expect(page.getByRole('alert').filter({hasText:'Fixture unavailable'})).toBeVisible();
 await expect(page.getByText('Mahsulot topilmadi',{exact:true})).toHaveCount(0);
 await page.unroute(endpoint);
 await page.getByRole('button',{name:'Qayta yuklash',exact:true}).click();
 await expect(page.getByLabel('Mahsulot nomi *',{exact:true})).toHaveValue(product.name);
 await page.getByLabel('Mahsulot nomi *',{exact:true}).fill('Product saved exactly');
 await page.getByLabel("Tannarx (so'm) *",{exact:true}).fill('99999999999999.123456');
 await page.getByLabel("Sotuv narxi (so'm) *",{exact:true}).fill('999999999999.99');
 await page.getByLabel('Minimal qoldiq',{exact:true}).fill('99999999999999.123456');
 const alias='alias-'+randomUUID();
 await page.getByLabel('Qo‘shimcha barkod',{exact:true}).fill(alias);
 page.once('dialog',dialog=>dialog.dismiss());
 await page.getByRole('button',{name:'Bekor qilish',exact:true}).click();
 await expect(page).toHaveURL(new RegExp('/products/'+product.id+'$'));
 await expect(page.getByLabel('Qo‘shimcha barkod',{exact:true})).toHaveValue(alias);
 await page.route(endpoint,route=>route.request().method()==='PUT'?route.fulfill({status:409,contentType:'application/json',body:JSON.stringify({success:false,error:{code:'CONCURRENT_CONFLICT',message:'Fixture rejected product save'}})}):route.continue());
 await page.getByRole('button',{name:'Saqlash',exact:true}).click();
 await expect(page.getByText(/Fixture rejected product save/).first()).toBeVisible();
 await expect(page.getByLabel("Tannarx (so'm) *",{exact:true})).toHaveValue('99999999999999.123456');
 await expect(page.getByRole('status').filter({hasText:'Saqlanmagan mahsulot'})).toBeVisible();
 await page.unroute(endpoint);
 let release=()=>{};
 const gate=new Promise<void>(resolve=>{release=resolve;});
 const bodies:Record<string,unknown>[]=[];
 await page.route(endpoint,async route=>{
  if(route.request().method()!=='PUT'){await route.continue();return;}
  bodies.push(route.request().postDataJSON());
  const response=await route.fetch();
  await gate;
  await route.fulfill({response});
 });
 try{
  await page.getByRole('button',{name:'Saqlash',exact:true}).click();
  await expect(page.getByLabel('Mahsulot nomi *',{exact:true})).toBeDisabled();
  await expect(page.getByLabel('Qo‘shimcha barkod',{exact:true})).toBeDisabled();
  await page.getByLabel('Mahsulot nomi *',{exact:true}).evaluate(input=>{const form=(input as HTMLInputElement).form!;form.requestSubmit();form.requestSubmit();});
  await expect.poll(()=>bodies.length).toBe(1);
  release();
  await expect(page.getByRole('status').filter({hasText:'Mahsulotning asosiy ma’lumotlari saqlandi'})).toBeVisible();
 }finally{release();await page.unroute(endpoint);}
 expect(bodies).toHaveLength(1);
 expect(bodies[0].costPrice).toBe('99999999999999.123456');
 expect(bodies[0].salePrice).toBe('999999999999.99');
 expect(bodies[0].minStock).toBe('99999999999999.123456');
 const saved=await db.product.findUniqueOrThrow({where:{id:product.id}});
 expect(saved.costPrice.toString()).toBe('99999999999999.123456');
 expect(saved.salePrice.toString()).toBe('999999999999.99');
 expect(saved.minStock.toString()).toBe('99999999999999.123456');
 await expect(page.getByRole('status').filter({hasText:'Saqlanmagan mahsulot'})).toHaveCount(0);
 // The unsaved barcode survives saving the main form. It alone still protects navigation.
 await expect(page.getByLabel('Qo‘shimcha barkod',{exact:true})).toHaveValue(alias);
 page.once('dialog',dialog=>dialog.dismiss());
 await page.getByRole('button',{name:'Mahsulotlarga qaytish',exact:true}).click();
 await expect(page).toHaveURL(new RegExp('/products/'+product.id+'$'));
 let releaseBarcode=()=>{};const barcodeGate=new Promise<void>(resolve=>{releaseBarcode=resolve;});let barcodeRequests=0;
 const barcodeEndpoint='**/api/products/'+product.id+'/barcodes';
 await page.route(barcodeEndpoint,async route=>{
  if(route.request().method()!=='POST'){await route.continue();return;}
  barcodeRequests++;const response=await route.fetch();await barcodeGate;await route.fulfill({response});
 });
 try{
  await page.getByRole('button',{name:'Qo‘shish',exact:true}).click();
  await expect(page.getByLabel('Qo‘shimcha barkod',{exact:true})).toBeDisabled();
  await expect(page.getByLabel('Mahsulot nomi *',{exact:true})).toBeDisabled();
  await page.getByLabel('Qo‘shimcha barkod',{exact:true}).evaluate(input=>{const form=(input as HTMLInputElement).form!;form.requestSubmit();form.requestSubmit();});
  await expect.poll(()=>barcodeRequests).toBe(1);releaseBarcode();
  await expect(page.getByLabel('Qo‘shimcha barkod',{exact:true})).toHaveValue('');
 }finally{releaseBarcode();await page.unroute(barcodeEndpoint);}
 expect(barcodeRequests).toBe(1);
 expect(await db.productBarcode.count({where:{productId:product.id,value:alias}})).toBe(1);
 let dialogs=0;page.on('dialog',async dialog=>{dialogs++;await dialog.dismiss();});
 await page.getByRole('button',{name:'Mahsulotlarga qaytish',exact:true}).click();
 await expect(page).toHaveURL(/\/products$/);
 expect(dialogs).toBe(0);
});

test('A delayed old catalog query cannot overwrite newer results',async({page})=>{
 const registered=await page.request.post('/api/auth/register',{headers:{Origin:'https://localhost:3100'},data:{fullName:'Catalog query owner',phone:'catalog-query-'+randomUUID(),password:'test-only-password',organizationName:'Catalog query fixture'}});
 expect(registered.ok()).toBe(true);
 const identity=(await(await page.request.get('/api/auth/me')).json()).data;
 organizations.push(identity.organization.id);users.push(identity.user.id);
 await db.product.createMany({data:['Old query owned product','Latest query owned product'].map(name=>({organizationId:identity.organization.id,name,sku:randomUUID(),barcode:randomUUID(),unit:'dona',costPrice:'0',salePrice:'1'}))});
 await page.goto('/products');
 await expect(page.getByRole('row').filter({hasText:'Old query owned product'})).toBeVisible();
 let release=()=>{};const gate=new Promise<void>(resolve=>{release=resolve;});
 await page.route('**/api/products?**',async route=>{
  if(new URL(route.request().url()).searchParams.get('search')!=='Old query'){await route.continue();return;}
  const response=await route.fetch();await gate;await route.fulfill({response});
 });
 const search=page.getByPlaceholder("Nom, SKU yoki barkod bo'yicha qidirish...",{exact:true});
 try{
  const requested=page.waitForRequest(request=>new URL(request.url()).pathname==='/api/products'&&new URL(request.url()).searchParams.get('search')==='Old query');
  await search.fill('Old query');await requested;
  await search.fill('Latest query');
  await expect(page.getByRole('row').filter({hasText:'Latest query owned product'})).toBeVisible();
  await expect(page.getByRole('row').filter({hasText:'Old query owned product'})).toHaveCount(0);
  const oldResponse=page.waitForResponse(response=>new URL(response.url()).pathname==='/api/products'&&new URL(response.url()).searchParams.get('search')==='Old query');
  release();await(await oldResponse).finished();
  await page.evaluate(()=>new Promise<void>(resolve=>requestAnimationFrame(()=>requestAnimationFrame(()=>resolve()))));
  await expect(search).toHaveValue('Latest query');
  await expect(page.getByRole('row').filter({hasText:'Latest query owned product'})).toBeVisible();
  await expect(page.getByRole('row').filter({hasText:'Old query owned product'})).toHaveCount(0);
 }finally{release();await page.unroute('**/api/products?**');}
});

test('Catalog modal drafts survive rejected close and delayed product/category saves cannot double submit',async({page})=>{
 const registered=await page.request.post('/api/auth/register',{headers:{Origin:'https://localhost:3100'},data:{fullName:'Catalog modal owner',phone:'catalog-modal-'+randomUUID(),password:'test-only-password',organizationName:'Catalog modal fixture'}});
 expect(registered.ok()).toBe(true);
 const identity=(await(await page.request.get('/api/auth/me')).json()).data;
 organizations.push(identity.organization.id);users.push(identity.user.id);
 const list='**/api/products?**';
 await page.route(list,route=>route.fulfill({status:503,contentType:'application/json',body:JSON.stringify({success:false,error:{code:'INTERNAL_ERROR',message:'Fixture list unavailable'}})}));
 await page.goto('/products');
 await expect(page.getByRole('alert').filter({hasText:'Fixture list unavailable'})).toBeVisible();
 await page.unroute(list);
 await page.getByRole('button',{name:'Qayta yuklash',exact:true}).click();
 await expect(page.getByRole('alert').filter({hasText:'Fixture list unavailable'})).toHaveCount(0);
 await page.getByRole('button',{name:'Yangi mahsulot',exact:true}).click();
 const modal=page.getByRole('dialog');
 await expect(modal.getByRole('status').filter({hasText:'Saqlanmagan mahsulot'})).toHaveCount(0);
 await modal.getByLabel('Mahsulot nomi *',{exact:true}).fill('Discarded product draft');
 page.once('dialog',dialog=>dialog.dismiss());await page.keyboard.press('Escape');
 await expect(modal.getByLabel('Mahsulot nomi *',{exact:true})).toHaveValue('Discarded product draft');
 page.once('dialog',dialog=>dialog.accept());await modal.getByRole('button',{name:'Bekor qilish',exact:true}).click();
 await expect(modal).toHaveCount(0);
 expect(await db.product.count({where:{organizationId:identity.organization.id}})).toBe(0);
 await page.getByRole('button',{name:'Yangi mahsulot',exact:true}).click();
 const productName='Saved catalog modal product';
 await modal.getByLabel('Mahsulot nomi *',{exact:true}).fill(productName);
 await modal.getByLabel("Tannarx (so'm) *",{exact:true}).fill('1.123456');
 await modal.getByLabel("Sotuv narxi (so'm) *",{exact:true}).fill('2.25');
 await modal.getByLabel('Minimal qoldiq',{exact:true}).fill('0.123456');
 let releaseProduct=()=>{};const productGate=new Promise<void>(resolve=>{releaseProduct=resolve;});
 const productBodies:Record<string,unknown>[]=[];
 await page.route('**/api/products',async route=>{
  if(route.request().method()!=='POST'){await route.continue();return;}
  productBodies.push(route.request().postDataJSON());const response=await route.fetch();await productGate;await route.fulfill({response});
 });
 try{
  await modal.getByRole('button',{name:"Qo'shish",exact:true}).click();
  await expect(modal.getByLabel('Mahsulot nomi *',{exact:true})).toBeDisabled();
  await modal.getByLabel('Mahsulot nomi *',{exact:true}).evaluate(input=>{const form=(input as HTMLInputElement).form!;form.requestSubmit();form.requestSubmit();});
  await expect.poll(()=>productBodies.length).toBe(1);releaseProduct();
  await expect(modal).toHaveCount(0);
 }finally{releaseProduct();await page.unroute('**/api/products');}
 expect(productBodies).toHaveLength(1);expect(productBodies[0].minStock).toBe('0.123456');
 await expect(page.getByRole('row').filter({hasText:productName})).toBeVisible();
 expect(await db.product.count({where:{organizationId:identity.organization.id,name:productName}})).toBe(1);
 await page.getByRole('row').filter({hasText:productName}).getByRole('button',{name:'Tahrirlash',exact:true}).click();
 await modal.getByLabel('Mahsulot nomi *',{exact:true}).fill('Unsaved edited modal product');
 page.once('dialog',dialog=>dialog.dismiss());await modal.getByRole('button',{name:'Oynani yopish',exact:true}).click();
 await expect(modal.getByLabel('Mahsulot nomi *',{exact:true})).toHaveValue('Unsaved edited modal product');
 page.once('dialog',dialog=>dialog.accept());await modal.getByRole('button',{name:'Bekor qilish',exact:true}).click();
 await page.getByRole('button',{name:'Kategoriyalar',exact:true}).click();
 const categoryName='Modal category '+randomUUID();
 await modal.getByLabel('Yangi kategoriya nomi',{exact:true}).fill(categoryName);
 page.once('dialog',dialog=>dialog.dismiss());await page.keyboard.press('Escape');
 await expect(modal.getByLabel('Yangi kategoriya nomi',{exact:true})).toHaveValue(categoryName);
 let releaseCategory=()=>{};const categoryGate=new Promise<void>(resolve=>{releaseCategory=resolve;});let categoryRequests=0;
 await page.route('**/api/categories',async route=>{
  if(route.request().method()!=='POST'){await route.continue();return;}
  categoryRequests++;const response=await route.fetch();await categoryGate;await route.fulfill({response});
 });
 try{
  await modal.getByRole('button',{name:"Qo'shish",exact:true}).click();
  await expect(modal.getByLabel('Yangi kategoriya nomi',{exact:true})).toBeDisabled();
  await modal.getByLabel('Yangi kategoriya nomi',{exact:true}).evaluate(input=>{const form=(input as HTMLInputElement).form!;form.requestSubmit();form.requestSubmit();});
  await expect.poll(()=>categoryRequests).toBe(1);releaseCategory();
  await expect(modal.getByLabel('Yangi kategoriya nomi',{exact:true})).toHaveValue('');
 }finally{releaseCategory();await page.unroute('**/api/categories');}
 expect(categoryRequests).toBe(1);
 expect(await db.category.count({where:{organizationId:identity.organization.id,name:categoryName}})).toBe(1);
 let dialogs=0;page.on('dialog',async dialog=>{dialogs++;await dialog.dismiss();});
 await modal.getByRole('button',{name:'Oynani yopish',exact:true}).click();await expect(modal).toHaveCount(0);expect(dialogs).toBe(0);
});
