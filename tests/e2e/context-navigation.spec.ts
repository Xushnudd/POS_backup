import {test,expect,type Page} from '@playwright/test'
import {PrismaClient} from '@prisma/client'
import {randomUUID} from 'node:crypto'
const connection=new URL(process.env.DATABASE_URL??'')
if(connection.hostname!=='127.0.0.1'||connection.port!=='55439'||connection.pathname!=='/pos_test')throw Error('Isolated DB required')
const db=new PrismaClient(),orgs:string[]=[],users:string[]=[],headers={Origin:'https://localhost:3100'}
test.afterAll(async()=>{await db.organization.deleteMany({where:{id:{in:orgs}}});await db.user.deleteMany({where:{id:{in:users}}});await db.$disconnect()})
async function fixture(page:Page){
 const registration=await page.request.post('/api/auth/register',{headers,data:{fullName:'Context review owner',phone:'context-review-'+randomUUID(),password:'test-only-password',organizationName:'Context review business'}})
 expect(registration.ok()).toBe(true);const me=(await registration.json()).data;orgs.push(me.organization.id);users.push(me.user.id)
 const store=await db.store.findFirstOrThrow({where:{organizationId:me.organization.id}}),register=await db.register.findFirstOrThrow({where:{storeId:store.id}})
 const secondRegister=await db.register.create({data:{storeId:store.id,name:'Second register',code:'SECOND'}})
 // Deliberately no owner UserStore assignment: owner must still see this branch.
 const secondStore=await db.store.create({data:{organizationId:me.organization.id,name:'Second branch'}})
 const otherRegister=await db.register.create({data:{storeId:secondStore.id,name:'Other branch register',code:'OTHER'}})
 return {me,store,register,secondRegister,secondStore,otherRegister}
}
const saved=(page:Page)=>expect(page.getByRole('status').filter({hasText:'Savat lokal saqlandi'})).toBeVisible()

test('Branch/register selectors verify accessible IDs, preserve selection after reload and handle server failure without changing context',async({page})=>{
 const f=await fixture(page)
 await page.goto('/pos');await saved(page)
 const deployment=(await(await page.request.get('/api/deployment/status')).json()).data
 expect(typeof deployment.release).toBe('string');expect(deployment.maintenance).toBe(false)
 await expect(page.getByText('Serverning texnik xizmat holati olinmadi. Natijasi noaniq amallarni yangi kalit bilan takrorlamang.',{exact:true})).toHaveCount(0)
 await expect(page.getByLabel('Filialni almashtirish',{exact:true})).toHaveValue(f.store.id)
 const initialRegister=await page.getByLabel('Kassani almashtirish',{exact:true}).inputValue()
 await expect.poll(()=>page.evaluate(()=>JSON.parse(localStorage.getItem('pos_active_register')??'null')?.id)).toBe(initialRegister)
 await expect.poll(()=>page.evaluate(()=>JSON.parse(localStorage.getItem('pos_active_store')??'null')?.id)).toBe(f.store.id)
 // Database row order is not a terminal-selection contract. Even the initial
 // automatic choice must survive a new order in the next verified response.
 await page.route('**/api/stores?*',async route=>{
  const response=await route.fetch(),body=await response.json()
  body.data=body.data.map((store:{registers?:unknown[]})=>({...store,registers:store.registers?.slice().reverse()}))
  await route.fulfill({response,json:body})
 })
 await page.reload();await saved(page)
 await expect(page.getByLabel('Kassani almashtirish',{exact:true})).toHaveValue(initialRegister)
 await page.unroute('**/api/stores?*')
 await page.getByLabel('Kassani almashtirish',{exact:true}).selectOption(f.secondRegister.id)
 await expect.poll(()=>page.evaluate(()=>JSON.parse(localStorage.getItem('pos_active_register')??'null')?.id)).toBe(f.secondRegister.id)
 await saved(page);await expect(page.getByLabel('Kassani almashtirish',{exact:true})).toHaveValue(f.secondRegister.id)
 await page.reload();await saved(page);await expect(page.getByLabel('Kassani almashtirish',{exact:true})).toHaveValue(f.secondRegister.id)
 await page.route('**/api/stores?*',route=>route.abort('failed'))
 await page.getByLabel('Filialni almashtirish',{exact:true}).selectOption(f.secondStore.id)
 await expect(page.getByLabel('Filialni almashtirish',{exact:true})).toBeEnabled()
 await expect(page.getByLabel('Filialni almashtirish',{exact:true})).toHaveValue(f.store.id)
 expect(await page.evaluate(()=>JSON.parse(localStorage.getItem('pos_active_register')!).id)).toBe(f.secondRegister.id)
 await page.unroute('**/api/stores?*')
 await page.getByLabel('Filialni almashtirish',{exact:true}).selectOption(f.secondStore.id)
 await expect.poll(()=>page.evaluate(()=>JSON.parse(localStorage.getItem('pos_active_store')??'null')?.id)).toBe(f.secondStore.id)
 await saved(page);await expect(page.getByLabel('Filialni almashtirish',{exact:true})).toHaveValue(f.secondStore.id)
 expect(await page.evaluate(()=>JSON.parse(localStorage.getItem('pos_active_register')!).id)).toBe(f.otherRegister.id)
 await page.setViewportSize({width:390,height:844});await page.reload();await saved(page)
 expect(await page.evaluate(()=>document.documentElement.scrollWidth<=window.innerWidth)).toBe(true)
 const registerBox=await page.locator('header').getByText('Other branch register',{exact:true}).boundingBox(),badgeBox=await page.locator('header').getByText('Smena ochilmagan',{exact:true}).boundingBox()
 expect(registerBox).not.toBeNull();expect(badgeBox).not.toBeNull()
 expect(registerBox!.x+registerBox!.width<=badgeBox!.x||registerBox!.y+registerBox!.height<=badgeBox!.y).toBe(true)
 await page.screenshot({path:test.info().outputPath('mobile-context.png'),fullPage:true})
})

