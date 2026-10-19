import test,{after} from 'node:test'
import assert from 'node:assert/strict'
import {randomUUID,randomBytes} from 'node:crypto'
import {mkdtemp,writeFile,rm} from 'node:fs/promises'
import {join} from 'node:path'
import {tmpdir} from 'node:os'
import {NextRequest} from 'next/server'
import {prisma} from '@/lib/prisma'
import {sessionHash,verifySession} from '@/server/auth/session'
import {runOperation} from '@/server/operations'
const url=new URL(process.env.DATABASE_URL??'');if(url.hostname!=='127.0.0.1'||url.port!=='55439'||url.pathname!=='/pos_test')throw new Error('Isolated DB only')
const orgs:string[]=[],users:string[]=[];after(async()=>{await prisma.organization.deleteMany({where:{id:{in:orgs}}});await prisma.user.deleteMany({where:{id:{in:users}}});await prisma.$disconnect()})
test('Maintenance rejects new durable writes, permits only authorized exact committed replay and lets an already admitted operation finish',async()=>{
 const directory=await mkdtemp(join(tmpdir(),'pos-maintenance-')),path=join(directory,'state.json'),prior=process.env.POS_DEPLOYMENT_STATE_FILE
 const org=await prisma.organization.create({data:{name:'Maintenance fixture',phone:randomUUID()}});orgs.push(org.id);const user=await prisma.user.create({data:{fullName:'Maintenance owner',phone:randomUUID(),passwordHash:'not-a-login'}});users.push(user.id)
 await prisma.organizationUser.create({data:{organizationId:org.id,userId:user.id,role:'owner'}});const token=randomBytes(32).toString('base64url'),session=await prisma.session.create({data:{userId:user.id,organizationId:org.id,tokenHash:sessionHash(token),expiresAt:new Date(Date.now()+3600000),idleExpiresAt:new Date(Date.now()+3600000)}}),ctx=(await verifySession(token))!,key=randomUUID(),payload={name:'One admitted store'}
 try{
  process.env.POS_DEPLOYMENT_STATE_FILE=path;await writeFile(path,JSON.stringify({maintenance:false,message:'Available'}),{mode:0o600})
  const result=await runOperation(ctx,'maintenance.fixture',key,payload,async tx=>{
   // Operator activates drain after the admission check, before this operation finishes.
   await writeFile(path,JSON.stringify({maintenance:true,message:'Planned release maintenance'}))
   return tx.store.create({data:{organizationId:org.id,name:payload.name}})
  })
  const replay=await runOperation<typeof result>(ctx,'maintenance.fixture',key,payload,()=>{throw new Error('Committed replay must not execute')});assert.equal(replay.id,result.id)
  await assert.rejects(()=>runOperation(ctx,'maintenance.fixture',randomUUID(),payload,tx=>tx.store.create({data:{organizationId:org.id,name:'Must not write'}})),e=>e instanceof Error&&'code'in e&&e.code==='MAINTENANCE')
  await assert.rejects(()=>runOperation(ctx,'maintenance.fixture',key,{name:'Altered replay'},()=>Promise.resolve({})),e=>e instanceof Error&&'code'in e&&e.code==='OPERATION_PAYLOAD_CONFLICT')
  assert.equal(await prisma.store.count({where:{organizationId:org.id}}),1);assert.equal(await prisma.operation.count({where:{organizationId:org.id}}),1)
  const {GET:ready}=await import('@/app/api/health/ready/route'),{GET:status}=await import('@/app/api/deployment/status/route');assert.equal((await ready()).status,503);assert.equal((await(await status(new NextRequest('http://localhost:3000/api/deployment/status',{headers:{cookie:'pos_session='+token}}),undefined)).json()).data.maintenance,true)
  await writeFile(path,JSON.stringify({maintenance:false,message:'Available again'}));assert.equal((await ready()).status,200)
  await runOperation(ctx,'maintenance.fixture',randomUUID(),{name:'After drain'},tx=>tx.store.create({data:{organizationId:org.id,name:'After drain'}}));assert.equal(await prisma.store.count({where:{organizationId:org.id}}),2)
  await prisma.session.update({where:{id:session.id},data:{revokedAt:new Date()}});await assert.rejects(()=>runOperation(ctx,'maintenance.fixture',key,payload,()=>Promise.resolve({})),e=>e instanceof Error&&'code'in e&&e.code==='SESSION_CHANGED')
 }finally{if(prior===undefined)delete process.env.POS_DEPLOYMENT_STATE_FILE;else process.env.POS_DEPLOYMENT_STATE_FILE=prior;await rm(directory,{recursive:true,force:true})}
})
