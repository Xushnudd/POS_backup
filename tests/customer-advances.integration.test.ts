import test,{after} from 'node:test'
import assert from 'node:assert/strict'
import {randomUUID,randomBytes} from 'node:crypto'
import {prisma} from '@/lib/prisma'
import {sessionHash,verifySession} from '@/server/auth/session'
import {createAccount} from '@/server/finance/accounts'
import {receiveAdvance,allocateAdvance,refundAdvance,listAdvances} from '@/server/customers/advances'
import {createDraft,completeSale} from '@/server/sales/service'
import {returnSale} from '@/server/returns/service'
import {postDebtDocument,debtDocumentSchema,customerStatement} from '@/server/customers/ledger'
import {assertCustomerCanArchive} from '@/server/customers/archive'
const u=new URL(process.env.DATABASE_URL??'');if(u.protocol!=='postgresql:'||u.hostname!=='127.0.0.1'||u.port!=='55439'||u.pathname!=='/pos_test'||u.username!=='pos_test')throw new Error('Isolated DB only')
const orgs:string[]=[],users:string[]=[]
after(async()=>{
 try{
  // Only this guarded disposable DB: validate the refund/document edge after
  // both tenant cascades, then restore its original policy atomically.
  await prisma.$transaction(async tx=>{
   await tx.$executeRawUnsafe('ALTER TABLE "CustomerAdvanceRefund" ALTER CONSTRAINT "CustomerAdvanceRefund_documentId_fkey" DEFERRABLE INITIALLY IMMEDIATE')
   await tx.$executeRawUnsafe('SET CONSTRAINTS "CustomerAdvanceRefund_documentId_fkey" DEFERRED')
   await tx.organization.deleteMany({where:{id:{in:orgs}}})
   await tx.$executeRawUnsafe('SET CONSTRAINTS "CustomerAdvanceRefund_documentId_fkey" IMMEDIATE')
   await tx.$executeRawUnsafe('ALTER TABLE "CustomerAdvanceRefund" ALTER CONSTRAINT "CustomerAdvanceRefund_documentId_fkey" NOT DEFERRABLE')
  },{timeout:30000})
  await prisma.user.deleteMany({where:{id:{in:users}}})
 }finally{await prisma.$disconnect()}
})
const code=(value:string)=>(e:unknown)=>!!e&&typeof e==='object'&&'code'in e&&e.code===value
async function fixture(){
 const org=await prisma.organization.create({data:{name:'Advance isolated',phone:randomUUID()}});orgs.push(org.id)
 const user=await prisma.user.create({data:{fullName:'Advance owner',phone:randomUUID(),passwordHash:'not-a-login'}});users.push(user.id)
 const member=await prisma.organizationUser.create({data:{organizationId:org.id,userId:user.id,role:'owner'}}),store=await prisma.store.create({data:{organizationId:org.id,name:'Branch'}}),register=await prisma.register.create({data:{storeId:store.id,name:'Till',code:randomUUID()}}),shift=await prisma.shift.create({data:{registerId:register.id,organizationUserId:member.id,openingCash:0}})
 const token=randomBytes(32).toString('base64url'),session=await prisma.session.create({data:{userId:user.id,organizationId:org.id,tokenHash:sessionHash(token),expiresAt:new Date(Date.now()+3600000),idleExpiresAt:new Date(Date.now()+3600000)}}),ctx=(await verifySession(token))!
 const customer=await prisma.customer.create({data:{organizationId:org.id,fullName:'Advance customer',phone:randomUUID(),creditLimit:1000}}),account=await createAccount(ctx,{operationId:randomUUID(),storeId:store.id,registerId:register.id,name:'Cash',kind:'cash',openingBalance:0,reason:'Isolated till cash journal'})
 return {org,user,store,register,shift,session,ctx,customer,account}
}
test('Advance overpayment is separate credit, partial allocation and original cash sale refunds conserve cash and debt once',async()=>{
 const f=await fixture(),product=await prisma.product.create({data:{organizationId:f.org.id,name:'Item',sku:randomUUID(),barcode:randomUUID(),unit:'dona',salePrice:100,costPrice:10}})
 await prisma.inventoryBalance.create({data:{storeId:f.store.id,productId:product.id,quantity:1}})
 const draft=await createDraft(f.ctx,{organizationId:f.org.id,storeId:f.store.id,registerId:f.register.id,shiftId:f.shift.id,customerId:f.customer.id,discountAmount:0,items:[{productId:product.id,quantity:1,discountAmount:0}]},randomUUID())
 await completeSale(f.ctx,draft.id,{payments:[{paymentType:'credit',amount:100}]},randomUUID())
 const input={operationId:randomUUID(),accountId:f.account.id,shiftId:f.shift.id,amount:'120.25',reason:'Actual customer cash advance'},both=await Promise.all([receiveAdvance(f.ctx,f.customer.id,input),receiveAdvance(f.ctx,f.customer.id,input)]),advance=both[0]
 assert.equal(both[1].id,advance.id);assert.equal(await prisma.cashMovement.count({where:{shiftId:f.shift.id,movementType:'cash_in'}}),1)
 let statement=await customerStatement(f.ctx,f.customer.id);assert.equal(statement.summary.currentBalance.toString(),'100');assert.equal(statement.advanceAvailable.toString(),'120.25')
 const allocation={operationId:randomUUID(),advanceId:advance.id,targetKey:'sale:'+draft.id,amount:'40.25',reason:'Apply selected advance to original sale'}
 await Promise.all([allocateAdvance(f.ctx,f.customer.id,allocation),allocateAdvance(f.ctx,f.customer.id,allocation)])
 statement=await customerStatement(f.ctx,f.customer.id);assert.equal(statement.summary.currentBalance.toString(),'59.75');assert.equal(statement.advanceAvailable.toString(),'80')
 await allocateAdvance(f.ctx,f.customer.id,{...allocation,operationId:randomUUID(),amount:'59.75'})
 await assert.rejects(()=>allocateAdvance(f.ctx,f.customer.id,{...allocation,operationId:randomUUID(),amount:1}),code('DEBT_TARGET_REQUIRED'))
 const refund={operationId:randomUUID(),advanceId:advance.id,accountId:f.account.id,shiftId:f.shift.id,amount:'20.25',reason:'Return unused original cash advance'}
 const refunds=await Promise.all([refundAdvance(f.ctx,f.customer.id,refund),refundAdvance(f.ctx,f.customer.id,refund)]);assert.equal(refunds[0].id,refunds[1].id)
 await assert.rejects(()=>refundAdvance(f.ctx,f.customer.id,{...refund,operationId:randomUUID(),amount:1}),code('ADVANCE_BALANCE_EXCEEDED'))
 const returned=await returnSale(f.ctx,draft.id,{operationId:randomUUID(),shiftId:f.shift.id,reason:'Refund sale funded by advance',items:[{saleItemId:draft.items[0].id,quantity:1,disposition:'sellable'}]});assert.equal(returned.settlement.cash.toString(),'100')
 const wallet=await listAdvances(f.ctx,f.customer.id,{page:1,limit:50});assert.equal(wallet.rows[0].allocated.toString(),'100');assert.equal(wallet.rows[0].refunded.toString(),'20.25');assert.equal(wallet.summary.available.toString(),'0')
 const incoming=await prisma.cashMovement.aggregate({where:{shiftId:f.shift.id,movementType:'cash_in'},_sum:{amount:true}}),outgoing=await prisma.cashMovement.aggregate({where:{shiftId:f.shift.id,movementType:'cash_out'},_sum:{amount:true}}),payments=await prisma.payment.aggregate({where:{shiftId:f.shift.id,paymentType:'cash',direction:'out'},_sum:{amount:true}})
 assert.equal(incoming._sum.amount!.sub(outgoing._sum.amount!).sub(payments._sum.amount!).toString(),'0');assert.equal((await customerStatement(f.ctx,f.customer.id)).summary.currentBalance.toString(),'0')
})
test('Advance source scope, archive, journal immutability and raced refunds fail closed',async()=>{
 const f=await fixture(),foreign=await fixture(),input={operationId:randomUUID(),accountId:f.account.id,shiftId:f.shift.id,amount:'10.01',reason:'Separate unused customer advance'}
 await assert.rejects(()=>receiveAdvance({...f.ctx,role:'admin'},f.customer.id,input),code('OWNER_REQUIRED'))
 await assert.rejects(()=>receiveAdvance(f.ctx,foreign.customer.id,input),code('CUSTOMER_NOT_FOUND'))
 const a=await receiveAdvance(f.ctx,f.customer.id,input)
 await assert.rejects(()=>prisma.$transaction(tx=>assertCustomerCanArchive(tx,f.org.id,f.customer.id)),code('CUSTOMER_HAS_BALANCE'))
 await assert.rejects(()=>prisma.customer.update({where:{id:f.customer.id},data:{isActive:false}}))
 await assert.rejects(()=>prisma.customerAdvance.update({where:{id:a.id},data:{amount:99}}))
 await assert.rejects(()=>listAdvances(foreign.ctx,f.customer.id,{page:1,limit:50}),code('CUSTOMER_NOT_FOUND'))
 const refund={advanceId:a.id,accountId:f.account.id,shiftId:f.shift.id,amount:'7',reason:'Concurrent unused refund limit'}
 const outcomes=await Promise.allSettled([refundAdvance(f.ctx,f.customer.id,{...refund,operationId:randomUUID()}),refundAdvance(f.ctx,f.customer.id,{...refund,operationId:randomUUID()})]);assert.equal(outcomes.filter(r=>r.status==='fulfilled').length,1);assert.equal((await listAdvances(f.ctx,f.customer.id,{page:1,limit:50})).summary.available.toString(),'3.01')
 const bank=await createAccount(f.ctx,{operationId:randomUUID(),storeId:f.store.id,name:'Manual bank',kind:'bank',openingBalance:0,reason:'No provider implementation'})
 await assert.rejects(()=>receiveAdvance(f.ctx,f.customer.id,{...input,operationId:randomUUID(),accountId:bank.id}),code('ADVANCE_CASH_ONLY'))
 const rawDebt=()=>prisma.debtEntry.create({data:{organizationId:f.org.id,customerId:f.customer.id,sourceType:'advance_allocation',sourceId:randomUUID(),amount:-1}});await assert.rejects(rawDebt)
})
test('Opening debt allocations never hide overpayment and revoked sessions cannot receive cash',async()=>{
 const f=await fixture(),debt=await postDebtDocument(f.ctx,f.customer.id,debtDocumentSchema.parse({operationId:randomUUID(),kind:'opening',amount:'12.01',reason:'Original opening debt'}))
 const input={operationId:randomUUID(),accountId:f.account.id,shiftId:f.shift.id,amount:'20',reason:'Actual opening debt advance'},a=await receiveAdvance(f.ctx,f.customer.id,input)
 const allocation={operationId:randomUUID(),advanceId:a.id,targetKey:'document:'+debt.id,amount:'12.02',reason:'Explicit original opening allocation'}
 await assert.rejects(()=>allocateAdvance(f.ctx,f.customer.id,allocation),code('DEBT_REDUCTION_EXCEEDED'))
 const row=await allocateAdvance(f.ctx,f.customer.id,{...allocation,amount:'12.01'});await assert.rejects(()=>prisma.customerAdvanceAllocation.delete({where:{id:row.id}}));await assert.rejects(()=>prisma.debtEntry.update({where:{id:row.debtEntryId},data:{amount:-1}}))
 const statement=await customerStatement(f.ctx,f.customer.id);assert.equal(statement.summary.currentBalance.toString(),'0');assert.equal(statement.advanceAvailable.toString(),'7.99')
 await prisma.session.update({where:{id:f.session.id},data:{revokedAt:new Date()}});await assert.rejects(()=>receiveAdvance(f.ctx,f.customer.id,{...input,operationId:randomUUID()}))
 assert.equal(await prisma.customerAdvance.count({where:{customerId:f.customer.id}}),1)
})
test('Actual advances HTTP enforces strict input, owner scope and exact statement cash events',async()=>{
 const f=await fixture(),{POST,GET}=await import('@/app/api/customers/[id]/advances/route'),{NextRequest}=await import('next/server'),{commercialStatementCsv}=await import('@/server/customers/commercial')
 const session=await prisma.session.findUniqueOrThrow({where:{id:f.session.id}});void session
 // Use a fresh opaque cookie; no credential is logged or persisted in source.
 const token=randomBytes(32).toString('base64url');await prisma.session.create({data:{userId:f.user.id,organizationId:f.org.id,tokenHash:sessionHash(token),expiresAt:new Date(Date.now()+3600000),idleExpiresAt:new Date(Date.now()+3600000)}})
 const params={params:Promise.resolve({id:f.customer.id})},headers={cookie:'pos_session='+token,origin:'http://localhost:3000','content-type':'application/json'},url='http://localhost:3000/api/customers/'+f.customer.id+'/advances'
 const body={action:'receive',operationId:randomUUID(),accountId:f.account.id,shiftId:f.shift.id,amount:'30.01',reason:'Customer physical advance receipt'}
 const post=(value:unknown)=>POST(new NextRequest(url,{method:'POST',headers,body:JSON.stringify(value)}),params)
 assert.equal((await post({...body,amount:'30.001'})).status,400);assert.equal((await post({...body,provider:'fake-click'})).status,400)
 const response=await post(body);assert.equal(response.status,200);const advance=(await response.json()).data
 assert.equal((await post(body)).status,200);assert.equal(await prisma.customerAdvance.count({where:{customerId:f.customer.id}}),1)
 assert.equal((await GET(new NextRequest(url,{headers}),params)).status,200)
 await refundAdvance(f.ctx,f.customer.id,{operationId:randomUUID(),advanceId:advance.id,accountId:f.account.id,shiftId:f.shift.id,amount:'10',reason:'Original unused advance refund'})
 const csv=(await commercialStatementCsv(f.ctx,f.customer.id,{from:null,to:null})).content;assert.match(csv,/advance_receive/);assert.match(csv,/advance_refund/);assert.match(csv,/Joriy ishlatilmagan avans.*20.01/)
})

