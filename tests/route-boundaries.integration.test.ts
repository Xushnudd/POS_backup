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
const publicPaths=new Set(['/api/auth/login','/api/auth/register','/api/auth/logout','/api/auth/invitations/accept','/api/health/live','/api/health/ready'])
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
   let denied=false;try{assertRoutePermission(path,method,'cashier')}catch{denied=true}
   if(denied)assert.equal((await routeModule[method](request(cashier.cookie,''),context)).status,403,method+' '+template+' cashier denied before handler')
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
 }
})
