import {test,expect} from '@playwright/test'
import {PrismaClient} from '@prisma/client'
import {randomUUID} from 'node:crypto'
import sharp from 'sharp'
const connection=new URL(process.env.DATABASE_URL??'')
if(connection.hostname!=='127.0.0.1'||connection.port!=='55439'||connection.pathname!=='/pos_test')throw Error('Isolated DB required')
const db=new PrismaClient(),orgs:string[]=[],users:string[]=[]
test.afterAll(async()=>{await db.organization.deleteMany({where:{id:{in:orgs}}});await db.user.deleteMany({where:{id:{in:users}}});await db.$disconnect()})
test('catalog draft survives failed refresh and file deletion replays its original DELETE key',async({page})=>{
 const headers={Origin:'https://localhost:3100'}
 expect((await page.request.post('/api/auth/register',{headers,data:{fullName:'Media editor owner',phone:'media-editor-'+randomUUID(),password:'test-only-password',organizationName:'Media editor state'}})).ok()).toBe(true)
 const me=(await(await page.request.get('/api/auth/me')).json()).data;orgs.push(me.organization.id);users.push(me.user.id)
 const product=await db.product.create({data:{organizationId:me.organization.id,name:'Media original product',sku:randomUUID(),barcode:randomUUID(),unit:'dona',salePrice:'1',costPrice:'1'}}),path='/products/'+product.id+'/media'
 await page.goto(path);await expect(page.getByRole('button',{name:'Katalog metama’lumotlarini saqlash',exact:true})).toBeEnabled()
 const description=page.getByLabel('Mahsulot tavsifi',{exact:true});await description.fill('Independent metadata draft')
 let prompts=0;page.on('dialog',async dialog=>{if(dialog.type()==='beforeunload')await dialog.accept();else{prompts++;await dialog.dismiss()}})
 await page.getByRole('link',{name:'Mahsulotlarga qaytish',exact:true}).click();await expect(page).toHaveURL(new RegExp(path+'$'));expect(prompts).toBe(1)
 let release!:()=>void,entered!:()=>void;const held=new Promise<void>(resolve=>{release=resolve}),started=new Promise<void>(resolve=>{entered=resolve});let puts=0
 await page.route('**/api/products/'+product.id,async route=>{if(route.request().method()==='PUT'){puts++;const response=await route.fetch();entered();await held;await route.fulfill({response});}else await route.continue()})
 await page.getByRole('button',{name:'Katalog metama’lumotlarini saqlash',exact:true}).evaluate(button=>{(button as HTMLButtonElement).click();(button as HTMLButtonElement).click()});await started
 await expect(description).toBeDisabled();await page.getByRole('link',{name:'Mahsulotlarga qaytish',exact:true}).click();await expect(page).toHaveURL(new RegExp(path+'$'));expect(prompts).toBe(1)
 release();await expect(page.getByRole('status').filter({hasText:'Katalog metama’lumotlari serverda saqlandi.'})).toBeVisible();expect(puts).toBe(1);await page.unroute('**/api/products/'+product.id)
 await expect(page.getByRole('button',{name:'Katalog metama’lumotlarini saqlash',exact:true})).toBeEnabled();await description.fill('Keep new description')
 await page.route('**/api/files?*',route=>route.abort('failed'));await page.getByRole('button',{name:'Qayta yuklash',exact:true}).last().click();await expect(page.getByRole('button',{name:'Katalogni qayta yuklash',exact:true})).toBeVisible();await expect(description).toHaveValue('Keep new description');await expect(page.getByRole('button',{name:'Katalog metama’lumotlarini saqlash',exact:true})).toBeDisabled()
 await page.unroute('**/api/files?*');await page.getByRole('button',{name:'Katalogni qayta yuklash',exact:true}).click();await expect(page.getByRole('button',{name:'Katalog metama’lumotlarini saqlash',exact:true})).toBeEnabled();await expect(description).toHaveValue('Keep new description')
 const buffer=await sharp({create:{width:4,height:3,channels:4,background:'red'}}).png().toBuffer();await page.getByLabel('Mahsulot rasm fayli',{exact:true}).setInputFiles({name:'replay.png',mimeType:'image/png',buffer});await page.getByRole('button',{name:'Mahsulot rasmi: oldindan ko‘rish',exact:true}).click();await page.getByRole('button',{name:'Amalni tasdiqlash',exact:true}).click()
 const remove=page.getByRole('button',{name:'Rasmni o‘chirish: replay.png: oldindan ko‘rish',exact:true});await expect(remove).toBeEnabled();await expect(description).toHaveValue('Keep new description')
 const asset=await db.fileAsset.findFirstOrThrow({where:{productId:product.id}});const bodies:string[]=[];let lost=false
 await page.route('**/api/files/'+asset.id,async route=>{if(route.request().method()==='DELETE'){bodies.push(route.request().postData()??'');const response=await route.fetch();if(!lost&&response.ok()){lost=true;await route.abort('failed')}else await route.fulfill({response})}else await route.continue()})
 await remove.click();await page.getByRole('button',{name:'Amalni tasdiqlash',exact:true}).click();await expect(page.getByRole('button',{name:'Original amalni qayta tekshirish',exact:true})).toBeVisible();await expect(description).toHaveValue('Keep new description')
 await page.getByRole('button',{name:'Saqlangan amalni qayta tekshirish',exact:true}).click();await expect(page.getByRole('button',{name:'Saqlangan amalni qayta tekshirish',exact:true})).not.toBeVisible();expect(bodies).toHaveLength(2);expect(bodies[0]).toBe(bodies[1]);await expect(description).toHaveValue('Keep new description');await expect(page.getByRole('img',{name:product.name,exact:true})).not.toBeVisible()
 expect((await db.fileAsset.findUniqueOrThrow({where:{id:asset.id}})).data).toBe(null)
 expect(await db.auditLog.count({where:{organizationId:me.organization.id,entityId:asset.id,action:'file_deleted'}})).toBe(1)
 expect(await db.inventoryMovement.count({where:{organizationId:me.organization.id}})).toBe(0)
 expect((await db.product.findUniqueOrThrow({where:{id:product.id}})).description).toBe('Independent metadata draft')
})
