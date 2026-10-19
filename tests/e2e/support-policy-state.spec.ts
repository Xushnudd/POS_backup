import {test,expect,type Page} from '@playwright/test'
import {PrismaClient} from '@prisma/client'
import {randomUUID} from 'node:crypto'
import {enrollCritical} from './critical-fixture'
const connection=new URL(process.env.DATABASE_URL??'')
if(connection.hostname!=='127.0.0.1'||connection.port!=='55439'||connection.pathname!=='/pos_test')throw Error('Isolated DB required')
const db=new PrismaClient(),orgs:string[]=[],users:string[]=[]
const headers={Origin:'https://localhost:3100'}
test.afterAll(async()=>{await db.organization.deleteMany({where:{id:{in:orgs}}});/* Published policy versions are immutable; retain synthetic history in the isolated DB. */await db.user.deleteMany({where:{id:{in:users}}});await db.$disconnect()})
async function admin(page:Page){expect((await page.request.post('/api/auth/register',{headers,data:{fullName:'Support policy operator',phone:'support-policy-'+randomUUID(),password:'test-only-password',organizationName:'Policy draft state'}})).ok()).toBe(true);const me=(await(await page.request.get('/api/auth/me')).json()).data;orgs.push(me.organization.id);users.push(me.user.id);await db.platformOperator.create({data:{userId:me.user.id,role:'platform_admin'}});return me}
test('raw support hours and separate ticket draft survive a newer policy version and failed read',async({page})=>{
 const me=await admin(page),critical=await enrollCritical(page,'test-only-password'),initial=(await(await page.request.get('/api/support/policy')).json()).data
 await page.goto('/tickets');const form=page.locator('section[aria-label="Support ish tartibini sozlash"]'),opening=form.getByLabel('Ochilish vaqti (HH:MM)',{exact:true})
 await opening.fill('bad-one');await form.getByLabel('Sabab',{exact:true}).fill('Unpublished raw draft')
 let prompts=0;page.on('dialog',async dialog=>{if(dialog.type()==='beforeunload')await dialog.accept();else{prompts++;await dialog.dismiss()}})
 await page.getByRole('link',{name:'POS Kassa',exact:true}).click();await expect(page).toHaveURL(/\/tickets$/);expect(prompts).toBe(1)
 const published=await critical.post('/api/support/policy',{operationId:randomUUID(),timezone:initial.timezone,weekdays:initial.weekdays,opensMinute:initial.opensMinute,closesMinute:initial.closesMinute,firstResponseMinutes:initial.firstResponseMinutes,escalationMinutes:initial.escalationMinutes,reason:'Independent actual version'});expect(published.ok()).toBe(true)
 await page.getByRole('button',{name:'Murojaatlar va tartibni yangilash',exact:true}).click();await expect(form.getByRole('button',{name:'Joriy ish tartibini draftga olish',exact:true})).toBeVisible();await expect(opening).toHaveValue('bad-one');await expect(form.getByLabel('Sabab',{exact:true})).toHaveValue('Unpublished raw draft')
 await opening.fill('bad-two');const ticket=page.locator('section[aria-label="Yangi murojaat"]');await ticket.getByLabel('Mavzu',{exact:true}).fill('Independent ticket title')
 await page.route('**/api/support/policy',async route=>{if(route.request().method()==='GET')await route.abort('failed');else await route.continue()});await page.getByRole('button',{name:'Murojaatlar va tartibni yangilash',exact:true}).click();await expect(page.getByRole('button',{name:'Qayta urinish',exact:true})).toBeVisible();await expect(opening).toHaveValue('bad-two');await expect(form.getByRole('button',{name:'Support tartibini saqlash: oldindan ko‘rish',exact:true})).toBeDisabled()
 await page.unroute('**/api/support/policy');await page.getByRole('button',{name:'Qayta urinish',exact:true}).click();await expect(opening).toBeEnabled();await expect(opening).toHaveValue('bad-two')
 await opening.fill('09:15');await form.getByRole('button',{name:'Support tartibini saqlash: oldindan ko‘rish',exact:true}).click();await form.getByRole('button',{name:'Amalni tasdiqlash',exact:true}).click();await critical.approve();await expect(form.getByLabel('Sabab',{exact:true})).toHaveValue('');await expect(ticket.getByLabel('Mavzu',{exact:true})).toHaveValue('Independent ticket title')
 expect(await db.supportPolicyVersion.count({where:{createdBy:me.user.id}})).toBe(2);expect(await db.supportTicket.count({where:{organizationId:me.organization.id}})).toBe(0)
})
test('failed operator refresh retains assignment draft and prevents submitting stale or empty assignment',async({page})=>{
 const me=await admin(page),created=await page.request.post('/api/support/tickets',{headers,data:{operationId:randomUUID(),title:'Assignment read state',description:'Internal assignment draft test',severity:'normal',diagnostics:{}}});expect(created.ok()).toBe(true);const ticket=(await created.json()).data
 await page.goto('/tickets/'+ticket.id+'?scope=platform');const form=page.locator('section[aria-label="Murojaat amali"]');await expect(form.getByRole('option',{name:'Mas’ul',exact:true})).toBeEnabled();await form.getByLabel('Murojaat amali',{exact:true}).selectOption('assignment');await form.getByLabel('Mas’ul',{exact:true}).selectOption(me.user.id);await form.getByLabel('Javob yoki sabab',{exact:true}).fill('Independent assignment reason')
 await page.route('**/api/support/tickets/operators',route=>route.abort('failed'));await page.getByRole('button',{name:'Murojaatni yangilash',exact:true}).click();await expect(page.getByRole('alert').filter({hasText:'mas’ul biriktirishdan oldin'})).toBeVisible();await expect(form.getByLabel('Mas’ul',{exact:true})).toHaveValue(me.user.id);await expect(form.getByLabel('Javob yoki sabab',{exact:true})).toHaveValue('Independent assignment reason');await expect(form.getByRole('button',{name:'Murojaat amalini bajarish: oldindan ko‘rish',exact:true})).toBeDisabled()
 await page.unroute('**/api/support/tickets/operators');await page.getByRole('button',{name:'Murojaatni yangilash',exact:true}).click();await expect(form.getByRole('button',{name:'Murojaat amalini bajarish: oldindan ko‘rish',exact:true})).toBeEnabled();await expect(form.getByLabel('Mas’ul',{exact:true})).toHaveValue(me.user.id)
 expect((await db.supportTicket.findUniqueOrThrow({where:{id:ticket.id}})).assignedTo).toBeNull();expect(await db.supportTicketEvent.count({where:{ticketId:ticket.id}})).toBe(1)
})
