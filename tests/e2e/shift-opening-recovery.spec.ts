import {test,expect} from '@playwright/test'
import {PrismaClient} from '@prisma/client'
import {randomUUID} from 'node:crypto'
const connection=new URL(process.env.DATABASE_URL??'')
if(connection.hostname!=='127.0.0.1'||connection.port!=='55439'||connection.pathname!=='/pos_test')throw Error('Isolated DB required')
const db=new PrismaClient(),orgs:string[]=[],users:string[]=[]
test.afterAll(async()=>{await db.organization.deleteMany({where:{id:{in:orgs}}});await db.user.deleteMany({where:{id:{in:users}}});await db.$disconnect()})
test('Shift opening retries failed handover loading and preserves original cash intent after lost ACK and reload',async({page})=>{
 const response=await page.request.post('/api/auth/register',{headers:{Origin:'https://localhost:3100'},data:{fullName:'Shift recovery owner',phone:'shift-recovery-'+randomUUID(),password:'test-only-password',organizationName:'Shift recovery business'}})
 expect(response.ok()).toBe(true)
 const me=(await(await page.request.get('/api/auth/me')).json()).data;orgs.push(me.organization.id);users.push(me.user.id)
 await page.goto('/pos')
 let failHandover=true
 await page.route(/\/api\/operations\/handover\?/,async route=>{if(failHandover){failHandover=false;await route.abort('failed')}else await route.continue()})
 await page.getByRole('button',{name:'Smenani ochish',exact:true}).click()
 const modal=page.getByRole('dialog',{name:'Yangi smena ochish',exact:true})
 await expect(modal.getByRole('alert')).toBeVisible()
 await expect(modal.getByRole('button',{name:'Smenani ochish: oldindan ko‘rish',exact:true})).toHaveCount(0)
 expect(await db.shift.count({where:{register:{store:{organizationId:me.organization.id}}}})).toBe(0)
 await modal.getByRole('button',{name:'Oldingi smenani qayta tekshirish',exact:true}).click()
 const cash=modal.getByLabel("Boshlang'ich naqd pul (so'm)",{exact:true})
 await expect(cash).toBeEnabled();await cash.fill('12345.67')
 await modal.getByLabel('Izoh (ixtiyoriy)',{exact:true}).fill('Original opening cash')
 await modal.getByRole('button',{name:'Smenani ochish: oldindan ko‘rish',exact:true}).click()
 await expect(modal.getByRole('status').filter({hasText:'Amalni tekshiring'})).toContainText('12345.67')
 let entered!:()=>void,release!:()=>void
 const started=new Promise<void>(resolve=>{entered=resolve}),gate=new Promise<void>(resolve=>{release=resolve})
 const bodies:Record<string,unknown>[]=[],ids:string[]=[];let lose=true
 await page.route('**/api/shifts',async route=>{
  if(route.request().method()!=='POST'){await route.continue();return}
  bodies.push(route.request().postDataJSON())
  if(lose){lose=false;const actual=await route.fetch();expect(actual.ok()).toBe(true);ids.push((await actual.json()).data.id);entered();await gate;await route.abort('failed')}
  else await route.continue()
 })
 page.on('dialog',async dialog=>{if(dialog.type()==='beforeunload')await dialog.accept();else await dialog.dismiss()})
 try{
  await modal.getByRole('button',{name:'Amalni tasdiqlash',exact:true}).click();await started
  await expect(cash).toBeDisabled();await expect(modal.getByLabel('Izoh (ixtiyoriy)',{exact:true})).toBeDisabled()
  await page.keyboard.press('Escape');await expect(modal).toBeVisible()
  await page.evaluate(()=>document.querySelector<HTMLAnchorElement>('a[href="/dashboard"]')!.click());await expect(page).toHaveURL(/\/pos$/)
 }finally{release()}
 await expect(modal.getByRole('alert')).toBeVisible()
 await expect(modal.getByRole('button',{name:'Original amalni qayta tekshirish',exact:true})).toBeVisible()
 await page.reload()
 await page.getByRole('button',{name:'Saqlangan amalni qayta tekshirish',exact:true}).click()
 await expect(page.getByRole('button',{name:'Saqlangan amalni qayta tekshirish',exact:true})).toHaveCount(0)
 expect(bodies).toHaveLength(2);expect(bodies[1]).toEqual(bodies[0]);expect(bodies[0].openingCash).toBe('12345.67')
 const shifts=await db.shift.findMany({where:{register:{store:{organizationId:me.organization.id}}}})
 expect(shifts).toHaveLength(1);expect(shifts[0].id).toBe(ids[0]);expect(shifts[0].openingCash.toString()).toBe('12345.67')
 expect(await db.operation.count({where:{organizationId:me.organization.id,type:'shift.open'}})).toBe(1)
 expect(await db.auditLog.count({where:{organizationId:me.organization.id,entityId:ids[0],action:'opened'}})).toBe(1)
 expect(await db.sale.count({where:{organizationId:me.organization.id}})).toBe(0)
})

test('Confirmed shift opening survives an older empty shift read and F9 cannot reopen the modal',async({page})=>{
 const response=await page.request.post('/api/auth/register',{headers:{Origin:'https://localhost:3100'},data:{fullName:'Shift race owner',phone:'shift-race-'+randomUUID(),password:'test-only-password',organizationName:'Shift race business'}})
 expect(response.ok()).toBe(true)
 const me=(await(await page.request.get('/api/auth/me')).json()).data;orgs.push(me.organization.id);users.push(me.user.id)
 let entered!:()=>void,release!:()=>void
 const started=new Promise<void>(resolve=>{entered=resolve}),gate=new Promise<void>(resolve=>{release=resolve});let held=false
 await page.route(url=>url.pathname==='/api/shifts'&&url.searchParams.get('status')==='open',async route=>{
  if(held){await route.continue();return}
  held=true;const actual=await route.fetch();expect(actual.ok()).toBe(true);expect((await actual.json()).data).toEqual([]);entered();await gate;await route.fulfill({response:actual})
 })
 await page.goto('/pos');await started
 try{
  await page.getByRole('button',{name:'Smenani ochish',exact:true}).click()
  const modal=page.getByRole('dialog',{name:'Yangi smena ochish',exact:true})
  await modal.getByRole('button',{name:'Smenani ochish: oldindan ko‘rish',exact:true}).click()
  await modal.getByRole('button',{name:'Amalni tasdiqlash',exact:true}).click()
  await expect(modal).toHaveCount(0)
  await expect(page.getByRole('button',{name:'Smenani ochish',exact:true})).toHaveCount(0)
  const staleResponse=page.waitForResponse(result=>new URL(result.url()).pathname==='/api/shifts'&&new URL(result.url()).searchParams.get('status')==='open')
  release();await staleResponse
  await page.keyboard.press('F9');await expect(page.getByRole('dialog')).toHaveCount(0)
  expect(await db.shift.count({where:{register:{store:{organizationId:me.organization.id}}}})).toBe(1)
  expect(await db.auditLog.count({where:{organizationId:me.organization.id,entityType:'Shift',action:'opened'}})).toBe(1)
 }finally{release()}
})
