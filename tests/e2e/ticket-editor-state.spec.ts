import {test,expect} from '@playwright/test'
import {PrismaClient} from '@prisma/client'
import {randomUUID} from 'node:crypto'
const connection=new URL(process.env.DATABASE_URL??'')
if(connection.hostname!=='127.0.0.1'||connection.port!=='55439'||connection.pathname!=='/pos_test')throw Error('Isolated DB required')
const db=new PrismaClient(),orgs:string[]=[],users:string[]=[]
test.afterAll(async()=>{await db.organization.deleteMany({where:{id:{in:orgs}}});await db.user.deleteMany({where:{id:{in:users}}});await db.$disconnect()})
test('ticket reply draft stays mounted through read failure and original reply recovery clears only acknowledged draft',async({page})=>{
 const headers={Origin:'https://localhost:3100'}
 expect((await page.request.post('/api/auth/register',{headers,data:{fullName:'Ticket editor owner',phone:'ticket-editor-'+randomUUID(),password:'test-only-password',organizationName:'Ticket editor state'}})).ok()).toBe(true)
 const me=(await(await page.request.get('/api/auth/me')).json()).data;orgs.push(me.organization.id);users.push(me.user.id)
 const response=await page.request.post('/api/support/tickets',{headers,data:{operationId:randomUUID(),title:'Original internal ticket',description:'Actual independent internal ticket',severity:'normal',diagnostics:{}}});expect(response.ok()).toBe(true);const ticket=(await response.json()).data,path='/tickets/'+ticket.id
 await page.goto(path);const command=page.locator('section[aria-label="Murojaat amali"]'),message=page.getByLabel('Javob yoki sabab',{exact:true});await message.fill('Independent reply draft')
 let prompts=0;page.on('dialog',async dialog=>{if(dialog.type()==='beforeunload')await dialog.accept();else{prompts++;await dialog.dismiss()}})
 await page.getByRole('link',{name:'Murojaatlar ro‘yxati',exact:true}).click();await expect(page).toHaveURL(new RegExp(path+'$'));expect(prompts).toBe(1)
 await page.route('**/api/support/tickets/'+ticket.id+'?*',route=>route.abort('failed'));await page.getByRole('button',{name:'Murojaatni yangilash',exact:true}).click();await expect(page.getByRole('button',{name:'Qayta urinish',exact:true})).toBeVisible();await expect(message).toHaveValue('Independent reply draft');await expect(command.getByRole('button',{name:'Murojaat amalini bajarish: oldindan ko‘rish',exact:true})).toBeDisabled()
 await page.unroute('**/api/support/tickets/'+ticket.id+'?*');await page.getByRole('button',{name:'Qayta urinish',exact:true}).click();await expect(message).toBeEnabled();await expect(message).toHaveValue('Independent reply draft')
 const bodies:string[]=[];let lost=false
 await page.route('**/api/support/tickets/'+ticket.id+'/commands',async route=>{bodies.push(route.request().postData()??'');const response=await route.fetch();if(!lost&&response.ok()){lost=true;await route.abort('failed')}else await route.fulfill({response})})
 await command.getByRole('button',{name:'Murojaat amalini bajarish: oldindan ko‘rish',exact:true}).click();await command.getByRole('button',{name:'Amalni tasdiqlash',exact:true}).click();await expect(command.getByRole('button',{name:'Original amalni qayta tekshirish',exact:true})).toBeVisible()
 await page.getByRole('button',{name:'Saqlangan amalni qayta tekshirish',exact:true}).click();await expect(page.getByRole('button',{name:'Saqlangan amalni qayta tekshirish',exact:true})).not.toBeVisible();await expect(message).toHaveValue('');expect(bodies).toHaveLength(2);expect(bodies[0]).toBe(bodies[1])
 expect(await db.supportTicketEvent.count({where:{ticketId:ticket.id}})).toBe(2);expect((await db.supportTicket.findUniqueOrThrow({where:{id:ticket.id}})).firstRespondedAt).toBe(null)
 expect(await db.inventoryMovement.count({where:{organizationId:me.organization.id}})).toBe(0)
})
