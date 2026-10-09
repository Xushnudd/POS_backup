import {test,after} from 'node:test'
import assert from 'node:assert/strict'
import {randomUUID} from 'node:crypto'
import {prisma} from '@/lib/prisma'
import type {TokenPayload} from '@/lib/auth'
import {createDraft,completeSale} from '@/server/sales/service'
import {complianceSchema,setCompliance} from '@/server/catalog/compliance'
import {configureOfflineCash,issueCashTicket} from '@/server/offline/cash'
import {writeTaxProfile,addTaxVersion} from '@/server/taxes/service'
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
 const product=await prisma.product.create({data:{organizationId:org.id,name:'P',sku:'P',barcode:'P',unit:'dona',salePrice:100,costPrice:50}})
 await prisma.inventoryBalance.create({data:{storeId:store.id,productId:product.id,quantity}})
 const session=await prisma.session.create({data:{userId:user.id,organizationId:org.id,tokenHash:randomUUID(),expiresAt:new Date(Date.now()+3600000),idleExpiresAt:new Date(Date.now()+3600000)}})
 const context:TokenPayload={userId:user.id,organizationId:org.id,organizationUserId:member.id,role:'owner',storeIds:[store.id],sessionId:session.id}
 const draft={discountReason:'Test customer discount approved by scenario owner',organizationId:org.id,storeId:store.id,registerId:register.id,shiftId:shift.id,discountAmount:0,items:[{productId:product.id,quantity:1,discountAmount:0}]}
 return {org,user,store,shift,product,context,draft}
}

function policy(overrides:Partial<ReturnType<typeof complianceSchema.parse>>={}){return complianceSchema.parse({operationId:randomUUID(),mxik:null,mxikSource:null,mxikRequired:false,taxRequired:false,markingRequired:false,taxProfileId:null,reason:'Owner supplied classification decision',...overrides})}
test('Required classification blocks posting atomically; exact configured tax and source freeze on receipt',async()=>{
 const f=await fixture();await setCompliance(f.context,f.product.id,policy({mxikRequired:true}));
 const draft=await createDraft(f.context,f.draft,randomUUID());
 await assert.rejects(()=>completeSale(f.context,draft.id,{payments:[{paymentType:'cash',amount:100}]},randomUUID()),{code:'CLASSIFICATION_REQUIRED'});
 assert.equal(await prisma.payment.count({where:{saleId:draft.id}}),0);assert.equal((await prisma.inventoryBalance.findUniqueOrThrow({where:{storeId_productId:{storeId:f.store.id,productId:f.product.id}}})).quantity.toString(),'10');
 await setCompliance(f.context,f.product.id,policy({mxikRequired:true,mxik:'Business-approved-code',mxikSource:'Owner supplied catalogue reference',taxRequired:true}));
 await assert.rejects(()=>completeSale(f.context,draft.id,{payments:[{paymentType:'cash',amount:100}]},randomUUID()),{code:'PRODUCT_TAX_REQUIRED'});
 const profile=await writeTaxProfile(f.context,{operationId:randomUUID(),name:'Business supplied exemption'});await addTaxVersion(f.context,profile.id,{operationId:randomUUID(),mode:'exempt',rate:'0',exemptionReason:'Owner approved test exemption',effectiveAt:new Date(Date.now()-86400000).toISOString()});
 await setCompliance(f.context,f.product.id,policy({mxikRequired:true,mxik:'Business-approved-code',mxikSource:'Owner supplied catalogue reference',taxRequired:true,taxProfileId:profile.id}));
 const fresh=await createDraft(f.context,f.draft,randomUUID());const sale=await completeSale(f.context,fresh.id,{payments:[{paymentType:'cash',amount:100}]},randomUUID());
 const item=await prisma.saleItem.findFirstOrThrow({where:{saleId:sale.id}});assert.equal((item.complianceSnapshot as {mxik:string}).mxik,'Business-approved-code');
 await setCompliance(f.context,f.product.id,policy({mxik:'Changed code',mxikSource:'Changed owner reference'}));assert.deepEqual((await prisma.saleItem.findUniqueOrThrow({where:{id:item.id}})).complianceSnapshot,item.complianceSnapshot);
});
test('Ordinary goods remain sellable; marking integration fails closed without payment or stock posting',async()=>{
 const f=await fixture();const ordinary=await createDraft(f.context,f.draft,randomUUID());await completeSale(f.context,ordinary.id,{payments:[{paymentType:'cash',amount:100}]},randomUUID());
 await setCompliance(f.context,f.product.id,policy({markingRequired:true}));const blocked=await createDraft(f.context,f.draft,randomUUID());await assert.rejects(()=>completeSale(f.context,blocked.id,{payments:[{paymentType:'cash',amount:100}]},randomUUID()),{code:'MARKING_INTEGRATION_UNAVAILABLE'});assert.equal(await prisma.payment.count({where:{saleId:blocked.id}}),0);await configureOfflineCash(f.context,{operationId:randomUUID(),storeId:f.store.id,enabled:true,maxAmount:'1000',ttlSeconds:300,reason:'Owner supplied offline test policy'});await assert.rejects(()=>issueCashTicket(f.context,{operationId:randomUUID(),saleId:blocked.id,deviceId:randomUUID()}),{code:'MARKING_INTEGRATION_UNAVAILABLE'});assert.equal(await prisma.offlineCashLease.count({where:{saleId:blocked.id}}),0);assert.equal((await prisma.inventoryBalance.findUniqueOrThrow({where:{storeId_productId:{storeId:f.store.id,productId:f.product.id}}})).quantity.toString(),'9');
});
test('Classification changes enforce owner, tenant, strict validation and original idempotency key',async()=>{
 const f=await fixture(),other=await fixture(),input=policy({mxikRequired:true});await assert.rejects(()=>setCompliance({...f.context,role:'admin'},f.product.id,input),{code:'OWNER_REQUIRED'});await assert.rejects(()=>setCompliance(f.context,other.product.id,input),{code:'NOT_FOUND'});
 const results=await Promise.all([setCompliance(f.context,f.product.id,input),setCompliance(f.context,f.product.id,input)]);assert.deepEqual(results[0],results[1]);assert.equal(await prisma.auditLog.count({where:{entityId:f.product.id,action:'classification_updated'}}),1);
 assert.equal(complianceSchema.safeParse({...input,unknown:true}).success,false);assert.equal(complianceSchema.safeParse({...input,mxik:' '}).success,false);
 await prisma.session.update({where:{id:f.context.sessionId},data:{revokedAt:new Date()}});await assert.rejects(()=>setCompliance(f.context,f.product.id,policy()));
});
