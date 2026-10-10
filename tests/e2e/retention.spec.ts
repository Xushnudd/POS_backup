import {test,expect} from '@playwright/test'
import {PrismaClient} from '@prisma/client'
import {randomUUID} from 'node:crypto'
const connection=new URL(process.env.DATABASE_URL??'');if(connection.hostname!=='127.0.0.1'||connection.port!=='55439'||connection.pathname!=='/pos_test')throw new Error('Isolated retention browser DB only')
const db=new PrismaClient(),orgs:string[]=[],users:string[]=[]
const origin={Origin:'https://localhost:3100'}
test.afterAll(async()=>{await db.organization.deleteMany({where:{id:{in:orgs}}});await db.user.deleteMany({where:{id:{in:users}}});await db.$disconnect()})
test('Retention settings require actual platform authority and recover original lost acknowledgement without another version',async({page})=>{
 const registration=await page.request.post('/api/auth/register',{headers:origin,data:{fullName:'Retention owner',phone:'retention-'+randomUUID(),password:'test-only-password',organizationName:'Retention browser business'}});expect(registration.ok()).toBe(true)
 const me=(await(await page.request.get('/api/auth/me')).json()).data;orgs.push(me.organization.id);users.push(me.user.id)
 const original=await db.retentionPolicy.findUniqueOrThrow({where:{key:'default'},include:{currentVersion:true}})
 await page.goto('/billing');const panel=page.getByRole('region',{name:'Ma’lumotlarni saqlash siyosati'})
 await expect(panel).toContainText('Avtomatik o‘chirish yoqilmagan')
 await expect(panel.getByRole('button',{name:'Saqlash siyosatini saqlash: oldindan ko‘rish',exact:true})).toHaveCount(0)
 await db.platformOperator.create({data:{userId:me.user.id,role:'platform_admin'}})
 try{
  await page.reload()
  await expect(panel.getByRole('button',{name:'Saqlash siyosatini saqlash: oldindan ko‘rish',exact:true})).toBeVisible()
  await panel.getByLabel('Obuna tugagandan keyingi saqlash reja kunlari',{exact:true}).fill('120')
  await panel.getByLabel('Backup uchun reja kunlari',{exact:true}).fill('14')
  await panel.getByLabel('Saqlash siyosati o‘zgartirish sababi',{exact:true}).fill('Reviewed browser retention update')
  let originalBody='',retryBody=''
  await page.route('**/api/billing/retention',async route=>{if(route.request().method()==='POST'){originalBody=route.request().postData()??'';await route.fetch();await route.abort('failed')}else await route.continue()})
  await panel.getByRole('button',{name:'Saqlash siyosatini saqlash: oldindan ko‘rish',exact:true}).click()
  await panel.getByRole('button',{name:'Amalni tasdiqlash',exact:true}).click()
  await expect(panel.getByRole('alert')).toBeVisible()
  await expect.poll(async()=>{const policy=await db.retentionPolicy.findUniqueOrThrow({where:{key:'default'},include:{currentVersion:true}});return policy.currentVersion.version}).toBe(original.currentVersion.version+1)
  await page.unroute('**/api/billing/retention');await page.reload()
  await expect(panel.getByRole('button',{name:'Original amalni qayta tekshirish',exact:true})).toBeVisible()
  await page.route('**/api/billing/retention',async route=>{if(route.request().method()==='POST')retryBody=route.request().postData()??'';await route.continue()})
  await panel.getByRole('button',{name:'Original amalni qayta tekshirish',exact:true}).click()
  await expect(panel.getByRole('button',{name:'Original amalni qayta tekshirish',exact:true})).toHaveCount(0)
  expect(JSON.parse(retryBody)).toEqual(JSON.parse(originalBody))
  const policy=await db.retentionPolicy.findUniqueOrThrow({where:{key:'default'},include:{currentVersion:true}})
  expect(policy.currentVersion.version).toBe(original.currentVersion.version+1);expect(policy.currentVersion.expiredSubscriptionDays).toBe(120)
  expect(await db.auditLog.count({where:{organizationId:me.organization.id,action:'retention_policy_published'}})).toBe(1)
  expect(await db.sale.count({where:{organizationId:me.organization.id}})).toBe(0)
  await expect(panel).toContainText('Huquqiy toifalar va muddatlar yakuniy tasdiqlanmagan')
 }finally{
  await page.unroute('**/api/billing/retention')
  const current=await db.retentionPolicy.findUniqueOrThrow({where:{key:'default'}})
  if(current.currentVersionId!==original.currentVersionId){const p=original.currentVersion;const restore=await page.request.post('/api/billing/retention',{headers:origin,data:{operationId:randomUUID(),expectedVersionId:current.currentVersionId,expiredSubscriptionDays:p.expiredSubscriptionDays,closureCancellationDays:p.closureCancellationDays,auditRetentionDays:p.auditRetentionDays,technicalLogRetentionDays:p.technicalLogRetentionDays,backupRetentionDays:p.backupRetentionDays,proposedFinancialRetentionYears:p.proposedFinancialRetentionYears,reason:'Restore isolated browser retention settings'}});expect(restore.ok()).toBe(true)}
 }
})
