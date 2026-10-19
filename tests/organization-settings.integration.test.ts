import {test,after} from 'node:test'
import assert from 'node:assert/strict'
import {randomUUID,randomBytes} from 'node:crypto'
import {NextRequest} from 'next/server'
import {prisma} from '@/lib/prisma'
import {sessionHash} from '@/server/auth/session'
import {GET as storesGET,POST as storesPOST} from '@/app/api/stores/route'
import {POST as orgPOST} from '@/app/api/organizations/route'
import {PUT as orgPUT} from '@/app/api/organizations/[id]/route'
import {POST as registerPOST} from '@/app/api/stores/[id]/registers/route'

const connection=new URL(process.env.DATABASE_URL??'')
if(connection.hostname!=='127.0.0.1'||connection.port!=='55439'||connection.pathname!=='/pos_test'||connection.username!=='pos_test')throw Error('Isolated settings test DB required')
const orgs:string[]=[],users:string[]=[]
after(async()=>{await prisma.organization.deleteMany({where:{id:{in:orgs}}});await prisma.user.deleteMany({where:{id:{in:users}}});await prisma.$disconnect()})
async function fixture(){
 const org=await prisma.organization.create({data:{name:'Review settings',phone:randomUUID()}});orgs.push(org.id)
 const store=await prisma.store.create({data:{organizationId:org.id,name:'Assigned branch'}})
 const credentials={} as Record<'owner'|'admin'|'cashier',{token:string;sessionId:string}>
 for(const role of ['owner','admin','cashier'] as const){
  const user=await prisma.user.create({data:{fullName:'Review '+role,phone:randomUUID(),passwordHash:'not-a-login'}});users.push(user.id)
  await prisma.organizationUser.create({data:{organizationId:org.id,userId:user.id,role,userStores:{create:{storeId:store.id}}}})
  const token=randomBytes(32).toString('base64url'),session=await prisma.session.create({data:{organizationId:org.id,userId:user.id,tokenHash:sessionHash(token),expiresAt:new Date(Date.now()+3600000),idleExpiresAt:new Date(Date.now()+3600000)}})
  credentials[role]={token,sessionId:session.id}
 }
 return {org,store,...credentials}
}
function request(token:string,path:string,method='GET',body?:unknown){return new NextRequest('http://localhost:3000'+path,{method,headers:{cookie:'pos_session='+token,origin:'http://localhost:3000','content-type':'application/json'},...(body===undefined?{}:{body:JSON.stringify(body)})})}
async function update(f:Awaited<ReturnType<typeof fixture>>,body:unknown,token=f.owner.token){return orgPUT(request(token,'/api/organizations/'+f.org.id,'PUT',body),{params:Promise.resolve({id:f.org.id})})}

test('Owner sees admin-created active branches without assignment; staff lists stay scoped and revoked sessions fail',async()=>{
 const f=await fixture(),foreign=await fixture()
 const created=await storesPOST(request(f.admin.token,'/api/stores','POST',{organizationId:f.org.id,name:'Admin-created branch'}),undefined)
 assert.equal(created.status,200);const branch=(await created.json()).data
 await prisma.register.create({data:{storeId:branch.id,name:'Active register',code:'ACTIVE'}})
 await prisma.register.create({data:{storeId:branch.id,name:'Inactive register',code:'INACTIVE',isActive:false}})
 await prisma.store.create({data:{organizationId:f.org.id,name:'Inactive branch',isActive:false}})
 for(const role of ['owner','admin','cashier'] as const){
  const response=await storesGET(request(f[role].token,'/api/stores?organizationId='+f.org.id),undefined)
  assert.equal(response.status,200);const data=(await response.json()).data
  assert.deepEqual(data.map((row:{id:string})=>row.id).sort(),(role==='cashier'?[f.store.id]:[f.store.id,branch.id]).sort())
  assert.ok(!JSON.stringify(data).includes(foreign.store.id));assert.ok(!JSON.stringify(data).includes('Inactive'))
 }
 assert.equal((await storesGET(request(f.owner.token,'/api/stores?organizationId='+foreign.org.id),undefined)).status,403)
 await prisma.session.update({where:{id:f.owner.sessionId},data:{revokedAt:new Date()}})
 assert.equal((await storesGET(request(f.owner.token,'/api/stores?organizationId='+f.org.id),undefined)).status,401)
})

test('Blank optional TINs are null across businesses and settings can clear a saved TIN and receipt footer',async()=>{
 const f=await fixture()
 for(const tin of ['', ' \t ',null]){
  const response=await orgPOST(request(f.owner.token,'/api/organizations','POST',{name:'Blank TIN business',phone:randomUUID(),tin}),undefined)
  assert.equal(response.status,200);const row=(await response.json()).data;orgs.push(row.id);assert.equal(row.tin,null)
 }
 assert.equal((await update(f,{tin:' TIN-'+randomUUID()+' ',receiptFooter:'Saved footer'})).status,200)
 const cleared=await update(f,{tin:null,receiptFooter:''});assert.equal(cleared.status,200)
 const row=await prisma.organization.findUniqueOrThrow({where:{id:f.org.id}})
 assert.equal(row.tin,null);assert.equal(row.receiptFooter,'')
})

