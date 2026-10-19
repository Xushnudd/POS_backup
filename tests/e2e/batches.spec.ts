import {test,expect} from '@playwright/test'
import {PrismaClient} from '@prisma/client'
import {randomUUID} from 'node:crypto'
import {readFileSync} from 'node:fs'
import {enrollCritical} from './critical-fixture'
const connection=new URL(process.env.DATABASE_URL??'')
if(connection.hostname!=='127.0.0.1'||connection.port!=='55439'||connection.pathname!=='/pos_test')throw Error('Isolated test DB only')
const db=new PrismaClient(),orgs:string[]=[],users:string[]=[]
test.afterAll(async()=>{await db.organization.deleteMany({where:{id:{in:orgs}}});await db.user.deleteMany({where:{id:{in:users}}});await db.$disconnect()})
test('Batch policy MFA/lost acknowledgement, FEFO receipt, expiry CSV and count original-key recovery',async({page})=>{
 test.setTimeout(180000)
 page.on('dialog',dialog=>dialog.type()==='beforeunload'?dialog.accept():dialog.dismiss())
 const headers={Origin:'https://localhost:3100'},password='test-only-password'
 expect((await page.request.post('/api/auth/register',{headers,data:{phone:'batch-'+randomUUID(),password,fullName:'Batch owner',organizationName:'Batch acceptance'}})).ok()).toBe(true)
 const me=(await(await page.request.get('/api/auth/me')).json()).data;orgs.push(me.organization.id);users.push(me.user.id)
 const critical=await enrollCritical(page,password),store=await db.store.findFirstOrThrow({where:{organizationId:me.organization.id}})
 const product=await db.product.create({data:{organizationId:me.organization.id,name:'Batch browser '+randomUUID(),sku:randomUUID(),barcode:randomUUID(),unit:'dona',salePrice:10,costPrice:3}})
 await page.goto('/inventory/batches')
 await page.getByLabel('Nazorat mahsulotini qidirish',{exact:true}).fill(product.name)
 await page.getByRole('button',{name:product.name,exact:true}).click()
 await page.getByLabel('Partiya nazorati sababi',{exact:true}).fill('Original policy review')
 const policyKeys:string[]=[]
 await page.route('**/inventory/batches/policy',async route=>{if(route.request().method()!=='POST')return route.continue();policyKeys.push(route.request().postDataJSON().operationId);const response=await route.fetch();if(response.ok())await route.abort('failed');else await route.fulfill({response})})
 await page.getByRole('button',{name:'Partiya nazoratini saqlash: oldindan ko‘rish',exact:true}).click()
 await page.getByRole('button',{name:'Amalni tasdiqlash',exact:true}).click();await critical.approve()
 await expect.poll(async()=> (await db.product.findUniqueOrThrow({where:{id:product.id}})).batchTracking).toBe(true)
 await expect(page.getByRole('button',{name:'Original amalni qayta tekshirish',exact:true})).toBeEnabled()
 await page.unroute('**/inventory/batches/policy');await page.reload()
 await page.getByRole('button',{name:'Saqlangan amalni qayta tekshirish',exact:true}).click()
 await expect(page.getByRole('button',{name:'Saqlangan amalni qayta tekshirish',exact:true})).toHaveCount(0)
 expect(new Set(policyKeys).size).toBe(1);expect(await db.auditLog.count({where:{organizationId:me.organization.id,action:'batch_tracking_enabled'}})).toBe(1)
 const parts=new Intl.DateTimeFormat('en',{timeZone:'Asia/Tashkent',year:'numeric',month:'2-digit',day:'2-digit'}).formatToParts(new Date()),part=(kind:string)=>parts.find(value=>value.type===kind)!.value,today=part('year')+'-'+part('month')+'-'+part('day')
 const day=(offset:number)=>{const value=new Date(today+'T00:00:00Z');value.setUTCDate(value.getUTCDate()+offset);return value.toISOString().slice(0,10)}
 const post=async(path:string,data:Record<string,unknown>)=>{const response=await page.request.post(path,{headers,data:{operationId:randomUUID(),...data}});expect(response.ok(),await response.text()).toBe(true);return (await response.json()).data}
 for(const [code,quantity,expiry] of [['Expired','5',day(-1)],['Early','2',day(1)],['Later','3',day(90)]]){const doc=await post('/api/stock-documents',{organizationId:me.organization.id,storeId:store.id,documentType:'purchase',documentNo:'BATCH-'+code,note:'Actual batch receipt',items:[{productId:product.id,quantity,unitCost:'3',batchInput:{code,receivedOn:day(-30),expiresOn:expiry}}]});await post('/api/stock-documents/'+doc.id+'/confirm',{})}
 const member=await db.organizationUser.findUniqueOrThrow({where:{organizationId_userId:{organizationId:me.organization.id,userId:me.user.id}}})
 const register=await db.register.findFirstOrThrow({where:{storeId:store.id}}),shift=await post('/api/shifts',{registerId:register.id,organizationUserId:member.id,openingCash:'0'})
 const sale=await post('/api/sales',{organizationId:me.organization.id,storeId:store.id,registerId:register.id,shiftId:shift.id,items:[{productId:product.id,quantity:'3',discountAmount:'0'}],discountAmount:'0'})
 const completed=await post('/api/sales/'+sale.id+'/complete',{payments:[{paymentType:'cash',amount:'30'}]})
 expect(completed.items[0].batchAllocations.map((row:{code:string;quantity:string})=>[row.code,row.quantity]).sort()).toEqual([['Early','2.000000'],['Later','1.000000']])
 await page.goto('/inventory/batches');await page.getByLabel('Yaroqlilik holati',{exact:true}).selectOption('expired')
 await expect(page.getByRole('row').filter({hasText:'Expired'})).toContainText('5.000000')
 const download=page.waitForEvent('download');await page.getByRole('button',{name:'CSV eksport',exact:true}).click();const file=await download,content=readFileSync((await file.path())!,'utf8')
 expect(content).toContain('Expired');expect(content).toContain('5.000000');expect(content).not.toContain('Later')
 await page.getByRole('button',{name:'Shu mahsulot partiyalarini sanash',exact:true}).click()
 const panel=page.getByRole('region',{name:'Partiya bo‘yicha sanash',exact:true})
 await panel.getByLabel('Sanalgan partiya Expired',{exact:true}).fill('4')
 await panel.getByLabel('Sanalgan partiya Early',{exact:true}).fill('0')
 await panel.getByLabel('Sanalgan partiya Later',{exact:true}).fill('2')
 await panel.getByLabel('Partiya sanash sababi',{exact:true}).fill('Actual counted expired lot')
 await page.route('**/inventory/batches/count/*?*',route=>route.abort('failed'))
 await panel.getByRole('button',{name:'Sanash manbasini qayta tekshirish',exact:true}).click();await expect(panel.getByRole('alert')).toBeVisible()
 await expect(panel.getByLabel('Sanalgan partiya Expired',{exact:true})).toHaveValue('4')
 await expect(panel.getByRole('button',{name:'Partiya sanashini tasdiqlash: oldindan ko‘rish',exact:true})).toBeDisabled()
 await page.unroute('**/inventory/batches/count/*?*');await panel.getByRole('button',{name:'Sanash manbasini qayta tekshirish',exact:true}).click()
 const countKeys:string[]=[]
 await page.route('**/inventory/batches/count/*',async route=>{if(route.request().method()!=='POST')return route.continue();countKeys.push(route.request().postDataJSON().operationId);const response=await route.fetch();expect(response.ok()).toBe(true);await route.abort('failed')})
 await panel.getByRole('button',{name:'Partiya sanashini tasdiqlash: oldindan ko‘rish',exact:true}).click();await panel.getByRole('button',{name:'Amalni tasdiqlash',exact:true}).click()
 await expect.poll(()=>db.auditLog.count({where:{organizationId:me.organization.id,action:'batch_count_reconciled'}})).toBe(1)
 await expect(panel.getByRole('button',{name:'Original amalni qayta tekshirish',exact:true})).toBeEnabled()
 await page.unroute('**/inventory/batches/count/*');await page.reload()
 await page.getByRole('button',{name:'Saqlangan amalni qayta tekshirish',exact:true}).click();await expect(page.getByRole('button',{name:'Saqlangan amalni qayta tekshirish',exact:true})).toHaveCount(0)
 expect(new Set(countKeys).size).toBe(1);expect(await db.auditLog.count({where:{organizationId:me.organization.id,action:'batch_count_reconciled'}})).toBe(1)
 expect((await db.inventoryBalance.findUniqueOrThrow({where:{storeId_productId:{storeId:store.id,productId:product.id}}})).quantity.toFixed()).toBe('6')
 // Source-backed large read navigation follows the already accepted policy.
 for(let i=0;i<43;i++){const doc=await post('/api/stock-documents',{organizationId:me.organization.id,storeId:store.id,documentType:'purchase',documentNo:'LIST-BATCH-'+String(i).padStart(3,'0'),items:[{productId:product.id,quantity:'1',unitCost:'3',batchInput:{code:'LIST-'+String(i).padStart(3,'0'),receivedOn:today,expiresOn:day(60+i)}}]});await post('/api/stock-documents/'+doc.id+'/confirm',{})}
 await page.goto('/inventory/batches?search=LIST-&sort=expiry_desc&page=3');await expect(page.locator('tbody tr')).toHaveCount(3);await expect(page.locator('tbody tr').first()).toContainText('LIST-002');await page.reload();await expect(page.locator('tbody tr')).toHaveCount(3);
 await page.getByLabel('Partiya yoki mahsulot qidirish',{exact:true}).fill('LIST-042');await page.getByRole('button',{name:'Qidirish',exact:true}).click();await expect(page.locator('tbody tr')).toHaveCount(1);await page.goBack();await expect(page.locator('tbody tr')).toHaveCount(3);
 await page.getByLabel('Yaroqlilik holati',{exact:true}).selectOption('expired');await expect(page.getByText('Tanlangan filtrda partiya topilmadi.',{exact:true})).toBeVisible();await page.goBack();await expect(page.locator('tbody tr')).toHaveCount(3);

 // Three receipts, one original confirmed count adjustment and43later receipts.
 expect(await db.inventoryMovement.count({where:{organizationId:me.organization.id,productId:product.id,sourceType:'stock_document'}})).toBe(47);
 await page.goto('/inventory/movements?'+new URLSearchParams({productId:product.id,sourceType:'stock_document',sort:'oldest',page:'3'}));await expect(page.locator('tbody tr')).toHaveCount(7);await page.reload();await expect(page.locator('tbody tr')).toHaveCount(7);
 await page.getByLabel('Mahsulot, SKU yoki jurnal izohi qidirish',{exact:true}).fill('NO-SUCH-JOURNAL-SKU');await page.getByRole('button',{name:'Qidirish',exact:true}).click();await expect(page.getByText('Harakat topilmadi.',{exact:true})).toBeVisible();await page.goBack();await expect(page.locator('tbody tr')).toHaveCount(7);

})
