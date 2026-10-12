import {test,expect} from '@playwright/test'
import {PrismaClient} from '@prisma/client'
import {randomUUID} from 'node:crypto'
const connection=new URL(process.env.DATABASE_URL??'')
if(connection.hostname!=='127.0.0.1'||connection.port!=='55439'||connection.pathname!=='/pos_test')throw Error('Isolated DB required')
const db=new PrismaClient(),orgs:string[]=[],users:string[]=[]
test.afterAll(async()=>{await db.organization.deleteMany({where:{id:{in:orgs}}});await db.user.deleteMany({where:{id:{in:users}}});await db.$disconnect()})
const origin={Origin:'https://localhost:3100'}
async function account(page:import('@playwright/test').Page){
 const phone='auth-form-'+randomUUID(),password='test-only-password'
 const response=await page.request.post('/api/auth/register',{headers:origin,data:{fullName:'Auth form owner',phone,password,organizationName:'Auth form business'}})
 expect(response.ok()).toBe(true)
 const me=(await(await page.request.get('/api/auth/me')).json()).data
 orgs.push(me.organization.id);users.push(me.user.id)
 expect((await page.request.post('/api/auth/logout',{headers:origin,data:{}})).ok()).toBe(true)
 return {phone,password}
}
for(const kind of ['login','register','forgot-password','reset-password'] as const)test(`${kind} guards dirty and in-flight state, rejects same-tick duplicate submit and preserves fields on real failure`,async({page})=>{
 const credentials=kind==='login'||kind==='register'?await account(page):null
 await page.goto('/'+kind)
 const fields:{label:string;value:string}[]=kind==='login'?[
  {label:'Telefon raqam',value:credentials!.phone},{label:'Parol',value:'wrong-test-password'}
 ]:kind==='register'?[
  {label:'Ism va Familiya',value:'New attempted owner'},{label:'Telefon raqam',value:credentials!.phone},{label:"Do'kon yoki Biznes nomi",value:'Duplicate registration'}, {label:'Parol (8–72 ta belgi)',value:'new-test-password'}
 ]:kind==='forgot-password'?[
  {label:'Telefon yoki e-mail',value:'not-registered@example.test'}
 ]:[{label:'Tiklash tokeni',value:'x'.repeat(43)},{label:'Yangi parol',value:'test-new-password'},{label:'Yangi parolni takrorlang',value:'test-new-password'}]
 for(const field of fields)await page.getByLabel(field.label,{exact:true}).fill(field.value)
 await expect(page.getByRole('status').filter({hasText:'Saqlanmagan forma'})).toBeVisible()
 let prompts=0
 page.on('dialog',async dialog=>{prompts++;await dialog.dismiss()})
 const leave=kind==='login'?'/forgot-password':'/login'
 await page.locator(`a[href="${leave}"]`).last().click()
 expect(prompts).toBe(1);await expect(page).toHaveURL(new RegExp('/'+kind+'$'))
 for(const field of fields)await expect(page.getByLabel(field.label,{exact:true})).toHaveValue(field.value)
 const path=kind==='login'||kind==='register'?'/api/auth/'+kind:'/api/auth/password-reset/'+(kind==='forgot-password'?'request':'complete')
 let entered!:()=>void,release!:()=>void,requests=0
 const started=new Promise<void>(resolve=>{entered=resolve}),gate=new Promise<void>(resolve=>{release=resolve})
 await page.route('**'+path,async route=>{if(route.request().method()!=='POST'){await route.continue();return}requests++;const response=await route.fetch();expect(response.ok()).toBe(false);entered();await gate;await route.fulfill({response})})
 try{
  await page.locator('form').evaluate(form=>{const target=form as HTMLFormElement;target.requestSubmit();target.requestSubmit()})
  await started
  await expect(page.getByRole('status').filter({hasText:'Server tasdig‘i'})).toBeVisible()
  for(const field of fields)await expect(page.getByLabel(field.label,{exact:true})).toBeDisabled()
  await page.locator(`a[href="${leave}"]`).last().click()
  expect(prompts).toBe(1);await expect(page).toHaveURL(new RegExp('/'+kind+'$'))
 }finally{release()}
 await expect(page.getByRole('status').filter({hasText:'Server tasdig‘i'})).toHaveCount(0)
 for(const field of fields){await expect(page.getByLabel(field.label,{exact:true})).toBeEnabled();await expect(page.getByLabel(field.label,{exact:true})).toHaveValue(field.value)}
 expect(requests).toBe(1)
 await expect(page.locator('form').locator('..').getByRole('alert').first()).toBeVisible()
 if(kind==='register')expect(await db.user.count({where:{phone:credentials!.phone}})).toBe(1)
})
test('successful login uses authenticated role ACK and does not require a second me request',async({page})=>{
 const credentials=await account(page)
 await page.goto('/login')
 await page.getByLabel('Telefon raqam',{exact:true}).fill(credentials.phone)
 await page.getByLabel('Parol',{exact:true}).fill(credentials.password)
 // The initial anonymous bootstrap has completed; any subsequent me lookup fails.
 await page.route('**/api/auth/me',route=>route.abort('failed'))
 await page.getByRole('button',{name:'Kirish',exact:true}).click()
 await expect(page).toHaveURL(/\/dashboard$/)
 expect((await page.request.get('/api/auth/me')).ok()).toBe(true)
})

test('invalid invitation preserves credential draft, blocks dirty and busy exit and sends one same-tick request',async({page})=>{
 await page.goto('/invite#'+'x'.repeat(43))
 await page.getByLabel('To‘liq ism',{exact:true}).fill('Invited test user')
 await page.getByLabel('Yangi parol',{exact:true}).fill('test-invited-password')
 let prompts=0;page.on('dialog',async dialog=>{prompts++;await dialog.dismiss()})
 await page.getByRole('link',{name:'Tizimga kirish',exact:true}).click();expect(prompts).toBe(1);await expect(page).toHaveURL(/\/invite#/)
 let entered!:()=>void,release!:()=>void,requests=0;const started=new Promise<void>(resolve=>{entered=resolve}),gate=new Promise<void>(resolve=>{release=resolve})
 await page.route('**/api/auth/invitations/accept',async route=>{requests++;const response=await route.fetch();expect(response.ok()).toBe(false);entered();await gate;await route.fulfill({response})})
 try{await page.locator('form').evaluate(form=>{(form as HTMLFormElement).requestSubmit();(form as HTMLFormElement).requestSubmit()});await started;await expect(page.getByLabel('Yangi parol',{exact:true})).toBeDisabled();await page.getByRole('link',{name:'Tizimga kirish',exact:true}).click();expect(prompts).toBe(1);await expect(page).toHaveURL(/\/invite#/);}finally{release()}
 await expect(page.getByRole('alert').filter({hasText:/taklif|invitation|yaroq|mavjud/i}).first()).toBeVisible()
 await expect(page.getByLabel('To‘liq ism',{exact:true})).toHaveValue('Invited test user')
 await expect(page.getByLabel('Yangi parol',{exact:true})).toBeEnabled();await expect(page.getByLabel('Yangi parol',{exact:true})).toHaveValue('test-invited-password');expect(requests).toBe(1)
})