test('Fractional cart and conversion controls survive reload; nonempty cart and held draft ACK block branch changes',async({page})=>{
 const f=await fixture(page),organizationId=f.me.organization.id
 await db.unit.updateMany({where:{organizationId,code:'kg'},data:{precision:6}})
 await db.unit.create({data:{organizationId,code:'pack',name:'Pack',precision:0}})
 const product=await db.product.create({data:{organizationId,name:'Exact fractional item',sku:randomUUID(),barcode:randomUUID(),unit:'kg',salePrice:'100',costPrice:'10'}})
 await db.productUnitConversion.create({data:{organizationId,productId:product.id,baseUnit:'kg',tradeUnit:'pack',ratio:'0.125'}})
 await db.shift.create({data:{registerId:f.register.id,organizationUserId:f.me.user.organizationUserId,openingCash:0}})
 await page.goto('/pos');await saved(page)
 // This scenario requires the fixture's open shift, not an unspecified first
 // register from the API response.
 await page.getByLabel('Kassani almashtirish',{exact:true}).selectOption(f.register.id)
 await saved(page)
 await page.getByRole('heading',{name:product.name,exact:true}).click()
 const quantity=page.getByLabel(product.name+' miqdori',{exact:true})
 await quantity.fill('2.3');await page.getByLabel(product.name+' miqdorini kamaytirish',{exact:true}).click();await expect(quantity).toHaveValue('1.3')
 // Adding the same catalog item must also use decimal arithmetic.
 await page.getByRole('heading',{name:product.name,exact:true}).first().click();await expect(quantity).toHaveValue('2.3')
 await saved(page);await page.reload();await saved(page);await expect(quantity).toHaveValue('2.3')
 const conversion=page.getByLabel(product.name+' savdo birligi',{exact:true})
 await expect(conversion).toContainText('pack');await conversion.selectOption('pack');await saved(page)
 await page.reload();await saved(page);await expect(conversion).toHaveValue('pack');await expect(quantity).toHaveValue('1')
 await page.getByLabel('Filialni almashtirish',{exact:true}).selectOption(f.secondStore.id)
 await expect(page.getByText('Filial yoki kassani almashtirishdan oldin savatni server qoralamasi sifatida saqlang yoki tozalang.',{exact:true})).toBeVisible()
 await expect(page.getByLabel('Filialni almashtirish',{exact:true})).toHaveValue(f.store.id);await expect(conversion).toHaveValue('pack')
 let entered!:()=>void,release!:()=>void
 const started=new Promise<void>(resolve=>{entered=resolve}),held=new Promise<void>(resolve=>{release=resolve})
 await page.route('**/api/sales',async route=>{if(route.request().method()!=='POST')return route.continue();const response=await route.fetch();expect(response.ok()).toBe(true);entered();await held;await route.fulfill({response})})
 try{
  await page.getByRole('button',{name:'Qoralamani serverda saqlash',exact:true}).click();await started
  await page.getByLabel('Filialni almashtirish',{exact:true}).selectOption(f.secondStore.id)
  await expect(page.getByLabel('Filialni almashtirish',{exact:true})).toHaveValue(f.store.id)
 }finally{release()}
 await expect(page.getByText(/Qoralama serverda saqlandi:/)).toBeVisible();await saved(page)
 await page.getByLabel('Filialni almashtirish',{exact:true}).selectOption(f.secondStore.id)
 await expect.poll(()=>page.evaluate(()=>JSON.parse(localStorage.getItem('pos_active_store')??'null')?.id)).toBe(f.secondStore.id)
 await saved(page)
 const sale=await db.sale.findFirstOrThrow({where:{organizationId},include:{items:true}})
 expect(sale.storeId).toBe(f.store.id);expect(sale.registerId).toBe(f.register.id);expect(sale.status).toBe('draft');expect(sale.items[0].quantity.toString()).toBe('0.125')
 expect(await db.payment.count({where:{organizationId}})).toBe(0)
})

