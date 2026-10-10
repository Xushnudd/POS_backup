import {test,after} from 'node:test'
import assert from 'node:assert/strict'
import {randomBytes,randomUUID} from 'node:crypto'
import {readdirSync,readFileSync} from 'node:fs'
import {join,relative} from 'node:path'
import {NextRequest} from 'next/server'
import {prisma} from '@/lib/prisma'
import {sessionHash} from '@/server/auth/session'
import {assertRoutePermission} from '@/server/auth/policy'
const connection=new URL(process.env.DATABASE_URL??'');if(connection.hostname!=='127.0.0.1'||connection.port!=='55439'||connection.pathname!=='/pos_test')throw new Error('Isolated DB only')
const orgs:string[]=[],users:string[]=[];after(async()=>{await prisma.organization.deleteMany({where:{id:{in:orgs}}});await prisma.user.deleteMany({where:{id:{in:users}}});await prisma.$disconnect()})
async function account(role:string){const org=await prisma.organization.create({data:{name:'Route matrix',phone:randomUUID()}});orgs.push(org.id);const user=await prisma.user.create({data:{fullName:'Matrix actor',phone:randomUUID(),passwordHash:'not-a-login'}});users.push(user.id);await prisma.organizationUser.create({data:{organizationId:org.id,userId:user.id,role}});const token=randomBytes(32).toString('base64url');await prisma.session.create({data:{organizationId:org.id,userId:user.id,tokenHash:sessionHash(token),expiresAt:new Date(Date.now()+3600000),idleExpiresAt:new Date(Date.now()+3600000)}});return {org,user,cookie:'pos_session='+token}}
function routes(dir:string):string[]{return readdirSync(dir,{withFileTypes:true}).flatMap(entry=>entry.isDirectory()?routes(join(dir,entry.name)):entry.name==='route.ts'?[join(dir,entry.name)]:[])}
const publicPaths=new Set(['/api/auth/login','/api/auth/register','/api/auth/logout','/api/auth/invitations/accept','/api/auth/password-reset/request','/api/auth/password-reset/complete','/api/health/live','/api/health/ready'])
test('Readiness requires the active manual-refund and supplier migration contract, without leaking dependency details',async()=>{
 const {GET}=await import('../src/app/api/health/ready/route');
 assert.equal((await GET()).status,200);
 for(const migration of ['202610070031_manual_refund_proof','202610100109_receipt_identity_snapshot'])try{
  await prisma.$executeRaw`UPDATE "_prisma_migrations" SET rolled_back_at=NOW() WHERE migration_name=${migration}`;
  const response=await GET();assert.equal(response.status,503);assert.deepEqual(await response.json(),{status:'unavailable'});
 }finally{await prisma.$executeRaw`UPDATE "_prisma_migrations" SET rolled_back_at=NULL WHERE migration_name=${migration}`}
 assert.equal((await GET()).status,200);
});
type Handler=(request:NextRequest,context:{params:Promise<Record<string,string>>})=>Promise<Response>
test('Every exported protected API handler rejects unauthenticated, foreign tenant and foreign branch requests',async()=>{
 const own=await account('owner'),cashier=await account('cashier'),admin=await account('admin'),foreign=await account('owner')
 const foreignStore=await prisma.store.create({data:{organizationId:foreign.org.id,name:'Foreign branch'}})
 const inventory:string[]=[]
 for(const file of routes(join(process.cwd(),'src/app/api')).sort()){
  const template='/api/'+relative(join(process.cwd(),'src/app/api'),file).replace(/\/route\.ts$/,'').replace(/^route\.ts$/,'')
  const path=template.replace(/\[([^\]]+)\]/g,()=>foreign.org.id)
  const parameters=Object.fromEntries([...template.matchAll(/\[([^\]]+)\]/g)].map(match=>[match[1],foreign.org.id]))
  const compiled=join(process.cwd(),'.test-build',relative(process.cwd(),file)).replace(/\.ts$/,'.js')
  const routeModule=await import(compiled) as Record<string,Handler>
  for(const method of ['GET','POST','PUT','PATCH','DELETE']){
   if(typeof routeModule[method]!=='function')continue
   inventory.push(method+' '+template)
   if(publicPaths.has(template))continue
   assert.match(readFileSync(file,'utf8'),/withApi/,template+' must use common guard')
   const request=(cookie:string,query:string)=>new NextRequest('http://localhost:3000'+path+query,{method,headers:{cookie,origin:'http://localhost:3000','content-type':'application/json'},...(method==='GET'?{}:{body:'{}'})})
   const context={params:Promise.resolve(parameters)}
   assert.equal((await routeModule[method](request('',''),context)).status,401,method+' '+template+' no-session')
   const crossTenant=await routeModule[method](request(own.cookie,'?organizationId='+foreign.org.id),context)
   assert.ok([403,404].includes(crossTenant.status),method+' '+template+' foreign tenant '+crossTenant.status)
   const crossStore=await routeModule[method](request(admin.cookie,'?storeId='+foreignStore.id),context)
   assert.ok([403,404].includes(crossStore.status),method+' '+template+' foreign store '+crossStore.status)
   for(const [role,actor] of [['owner',own],['admin',admin],['cashier',cashier]] as const){
    let denied=false;try{assertRoutePermission(path,method,role)}catch{denied=true}
    if(denied)assert.equal((await routeModule[method](request(actor.cookie,''),context)).status,403,method+' '+template+' '+role+' denied before handler')
   }
  }
 }
 assert.ok(inventory.length>=100,'Guard inventory includes all HTTP methods; no silent shrinking')
 console.info(JSON.stringify({event:'route_boundary_inventory',handlers:inventory.length,templates:routes(join(process.cwd(),'src/app/api')).length}))
})

