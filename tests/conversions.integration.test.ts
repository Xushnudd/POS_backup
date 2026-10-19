import {test,after} from 'node:test'
import assert from 'node:assert/strict'
import {randomUUID,randomBytes} from 'node:crypto'
import {NextRequest} from 'next/server'
import {prisma} from '@/lib/prisma'
import type {TokenPayload} from '@/lib/auth'
import {sessionHash} from '@/server/auth/session'
import {createDraft,completeSale} from '@/server/sales/service'
import {returnSale} from '@/server/returns/service'
import {setConversion} from '@/server/catalog/conversions'
import {confirmStockDocument} from '@/server/inventory/documents'
const connection=new URL(process.env.DATABASE_URL??'')
if (connection.pathname!=='/pos_test' || connection.hostname!=='127.0.0.1'||connection.port!=='55439'||connection.username!=='pos_test') throw new Error('Isolated test DB required')
const orgs:string[]=[],users:string[]=[]
after(async()=>{
 await prisma.organization.deleteMany({where:{id:{in:orgs}}})
 await prisma.user.deleteMany({where:{id:{in:users}}});await prisma.$disconnect()
})
async function fixture(quantity=10) {
 const org=await prisma.organization.create({data:{name:'Economic test',phone:randomUUID()}});orgs.push(org.id)
 const user=await prisma.user.create({data:{fullName:'Owner',phone:randomUUID(),passwordHash:'not-a-login'}});users.push(user.id)
 const member=await prisma.organizationUser.create({data:{organizationId:org.id,userId:user.id,role:'owner'}})
 const store=await prisma.store.create({data:{organizationId:org.id,name:'Main'}})
 const register=await prisma.register.create({data:{storeId:store.id,name:'Till',code:'1'}})
 const shift=await prisma.shift.create({data:{registerId:register.id,organizationUserId:member.id,openingCash:0}})
 const product=await prisma.product.create({data:{organizationId:org.id,name:'Product',sku:'P',barcode:'P',unit:'dona',salePrice:100,costPrice:50}})
 await prisma.inventoryBalance.create({data:{storeId:store.id,productId:product.id,quantity}})
 const token=randomBytes(32).toString('base64url');const session=await prisma.session.create({data:{userId:user.id,organizationId:org.id,tokenHash:sessionHash(token),expiresAt:new Date(Date.now()+3600000),idleExpiresAt:new Date(Date.now()+3600000)}})
 const context:TokenPayload={userId:user.id,organizationId:org.id,organizationUserId:member.id,role:'owner',storeIds:[store.id],sessionId:session.id}
 const draft={discountReason:'Test customer discount approved by scenario owner',organizationId:org.id,storeId:store.id,registerId:register.id,shiftId:shift.id,discountAmount:0,items:[{productId:product.id,quantity:1,discountAmount:0}]}
 return {org,user,store,shift,product,context,draft,cookie:'pos_session='+token}
}


