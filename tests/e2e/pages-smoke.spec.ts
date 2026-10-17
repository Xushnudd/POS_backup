import {test,expect,type Page} from '@playwright/test'
import {PrismaClient} from '@prisma/client'
import {randomUUID} from 'node:crypto'
import {readdirSync,writeFileSync} from 'node:fs'
import {join} from 'node:path'
const connection=new URL(process.env.DATABASE_URL??'')
if(connection.hostname!=='127.0.0.1'||connection.port!=='55439'||connection.pathname!=='/pos_test')throw Error('Isolated DB required')
const db=new PrismaClient(),orgs:string[]=[],users:string[]=[]
test.afterAll(async()=>{await db.organization.deleteMany({where:{id:{in:orgs}}});await db.user.deleteMany({where:{id:{in:users}}});await db.$disconnect()})
function pages(directory='src/app',result:string[]=[]){
 for(const entry of readdirSync(directory,{withFileTypes:true})){
  const path=join(directory,entry.name)
  if(entry.isDirectory())pages(path,result)
  else if(entry.name==='page.tsx')result.push(path)
 }
 return result.sort()
}
const publicPages=pages().filter(path=>!path.includes('(dashboard)'))
const dashboardPages=pages().filter(path=>path.includes('(dashboard)'))
const route=(file:string)=>'/'+file.split('/').slice(2,-1).filter(part=>!part.startsWith('(')).join('/')
async function visit(page:Page,paths:string[],proof:string,authenticated=false){
 const failures:string[]=[],exceptions:string[]=[],results:{path:string;status:number;reached:string}[]=[]
 const pending=new Set<unknown>()
 page.on('request',request=>{if(new URL(request.url()).pathname.startsWith('/api/'))pending.add(request)})
 page.on('requestfinished',request=>pending.delete(request));page.on('requestfailed',request=>pending.delete(request))
 page.on('pageerror',error=>exceptions.push(error.name))
 page.on('response',response=>{const path=new URL(response.url()).pathname;if(path.startsWith('/api/')&&response.status()>=500)failures.push(path+':'+response.status())})
 for(const path of paths){
  const navigationStarted=Date.now()
  const identity=authenticated?page.waitForResponse(response=>new URL(response.url()).pathname==='/api/auth/me'):undefined
  const response=await page.goto(path);expect(response?.status(),path).toBe(200)
  if(identity)expect((await identity).status(),path+' live session').toBe(200)
  // Next may keep RSC prefetch connections alive. Readiness depends on the
  // actual API responses, not on unrelated background network quiescence.
  let settled=0
  await expect.poll(()=>pending.size===0?++settled:(settled=0),{timeout:15000,intervals:[100]}).toBeGreaterThanOrEqual(3)
  if(/^\/products\/[^/]+\/units$/.test(path))await expect(page.getByRole('link',{name:'Birliklar katalogi',exact:true})).toHaveAttribute('href','/products/units')
  await expect(page.locator('body'),path).not.toContainText('Application error:')
  await expect(page.locator('body'),path).not.toContainText('Internal Server Error')
  expect(exceptions,path+' browser exceptions').toEqual([])
  expect(failures,path+' unexpected backend failures').toEqual([])
  results.push({path,status:response!.status(),reached:new URL(page.url()).pathname})
  writeFileSync(test.info().outputPath(proof),JSON.stringify({recordedAt:new Date().toISOString(),complete:results.length===paths.length,scope:'isolated Chromium route loading, not full business acceptance',routes:results,browserExceptions:exceptions,apiServerFailures:failures},null,2)+'\n')
  // A full reload triggers the shared layout's real API reads too. Pace this
  // route inventory below the normal per-actor budget; never disable/reset it.
  if(authenticated)await new Promise(resolve=>setTimeout(resolve,Math.max(0,1500-(Date.now()-navigationStarted))))
 }
}
test('Every dashboard page loads its real owned source or an explicit permission/business-state boundary without a server/render exception',async({page})=>{
 test.setTimeout(180000)
 const registered=await page.request.post('/api/auth/register',{headers:{Origin:'https://localhost:3100'},data:{fullName:'Page smoke owner',phone:'pages-smoke-'+randomUUID(),password:'test-only-password',organizationName:'All page smoke fixture'}})
 expect(registered.ok()).toBe(true);const me=(await registered.json()).data,organizationId=me.organization.id
 orgs.push(organizationId);users.push(me.user.id)
 const store=await db.store.findFirstOrThrow({where:{organizationId}}),register=await db.register.findFirstOrThrow({where:{storeId:store.id}})
 const shift=await db.shift.create({data:{registerId:register.id,organizationUserId:me.user.organizationUserId,openingCash:0}})
 const product=await db.product.create({data:{organizationId,name:'Owned smoke product',sku:randomUUID(),barcode:randomUUID(),unit:'dona',salePrice:10,costPrice:1}})
 const customer=await db.customer.create({data:{organizationId,fullName:'Owned smoke customer',phone:randomUUID()}}),supplier=await db.supplier.create({data:{organizationId,name:'Owned smoke supplier'}})
 const sale=await db.sale.create({data:{organizationId,storeId:store.id,registerId:register.id,shiftId:shift.id,cashierId:me.user.id,receiptNo:randomUUID(),status:'draft',subtotal:10,totalAmount:10}})
 const ticketResponse=await page.request.post('/api/support/tickets',{headers:{Origin:'https://localhost:3100'},data:{operationId:randomUUID(),title:'Owned route smoke ticket',description:'Synthetic internal browser route test',severity:'normal'}})
 expect(ticketResponse.ok()).toBe(true);const ticket=(await ticketResponse.json()).data
 const ids:Record<string,string>={products:product.id,customers:customer.id,suppliers:supplier.id,sales:sale.id,tickets:ticket.id}
 const paths=dashboardPages.map(file=>{const path=route(file),root=path.split('/')[1];if(path.includes('[id]')){expect(ids[root],path).toBeTruthy();return path.replace('[id]',ids[root])}return path})
 await visit(page,paths,'dashboard-pages-smoke.json',true)
 expect(await db.payment.count({where:{organizationId}})).toBe(0)
 expect(await db.inventoryMovement.count({where:{organizationId}})).toBe(0)
})
test('Every public page loads without a render exception and unauthenticated POS navigation returns to login',async({page})=>{
 test.setTimeout(60000)
 await visit(page,publicPages.map(route),'public-pages-smoke.json')
 await page.goto('/pos');await expect(page).toHaveURL(/\/login(?:\?|$)/)
})
