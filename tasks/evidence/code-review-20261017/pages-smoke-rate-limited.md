# Instructions

- Following Playwright test failed.
- Explain why, be concise, respect Playwright best practices.
- Provide a snippet of code with the fix, if possible.

# Test info

- Name: pages-smoke.spec.ts >> Every dashboard page loads its real owned source or an explicit permission/business-state boundary without a server/render exception
- Location: tests/e2e/pages-smoke.spec.ts:45:5

# Error details

```
Error: /shifts live session

expect(received).toBe(expected) // Object.is equality

Expected: 200
Received: 429
```

# Test source

```ts
  1  | import {test,expect,type Page} from '@playwright/test'
  2  | import {PrismaClient} from '@prisma/client'
  3  | import {randomUUID} from 'node:crypto'
  4  | import {readdirSync,writeFileSync} from 'node:fs'
  5  | import {join} from 'node:path'
  6  | const connection=new URL(process.env.DATABASE_URL??'')
  7  | if(connection.hostname!=='127.0.0.1'||connection.port!=='55439'||connection.pathname!=='/pos_test')throw Error('Isolated DB required')
  8  | const db=new PrismaClient(),orgs:string[]=[],users:string[]=[]
  9  | test.afterAll(async()=>{await db.organization.deleteMany({where:{id:{in:orgs}}});await db.user.deleteMany({where:{id:{in:users}}});await db.$disconnect()})
  10 | function pages(directory='src/app',result:string[]=[]){
  11 |  for(const entry of readdirSync(directory,{withFileTypes:true})){
  12 |   const path=join(directory,entry.name)
  13 |   if(entry.isDirectory())pages(path,result)
  14 |   else if(entry.name==='page.tsx')result.push(path)
  15 |  }
  16 |  return result.sort()
  17 | }
  18 | const publicPages=pages().filter(path=>!path.includes('(dashboard)'))
  19 | const dashboardPages=pages().filter(path=>path.includes('(dashboard)'))
  20 | const route=(file:string)=>'/'+file.split('/').slice(2,-1).filter(part=>!part.startsWith('(')).join('/')
  21 | async function visit(page:Page,paths:string[],proof:string,authenticated=false){
  22 |  const failures:string[]=[],exceptions:string[]=[],results:{path:string;status:number;reached:string}[]=[]
  23 |  const pending=new Set<unknown>()
  24 |  page.on('request',request=>{if(new URL(request.url()).pathname.startsWith('/api/'))pending.add(request)})
  25 |  page.on('requestfinished',request=>pending.delete(request));page.on('requestfailed',request=>pending.delete(request))
  26 |  page.on('pageerror',error=>exceptions.push(error.name))
  27 |  page.on('response',response=>{const path=new URL(response.url()).pathname;if(path.startsWith('/api/')&&response.status()>=500)failures.push(path+':'+response.status())})
  28 |  for(const path of paths){
  29 |   const identity=authenticated?page.waitForResponse(response=>new URL(response.url()).pathname==='/api/auth/me'):undefined
  30 |   const response=await page.goto(path);expect(response?.status(),path).toBe(200)
> 31 |   if(identity)expect((await identity).status(),path+' live session').toBe(200)
     |                                                                      ^ Error: /shifts live session
  32 |   // Next may keep RSC prefetch connections alive. Readiness depends on the
  33 |   // actual API responses, not on unrelated background network quiescence.
  34 |   let settled=0
  35 |   await expect.poll(()=>pending.size===0?++settled:(settled=0),{timeout:15000,intervals:[100]}).toBeGreaterThanOrEqual(3)
  36 |   if(/^\/products\/[^/]+\/units$/.test(path))await expect(page.getByRole('link',{name:'Birliklar katalogi',exact:true})).toHaveAttribute('href','/products/units')
  37 |   await expect(page.locator('body'),path).not.toContainText('Application error:')
  38 |   await expect(page.locator('body'),path).not.toContainText('Internal Server Error')
  39 |   expect(exceptions,path+' browser exceptions').toEqual([])
  40 |   expect(failures,path+' unexpected backend failures').toEqual([])
  41 |   results.push({path,status:response!.status(),reached:new URL(page.url()).pathname})
  42 |   writeFileSync(test.info().outputPath(proof),JSON.stringify({recordedAt:new Date().toISOString(),complete:results.length===paths.length,scope:'isolated Chromium route loading, not full business acceptance',routes:results,browserExceptions:exceptions,apiServerFailures:failures},null,2)+'\n')
  43 |  }
  44 | }
  45 | test('Every dashboard page loads its real owned source or an explicit permission/business-state boundary without a server/render exception',async({page})=>{
  46 |  test.setTimeout(180000)
  47 |  const registered=await page.request.post('/api/auth/register',{headers:{Origin:'https://localhost:3100'},data:{fullName:'Page smoke owner',phone:'pages-smoke-'+randomUUID(),password:'test-only-password',organizationName:'All page smoke fixture'}})
  48 |  expect(registered.ok()).toBe(true);const me=(await registered.json()).data,organizationId=me.organization.id
  49 |  orgs.push(organizationId);users.push(me.user.id)
  50 |  const store=await db.store.findFirstOrThrow({where:{organizationId}}),register=await db.register.findFirstOrThrow({where:{storeId:store.id}})
  51 |  const shift=await db.shift.create({data:{registerId:register.id,organizationUserId:me.user.organizationUserId,openingCash:0}})
  52 |  const product=await db.product.create({data:{organizationId,name:'Owned smoke product',sku:randomUUID(),barcode:randomUUID(),unit:'dona',salePrice:10,costPrice:1}})
  53 |  const customer=await db.customer.create({data:{organizationId,fullName:'Owned smoke customer',phone:randomUUID()}}),supplier=await db.supplier.create({data:{organizationId,name:'Owned smoke supplier'}})
  54 |  const sale=await db.sale.create({data:{organizationId,storeId:store.id,registerId:register.id,shiftId:shift.id,cashierId:me.user.id,receiptNo:randomUUID(),status:'draft',subtotal:10,totalAmount:10}})
  55 |  const ticketResponse=await page.request.post('/api/support/tickets',{headers:{Origin:'https://localhost:3100'},data:{operationId:randomUUID(),title:'Owned route smoke ticket',description:'Synthetic internal browser route test',severity:'normal'}})
  56 |  expect(ticketResponse.ok()).toBe(true);const ticket=(await ticketResponse.json()).data
  57 |  const ids:Record<string,string>={products:product.id,customers:customer.id,suppliers:supplier.id,sales:sale.id,tickets:ticket.id}
  58 |  const paths=dashboardPages.map(file=>{const path=route(file),root=path.split('/')[1];if(path.includes('[id]')){expect(ids[root],path).toBeTruthy();return path.replace('[id]',ids[root])}return path})
  59 |  await visit(page,paths,'dashboard-pages-smoke.json',true)
  60 |  expect(await db.payment.count({where:{organizationId}})).toBe(0)
  61 |  expect(await db.inventoryMovement.count({where:{organizationId}})).toBe(0)
  62 | })
  63 | test('Every public page loads without a render exception and unauthenticated POS navigation returns to login',async({page})=>{
  64 |  test.setTimeout(60000)
  65 |  await visit(page,publicPages.map(route),'public-pages-smoke.json')
  66 |  await page.goto('/pos');await expect(page).toHaveURL(/\/login(?:\?|$)/)
  67 | })
  68 | 
```