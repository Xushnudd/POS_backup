import {test,after} from 'node:test'
import assert from 'node:assert/strict'
import {randomBytes,randomUUID,createHash} from 'node:crypto'
import {readdirSync} from 'node:fs'
import {join,relative} from 'node:path'
import {NextRequest,NextResponse} from 'next/server'
import {prisma} from '@/lib/prisma'
import {sessionHash} from '@/server/auth/session'
import {withApi} from '@/server/api'
import {consumeLimit} from '@/server/auth/rate-limit'
import {POST as importPreview} from '@/app/api/catalog-import/preview/route'
import {POST as register} from '@/app/api/auth/register/route'
import {requestPasswordReset,completePasswordReset} from '@/server/auth/challenges'
import {mockAuthenticationDelivery} from './helpers/auth-delivery'
const connection=new URL(process.env.DATABASE_URL??'');if(connection.hostname!=='127.0.0.1'||connection.port!=='55439'||connection.pathname!=='/pos_test')throw new Error('Isolated DB only')
const orgs:string[]=[],users:string[]=[],keys:string[]=[]
after(async()=>{await prisma.organization.deleteMany({where:{id:{in:orgs}}});await prisma.user.deleteMany({where:{id:{in:users}}});await prisma.rateLimit.deleteMany({where:{key:{in:keys}}});await prisma.$disconnect()})
async function fixture(){const org=await prisma.organization.create({data:{name:'Budget fixture',phone:randomUUID()}});orgs.push(org.id);const user=await prisma.user.create({data:{fullName:'Budget actor',phone:randomUUID(),passwordHash:'not-a-login'}});users.push(user.id);await prisma.organizationUser.create({data:{organizationId:org.id,userId:user.id,role:'owner'}});const token=randomBytes(32).toString('base64url');await prisma.session.create({data:{organizationId:org.id,userId:user.id,tokenHash:sessionHash(token),expiresAt:new Date(Date.now()+3600000),idleExpiresAt:new Date(Date.now()+3600000)}});return {org,user,cookie:'pos_session='+token}}
const key=(category:string,identity:string)=>createHash('sha256').update(category+':'+identity).digest('hex')
async function exhaust(category:string,identity:string,limit:number){const value=key(category,identity);keys.push(value);await prisma.rateLimit.upsert({where:{key:value},create:{key:value,attempts:limit,expiresAt:new Date(Date.now()+60000)},update:{attempts:limit,expiresAt:new Date(Date.now()+60000)}});return value}
function request(path:string,cookie:string,body?:string,headers:Record<string,string>={}){return new NextRequest('http://localhost:3000'+path,{method:body===undefined?'GET':'POST',headers:{cookie,origin:'http://localhost:3000','content-type':'application/json',...headers},...(body===undefined?{}:{body})})}
function routes(dir:string):string[]{return readdirSync(dir,{withFileTypes:true}).flatMap(entry=>entry.isDirectory()?routes(join(dir,entry.name)):entry.name==='route.ts'?[join(dir,entry.name)]:[])}
// Approved bearer-document viewers use the public IP budget and their own
// per-capability budget; they are not authorized by an organization session.
const publicPaths=new Set(['/api/auth/login','/api/auth/register','/api/auth/logout','/api/auth/invitations/accept','/api/auth/password-reset/request','/api/auth/password-reset/complete','/api/health/live','/api/health/ready','/api/receipt-view','/api/reminder-view'])
test('Every protected HTTP handler rejects an exhausted shared budget before business work; tenants isolate and expiry permits retry',async()=>{
 const f=await fixture(),other=await fixture(),identity=f.org.id+':'+f.user.id
 const readKey=await exhaust('api.read',identity,600),writeKey=await exhaust('api.write',identity,300)
 let checked=0
 for(const file of routes(join(process.cwd(),'src/app/api')).sort()){
  const template='/api/'+relative(join(process.cwd(),'src/app/api'),file).replace(/\/route\.ts$/,'')
  if(publicPaths.has(template))continue
  const path=template.replace(/\[([^\]]+)\]/g,()=>f.org.id),params=Object.fromEntries([...template.matchAll(/\[([^\]]+)\]/g)].map(match=>[match[1],f.org.id]))
  const routeHandlers=await import(join(process.cwd(),'.test-build',relative(process.cwd(),file)).replace(/\.ts$/,'.js'))
  for(const method of ['GET','POST','PUT','PATCH','DELETE']){
   if(typeof routeHandlers[method]!=='function')continue
   const req=new NextRequest('http://localhost:3000'+path,{method,headers:{cookie:f.cookie,origin:'http://localhost:3000','content-type':'application/json'},...(method==='GET'?{}:{body:'{}'})})
   const response=await routeHandlers[method](req,{params:Promise.resolve(params)})
   assert.equal(response.status,429,method+' '+template);assert.ok(Number(response.headers.get('Retry-After'))>=1);assert.equal((await response.json()).error.code,'RATE_LIMITED');checked++
  }
 }
 assert.ok(checked>150,'Inventory must include all protected HTTP handlers')
 const {GET}=await import('@/app/api/units/route')
 assert.equal((await GET(request('/api/units',other.cookie),undefined)).status,200)
 await prisma.rateLimit.updateMany({where:{key:{in:[readKey,writeKey]}},data:{expiresAt:new Date(Date.now()-1000)}})
 assert.equal((await GET(request('/api/units',f.cookie),undefined)).status,200)
 assert.equal(await prisma.sale.count({where:{organizationId:f.org.id}}),0);assert.equal(await prisma.operation.count({where:{organizationId:f.org.id}}),0)
 console.info(JSON.stringify({event:'request_budget_inventory',protectedHandlers:checked}))
})
test('Atomic shared counter admits only its configured concurrent capacity and returns a retry duration',async()=>{
 const category='budget-race-'+randomUUID(),identity=randomUUID();keys.push(key(category,identity))
 const results=await Promise.allSettled(Array.from({length:12},()=>consumeLimit(category,identity,3,60000)))
 assert.equal(results.filter(r=>r.status==='fulfilled').length,3)
 for(const result of results)if(result.status==='rejected'){assert.equal(result.reason.code,'RATE_LIMITED');assert.ok(result.reason.retryAfterSeconds>=1)}
})
test('Every public authentication admission limit resists spoofed IPs; health/logout remain usable and expiry allows retry',async()=>{
 const previous=process.env.TRUST_PROXY_IP
 try{
  delete process.env.TRUST_PROXY_IP
  const publicKey=await exhaust('api.public.write','unattributed',1200)
  for(const path of ['/api/auth/login','/api/auth/register','/api/auth/invitations/accept','/api/auth/password-reset/request','/api/auth/password-reset/complete','/api/receipt-view','/api/reminder-view']){
   const routeHandlers=await import(join(process.cwd(),'.test-build/src/app',path.slice(1),'route.js'))
   const response=await routeHandlers.POST(request(path,'','{}',{'x-real-ip':'192.0.2.123','x-forwarded-for':randomUUID()}),undefined)
   assert.equal(response.status,429,path);assert.ok(response.headers.get('Retry-After'))
  }
  const {GET}=await import('@/app/api/health/live/route');assert.equal((await GET()).status,200)
  const {POST}=await import('@/app/api/auth/logout/route');assert.equal((await POST(request('/api/auth/logout','','{}'),undefined)).status,200)
  process.env.TRUST_PROXY_IP='true'
  const {POST:login}=await import('@/app/api/auth/login/route')
  assert.equal((await login(request('/api/auth/login','','{}',{'x-real-ip':'not-a-valid-IP'}),undefined)).status,429)
  assert.equal((await login(request('/api/auth/login','','{}',{'x-real-ip':'192.0.2.45'}),undefined)).status,400)
  keys.push(key('api.public.write','192.0.2.45'))
  delete process.env.TRUST_PROXY_IP
  await prisma.rateLimit.update({where:{key:publicKey},data:{expiresAt:new Date(Date.now()-1)}})
  assert.equal((await login(request('/api/auth/login','','{}'),undefined)).status,400)
 }finally{if(previous===undefined)delete process.env.TRUST_PROXY_IP;else process.env.TRUST_PROXY_IP=previous}
})
test('Declared and actual streamed body sizes enforce 413; slow ingress never runs a handler and retry remains available',async()=>{
 let calls=0;const endpoint=withApi(async()=>{calls++;return NextResponse.json({success:true})},{public:true})
 assert.equal((await endpoint(request('/api/auth/login','','{}',{'content-length':'1048577'}),undefined)).status,413)
 assert.equal((await endpoint(request('/api/auth/login','',JSON.stringify({text:'x'.repeat(1048576)})),undefined)).status,413)
 const previous=process.env.API_BODY_TIMEOUT_MS
 try{
  process.env.API_BODY_TIMEOUT_MS='50'
  const stream=new ReadableStream<Uint8Array>({start(controller){controller.enqueue(new TextEncoder().encode('{'))}})
  const options={method:'POST',headers:{origin:'http://localhost:3000','content-type':'application/json'},body:stream,duplex:'half' as const}
  const req=new NextRequest('http://localhost:3000/api/auth/login',options)
  const response=await endpoint(req,undefined);assert.equal(response.status,408);assert.equal((await response.json()).error.code,'REQUEST_BODY_TIMEOUT');assert.equal(calls,0)
 }finally{if(previous===undefined)delete process.env.API_BODY_TIMEOUT_MS;else process.env.API_BODY_TIMEOUT_MS=previous}
 try{process.env.API_BODY_TIMEOUT_MS='invalid';assert.equal((await endpoint(request('/api/auth/login','','{}'),undefined)).status,503);assert.equal(calls,0)}
 finally{if(previous===undefined)delete process.env.API_BODY_TIMEOUT_MS;else process.env.API_BODY_TIMEOUT_MS=previous}
 assert.equal((await endpoint(request('/api/auth/login','','{}'),undefined)).status,200);assert.equal(calls,1)
})
test('Import-specific budget precedes parser and oversized file fails without posting; public registration budget supports safe retry',async()=>{
 const f=await fixture(),identity=f.org.id+':'+f.user.id
 const value=await exhaust('catalog.import.preview',identity,10)
 const body=JSON.stringify({format:'csv',content:Buffer.from('name,sku,barcode,unit,salePrice,costPrice\nTest,A,B,dona,1,0').toString('base64')})
 const denied=await importPreview(request('/api/catalog-import/preview',f.cookie,body),undefined);assert.equal(denied.status,429);assert.ok(denied.headers.get('Retry-After'))
 await prisma.rateLimit.update({where:{key:value},data:{expiresAt:new Date(Date.now()-1)}})
 assert.equal((await importPreview(request('/api/catalog-import/preview',f.cookie,JSON.stringify({format:'csv',content:'='.repeat(700000)})),undefined)).status,413)
 const tooManyRows=JSON.stringify({format:'csv',content:Buffer.from('name,sku,barcode,unit,salePrice,costPrice\n'+'Test,A,B,dona,1,0\n'.repeat(1001)).toString('base64')})
 assert.equal((await importPreview(request('/api/catalog-import/preview',f.cookie,tooManyRows),undefined)).status,413)
 assert.equal((await importPreview(request('/api/catalog-import/preview',f.cookie,body),undefined)).status,200)
 const phone=randomUUID(),registration=JSON.stringify({fullName:'Budget signup',phone,password:'test-only-password',organizationName:'Budget signup'})
 const registrationKey=await exhaust('register-account',phone,5)
 const blocked=await register(request('/api/auth/register','',registration),undefined);assert.equal(blocked.status,429);assert.ok(blocked.headers.get('Retry-After'));assert.equal(await prisma.user.count({where:{phone}}),0)
 await prisma.rateLimit.update({where:{key:registrationKey},data:{expiresAt:new Date(Date.now()-1)}})
 const allowed=await register(request('/api/auth/register','',registration),undefined);assert.equal(allowed.status,200)
 const created=await prisma.user.findUniqueOrThrow({where:{phone}}),membership=await prisma.organizationUser.findFirstOrThrow({where:{userId:created.id}});users.push(created.id);orgs.push(membership.organizationId)
 assert.equal(await prisma.product.count({where:{organizationId:f.org.id}}),0);assert.equal(await prisma.payment.count({where:{organizationId:f.org.id}}),0)
})
test('Reset issue and completion budgets deny excess attempts and permit the original intent after expiry',async()=>{
 const identifier=randomUUID()+'@example.test',deps={delivery:mockAuthenticationDelivery('email').provider,secret:'c'.repeat(64)},input={identifier,channel:'email' as const}
 const requestKey=key('auth.reset.request','email:'+identifier);keys.push(requestKey)
 for(let i=0;i<3;i++)assert.deepEqual(await requestPasswordReset(input,deps),{accepted:true})
 await assert.rejects(requestPasswordReset(input,deps),{status:429,code:'RATE_LIMITED'})
 await prisma.rateLimit.update({where:{key:requestKey},data:{expiresAt:new Date(Date.now()-1)}})
 assert.deepEqual(await requestPasswordReset(input,deps),{accepted:true})
 const token=randomBytes(32).toString('base64url'),digest=createHash('sha256').update('reset\0'+token).digest('hex'),completionKey=key('auth.reset.complete',digest);keys.push(completionKey)
 for(let i=0;i<5;i++)await assert.rejects(completePasswordReset({token,newPassword:'test-only-password'}),{code:'AUTH_CHALLENGE_INVALID'})
 await assert.rejects(completePasswordReset({token,newPassword:'test-only-password'}),{status:429,code:'RATE_LIMITED'})
 await prisma.rateLimit.update({where:{key:completionKey},data:{expiresAt:new Date(Date.now()-1)}})
 await assert.rejects(completePasswordReset({token,newPassword:'test-only-password'}),{code:'AUTH_CHALLENGE_INVALID'})
})