function config(ratio='12'){return {operationId:randomUUID(),tradeUnit:'quti',ratio,isActive:true,reason:'Owner verified package size'}}
test('One box sale posts twelve base units; original ratio governs partial return after catalogue changes',async()=>{
 const f=await fixture(24);await setConversion(f.context,f.product.id,config());const draft=await createDraft(f.context,{...f.draft,items:[{productId:f.product.id,quantity:1,tradeUnit:'quti',expectedConversionRatio:'12',discountAmount:0}]},randomUUID());assert.equal(String(draft.totalAmount),'1200');assert.equal(String(draft.items[0].quantity),'12');
 const sale=await completeSale(f.context,draft.id,{payments:[{paymentType:'cash',amount:'1200'}]},randomUUID());assert.equal((await prisma.inventoryBalance.findUniqueOrThrow({where:{storeId_productId:{storeId:f.store.id,productId:f.product.id}}})).quantity.toString(),'12');
 await setConversion(f.context,f.product.id,config('10'));const ret=await returnSale(f.context,sale.id,{operationId:randomUUID(),shiftId:f.shift.id,reason:'Customer returned six original pieces',items:[{saleItemId:sale.items[0].id,quantity:'0.5',tradeUnit:'quti',disposition:'sellable'}]});assert.equal(ret.items[0].quantity.toString(),'6');assert.equal(ret.refundAmount.toString(),'600');assert.equal((await prisma.inventoryBalance.findUniqueOrThrow({where:{storeId_productId:{storeId:f.store.id,productId:f.product.id}}})).quantity.toString(),'18');assert.equal((sale.items[0].conversionSnapshot as {ratio:string}).ratio,'12');
});
test('Purchase box quantity uses base-unit cost, preserves document input, and stale draft cannot silently post a new ratio',async()=>{
 const f=await fixture(0);await setConversion(f.context,f.product.id,config());const {POST}=await import('@/app/api/stock-documents/route');const response=await POST(new NextRequest('http://localhost:3000/api/stock-documents',{method:'POST',headers:{cookie:f.cookie,origin:'http://localhost:3000','content-type':'application/json'},body:JSON.stringify({organizationId:f.org.id,storeId:f.store.id,documentType:'purchase',documentNo:randomUUID(),items:[{productId:f.product.id,quantity:'2',tradeUnit:'quti',unitCost:'50'}]})}),undefined);assert.equal(response.status,200);const created=(await response.json()).data;
 const doc=await confirmStockDocument(f.context,created.id);assert.equal(doc.items[0].quantity.toString(),'24');assert.equal((doc.items[0].conversionSnapshot as {tradeQuantity:string}).tradeQuantity,'2');
 const draft=await createDraft(f.context,{...f.draft,items:[{productId:f.product.id,quantity:1,tradeUnit:'quti',discountAmount:0}]},randomUUID());await setConversion(f.context,f.product.id,config('10'));await assert.rejects(()=>completeSale(f.context,draft.id,{payments:[{paymentType:'cash',amount:'1200'}]},randomUUID()),{code:'CONVERSION_CHANGED'});assert.equal(await prisma.payment.count({where:{saleId:draft.id}}),0);await assert.rejects(()=>createDraft(f.context,{...f.draft,items:[{productId:f.product.id,quantity:1,tradeUnit:'quti',expectedConversionRatio:'12',discountAmount:0}]},randomUUID()),{code:'CONVERSION_CHANGED'});
});
test('Conversion scope and precision reject foreign products, unsupported units and mixed SKU document units',async()=>{
 const f=await fixture(24),other=await fixture();await assert.rejects(()=>setConversion(f.context,other.product.id,config()),{code:'NOT_FOUND'});await assert.rejects(()=>setConversion({...f.context,role:'cashier'},f.product.id,config()),{code:'OWNER_REQUIRED'});await assert.rejects(()=>setConversion(f.context,f.product.id,{...config(),tradeUnit:'missing'}),{code:'UNIT_UNAVAILABLE'});await setConversion(f.context,f.product.id,config());await assert.rejects(()=>createDraft(f.context,{...f.draft,items:[{productId:f.product.id,quantity:1,tradeUnit:'quti',discountAmount:0},{productId:f.product.id,quantity:1,discountAmount:0}]},randomUUID()),{code:'MIXED_TRADE_UNITS'});
 const invalidDraft=await createDraft(f.context,f.draft,randomUUID());await assert.rejects(()=>prisma.saleItem.create({data:{saleId:invalidDraft.id,productId:f.product.id,productName:'Bad conversion',sku:'BAD',unit:'dona',quantity:12,unitPrice:100,unitCost:50,lineTotal:1200,conversionSnapshot:{baseUnit:'dona',tradeUnit:'quti',ratio:'10',tradeQuantity:'1'}}}));
});

test('Exact barcode, alias and identifier lookup expose the same conversion metadata as catalog listing',async()=>{
 const f=await fixture();await setConversion(f.context,f.product.id,config());
 await prisma.productBarcode.create({data:{organizationId:f.org.id,productId:f.product.id,value:'ALIAS-'+f.product.id}});
 const {GET}=await import('@/app/api/products/route');
 for(const query of ['barcode=P','barcode=ALIAS-'+f.product.id,'identifier='+f.product.name,'search=P']){
  const response=await GET(new NextRequest('http://localhost:3000/api/products?organizationId='+f.org.id+'&'+query,{headers:{cookie:f.cookie}}),undefined);
  assert.equal(response.status,200);const body=await response.json();const row=Array.isArray(body.data)?body.data.find((item:{id:string})=>item.id===f.product.id):body.data;
  assert.equal(row.unitPrecision,0);assert.equal(row.unitConversions.length,1);assert.equal(row.unitConversions[0].tradeUnit,'quti');assert.equal(row.unitConversions[0].ratio,'12');assert.equal(row.unitConversions[0].tradePrecision,0);
 }
});
