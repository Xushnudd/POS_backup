import {test,expect,type Page} from '@playwright/test'
import {PrismaClient} from '@prisma/client'
import {randomUUID} from 'node:crypto'
import {enrollCritical} from './critical-fixture'
const connection=new URL(process.env.DATABASE_URL??'')
if(connection.hostname!=='127.0.0.1'||connection.port!=='55439'||connection.pathname!=='/pos_test')throw Error('Isolated DB required')
const db=new PrismaClient(),orgs:string[]=[],users:string[]=[]
const headers={Origin:'https://localhost:3100'},password='test-only-password'
test.afterAll(async()=>{await db.organization.deleteMany({where:{id:{in:orgs}}});await db.user.deleteMany({where:{id:{in:users}}});await db.$disconnect()})
async function owner(page:Page){const phone='security-ack-'+randomUUID();expect((await page.request.post('/api/auth/register',{headers,data:{fullName:'Security ACK owner',phone,password,organizationName:'Security ACK state'}})).ok()).toBe(true);const me=(await(await page.request.get('/api/auth/me')).json()).data;orgs.push(me.organization.id);users.push(me.user.id);return {...me,phone}}
test('password ACK and one critical command survive failed profile read without storing credentials',async({page})=>{
 const me=await owner(page),critical=await enrollCritical(page,password),next='new-test-only-password';await page.goto('/security');await page.getByLabel('Joriy parol',{exact:true}).fill(password);await page.getByLabel('Yangi parol',{exact:true}).fill(next);await page.getByLabel('Yangi parolni tasdiqlash',{exact:true}).fill(next)
 let accepted=0,release!:()=>void;const gate=new Promise<void>(resolve=>{release=resolve}),bodies:string[]=[]
 await page.route('**/api/auth/change-password',async route=>{bodies.push(route.request().postData()??'');const response=await route.fetch();if(response.ok()){accepted++;await gate;}await route.fulfill({response})})
 await page.getByRole('button',{name:'Parolni yangilash',exact:true}).evaluate(button=>{(button as HTMLButtonElement).click();(button as HTMLButtonElement).click()});await critical.approve();await expect.poll(()=>accepted).toBe(1);await expect(page.getByLabel('Joriy parol',{exact:true})).toBeDisabled();expect(bodies).toHaveLength(2);expect(bodies[0]).toBe(bodies[1])
 expect(await page.evaluate(()=>JSON.stringify(Object.entries(localStorage)))).not.toContain(next)
 await page.route('**/api/auth/me',route=>route.abort('failed'));release();await expect(page).toHaveURL(/\/login$/);await page.unroute('**/api/auth/me')
 expect(await db.session.count({where:{userId:me.user.id,revokedAt:null}})).toBe(0);expect((await page.request.post('/api/auth/login',{headers,data:{phone:me.phone,password}})).status()).toBe(401);expect((await page.request.post('/api/auth/login',{headers,data:{phone:me.phone,password:next}})).ok()).toBe(true);expect(accepted).toBe(1);expect(JSON.stringify(await db.auditLog.findMany({where:{organizationId:me.organization.id}}))).not.toContain(next)
})
test('all-session logout admits one request and still leaves security after profile read failure',async({page})=>{
 const me=await owner(page);await page.goto('/security');let accepted=0,release!:()=>void;const gate=new Promise<void>(resolve=>{release=resolve})
 await page.route('**/api/auth/logout-all',async route=>{accepted++;const response=await route.fetch();expect(response.ok()).toBe(true);await gate;await route.fulfill({response})})
 await page.getByRole('button',{name:'Barcha sessiyalardan chiqish',exact:true}).evaluate(button=>{(button as HTMLButtonElement).click();(button as HTMLButtonElement).click()});await expect.poll(()=>accepted).toBe(1);await expect(page.getByRole('button',{name:'Parolni yangilash',exact:true})).toBeDisabled();await page.route('**/api/auth/me',route=>route.abort('failed'));release();await expect(page).toHaveURL(/\/login$/);expect(await db.session.count({where:{userId:me.user.id,revokedAt:null}})).toBe(0);expect(accepted).toBe(1)
})
