import {test,expect} from '@playwright/test'
import {PrismaClient} from '@prisma/client'
import {randomUUID} from 'node:crypto'
import {enrollCritical} from './critical-fixture'
const connection=new URL(process.env.DATABASE_URL??'')
if(connection.hostname!=='127.0.0.1'||connection.port!=='55439'||connection.pathname!=='/pos_test')throw Error('Isolated DB required')
const db=new PrismaClient(),orgs:string[]=[],users:string[]=[]
test.afterAll(async()=>{await db.organization.deleteMany({where:{id:{in:orgs}}});await db.user.deleteMany({where:{id:{in:users}}});await db.$disconnect()})
test('offline unlock and partial owner drafts are guarded; policy ACK resets only its own draft',async({page})=>{
 const headers={Origin:'https://localhost:3100'}
 expect((await page.request.post('/api/auth/register',{headers,data:{fullName:'Offline editor owner',phone:'offline-editor-'+randomUUID(),password:'test-only-password',organizationName:'Offline editor state'}})).ok()).toBe(true)
 const me=(await(await page.request.get('/api/auth/me')).json()).data;orgs.push(me.organization.id);users.push(me.user.id)
 const critical=await enrollCritical(page,'test-only-password');await page.goto('/pos/offline');await expect(page.getByRole('status').filter({hasText:'Offline ma’lumoti yuklanmoqda'})).not.toBeVisible()
 const unlock=page.getByLabel('Offline unlock iborasi (serverga yuborilmaydi)',{exact:true});await unlock.fill('short')
 let prompts=0;page.on('dialog',async dialog=>{if(dialog.type()==='beforeunload')await dialog.accept();else{prompts++;await dialog.dismiss()}})
 await page.getByRole('link',{name:'POSga qaytish',exact:true}).click();await expect(page).toHaveURL(/\/pos\/offline$/);expect(prompts).toBe(1);await unlock.fill('')
 const max=page.getByLabel('Filialning jami hal qilinmagan offline summasi limiti',{exact:true}),cancel=page.getByLabel('Offline natijani hal qilish sababi',{exact:true});await max.fill('2');await cancel.fill('Independent cancel draft')
 await page.getByRole('link',{name:'POSga qaytish',exact:true}).click();await expect(page).toHaveURL(/\/pos\/offline$/);expect(prompts).toBe(2)
 await page.getByLabel('Offline naqdga ruxsat berish',{exact:true}).check();await max.fill('25');await page.getByLabel('Offline ruxsat muddati (30–300 soniya)',{exact:true}).fill('300');await page.getByLabel('Offline siyosat sababi',{exact:true}).fill('Verified bounded offline policy')
 let entered!:()=>void,release!:()=>void;const started=new Promise<void>(resolve=>{entered=resolve}),held=new Promise<void>(resolve=>{release=resolve});let posts=0
 await page.route('**/api/offline-cash/policy',async route=>{const response=await route.fetch();if(response.ok()){posts++;entered();await held;}await route.fulfill({response})})
 await page.getByRole('button',{name:'Offline siyosatni yozish: oldindan ko‘rish',exact:true}).click();await page.getByRole('button',{name:'Amalni tasdiqlash',exact:true}).evaluate(button=>{(button as HTMLButtonElement).click();(button as HTMLButtonElement).click()});await critical.approve();await started
 await expect(max).toBeDisabled();await expect(cancel).toBeDisabled();await expect(unlock).toBeDisabled();await page.getByRole('link',{name:'POSga qaytish',exact:true}).click();await expect(page).toHaveURL(/\/pos\/offline$/);expect(prompts).toBe(2)
 release();await expect(max).toHaveValue('');await expect(cancel).toHaveValue('Independent cancel draft');await expect(page.getByText(/Joriy siyosat: Yoqilgan/)).toBeVisible();expect(posts).toBe(1)
 await page.route('**/api/offline-cash?*',route=>route.abort('failed'));await page.getByRole('button',{name:'Qayta yuklash',exact:true}).last().click();await expect(page.getByRole('button',{name:'Offline ma’lumotini qayta yuklash',exact:true})).toBeVisible();await expect(cancel).toHaveValue('Independent cancel draft');await expect(page.getByText(/Joriy siyosat: Yoqilgan/)).toBeVisible()
 await page.unroute('**/api/offline-cash?*');await page.getByRole('button',{name:'Offline ma’lumotini qayta yuklash',exact:true}).click();await expect(page.getByRole('button',{name:'Offline ma’lumotini qayta yuklash',exact:true})).not.toBeVisible();await expect(cancel).toHaveValue('Independent cancel draft')
 await page.getByRole('link',{name:'POSga qaytish',exact:true}).click();await expect(page).toHaveURL(/\/pos\/offline$/);expect(prompts).toBe(3)
 expect(await db.offlineCashLease.count({where:{organizationId:me.organization.id}})).toBe(0);expect(await db.payment.count({where:{sale:{organizationId:me.organization.id}}})).toBe(0)
 const local=await page.evaluate(()=>JSON.stringify({...localStorage}));expect(local).not.toContain('short')
})