test('Duplicate TIN gives actionable sanitized409 and rolls back settings/audit; staff cannot change settings',async()=>{
 const f=await fixture(),other=await fixture(),tin='TIN-'+randomUUID()
 await prisma.organization.update({where:{id:other.org.id},data:{tin}})
 const before=await prisma.auditLog.count({where:{organizationId:f.org.id}})
 const response=await update(f,{tin:' '+tin+' ',name:'Must roll back'}),result=await response.json()
 assert.equal(response.status,409);assert.equal(result.error.code,'TIN_EXISTS');assert.ok(result.error.nextAction)
 assert.equal(result.requestId,response.headers.get('x-request-id'))
 for(const value of [tin,other.org.id,'P2002','Organization_tin_key'])assert.ok(!JSON.stringify(result).includes(value))
 assert.equal((await prisma.organization.findUniqueOrThrow({where:{id:f.org.id}})).name,f.org.name)
 assert.equal(await prisma.auditLog.count({where:{organizationId:f.org.id}}),before)
 assert.equal((await update(f,{name:'Staff forbidden'},f.admin.token)).status,403)
})

test('Unknown timezone and malformed currency fail validation before mutation, supported timezones remain valid',async()=>{
 const f=await fixture(),before=await prisma.auditLog.count({where:{organizationId:f.org.id}})
 for(const patch of [{timezone:'Mars/Unknown'},{timezone:''},{timezone:'x'.repeat(101)},{currencyCode:'uzs'},{currencyCode:'UZS<script>'}]){
  const response=await update(f,patch);assert.equal(response.status,400);assert.equal((await response.json()).error.code,'VALIDATION_ERROR')
 }
 assert.equal((await prisma.organization.findUniqueOrThrow({where:{id:f.org.id}})).timezone,'Asia/Tashkent')
 assert.equal(await prisma.auditLog.count({where:{organizationId:f.org.id}}),before)
 for(const timezone of ['UTC','Asia/Tashkent'])assert.equal((await update(f,{timezone,currencyCode:'UZS'})).status,200)
})

test('Duplicate register code reaches common409 handling without committing a second register or audit',async()=>{
 const f=await fixture(),path='/api/stores/'+f.store.id+'/registers',params={params:Promise.resolve({id:f.store.id})}
 const body={name:'Register one',code:'ONE'}
 assert.equal((await registerPOST(request(f.owner.token,path,'POST',body),params)).status,200)
 const before=await prisma.auditLog.count({where:{organizationId:f.org.id}})
 const response=await registerPOST(request(f.owner.token,path,'POST',{...body,name:'Duplicate'}),params),result=await response.json()
 assert.equal(response.status,409);assert.equal(result.error.code,'CONFLICT');assert.ok(result.error.nextAction)
 assert.ok(!JSON.stringify(result).includes('P2002'));assert.equal(await prisma.register.count({where:{storeId:f.store.id}}),1)
 assert.equal(await prisma.auditLog.count({where:{organizationId:f.org.id}}),before)
})

test('Late settings audit failure returns sanitized500 with a request ID and rolls back the actual business update',async()=>{
 const f=await fixture(),suffix=randomUUID().replaceAll('-',''),name='review_fault_'+suffix
 await prisma.$executeRawUnsafe(`CREATE FUNCTION "${name}"() RETURNS trigger LANGUAGE plpgsql AS $$ BEGIN IF NEW."organizationId"='${f.org.id}' AND NEW."entityType"='Organization' THEN RAISE EXCEPTION 'private-review-diagnostic';END IF;RETURN NEW;END $$`)
 await prisma.$executeRawUnsafe(`CREATE TRIGGER "${name}" BEFORE INSERT ON "AuditLog" FOR EACH ROW EXECUTE FUNCTION "${name}"()`)
 try{
  const response=await update(f,{name:'Must not persist'}),result=await response.json()
  assert.equal(response.status,500);assert.equal(result.error.code,'INTERNAL_ERROR');assert.equal(result.requestId,response.headers.get('x-request-id'))
  assert.ok(!JSON.stringify(result).includes('private-review-diagnostic'))
  assert.equal((await prisma.organization.findUniqueOrThrow({where:{id:f.org.id}})).name,f.org.name)
 }finally{
  await prisma.$executeRawUnsafe(`DROP TRIGGER "${name}" ON "AuditLog"`)
  await prisma.$executeRawUnsafe(`DROP FUNCTION "${name}"()`)
 }
})
