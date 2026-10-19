import {test,after} from 'node:test'
import assert from 'node:assert/strict'
import {randomUUID,randomBytes,createHmac,createHash} from 'node:crypto'
import {prisma} from '@/lib/prisma'
import {verifySession,sessionHash} from '@/server/auth/session'
import {createDraft,completeSale,saleDraftSchema,completeSchema} from '@/server/sales/service'
import {createReceiptLink,listReceiptLinks,revokeReceiptLink,viewReceipt} from '@/server/sales/receipt-links'
import {runOperation,audit} from '@/server/operations'
import {POST as viewRoute} from '@/app/api/receipt-view/route'
import {POST as createRoute} from '@/app/api/sales/[id]/receipt-links/route'
import {NextRequest} from 'next/server'
import sharp from 'sharp'
import {QRCodeReader,RGBLuminanceSource,HybridBinarizer,BinaryBitmap,DecodeHintType} from '@zxing/library'
const connection=new URL(process.env.DATABASE_URL??'');if(connection.hostname!=='127.0.0.1'||connection.port!=='55439'||connection.pathname!=='/pos_test')throw new Error('Isolated DB only')
const orgs:string[]=[],users:string[]=[]
after(async()=>{await prisma.organization.deleteMany({where:{id:{in:orgs}}});await prisma.user.deleteMany({where:{id:{in:users}}});await prisma.$disconnect()})
async function fixture(){
 const org=await prisma.organization.create({data:{name:'Original receipt merchant',phone:randomUUID()}});orgs.push(org.id)
 const user=await prisma.user.create({data:{fullName:'Private cashier identity',phone:randomUUID(),passwordHash:'not-a-login'}});users.push(user.id)
 const member=await prisma.organizationUser.create({data:{organizationId:org.id,userId:user.id,role:'owner'}})
 const store=await prisma.store.create({data:{organizationId:org.id,name:'Original receipt branch'}}),register=await prisma.register.create({data:{storeId:store.id,name:'Receipt terminal',code:randomUUID()}}),shift=await prisma.shift.create({data:{registerId:register.id,organizationUserId:member.id,openingCash:0}})
 const product=await prisma.product.create({data:{organizationId:org.id,name:'Original receipt item',sku:randomUUID(),barcode:randomUUID(),unit:'dona',salePrice:'1.01',costPrice:'0.50'}})
 await prisma.inventoryBalance.create({data:{storeId:store.id,productId:product.id,quantity:5}})
 const token=randomBytes(32).toString('base64url');await prisma.session.create({data:{organizationId:org.id,userId:user.id,tokenHash:sessionHash(token),expiresAt:new Date(Date.now()+3600000),idleExpiresAt:new Date(Date.now()+3600000)}})
 const ctx=(await verifySession(token))!
 const draft=await createDraft(ctx,saleDraftSchema.parse({organizationId:org.id,storeId:store.id,registerId:register.id,shiftId:shift.id,items:[{productId:product.id,quantity:'1'}]}),randomUUID())
 const sale=await completeSale(ctx,draft.id,completeSchema.parse({payments:[{paymentType:'cash',amount:'1.01'}]}),randomUUID())
 return {org,user,product,ctx,sale,token}
}
function input(url:string){const [organizationId,operationId,capability]=new URL(url).hash.slice(1).split('.');return {organizationId,operationId,capability}}
test('Consented receipt share retries once, preserves original decimals/identity, exposes no customer/staff/cost and revokes atomically',async()=>{
 const f=await fixture(),foreign=await fixture(),command={operationId:randomUUID(),consent:true}
 await assert.rejects(createReceiptLink(f.ctx,f.sale.id,{...command,consent:false}))
 const [a,b]=await Promise.all([createReceiptLink(f.ctx,f.sale.id,command),createReceiptLink(f.ctx,f.sale.id,command)])
 assert.equal(a.url,b.url);assert.ok(a.url);assert.equal(new URL(a.url!).pathname,'/r');assert.equal(new URL(a.url!).search,'')
 assert.equal(await prisma.operation.count({where:{organizationId:f.org.id,type:'receipt.share',key:command.operationId}}),1)
 assert.equal(await prisma.auditLog.count({where:{organizationId:f.org.id,entityId:f.sale.id,action:'receipt_link_granted'}}),1)
 const persisted=await prisma.operation.findFirstOrThrow({where:{organizationId:f.org.id,type:'receipt.share'}})
 const proof=input(a.url!);assert.ok(!JSON.stringify(persisted).includes(proof.capability))
 const svg=Buffer.from(a.qrDataUrl!.split(',')[1],'base64')
 const raster=await sharp(svg).flatten({background:'#ffffff'}).greyscale().raw().toBuffer({resolveWithObject:true})
 // This is a pure generated QR, not a camera frame. The detector can mistake
 // random payload patterns for finder marks; decode the complete matrix and
 // still require the exact original capability URL, including its fragment.
 const decoded=new QRCodeReader().decode(new BinaryBitmap(new HybridBinarizer(new RGBLuminanceSource(new Uint8ClampedArray(raster.data),raster.info.width,raster.info.height))),new Map([[DecodeHintType.PURE_BARCODE,true]]))
 assert.equal(decoded.getText(),a.url)
 await prisma.organization.update({where:{id:f.org.id},data:{name:'Changed merchant'}})
 await prisma.product.update({where:{id:f.product.id},data:{name:'Changed product'}})
 const view=await viewReceipt(proof)
 assert.equal(view.organizationName,'Original receipt merchant');assert.equal(view.items[0].name,'Original receipt item');assert.equal(view.totalAmount,'1.01');assert.equal(view.payments[0].amount,'1.01');assert.equal(view.currency,'UZS')
 assert.doesNotMatch(JSON.stringify(view),/Private cashier identity|phone|customerId|cashierId|costPrice|unitCost|tokenHash|leaseToken/)
 for(const bad of [{...proof,capability:'a'.repeat(43)},{...proof,organizationId:foreign.org.id},{...proof,operationId:randomUUID()}])await assert.rejects(viewReceipt(bad),{code:'RECEIPT_UNAVAILABLE'})
 await assert.rejects(createReceiptLink(foreign.ctx,f.sale.id,{operationId:randomUUID(),consent:true}),{code:'NOT_FOUND'})
 await assert.rejects(prisma.operation.update({where:{id:persisted.id},data:{result:{forged:true}}}))
 await assert.rejects(prisma.operation.delete({where:{id:persisted.id}}))
 await assert.rejects(prisma.operation.create({data:{organizationId:f.org.id,actorId:f.ctx.userId,type:'receipt.share',key:randomUUID(),payloadHash:'a'.repeat(64),result:persisted.result!}}))
 await revokeReceiptLink(f.ctx,f.sale.id,{operationId:command.operationId});await revokeReceiptLink(f.ctx,f.sale.id,{operationId:command.operationId})
 assert.equal((await listReceiptLinks(f.ctx,f.sale.id)).rows[0].available,false)
 await assert.rejects(viewReceipt(proof),{code:'RECEIPT_UNAVAILABLE'})
 assert.equal(await prisma.payment.count({where:{organizationId:f.org.id}}),1)
 assert.equal(await prisma.inventoryMovement.count({where:{organizationId:f.org.id}}),1)
})
test('Actual near-expiry capability fails after database time passes; key removal fences prior links',async()=>{
 const f=await fixture(),command={operationId:randomUUID(),consent:true}
 const link=await createReceiptLink(f.ctx,f.sale.id,command),proof=input(link.url!)
 const original=await prisma.operation.findFirstOrThrow({where:{organizationId:f.org.id,type:'receipt.share',key:command.operationId}})
 const operationId=randomUUID(),key=Buffer.from(process.env.AUTH_CHALLENGE_SECRET!,'hex')
 const capability=createHmac('sha256',key).update('pos:in-person-receipt:v1\0'+f.org.id+'\0'+operationId).digest('base64url')
 const result={...(original.result as object),expiresAt:new Date(Date.now()+2000).toISOString(),tokenHash:createHash('sha256').update(capability).digest('hex')}
 await runOperation(f.ctx,'receipt.share',operationId,{syntheticShortExpiry:true},async tx=>{await audit(tx,f.ctx,'Sale',f.sale.id,'receipt_link_granted',{operationId,channel:'in_person',source:'customer_request',consent:true,policyVersion:'direct-receipt-v1',expiresAt:result.expiresAt,sessionId:f.ctx.sessionId});return result})
 const short={organizationId:f.org.id,operationId,capability}
 assert.equal((await viewReceipt(short)).totalAmount,'1.01')
 await new Promise(resolve=>setTimeout(resolve,2100));await assert.rejects(viewReceipt(short),{code:'RECEIPT_UNAVAILABLE'})
 const previous=process.env.AUTH_CHALLENGE_SECRET,overlap=process.env.AUTH_TOTP_PREVIOUS_SECRETS
 try{process.env.AUTH_CHALLENGE_SECRET=randomBytes(32).toString('hex');delete process.env.AUTH_TOTP_PREVIOUS_SECRETS;await assert.rejects(viewReceipt(proof),{code:'RECEIPT_UNAVAILABLE'})}finally{process.env.AUTH_CHALLENGE_SECRET=previous;if(overlap===undefined)delete process.env.AUTH_TOTP_PREVIOUS_SECRETS;else process.env.AUTH_TOTP_PREVIOUS_SECRETS=overlap}
})
test('HTTP share creation needs auth and consent; public bearer POST requires origin and omits capability from responses',async()=>{
 const f=await fixture(),command={operationId:randomUUID(),consent:true}
 const request=(path:string,body:unknown,cookie='',origin='http://localhost:3000')=>new NextRequest('http://localhost:3000/api'+path,{method:'POST',headers:{origin,cookie,'content-type':'application/json'},body:JSON.stringify(body)})
 const params={params:Promise.resolve({id:f.sale.id})}
 assert.equal((await createRoute(request('/sales/'+f.sale.id+'/receipt-links',command),params)).status,401)
 const response=await createRoute(request('/sales/'+f.sale.id+'/receipt-links',command,'pos_session='+f.token),params)
 assert.equal(response.status,200);assert.doesNotMatch(JSON.stringify(await response.json()),/https?:|qrDataUrl|tokenHash|capability/)
 const link=(await listReceiptLinks(f.ctx,f.sale.id)).rows[0],proof=input(link.url!)
 const viewed=await viewRoute(request('/receipt-view',proof),undefined);assert.equal(viewed.status,200);assert.equal(viewed.headers.get('Cache-Control'),'private, no-store');assert.equal(viewed.headers.get('Referrer-Policy'),'no-referrer')
 assert.ok(!JSON.stringify(await viewed.json()).includes(proof.capability))
 assert.equal((await viewRoute(request('/receipt-view',proof,'','https://attacker.invalid'),undefined)).status,403)
})
test('Every receipt capability remains manageable after the first twenty rows, with stable bounded pages',async()=>{
 const f=await fixture()
 for(let index=0;index<21;index++)await createReceiptLink(f.ctx,f.sale.id,{operationId:randomUUID(),consent:true})
 const first=await listReceiptLinks(f.ctx,f.sale.id,1),second=await listReceiptLinks(f.ctx,f.sale.id,2)
 assert.equal(first.total,21);assert.equal(first.totalPages,2);assert.equal(first.rows.length,20);assert.equal(second.rows.length,1)
 assert.equal(new Set([...first.rows,...second.rows].map(row=>row.operationId)).size,21)
 await revokeReceiptLink(f.ctx,f.sale.id,{operationId:second.rows[0].operationId})
 assert.equal((await listReceiptLinks(f.ctx,f.sale.id,2)).rows[0].available,false)
 await assert.rejects(listReceiptLinks(f.ctx,f.sale.id,0),{code:'INVALID_PAGINATION'})
 assert.equal(await prisma.payment.count({where:{organizationId:f.org.id}}),1)
})