test('Advance cash waits on the shift without holding its customer, matching return and finance account lock order',async()=>{
 const f=await fixture();let shiftLocked!:()=>void,admit!:()=>void
 const locked=new Promise<void>(resolve=>{shiftLocked=resolve}),proceed=new Promise<void>(resolve=>{admit=resolve})
 const blocker=prisma.$transaction(async tx=>{
  await tx.$queryRaw`SELECT id FROM "Shift" WHERE id=${f.shift.id} FOR UPDATE`;shiftLocked();await proceed
  await tx.$executeRaw`SET LOCAL lock_timeout='500ms'`
  // Return/checkout can take their customer after holding the shift. A receipt
  // waiting on this shift must not already hold that customer (lock inversion).
  await tx.$queryRaw`SELECT id FROM "Customer" WHERE id=${f.customer.id} FOR UPDATE`
 },{timeout:10000})
 await locked
 const receipt=receiveAdvance(f.ctx,f.customer.id,{operationId:randomUUID(),accountId:f.account.id,shiftId:f.shift.id,amount:'12.11',reason:'Exact serialized cash admission'})
 try{
  let waiting=false;const deadline=Date.now()+5000
  while(Date.now()<deadline){const [row]=await prisma.$queryRaw<{waiting:boolean}[]>`SELECT EXISTS(SELECT 1 FROM pg_stat_activity WHERE datname=current_database() AND pid<>pg_backend_pid() AND wait_event_type='Lock' AND query LIKE '%"Shift"%') AS waiting`;if(row.waiting){waiting=true;break}await new Promise(resolve=>setTimeout(resolve,10))}
  assert.equal(waiting,true,'Real receipt is waiting on the locked shift before customer acquisition')
 }finally{admit()}
 await Promise.all([blocker,receipt]);assert.equal(await prisma.customerAdvance.count({where:{customerId:f.customer.id}}),1);assert.equal((await listAdvances(f.ctx,f.customer.id,{page:1,limit:50})).summary.available.toString(),'12.11')
})
