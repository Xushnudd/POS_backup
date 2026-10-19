import {test,after} from 'node:test'
import assert from 'node:assert/strict'
import {randomUUID} from 'node:crypto'
import {NextRequest} from 'next/server'
import {prisma} from '@/lib/prisma'
import {hashPassword} from '@/lib/auth'
import {createSession,verifySession} from '@/server/auth/session'
import {createCustomRole,updateCustomRole,listCustomRoles} from '@/server/users/custom-roles'
import {updateMember} from '@/server/users/service'
import {assertLiveContext} from '@/server/operations'
import {withApi} from '@/server/api'
import {GET as storeGET} from '@/app/api/stores/[id]/route'
const connection=new URL(process.env.DATABASE_URL??'')
if(connection.hostname!=='127.0.0.1'||connection.port!=='55439'||connection.pathname!=='/pos_test')throw new Error('Isolated DB only')
const organizations:string[]=[],users:string[]=[]
after(async()=>{await prisma.organization.deleteMany({where:{id:{in:organizations}}});await prisma.user.deleteMany({where:{id:{in:users}}});await prisma.$disconnect()})
async function fixture(legacy=false){
 const org=await prisma.$transaction(async tx=>{
  if(legacy)await tx.$executeRawUnsafe('ALTER TABLE "Organization" DISABLE TRIGGER billing_enroll_new_org')
  const row=await tx.organization.create({data:{name:'Roles isolated',phone:randomUUID()}})
  if(legacy)await tx.$executeRawUnsafe('ALTER TABLE "Organization" ENABLE TRIGGER billing_enroll_new_org')
  return row
 });organizations.push(org.id)
 async function member(role:string){const user=await prisma.user.create({data:{fullName:'Roles '+role,phone:randomUUID(),passwordHash:await hashPassword('local-roles-password')}});users.push(user.id);const membership=await prisma.organizationUser.create({data:{organizationId:org.id,userId:user.id,role}});return {user,membership}}
 const owner=await member('owner'),staff=await member('admin')
 const token=await prisma.$transaction(tx=>createSession(tx,owner.user.id,org.id)),ctx=(await verifySession(token))!
 return {org,owner,staff,ctx,token}
}
const command=(name='Kuzatuvchi')=>({operationId:randomUUID(),name,baseRole:'admin' as const,permissions:['GET /api/products'],reason:'Owner reviewed explicit permissions'})
const revision=(row:{revision:number;name:string;permissions:string[];isActive:boolean},extra:object={})=>({operationId:randomUUID(),expectedRevision:row.revision,name:row.name,permissions:row.permissions,isActive:row.isActive,reason:'Owner reviewed role change',...extra})
test('An allowed custom route cannot bypass assigned-branch boundaries',async()=>{
 const f=await fixture(),row=await createCustomRole(f.ctx,{...command(),permissions:['GET /api/stores/[id]']})
 const assigned=await prisma.store.create({data:{organizationId:f.org.id,name:'Assigned branch'}}),unassigned=await prisma.store.create({data:{organizationId:f.org.id,name:'Unassigned branch'}})
 await updateMember(f.ctx,f.staff.membership.id,{customRoleId:row.id,storeIds:[assigned.id]})
 const token=await prisma.$transaction(tx=>createSession(tx,f.staff.user.id,f.org.id))
 const request=(id:string)=>new NextRequest('http://localhost/api/stores/'+id,{headers:{cookie:`pos_session=${token}`}})
 assert.equal((await storeGET(request(assigned.id),{params:Promise.resolve({id:assigned.id})})).status,200)
 assert.equal((await storeGET(request(unassigned.id),{params:Promise.resolve({id:unassigned.id})})).status,404)
 assert.deepEqual((await verifySession(token))?.storeIds,[assigned.id])
})
test('Owner creates tenant-local profiles, exact replay is stable and profiles cannot elevate owner/cashier privileges',async()=>{
 const f=await fixture(),input=command(),row=await createCustomRole(f.ctx,input)
 assert.equal((await createCustomRole(f.ctx,input)).id,row.id)
 assert.equal(await prisma.customRole.count({where:{organizationId:f.org.id}}),1)
 await assert.rejects(createCustomRole(f.ctx,{...command(),permissions:['POST /api/roles']}),{code:'INVALID_ROLE_PERMISSION'})
 await assert.rejects(createCustomRole(f.ctx,{...command(),baseRole:'cashier',permissions:['GET /api/reports/profit']}),{code:'INVALID_ROLE_PERMISSION'})
 await assert.rejects(updateMember(f.ctx,f.owner.membership.id,{customRoleId:row.id}),{code:'LAST_OWNER'})
 const other=await fixture()
 await assert.rejects(updateMember(other.ctx,other.staff.membership.id,{customRoleId:row.id}),{code:'NOT_FOUND'})
 await assert.rejects(prisma.organizationUser.update({where:{id:other.staff.membership.id},data:{customRoleId:row.id}}))
 assert.equal((await listCustomRoles(f.ctx)).templates.length,3)
})
test('HTTP admission honors current custom profile; editing revokes sessions and stale contexts before replay',async()=>{
 const f=await fixture(),row=await createCustomRole(f.ctx,command())
 await updateMember(f.ctx,f.staff.membership.id,{customRoleId:row.id})
 const token=await prisma.$transaction(tx=>createSession(tx,f.staff.user.id,f.org.id)),ctx=(await verifySession(token))!
 assert.equal(ctx.customRole?.id,row.id)
 await assert.rejects(createCustomRole(ctx,command('No escalation')),{code:'OWNER_REQUIRED'})
 const route=withApi(async()=>Response.json({success:true}),{touchSession:false})
 const request=(method:string)=>new NextRequest('http://localhost/api/products',{method,headers:{cookie:`pos_session=${token}`,'content-type':'application/json',origin:'http://localhost'},...(method==='POST'?{body:'{}'}:{})})
 assert.equal((await route(request('GET'),{params:Promise.resolve({})})).status,200)
 assert.equal((await route(request('POST'),{params:Promise.resolve({})})).status,403)
 const edit=revision(row,{permissions:[]}),updated=await updateCustomRole(f.ctx,row.id,edit)
 assert.equal(updated.revision,2)
 assert.equal((await updateCustomRole(f.ctx,row.id,edit)).revision,2)
 assert.equal(await verifySession(token),null)
 await assert.rejects(prisma.$transaction(tx=>assertLiveContext(tx,ctx)),{code:'SESSION_CHANGED'})
 const nextToken=await prisma.$transaction(tx=>createSession(tx,f.staff.user.id,f.org.id))
 const denied=await route(new NextRequest('http://localhost/api/products',{headers:{cookie:`pos_session=${nextToken}`}}),{params:Promise.resolve({})})
 assert.equal(denied.status,403)
 await assert.rejects(updateCustomRole(f.ctx,row.id,revision(row)),{code:'ROLE_REVISION_CHANGED'})
})
test('Concurrent role edits have one winner; deactivation blocks new sessions and preserves membership history',async()=>{
 const f=await fixture(),row=await createCustomRole(f.ctx,command())
 await updateMember(f.ctx,f.staff.membership.id,{customRoleId:row.id})
 const results=await Promise.allSettled([updateCustomRole(f.ctx,row.id,revision(row,{name:'Reader one'})),updateCustomRole(f.ctx,row.id,revision(row,{name:'Reader two'}))])
 assert.equal(results.filter(result=>result.status==='fulfilled').length,1)
 const current=await prisma.customRole.findUniqueOrThrow({where:{id:row.id}})
 await updateCustomRole(f.ctx,row.id,revision(current,{isActive:false}))
 await assert.rejects(prisma.$transaction(tx=>createSession(tx,f.staff.user.id,f.org.id)),{code:'NO_ORGANIZATION'})
 await assert.rejects(updateMember(f.ctx,f.staff.membership.id,{isActive:true}),{code:'ROLE_INACTIVE'})
 await assert.rejects(prisma.customRole.delete({where:{id:row.id}}))
 assert.equal((await prisma.organizationUser.findUniqueOrThrow({where:{id:f.staff.membership.id}})).customRoleId,row.id)
 await updateMember(f.ctx,f.staff.membership.id,{customRoleId:null})
 const token=await prisma.$transaction(tx=>createSession(tx,f.staff.user.id,f.org.id))
 assert.equal((await verifySession(token))?.customRole,undefined)
})
test('Late audit failure atomically restores role revision, permissions, sessions and operation before original-key retry',async()=>{
 const f=await fixture(),row=await createCustomRole(f.ctx,command())
 await updateMember(f.ctx,f.staff.membership.id,{customRoleId:row.id})
 const token=await prisma.$transaction(tx=>createSession(tx,f.staff.user.id,f.org.id))
 const input=revision(row,{permissions:[]}),trigger='role_audit_'+randomUUID().replaceAll('-','')
 try{
  await prisma.$executeRawUnsafe(`CREATE FUNCTION ${trigger}() RETURNS trigger LANGUAGE plpgsql AS $$ BEGIN RAISE EXCEPTION 'isolated role audit failure'; END $$`)
  await prisma.$executeRawUnsafe(`CREATE TRIGGER ${trigger} BEFORE INSERT ON "AuditLog" FOR EACH ROW WHEN (NEW."organizationId"='${f.org.id}' AND NEW.action='custom_role_updated') EXECUTE FUNCTION ${trigger}()`)
  await assert.rejects(updateCustomRole(f.ctx,row.id,input))
  assert.equal((await prisma.customRole.findUniqueOrThrow({where:{id:row.id}})).revision,1)
  assert.deepEqual((await verifySession(token))?.customRole?.permissions,row.permissions)
  assert.equal(await prisma.operation.count({where:{organizationId:f.org.id,key:input.operationId}}),0)
 }finally{
  await prisma.$executeRawUnsafe(`DROP TRIGGER IF EXISTS ${trigger} ON "AuditLog"`)
  await prisma.$executeRawUnsafe(`DROP FUNCTION IF EXISTS ${trigger}()`)
 }
 assert.equal((await updateCustomRole(f.ctx,row.id,input)).revision,2)
 assert.equal(await verifySession(token),null)
})
test('Custom role writes respect subscription read-only and source identity guards',async()=>{
 const f=await fixture(true),row=await createCustomRole(f.ctx,command())
 await assert.rejects(prisma.customRole.update({where:{id:row.id},data:{baseRole:'cashier',revision:2}}))
 await assert.rejects(prisma.customRole.update({where:{id:row.id},data:{permissions:[]}}))
 const ends=new Date(Date.now()-8*86400000)
 await prisma.organizationSubscription.create({data:{organizationId:f.org.id,planVersionId:'initial-pro-v1',trialStartedAt:new Date(ends.getTime()-14*86400000),trialEndsAt:ends}})
 await assert.rejects(createCustomRole(f.ctx,command('Expired create')),{code:'SUBSCRIPTION_EXPIRED'})
 await assert.rejects(updateCustomRole(f.ctx,row.id,revision(row)),{code:'SUBSCRIPTION_EXPIRED'})
 assert.equal((await listCustomRoles(f.ctx)).total,1)
})
