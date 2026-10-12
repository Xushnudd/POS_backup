import {test,after} from 'node:test'
import assert from 'node:assert/strict'
import {randomUUID} from 'node:crypto'
import {NextRequest} from 'next/server'
import {prisma} from '@/lib/prisma'
import {POST as register} from '@/app/api/auth/register/route'
import {POST as stockDraft} from '@/app/api/stock-documents/route'
import {POST as transferDraft} from '@/app/api/transfers/route'
import {clearLimit} from '@/server/auth/rate-limit'
const url=new URL(process.env.DATABASE_URL??'')
if(url.hostname!=='127.0.0.1'||url.port!=='55439'||url.pathname!=='/pos_test'||url.username!=='pos_test')throw Error('Isolated test DB required')
const orgs:string[]=[],users:string[]=[],phones:string[]=[]
const req=(path:string,cookie:string,body:unknown)=>new NextRequest('http://localhost:3000/api'+path,{method:'POST',headers:{cookie,origin:'http://localhost:3000','content-type':'application/json'},body:JSON.stringify(body)})
after(async()=>{await prisma.organization.deleteMany({where:{id:{in:orgs}}});await prisma.user.deleteMany({where:{id:{in:users}}});for(const phone of phones)await clearLimit('register-account',phone);await prisma.$disconnect()})
async function fixture(){
 const phone='draft-'+randomUUID();phones.push(phone)
 const response=await register(req('/auth/register','',{phone,password:'test-only-password',fullName:'Draft owner',organizationName:'Draft business'}),undefined)
 assert.equal(response.status,200)
 const data=(await response.json()).data;orgs.push(data.organization.id);users.push(data.user.id)
 const organizationId=data.organization.id as string,store=await prisma.store.findFirstOrThrow({where:{organizationId}})
 const otherStore=await prisma.store.create({data:{organizationId,name:'Destination'}})
 const product=await prisma.product.create({data:{organizationId,name:'Draft item',sku:randomUUID(),barcode:randomUUID(),unit:'dona',salePrice:'1.01',costPrice:'0.123456'}})
 return {organizationId,store,otherStore,product,userId:data.user.id as string,cookie:response.headers.get('set-cookie')!.split(';')[0]}
}
for(const kind of ['stock','transfer'] as const)test(`${kind} draft: parallel and lost-ACK replay creates one document and audit, rejects changed payload and revoked role`,async()=>{
 const f=await fixture(),operationId=randomUUID(),items=[{productId:f.product.id,quantity:'2',unitCost:'0.123456'}]
 const path=kind==='stock'?'/stock-documents':'/transfers',post=kind==='stock'?stockDraft:transferDraft
 const input=kind==='stock'?{operationId,organizationId:f.organizationId,storeId:f.store.id,documentType:'opening',documentNo:'DOC-'+randomUUID(),note:'Verified opening draft',items}:{operationId,organizationId:f.organizationId,fromStoreId:f.store.id,toStoreId:f.otherStore.id,note:'Reviewed transfer draft',items}
 const parallel=await Promise.all([post(req(path,f.cookie,input),undefined),post(req(path,f.cookie,input),undefined)])
 const results=[]
 for(const response of parallel){assert.equal(response.status,200);results.push((await response.json()).data)}
 assert.equal(results[0].id,results[1].id)
 const replay=await post(req(path,f.cookie,input),undefined);assert.equal(replay.status,200);assert.equal((await replay.json()).data.id,results[0].id)
 assert.equal(String(results[0].items[0].unitCost),'0.123456')
 const conflict=await post(req(path,f.cookie,{...input,note:'Different original request'}),undefined)
 assert.equal(conflict.status,409);assert.equal((await conflict.json()).error.code,'OPERATION_PAYLOAD_CONFLICT')
 assert.equal(await prisma.operation.count({where:{organizationId:f.organizationId,key:operationId}}),1)
 assert.equal(await prisma.auditLog.count({where:{organizationId:f.organizationId,entityId:results[0].id,action:'create'}}),1)
 assert.equal(await prisma.inventoryMovement.count({where:{organizationId:f.organizationId}}),0)
 assert.equal(kind==='stock'?await prisma.stockDocument.count({where:{organizationId:f.organizationId}}):await prisma.stockTransfer.count({where:{organizationId:f.organizationId}}),1)
 await prisma.organizationUser.updateMany({where:{organizationId:f.organizationId,userId:f.userId},data:{role:'cashier'}})
 assert.equal((await post(req(path,f.cookie,input),undefined)).status,403)
})
