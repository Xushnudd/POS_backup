import {test,expect} from '@playwright/test'
import {PrismaClient} from '@prisma/client'
import {randomUUID} from 'node:crypto'
import {readFileSync} from 'node:fs'
const connection=new URL(process.env.DATABASE_URL??'')
if(connection.hostname!=='127.0.0.1'||connection.port!=='55439'||connection.pathname!=='/pos_test')throw new Error('Isolated database only')
const db=new PrismaClient(),organizations:string[]=[],users:string[]=[]
test.afterAll(async()=>{await db.organization.deleteMany({where:{id:{in:organizations}}});await db.user.deleteMany({where:{id:{in:users}}});await db.$disconnect()})
test('Inventory inactivity selector filters branch stock and CSV uses the same selection',async({page})=>{
 const result=await page.request.post('/api/auth/register',{headers:{Origin:'https://localhost:3100'},data:{fullName:'Inactivity owner',phone:'inactive-'+randomUUID(),password:'test-only-password',organizationName:'Inactivity fixture'}})
 expect(result.ok()).toBe(true)
 const identity=(await (await page.request.get('/api/auth/me')).json()).data
 organizations.push(identity.organization.id);users.push(identity.user.id)
 const store=await db.store.findFirstOrThrow({where:{organizationId:identity.organization.id}})
 const member=await db.organizationUser.findFirstOrThrow({where:{organizationId:identity.organization.id,userId:identity.user.id}})
 const register=await db.register.create({data:{storeId:store.id,name:'Fixture till',code:randomUUID()}})
 const shift=await db.shift.create({data:{registerId:register.id,organizationUserId:member.id,openingCash:0}})
 const products=[]
 for(const name of ['Inactive browser item','Recent browser item']){
  const product=await db.product.create({data:{organizationId:identity.organization.id,name,sku:randomUUID(),barcode:randomUUID(),unit:'dona',salePrice:10,costPrice:1}})
  await db.inventoryBalance.create({data:{storeId:store.id,productId:product.id,quantity:3}});products.push(product)
 }
 const sale=await db.sale.create({data:{organizationId:identity.organization.id,storeId:store.id,registerId:register.id,shiftId:shift.id,cashierId:identity.user.id,receiptNo:randomUUID(),subtotal:10,totalAmount:10,completedAt:new Date(),items:{create:{productId:products[1].id,productName:products[1].name,sku:products[1].sku,unit:'dona',quantity:1,unitPrice:10,lineTotal:10,unitCost:1}}}})
 await db.sale.update({where:{id:sale.id},data:{status:'completed'}})
 await page.goto('/inventory')
 await expect(page.getByRole('row').filter({hasText:'Recent browser item'})).toBeVisible()
 await page.getByLabel('Filialda yakunlangan savdosiz qoldiq').selectOption('30')
 await expect(page.getByRole('row').filter({hasText:'Inactive browser item'})).toBeVisible()
 await expect(page.getByRole('row').filter({hasText:'Recent browser item'})).toHaveCount(0)
 const [download]=await Promise.all([page.waitForEvent('download'),page.getByRole('button',{name:'Qoldiqlarni CSV yuklash',exact:true}).click()])
 const path=await download.path();expect(path).not.toBeNull();const content=readFileSync(path!,'utf8')
 expect(content).toContain('Inactive browser item');expect(content).not.toContain('Recent browser item');expect(content).toContain('Savdosiz kunlar')
 await page.getByLabel('Filialda yakunlangan savdosiz qoldiq').selectOption('')
 await expect(page.getByRole('row').filter({hasText:'Recent browser item'})).toBeVisible()
})