test('Settings can clear TIN/footer and expose tax settings; sidebar reports an actual server outage',async({page})=>{
 const f=await fixture(page)
 await db.organization.update({where:{id:f.me.organization.id},data:{tin:'review-'+randomUUID(),receiptFooter:'Old footer'}})
 await page.goto('/settings')
 await expect(page.getByLabel('STIR / INN',{exact:true})).not.toHaveValue('')
 await page.getByLabel('STIR / INN',{exact:true}).fill('');await page.getByLabel('Chek ostidagi matn (kvitansiya footer)',{exact:true}).fill('')
 await page.getByRole('button',{name:"O'zgarishlarni saqlash",exact:true}).click()
 await expect.poll(async()=>{const org=await db.organization.findUniqueOrThrow({where:{id:f.me.organization.id}});return [org.tin,org.receiptFooter]}).toEqual([null,''])
 await page.reload();await expect(page.getByLabel('STIR / INN',{exact:true})).toHaveValue('');await expect(page.getByLabel('Chek ostidagi matn (kvitansiya footer)',{exact:true})).toHaveValue('')
 await expect(page.getByRole('link',{name:'Soliq siyosati va stavka tarixi',exact:true})).toHaveAttribute('href','/settings/taxes')
 const connectionStatus=page.getByRole('status',{name:'Server aloqasi',exact:true})
 await expect(connectionStatus).toHaveText('Online')
 await page.route('**/api/health/ready',route=>route.fulfill({status:503,json:{status:'unavailable'}}))
 await page.evaluate(()=>window.dispatchEvent(new Event('offline')))
 await expect(connectionStatus).toHaveText('Offline')
 await page.unroute('**/api/health/ready');await page.evaluate(()=>window.dispatchEvent(new Event('online')));await expect(connectionStatus).toHaveText('Online')
})

test('Failed logout preserves a saved cart; acknowledged logout clears local scope and revokes the actual session',async({page})=>{
 const f=await fixture(page),product=await db.product.create({data:{organizationId:f.me.organization.id,name:'Recoverable logout item',sku:randomUUID(),barcode:randomUUID(),unit:'dona',salePrice:'10',costPrice:'1'}})
 await page.goto('/pos');await saved(page);await page.getByRole('heading',{name:product.name,exact:true}).click();await saved(page)
 await page.route('**/api/auth/logout',route=>route.abort('failed'))
 await page.getByRole('button',{name:'Tizimdan chiqish',exact:true}).click()
 await expect(page.getByText('Server bilan ulanish uzildi; amal natijasi noma’lum.',{exact:false})).toBeVisible()
 await expect(page).toHaveURL(/\/pos$/);await page.reload();await saved(page)
 await expect(page.getByLabel(product.name+' miqdori',{exact:true})).toHaveValue('1')
 await page.unroute('**/api/auth/logout')
 await page.getByRole('button',{name:'Tizimdan chiqish',exact:true}).click();await expect(page).toHaveURL(/\/login$/)
 expect((await page.request.get('/api/auth/me')).status()).toBe(401)
 const drafts=await page.evaluate(async()=>{const request=indexedDB.open('shuni-pos-local-v1');const database=await new Promise<IDBDatabase>((resolve,reject)=>{request.onsuccess=()=>resolve(request.result);request.onerror=()=>reject(request.error)});const count=await new Promise<number>(resolve=>{const query=database.transaction('drafts').objectStore('drafts').count();query.onsuccess=()=>resolve(query.result)});database.close();return count})
 expect(drafts).toBe(0)
})
