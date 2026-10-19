import {test,expect} from '@playwright/test'
import {PrismaClient} from '@prisma/client'
import {randomUUID} from 'node:crypto'
const connection=new URL(process.env.DATABASE_URL??'')
if(connection.hostname!=='127.0.0.1'||connection.port!=='55439'||connection.pathname!=='/pos_test')throw Error('Isolated DB required')
const db=new PrismaClient(),orgs:string[]=[],users:string[]=[]
test.afterAll(async()=>{await db.organization.deleteMany({where:{id:{in:orgs}}});await db.user.deleteMany({where:{id:{in:users}}});await db.$disconnect()})
test('exchange preview freezes its snapshot, rejects malformed return lines and preserves a newer draft after original lost-ACK recovery',async({page})=>{
 const headers={Origin:'https://localhost:3100'}
 expect((await page.request.post('/api/auth/register',{headers,data:{fullName:'Exchange editor owner',phone:'exchange-editor-'+randomUUID(),password:'test-only-password',organizationName:'Exchange editor state'}})).ok()).toBe(true)
 const me=(await(await page.request.get('/api/auth/me')).json()).data;orgs.push(me.organization.id);users.push(me.user.id)
 const store=await db.store.findFirstOrThrow({where:{organizationId:me.organization.id}}),register=await db.register.findFirstOrThrow({where:{storeId:store.id}}),member=await db.organizationUser.findFirstOrThrow({where:{organizationId:me.organization.id,userId:me.user.id}}),shift=await db.shift.create({data:{registerId:register.id,organizationUserId:member.id,openingCash:'1000'}})
 const products=[]
 for(const [name,price] of [['Original first','10.01'],['Original second','5.01'],['Replacement','12.03']]){const product=await db.product.create({data:{organizationId:me.organization.id,name,sku:randomUUID(),barcode:randomUUID(),unit:'dona',salePrice:price,costPrice:'3.333333'}});await db.inventoryBalance.create({data:{storeId:store.id,productId:product.id,quantity:10}});products.push(product)}
 const draft=await page.request.post('/api/sales',{headers,data:{operationId:randomUUID(),organizationId:me.organization.id,storeId:store.id,registerId:register.id,shiftId:shift.id,items:products.slice(0,2).map(product=>({productId:product.id,quantity:1}))}});expect(draft.ok()).toBe(true);const sale=(await draft.json()).data
 expect((await page.request.post('/api/sales/'+sale.id+'/complete',{headers,data:{operationId:randomUUID(),payments:[{paymentType:'cash',amount:'15.02'}]}})).ok()).toBe(true)
 await page.goto('/sales/'+sale.id+'/exchange');await page.getByLabel('Almashtirishdagi yangi mahsulot',{exact:true}).selectOption(products[2].id);await page.getByLabel('Almashtirish sababi',{exact:true}).fill('Original physical exchange');await page.getByLabel('Qaytarish miqdori: Original first',{exact:true}).fill('invalid');await page.getByLabel('Qaytarish miqdori: Original second',{exact:true}).fill('1')
 let previews=0;await page.route('**/api/exchanges/preview',async route=>{previews++;await route.continue()})
 await page.getByRole('button',{name:'Almashtirish farqini hisoblash',exact:true}).click();await expect(page.locator('p[role="alert"]')).toContainText('Noto‘g‘ri qator tashlab ketilmaydi');expect(previews).toBe(0)
 await page.getByLabel('Qaytarish miqdori: Original first',{exact:true}).fill('1')
 let prompts=0;page.on('dialog',async dialog=>{if(dialog.type()==='beforeunload')await dialog.accept();else{prompts++;await dialog.dismiss()}})
 await page.getByRole('link',{name:'Original savdoga qaytish',exact:true}).click();await expect(page).toHaveURL(new RegExp('/sales/'+sale.id+'/exchange$'));expect(prompts).toBe(1)
 await page.unroute('**/api/exchanges/preview')
 let entered!:()=>void,release!:()=>void
 const started=new Promise<void>(resolve=>{entered=resolve}),gate=new Promise<void>(resolve=>{release=resolve})
 await page.route('**/api/exchanges/preview',async route=>{previews++;const response=await route.fetch();expect(response.ok()).toBe(true);entered();await gate;await route.abort('failed')})
 try{await page.getByRole('button',{name:'Almashtirish farqini hisoblash',exact:true}).evaluate(button=>{(button as HTMLButtonElement).click();(button as HTMLButtonElement).click()});await started;await expect(page.getByLabel('Almashtirish sababi',{exact:true})).toBeDisabled();await page.getByRole('link',{name:'Original savdoga qaytish',exact:true}).click();expect(prompts).toBe(1);}finally{release()}
 await expect(page.getByRole('button',{name:'Almashtirish farqini hisoblash',exact:true})).toBeEnabled();await expect(page.getByLabel('Almashtirish sababi',{exact:true})).toHaveValue('Original physical exchange');expect(previews).toBe(1);expect(await db.saleExchange.count({where:{organizationId:me.organization.id}})).toBe(0)
 await page.unroute('**/api/exchanges/preview');await page.getByRole('button',{name:'Almashtirish farqini hisoblash',exact:true}).click();await expect(page.getByRole('status').filter({hasText:'Qaytarish:'})).toContainText('naqd farq: -2.99')
 await page.getByRole('button',{name:'Almashtirishni qayd etish: oldindan ko‘rish',exact:true}).click()
 let postingEntered!:()=>void,postingRelease!:()=>void,lost=true;const postingStarted=new Promise<void>(resolve=>{postingEntered=resolve}),postingGate=new Promise<void>(resolve=>{postingRelease=resolve}),bodies:Record<string,unknown>[]=[]
 await page.route('**/api/exchanges',async route=>{if(route.request().method()!=='POST')return route.continue();bodies.push(route.request().postDataJSON());if(lost){lost=false;const response=await route.fetch();expect(response.ok()).toBe(true);postingEntered();await postingGate;await route.abort('failed')}else await route.continue()})
 try{await page.getByRole('button',{name:'Amalni tasdiqlash',exact:true}).click();await postingStarted;await expect(page.getByLabel('Qaytarish miqdori: Original first',{exact:true})).toBeDisabled();await expect(page.getByLabel('Farq uchun mijoz bergan haqiqiy naqd pul',{exact:true})).toBeDisabled();await page.getByRole('link',{name:'Original savdoga qaytish',exact:true}).click();expect(prompts).toBe(1);}finally{postingRelease()}
 await expect(page.getByRole('button',{name:'Original amalni qayta tekshirish',exact:true})).toBeEnabled()
 await page.getByLabel('Almashtirish sababi',{exact:true}).fill('New independent exchange draft')
 await page.getByRole('button',{name:'Saqlangan amalni qayta tekshirish',exact:true}).click();await expect(page.getByRole('button',{name:'Saqlangan amalni qayta tekshirish',exact:true})).toHaveCount(0)
 await expect(page.getByLabel('Almashtirish sababi',{exact:true})).toHaveValue('New independent exchange draft');await page.getByRole('link',{name:'Original savdoga qaytish',exact:true}).click();expect(prompts).toBe(2)
 expect(bodies).toHaveLength(2);expect(bodies[1]).toEqual(bodies[0]);expect(bodies[0].reason).toBe('Original physical exchange')
 const exchange=await db.saleExchange.findFirstOrThrow({where:{organizationId:me.organization.id}});expect(exchange.cashDifference.toFixed(2)).toBe('-2.99');expect(await db.saleExchange.count({where:{organizationId:me.organization.id}})).toBe(1);expect(await db.saleReturn.count({where:{saleId:sale.id}})).toBe(1);expect(await db.operation.count({where:{organizationId:me.organization.id,type:'sale.exchange'}})).toBe(1)
})
