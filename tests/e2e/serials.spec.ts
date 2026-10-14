import {test,expect} from '@playwright/test'
import {PrismaClient} from '@prisma/client'
import {randomUUID} from 'node:crypto'
import {enrollCritical} from './critical-fixture'
const url=new URL(process.env.DATABASE_URL??'');if(url.hostname!=='127.0.0.1'||url.port!=='55439'||url.pathname!=='/pos_test')throw Error('Isolated DB only')
const db=new PrismaClient(),orgs:string[]=[],users:string[]=[]
test.afterAll(async()=>{await db.organization.deleteMany({where:{id:{in:orgs}}});await db.user.deleteMany({where:{id:{in:users}}});await db.$disconnect()})
test('Owner serial policy MFA and original lost ACK recovery; real unit warranty/service history remains source-linked',async({page})=>{
 test.setTimeout(180000)
 page.on('dialog',d=>d.type()==='beforeunload'?d.accept():d.dismiss())
 const headers={Origin:'https://localhost:3100'},password='test-only-password'
 expect((await page.request.post('/api/auth/register',{headers,data:{phone:'serial-browser-'+randomUUID(),password,fullName:'Serial owner',organizationName:'Actual serial business'}})).ok()).toBe(true)
 const me=(await(await page.request.get('/api/auth/me')).json()).data;orgs.push(me.organization.id);users.push(me.user.id)
 const critical=await enrollCritical(page,password),store=await db.store.findFirstOrThrow({where:{organizationId:me.organization.id}}),product=await db.product.create({data:{organizationId:me.organization.id,name:'Browser serial unit '+randomUUID(),sku:randomUUID(),barcode:randomUUID(),unit:'dona',salePrice:10,costPrice:2}})
 await page.goto('/inventory/serials')
 const policy=page.getByRole('region',{name:'Serial nazoratini sozlash',exact:true})
 await policy.getByLabel('Mahsulot qidirish',{exact:true}).fill(product.name)
 await expect(policy.getByLabel('Mahsulot',{exact:true})).toBeEnabled();await policy.getByLabel('Mahsulot',{exact:true}).selectOption(product.id)
 await policy.getByLabel('Kafolat kunlari',{exact:true}).fill('365');await policy.getByLabel('Kafolat shartlari',{exact:true}).fill('Actual original terms');await policy.getByLabel('Serial nazorati sababi',{exact:true}).fill('Actual reviewed serial policy')
 const keys:string[]=[];let dropped=false
 await page.route('**/inventory/serials/policy',async route=>{keys.push(route.request().postDataJSON().operationId);const response=await route.fetch();if(response.ok()&&!dropped){dropped=true;await route.abort('failed')}else await route.fulfill({response})})
 await policy.getByRole('button',{name:'Serial nazoratini saqlash: oldindan ko‘rish',exact:true}).click();await policy.getByRole('button',{name:'Amalni tasdiqlash',exact:true}).click()
 expect((await db.product.findUniqueOrThrow({where:{id:product.id}})).serialTracking).toBe(false)
 await critical.approve();await expect.poll(async()=>(await db.product.findUniqueOrThrow({where:{id:product.id}})).serialTracking).toBe(true)
 await expect(policy.getByRole('button',{name:'Original amalni qayta tekshirish',exact:true})).toBeVisible()
 await page.reload();await page.getByRole('button',{name:'Saqlangan amalni qayta tekshirish',exact:true}).click();await expect(page.getByRole('button',{name:'Saqlangan amalni qayta tekshirish',exact:true})).toHaveCount(0);expect(new Set(keys).size).toBe(1)
 const post=async(path:string,data:Record<string,unknown>)=>{const response=await page.request.post(path,{headers,data:{operationId:randomUUID(),...data}});expect(response.ok()).toBe(true);return(await response.json()).data}
 const supplier=await db.supplier.create({data:{organizationId:me.organization.id,name:'Browser serial supplier'}}),order=await post('/api/purchase-orders',{storeId:store.id,supplierId:supplier.id,referenceNo:'SERIAL-BROWSER-ORDER',reason:'Actual serial order',items:[{productId:product.id,quantity:'1',unitCost:'2'}]})
 await post('/api/purchase-orders/'+order.id+'/receive',{referenceNo:'SERIAL-BROWSER-RECEIPT',reason:'Actual serial receipt',items:[{orderItemId:order.items[0].id,quantity:'1',serialInput:['BROWSER-SERIAL-ONE']}]})
 const serial=await db.serialNumber.findFirstOrThrow({where:{productId:product.id}}),register=await db.register.findFirstOrThrow({where:{storeId:store.id}}),shift=await post('/api/shifts',{registerId:register.id,organizationUserId:(await db.organizationUser.findFirstOrThrow({where:{organizationId:me.organization.id,userId:me.user.id}})).id,openingCash:'0'})
 const draft=await post('/api/sales',{organizationId:me.organization.id,storeId:store.id,registerId:register.id,shiftId:shift.id,items:[{productId:product.id,quantity:'1',discountAmount:0}],discountAmount:0})
 await post('/api/sales/'+draft.id+'/complete',{payments:[{paymentType:'cash',amount:'10'}],serialSelections:[{productId:product.id,ids:[serial.id]}]})
 await page.reload();await page.getByRole('button',{name:'Shu kafolat bo‘yicha servis',exact:true}).click()
 const service=page.getByRole('region',{name:'Kafolat servis jurnali',exact:true});await service.getByLabel('Servis izohi',{exact:true}).fill('Actual unit service request')
 await service.getByRole('button',{name:'Servis holatini yozish: oldindan ko‘rish',exact:true}).click();await service.getByRole('button',{name:'Amalni tasdiqlash',exact:true}).click()
 await expect.poll(()=>db.warrantyService.count({where:{productId:product.id}})).toBe(1)
 await page.getByRole('button',{name:'Barcha original serial tarixini ochish',exact:true}).click();await expect(page.getByRole('region',{name:'Original serial tarixi',exact:true})).toContainText('Actual unit service request')
 await page.goto('/sales/'+draft.id);await page.getByRole('button',{name:'Qaytarish',exact:true}).click()
 const picker=page.getByRole('group',{name:product.name+' original qaytariladigan seriallar',exact:true});await expect(picker.getByLabel('BROWSER-SERIAL-ONE',{exact:true})).toBeVisible()
 await picker.getByLabel('BROWSER-SERIAL-ONE',{exact:true}).check();await page.getByLabel(product.name,{exact:true}).fill('1');await page.getByRole('dialog',{name:'Tovar qaytarish',exact:true}).getByLabel('Sabab',{exact:true}).fill('Actual original serial refund');await page.getByRole('button',{name:'Qaytarishni tasdiqlash',exact:true}).click()
 await expect.poll(async()=>(await db.serialNumber.findUniqueOrThrow({where:{id:serial.id}})).state).toBe('available')
 await page.goto('/pos');await page.getByLabel('POS mahsulot qidirish',{exact:true}).fill(product.name);await page.getByRole('button',{name:product.name+' — savatga qo‘shish',exact:true}).click();await page.getByRole('button',{name:"To'lovga o'tish",exact:true}).click()
 const payment=page.getByRole('dialog',{name:"To'lovni qabul qilish",exact:true}),checkoutPicker=payment.getByRole('group',{name:product.name+' sotiladigan seriallar (1)',exact:true})
 await checkoutPicker.getByLabel('BROWSER-SERIAL-ONE',{exact:true}).check()
 let completionDropped=false;const completionKeys:string[]=[]
 await page.route('**/sales/*/complete',async route=>{completionKeys.push(route.request().postDataJSON().operationId??new URL(route.request().url()).pathname.split('/')[3]);const response=await route.fetch();if(response.ok()&&!completionDropped){completionDropped=true;await route.abort('failed')}else await route.fulfill({response})})
 await payment.getByRole('button',{name:/Savdoni yakunlash/}).click();await expect.poll(()=>db.warranty.count({where:{serialId:serial.id}})).toBe(2)
 await expect(page.getByRole('dialog',{name:'Savdo yakunlanmadi',exact:true})).toBeVisible()
 await page.reload();await expect(page.getByText('Oldingi savdo natijasi tekshirilishi kerak. Savatni o‘zgartirmang.',{exact:true})).toBeVisible()
 await page.getByRole('button',{name:'Natijani tekshirish',exact:true}).click();await expect.poll(()=>db.warranty.count({where:{serialId:serial.id}})).toBe(2)
 await expect(page.getByText('Oldingi savdo natijasi tekshirilishi kerak. Savatni o‘zgartirmang.',{exact:true})).toHaveCount(0)
 expect(new Set(completionKeys).size).toBe(1);expect(await db.serialEvent.count({where:{serialId:serial.id,kind:'sale'}})).toBe(2)
 expect((await db.inventoryBalance.findUniqueOrThrow({where:{storeId_productId:{storeId:store.id,productId:product.id}}})).quantity.toFixed()).toBe('0')

 const paged=await post('/api/purchase-orders',{storeId:store.id,supplierId:supplier.id,referenceNo:randomUUID(),reason:'Source-backed serial paging acceptance',items:[{productId:product.id,quantity:'43',unitCost:'2'}]});
 await post('/api/purchase-orders/'+paged.id+'/receive',{referenceNo:randomUUID(),reason:'Actual forty-three original unit receipt',items:[{orderItemId:paged.items[0].id,quantity:'43',serialInput:Array.from({length:43},(_,i)=>'PAGE-'+String(i).padStart(3,'0'))}]});
 await page.goto('/inventory/serials?search=PAGE-&sort=code_desc&page=3');await expect(page.locator('tbody tr')).toHaveCount(3);await expect(page.locator('tbody tr').first()).toContainText('PAGE-002');await page.reload();await expect(page.locator('tbody tr')).toHaveCount(3);
 await page.getByLabel('Seriya raqamini qidirish',{exact:true}).fill('PAGE-042');await page.getByRole('button',{name:'Qidirish',exact:true}).click();await expect(page.locator('tbody tr')).toHaveCount(1);await page.goBack();await expect(page.locator('tbody tr')).toHaveCount(3);
 await page.getByLabel('Serial holati',{exact:true}).selectOption('sold');await expect(page.getByText('Tanlangan filtrda serial yo‘q.',{exact:true})).toBeVisible();await page.goBack();await expect(page.locator('tbody tr')).toHaveCount(3);

})
