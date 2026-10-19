// Copied into the previous application's isolated checkout by test-release-drill.sh.
import {randomBytes,randomUUID} from 'node:crypto'
import assert from 'node:assert/strict'
import {NextRequest} from 'next/server'
import {prisma} from '@/lib/prisma'
import {sessionHash} from '@/server/auth/session'
import {POST as create} from '@/app/api/sales/route'
import {POST as complete} from '@/app/api/sales/[id]/complete/route'
const url=new URL(process.env.DATABASE_URL??'');if(url.hostname!=='127.0.0.1'||url.port!=='55439'||url.pathname!=='/pos_test')throw new Error('Isolated rollback DB required')
async function main(){
 const org=await prisma.organization.create({data:{name:'Previous-app rollback drill',phone:randomUUID()}})
 let userId:string|undefined
 try{
  const user=await prisma.user.create({data:{fullName:'Drill actor',phone:randomUUID(),passwordHash:'not-a-login'}});userId=user.id
  const member=await prisma.organizationUser.create({data:{organizationId:org.id,userId:user.id,role:'owner'}})
  const store=await prisma.store.create({data:{organizationId:org.id,name:'Drill branch'}}),register=await prisma.register.create({data:{storeId:store.id,name:'Drill till',code:randomUUID()}})
  const shift=await prisma.shift.create({data:{registerId:register.id,organizationUserId:member.id,openingCash:0}}),product=await prisma.product.create({data:{organizationId:org.id,name:'Old app product',sku:randomUUID(),barcode:randomUUID(),unit:'dona',salePrice:'1.01',costPrice:'0.50'}})
  await prisma.inventoryBalance.create({data:{storeId:store.id,productId:product.id,quantity:2}})
  const token=randomBytes(32).toString('base64url');await prisma.session.create({data:{organizationId:org.id,userId:user.id,tokenHash:sessionHash(token),expiresAt:new Date(Date.now()+3600000),idleExpiresAt:new Date(Date.now()+3600000)}})
  const request=(path:string,body:unknown)=>new NextRequest('http://localhost:3000/api'+path,{method:'POST',headers:{cookie:'pos_session='+token,origin:'http://localhost:3000','content-type':'application/json'},body:JSON.stringify(body)})
  const created=await create(request('/sales',{organizationId:org.id,storeId:store.id,registerId:register.id,shiftId:shift.id,operationId:randomUUID(),items:[{productId:product.id,quantity:'1'}]}),undefined)
  assert.equal(created.status,200);const sale=(await created.json()).data
  const params={params:Promise.resolve({id:sale.id})},payment={payments:[{paymentType:'cash',amount:'1.01'}]}
  const first=await complete(request('/sales/'+sale.id+'/complete',payment),params),second=await complete(request('/sales/'+sale.id+'/complete',payment),params)
  assert.equal(first.status,200);assert.equal(second.status,200)
  assert.equal((await first.json()).data.totalAmount,'1.01');assert.equal(await prisma.payment.count({where:{saleId:sale.id}}),1);assert.equal(await prisma.inventoryMovement.count({where:{sourceId:sale.id}}),1)
  assert.equal((await prisma.inventoryBalance.findUniqueOrThrow({where:{storeId_productId:{storeId:store.id,productId:product.id}}})).quantity.toString(),'1')
  console.info('PASS: previous committed app source posts exactly once against additive migrated schema; amount1.01, payment1, movement1, balance1')
 }finally{await prisma.organization.delete({where:{id:org.id}});if(userId)await prisma.user.delete({where:{id:userId}});await prisma.$disconnect()}
}
main().catch(error=>{console.error(error instanceof Error?error.message:'Rollback drill failed');process.exitCode=1})