test('Positive scoped reads cover API groups alongside exhaustive negative handler inventory',async()=>{
 const own=await account('owner'),store=await prisma.store.create({data:{organizationId:own.org.id,name:'Allowed branch'}})
 const product=await prisma.product.create({data:{organizationId:own.org.id,name:'Allowed product',sku:randomUUID(),barcode:randomUUID(),unit:'dona',salePrice:'1.01',costPrice:'0.50'}})
 const barcode=await prisma.productBarcode.findFirstOrThrow({where:{productId:product.id}})
 const customer=await prisma.customer.create({data:{organizationId:own.org.id,fullName:'Allowed customer',phone:randomUUID(),creditLimit:100}})
 const paths=['auth/me','auth/sessions','organizations','stores','products','units','categories','customers','suppliers','sales','shifts','stock-documents','transfers','stock-counts','ownership-transfers','audit','incidents','sync/reviews','operations/overview','inventory/balances','inventory/movements','settings/discounts','reports/dashboard','reports/sales','reports/products','reports/purchases','reports/reconciliation','reports/replenishment',`products/${product.id}/barcodes`,`products/${product.id}/barcodes/labels`,`customers/${customer.id}/ledger`,`customers/${customer.id}/debt`]
 for(const path of paths){
  const template=path.replace(product.id,'[id]').replace(customer.id,'[id]'),compiled=join(process.cwd(),'.test-build/src/app/api',template,'route.js')
  const route=await import(compiled) as {GET:Handler}
  const request=new NextRequest('http://localhost:3000/api/'+path+'?organizationId='+own.org.id+'&storeId='+store.id+(path.endsWith('/labels')?'&barcodeId='+barcode.id:''),{headers:{cookie:own.cookie}})
  const response=await route.GET(request,{params:Promise.resolve({id:path.includes(product.id)?product.id:customer.id})})
   assert.equal(response.status,200,path+' owner scoped allow')
  const content=await response.text();
  assert.doesNotMatch(content,/"(?:passwordHash|tokenHash|resetToken|secret|apiKey|privateKey|clientSecret|accessToken|refreshToken|sessionToken)"\s*:/i,path+' response credentials');
  assert.ok(!content.includes('not-a-login'),path+' password canary');
 }
})

