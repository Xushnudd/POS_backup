import assert from 'node:assert/strict'
import {readFileSync} from 'node:fs'
import {randomUUID} from 'node:crypto'
import {prisma} from '@/lib/prisma'
import {createSession,verifySession} from '@/server/auth/session'
import {runOperation} from '@/server/operations'
import {claimProviderIntent,executeProviderClaim,recoverProviderLeases,bindingKey,enqueueProviderIntentTx,type ProviderBinding} from '@/server/integrations/outbox'
const url=new URL(process.env.DATABASE_URL??'')
if(url.hostname!=='127.0.0.1'||url.port!=='55439'||url.username!=='pos_test'||!/^\/pos_provider_restore_[a-f0-9]{32}$/.test(url.pathname))throw new Error('Disposable recovery fixture only')
let stage="startup"
async function main(){
 const first=process.env.POS_PROVIDER_RESTORE_QUEUED!,second=process.env.POS_PROVIDER_RESTORE_RUNNING!
 const original=JSON.parse(readFileSync(process.env.POS_PROVIDER_RESTORE_CLAIM_FILE!,'utf8'))
 original.leaseUntil=new Date(original.leaseUntil);original.intent.createdAt=new Date(original.intent.createdAt)
 let executes=0,lookups=0
 const binding:ProviderBinding={supportsCompensation:false,transport:{async execute(){executes++;throw new Error('Restored execution forbidden')},async lookup(identity){lookups++;assert.ok([first,second].includes(identity.operationId));return identity.operationId===first?{state:'confirmed',externalId:'fixture-remote-confirmed'}:{state:'not_found'}}},async confirmed(tx,intent){await tx.auditLog.create({data:{organizationId:intent.organizationId,actorId:intent.actorId,entityType:'ProviderIntent',entityId:intent.id,action:'restore_fixture_confirmed'}})},async failed(){throw new Error('Unexpected failure hook')}}
 const registry=new Map([[bindingKey('restore-test','payment'),binding]])
 const before=await Promise.all([prisma.sale.count(),prisma.payment.count(),prisma.inventoryMovement.count(),prisma.debtEntry.count()])
 stage="pending-gate"
 assert.equal(await claimProviderIntent(registry),null)
 assert.equal((await executeProviderClaim(original,registry)).state,'restore_review')
 const directSubmit=()=>prisma.providerOutbox.update({where:{intentId:first},data:{state:'running',mode:'submit',submitAttempts:1,generation:1,leaseToken:'isolated-fixture',leaseUntil:new Date(Date.now()+30000)}})
 await assert.rejects(directSubmit())
 stage="review"
 const checkpoint=await prisma.authRestoreCheckpoint.findFirstOrThrow({where:{reviewedAt:null}})
 await prisma.authRestoreCheckpoint.update({where:{id:checkpoint.id},data:{reviewedAt:new Date(),reviewer:'Isolated fixture operator',reviewEvidence:'Synthetic clone only; quarantined credentials/access; no production approval'}})
 await assert.rejects(directSubmit())
 await prisma.providerOutbox.update({where:{intentId:second},data:{leaseUntil:new Date(Date.now()+30000)}})
 assert.equal((await executeProviderClaim(original,registry)).state,'restore_lookup_required')
 stage="queued-lookup"
 const queued=await claimProviderIntent(registry);assert.ok(queued);assert.equal(queued.intentId,first);assert.equal(queued.mode,'lookup');assert.equal(queued.submitAttempts,0);assert.equal(queued.lookupAttempts,1)
 assert.equal((await executeProviderClaim(queued,registry)).state,'confirmed')
 assert.equal((await executeProviderClaim(queued,registry)).applied,false)
 await prisma.providerOutbox.update({where:{intentId:second},data:{leaseUntil:new Date(0)}})
 stage="running-lookup"
 await recoverProviderLeases()
 const running=await claimProviderIntent(registry);assert.ok(running);assert.equal(running.intentId,second);assert.equal(running.mode,'lookup')
 assert.equal((await executeProviderClaim(running,registry)).state,'review')
 assert.equal(await claimProviderIntent(registry),null)
 assert.equal(executes,0);assert.equal(lookups,2)
 assert.equal(await prisma.auditLog.count({where:{entityId:first,action:'restore_fixture_confirmed'}}),1)
 assert.equal((await prisma.providerOutbox.findUniqueOrThrow({where:{intentId:second}})).resultCode,'LOOKUP_NOT_FOUND')
 assert.deepEqual(await Promise.all([prisma.sale.count(),prisma.payment.count(),prisma.inventoryMovement.count(),prisma.debtEntry.count()]),before)
 stage="post-restore-new-intent"
 const intent=await prisma.providerIntent.findUniqueOrThrow({where:{id:first}})
 const oldSale=await prisma.sale.findUniqueOrThrow({where:{id:(intent.request as {businessId:string}).businessId}})
 const token=await prisma.$transaction(tx=>createSession(tx,intent.actorId,intent.organizationId)),context=await verifySession(token);assert.ok(context)
 const newSale=await prisma.sale.create({data:{organizationId:oldSale.organizationId,storeId:oldSale.storeId,registerId:oldSale.registerId,shiftId:oldSale.shiftId,cashierId:oldSale.cashierId,receiptNo:randomUUID(),subtotal:'10.01',totalAmount:'10.01'}})
 const key=randomUUID(),fresh=await runOperation(context,'provider.test.business',key,{saleId:newSale.id,provider:'restore-test'},tx=>enqueueProviderIntentTx(tx,context,{type:'provider.test.business',key},{storeId:newSale.storeId,provider:'restore-test',capability:'payment',request:{businessType:'sale',businessId:newSale.id,amount:'10.01',currency:'UZS'},reason:'Synthetic post-restore new intent'}))
 let freshExecutes=0
 const freshBinding:ProviderBinding={...binding,transport:{...binding.transport,async execute(command){assert.equal(command.operationId,fresh.id);freshExecutes++;return {state:'confirmed',externalId:'fixture-fresh-confirmed'}}}}
 const freshRegistry=new Map([[bindingKey('restore-test','payment'),freshBinding]])
 const freshClaim=await claimProviderIntent(freshRegistry);assert.ok(freshClaim);assert.equal(freshClaim.intentId,fresh.id);assert.equal(freshClaim.mode,'submit');assert.equal(freshClaim.submitAttempts,1);assert.equal(freshClaim.lookupAttempts,0)
 assert.equal((await executeProviderClaim(freshClaim,freshRegistry)).state,'confirmed');assert.equal(freshExecutes,1)
 console.log(JSON.stringify({status:'passed',executeCalls:executes,lookupCalls:lookups,domainFinalizations:1,economicCountsUnchanged:true}))
}
void main().finally(()=>prisma.$disconnect()).catch(error=>{console.error(JSON.stringify({code:'ISOLATED_PROVIDER_RESTORE_TEST_FAILED',stage,detail:error instanceof assert.AssertionError?error.message:'database_or_runtime_failure'}));process.exitCode=1})
