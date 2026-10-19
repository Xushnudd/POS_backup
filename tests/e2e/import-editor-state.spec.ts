import {test,expect} from '@playwright/test'
import {PrismaClient} from '@prisma/client'
import {randomUUID} from 'node:crypto'
const connection=new URL(process.env.DATABASE_URL??'')
if(connection.hostname!=='127.0.0.1'||connection.port!=='55439'||connection.pathname!=='/pos_test')throw Error('Isolated DB required')
const db=new PrismaClient(),orgs:string[]=[],users:string[]=[]
test.afterAll(async()=>{await db.organization.deleteMany({where:{id:{in:orgs}}});await db.user.deleteMany({where:{id:{in:users}}});await db.$disconnect()})
test('import selected file is guarded before preview and old confirmation recovery preserves a new file draft',async({page})=>{
 const headers={Origin:'https://localhost:3100'}
 expect((await page.request.post('/api/auth/register',{headers,data:{fullName:'Import editor owner',phone:'import-editor-'+randomUUID(),password:'test-only-password',organizationName:'Import editor state'}})).ok()).toBe(true)
 const me=(await(await page.request.get('/api/auth/me')).json()).data;orgs.push(me.organization.id);users.push(me.user.id)
 const csv=(name:string,sku:string)=>Buffer.from('name,sku,barcode,unit,salePrice,costPrice,minStock\r\n'+name+','+sku+','+randomUUID()+',dona,1.01,0.333333,1\r\n')
 await page.goto('/products/import');await page.getByLabel('Katalog fayli',{exact:true}).setInputFiles({name:'original.csv',mimeType:'text/csv',buffer:csv('Original import only','FIRST')});await expect(page.getByRole('button',{name:'Importni oldindan ko‘rish',exact:true})).toBeEnabled()
 let prompts=0;page.on('dialog',async dialog=>{if(dialog.type()==='beforeunload')await dialog.accept();else{prompts++;await dialog.dismiss()}})
 await page.getByRole('link',{name:'Mahsulotlarga qaytish',exact:true}).click();await expect(page).toHaveURL(/\/products\/import$/);expect(prompts).toBe(1)
 await page.getByRole('button',{name:'Importni oldindan ko‘rish',exact:true}).click();await page.getByLabel('Katalog import sababi',{exact:true}).fill('Original reviewed import')
 const bodies:string[]=[];let lost=false
 await page.route('**/api/catalog-import',async route=>{bodies.push(route.request().postData()??'');const response=await route.fetch();if(!lost&&response.ok()){lost=true;await route.abort('failed')}else await route.fulfill({response})})
 await page.getByRole('button',{name:'Yaroqli katalog qatorlarini qo‘shish: oldindan ko‘rish',exact:true}).click();await page.getByRole('button',{name:'Amalni tasdiqlash',exact:true}).click();await expect(page.getByRole('button',{name:'Original amalni qayta tekshirish',exact:true})).toBeVisible()
 await page.reload();await page.getByLabel('Katalog fayli',{exact:true}).setInputFiles({name:'new.csv',mimeType:'text/csv',buffer:csv('Independent new file','SECOND')});await page.getByRole('button',{name:'Importni oldindan ko‘rish',exact:true}).click();await expect(page.getByRole('cell',{name:'Independent new file / SECOND',exact:true})).toBeVisible()
 await page.getByRole('button',{name:'Saqlangan amalni qayta tekshirish',exact:true}).click();await expect(page.getByRole('button',{name:'Saqlangan amalni qayta tekshirish',exact:true})).not.toBeVisible();await expect(page.getByRole('cell',{name:'Independent new file / SECOND',exact:true})).toBeVisible();await expect(page.getByLabel('Katalog import sababi',{exact:true})).toBeEnabled()
 expect(bodies).toHaveLength(2);expect(bodies[0]).toBe(bodies[1]);expect(await db.product.count({where:{organizationId:me.organization.id,name:'Original import only'}})).toBe(1);expect(await db.product.count({where:{organizationId:me.organization.id,name:'Independent new file'}})).toBe(0)
 await page.getByRole('link',{name:'Mahsulotlarga qaytish',exact:true}).click();await expect(page).toHaveURL(/\/products\/import$/);expect(prompts).toBe(2)
 expect(await db.operation.count({where:{organizationId:me.organization.id,type:'catalog.import'}})).toBe(1);expect(await db.inventoryMovement.count({where:{organizationId:me.organization.id}})).toBe(0)
})