test('Organization nested stores/staff and shift operator DTOs respect branch and private-field boundaries',async()=>{
 const own=await account('owner'),cashier=await account('cashier');
 const allowed=await prisma.store.create({data:{organizationId:own.org.id,name:'Allowed nested store'}}),hidden=await prisma.store.create({data:{organizationId:own.org.id,name:'Hidden nested store'}});
 const member=await prisma.organizationUser.create({data:{organizationId:own.org.id,userId:cashier.user.id,role:'cashier',userStores:{create:{storeId:allowed.id}}}});
 const token=randomBytes(32).toString('base64url');
 await prisma.session.create({data:{organizationId:own.org.id,userId:cashier.user.id,tokenHash:sessionHash(token),expiresAt:new Date(Date.now()+3600000),idleExpiresAt:new Date(Date.now()+3600000)}});
 const register=await prisma.register.create({data:{storeId:allowed.id,name:'DTO register',code:'DTO'}});
 const shift=await prisma.shift.create({data:{registerId:register.id,organizationUserId:member.id,openingCash:0}});
 const request=(path:string,cookie='pos_session='+token)=>new NextRequest('http://localhost:3000/api/'+path,{headers:{cookie}});
 const organizations=await import('../src/app/api/organizations/[id]/route');
 const result=await organizations.GET(request('organizations/'+own.org.id),{params:Promise.resolve({id:own.org.id})});assert.equal(result.status,200);
 const body=await result.json();assert.deepEqual(body.data.stores.map((store:{id:string})=>store.id),[allowed.id]);assert.deepEqual(body.data.users,[]);assert.ok(!JSON.stringify(body).includes(hidden.id));
 const owner=await organizations.GET(request('organizations/'+own.org.id,own.cookie),{params:Promise.resolve({id:own.org.id})});const ownerData=await owner.json();assert.equal(ownerData.data.stores.length,2);assert.ok(ownerData.data.users.length>=2);assert.ok(!JSON.stringify(ownerData).includes('not-a-login'));
 const shifts=await import('../src/app/api/shifts/[id]/route');
 const response=await shifts.GET(request('shifts/'+shift.id),{params:Promise.resolve({id:shift.id})});assert.equal(response.status,200);
 const operator=(await response.json()).data.organizationUser.user;
 assert.deepEqual(Object.keys(operator).sort(),['fullName','id']);assert.equal(operator.id,cashier.user.id);
});

test('Keyboard identifiers preserve exact SKU/name lookup, reject ambiguity and leave barcode/camera lookup strict',async()=>{
 const own=await account('owner'),foreign=await account('owner');
 const product=await prisma.product.create({data:{organizationId:own.org.id,name:'Exact keyboard name',sku:'Exact-SKU',barcode:randomUUID(),unit:'dona',salePrice:'1.01',costPrice:'0.50'}});
 const {GET}=await import('../src/app/api/products/route');
 const query=(key:string,value:string,organizationId=own.org.id)=>new NextRequest('http://localhost:3000/api/products?'+new URLSearchParams({organizationId,[key]:value}),{headers:{cookie:own.cookie}});
 for(const value of ['Exact-SKU','exact-sku','exact keyboard name']){const result=await GET(query('identifier',value),undefined);assert.equal(result.status,200);assert.equal((await result.json()).data.id,product.id)}
 assert.equal((await GET(query('barcode','Exact-SKU'),undefined)).status,404);
 for(const partial of ['Exact','Exact-S_U','exact keyboard nam_','%%'])assert.equal((await GET(query('identifier',partial),undefined)).status,404);
 assert.equal((await GET(query('identifier','Exact-SKU',foreign.org.id),undefined)).status,403);
 await prisma.product.create({data:{organizationId:own.org.id,name:product.name,sku:'Other-SKU',barcode:randomUUID(),unit:'dona',salePrice:'9.99',costPrice:'1'}});
 assert.equal((await GET(query('identifier',product.name),undefined)).status,409);
 assert.equal((await GET(query('identifier','x'.repeat(201)),undefined)).status,400);
 assert.equal(await prisma.sale.count({where:{organizationId:own.org.id}}),0);
});

test('Common HTTP guard denies unreviewed endpoints and methods for every business role before handler execution',async()=>{
 const {withApi}=await import('@/server/api');let invoked=0;
 const guarded=withApi(async()=>{invoked++;return Response.json({unexpected:true})});
 for(const role of ['owner','admin','cashier']){
  const actor=await account(role);
  for(const [method,path] of [['GET','/api/new-sensitive-feature'],['POST','/api/products/unreviewed/action'],['PATCH','/api/reports/profit']] as const){
   const request=new NextRequest('http://localhost:3000'+path,{method,headers:{cookie:actor.cookie,origin:'http://localhost:3000','content-type':'application/json'},...(method==='GET'?{}:{body:'{}'})});
   const response=await guarded(request,undefined);assert.equal(response.status,403,role+' '+method+' '+path);assert.equal((await response.json()).error.code,'FORBIDDEN');
  }
  assert.equal(await prisma.operation.count({where:{organizationId:actor.org.id}}),0);
  assert.equal(await prisma.sale.count({where:{organizationId:actor.org.id}}),0);
 }
 assert.equal(invoked,0);
});
