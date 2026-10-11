import {test,expect,type Page} from '@playwright/test';
import {PrismaClient} from '@prisma/client';
import {randomUUID} from 'node:crypto';
import {hashSync} from 'bcryptjs';
import {TOTP,URI} from 'otpauth';
const connection=new URL(process.env.DATABASE_URL??'');
if(connection.hostname!=='127.0.0.1'||connection.port!=='55439'||connection.pathname!=='/pos_test')throw new Error('Isolated database only');
const db=new PrismaClient(),organizations:string[]=[],users:string[]=[],password='roles-state-test-password';
test.afterAll(async()=>{await db.organization.deleteMany({where:{id:{in:organizations}}});await db.user.deleteMany({where:{id:{in:users}}});await db.$disconnect();});
async function owner(page:Page){
 expect((await page.request.post('/api/auth/register',{headers:{Origin:'https://localhost:3100'},data:{fullName:'Roles state owner',phone:'roles-state-'+randomUUID(),password,organizationName:'Roles state fixture'}})).ok()).toBe(true);
 const identity=(await(await page.request.get('/api/auth/me')).json()).data;
 organizations.push(identity.organization.id);users.push(identity.user.id);return identity;
}
async function authenticator(page:Page){
 const begin=await page.request.post('/api/auth/totp/enroll',{headers:{Origin:'https://localhost:3100'},data:{password}});expect(begin.ok()).toBe(true);
 const enrollment=(await begin.json()).data,totp=URI.parse(enrollment.provisioningUri) as TOTP;
 const previous=Math.floor(Date.now()/30000)-1;
 expect((await page.request.post('/api/auth/totp/confirm',{headers:{Origin:'https://localhost:3100'},data:{factorId:enrollment.factorId,code:totp.generate({timestamp:previous*30000})}})).ok()).toBe(true);
 let last=previous;
 return async()=>{
  const modal=page.getByRole('dialog',{name:'Muhim amalni tasdiqlash'});await expect(modal).toBeVisible();
  // Respect the real server's one-use counter and ±1 time window. Do not reset
  // factor state, disable MFA or fake a proof to shorten acceptance tests.
  while(last+1>Math.floor(Date.now()/30000)+1)await page.waitForTimeout(Math.min(1000,Math.max(1,last*30000-Date.now()+30)));
  const counter=Math.max(last+1,Math.floor(Date.now()/30000));
  await modal.getByLabel('Muhim amal uchun Authenticator kodi',{exact:true}).fill(totp.generate({timestamp:counter*30000}));
  await modal.getByRole('button',{name:'Amalni tasdiqlash',exact:true}).click();await expect(modal).toHaveCount(0);last=counter;
 };
}
async function profile(organizationId:string,actorId:string,name:string){return db.customRole.create({data:{organizationId,createdBy:actorId,name,baseRole:'admin',permissions:['GET /api/products','GET /api/sales']}});}
async function staff(organizationId:string,name:string,customRoleId?:string){
 const user=await db.user.create({data:{fullName:name,phone:'roles-staff-'+randomUUID(),passwordHash:hashSync(password,12)}});users.push(user.id);
 return db.organizationUser.create({data:{organizationId,userId:user.id,role:'admin',customRoleId}});
}

test('Unknown role and assignment acknowledgements retain independent immutable keys and replay once with real MFA',async({page})=>{
 test.setTimeout(150000);
 const identity=await owner(page),approve=await authenticator(page);
 const original=await profile(identity.organization.id,identity.user.id,'Original staff profile'),target=await profile(identity.organization.id,identity.user.id,'Replacement staff profile');
 const employee=await staff(identity.organization.id,'First roles staff',original.id),other=await staff(identity.organization.id,'Other roles staff');
 await page.goto('/roles');await page.getByRole('button',{name:'Rollarni yuklash',exact:true}).click();
 await page.getByRole('button',{name:'Yangi rol',exact:true}).click();
 await page.getByLabel('Nom',{exact:true}).fill('Unknown acknowledgement profile');
 await page.getByLabel('GET /api/products',{exact:true}).check();
 await page.getByLabel('Sabab',{exact:true}).fill('Reviewed role with interrupted acknowledgement');
 const roleBodies:string[]=[],assignmentBodies:string[]=[];let dropRole=true,dropAssignment=true;
 await page.route('**/api/roles',async route=>{
  if(route.request().method()!=='POST'){await route.continue();return;}
  roleBodies.push(route.request().postData()!);const response=await route.fetch();
  if(response.ok()&&dropRole){dropRole=false;await route.abort('failed');}else await route.fulfill({response});
 });
 const memberEndpoint='**/api/organizations/'+identity.organization.id+'/users/'+employee.id;
 await page.route(memberEndpoint,async route=>{
  if(route.request().method()!=='PUT'){await route.continue();return;}
  assignmentBodies.push(route.request().postData()!);const response=await route.fetch();
  if(response.ok()&&dropAssignment){dropAssignment=false;await route.abort('failed');}else await route.fulfill({response});
 });
 await page.getByRole('button',{name:'Saqlash',exact:true}).click();await approve();
 await expect(page.getByRole('button',{name:'Original rol amalini tekshirish',exact:true})).toBeEnabled();
 await expect(page.getByLabel('Nom',{exact:true})).toBeDisabled();
 const roleKey=JSON.parse(roleBodies[0]).operationId;
 await expect(page.getByRole('status').filter({hasText:'Rol amali natijasi'})).toContainText(roleKey);
 expect(await db.customRole.count({where:{organizationId:identity.organization.id,name:'Unknown acknowledgement profile'}})).toBe(1);
 await page.getByLabel('Xodim',{exact:true}).selectOption(employee.id);
 await expect(page.getByLabel('Ushbu sahifadagi profil',{exact:true})).toHaveValue(original.id);
 await expect(page.getByRole('button',{name:'Biriktirishni saqlash',exact:true})).toBeDisabled();
 await page.getByLabel('Ushbu sahifadagi profil',{exact:true}).selectOption(target.id);
 page.once('dialog',dialog=>dialog.dismiss());await page.getByLabel('Xodim',{exact:true}).selectOption(other.id);
 await expect(page.getByLabel('Xodim',{exact:true})).toHaveValue(employee.id);
 await expect(page.getByLabel('Ushbu sahifadagi profil',{exact:true})).toHaveValue(target.id);
 await page.getByRole('button',{name:'Biriktirishni saqlash',exact:true}).click();await approve();
 await expect(page.getByRole('button',{name:'Original biriktirish amalini tekshirish',exact:true})).toBeEnabled();
 const assignmentKey=JSON.parse(assignmentBodies[0]).operationId;expect(assignmentKey).not.toBe(roleKey);
 await expect(page.getByRole('status').filter({hasText:'Rol amali natijasi'})).toContainText(roleKey);
 await expect(page.getByRole('status').filter({hasText:'Biriktirish amali natijasi'})).toContainText(assignmentKey);
 await expect(page.getByLabel('Xodim',{exact:true})).toBeDisabled();
 page.once('dialog',dialog=>dialog.dismiss());await page.locator('a[href="/products"]').first().click();
 await expect(page).toHaveURL(/\/roles$/);
 await page.getByRole('button',{name:'Original rol amalini tekshirish',exact:true}).click();
 await expect(page.getByText('Rol saqlandi. Vakolat o‘zgargan xodimlar qayta kirishi kerak.',{exact:true})).toBeVisible();
 await expect(page.getByRole('status').filter({hasText:'Rol amali natijasi'})).toHaveCount(0);
 await expect(page.getByRole('status').filter({hasText:'Biriktirish amali natijasi'})).toContainText(assignmentKey);
 await page.getByRole('button',{name:'Original biriktirish amalini tekshirish',exact:true}).click();
 await expect(page.getByText('Profil biriktirildi; xodim qayta kirishi kerak.',{exact:true})).toBeVisible();
 expect(roleBodies).toHaveLength(3);expect(assignmentBodies).toHaveLength(3);
 expect(new Set(roleBodies).size).toBe(1);expect(new Set(assignmentBodies).size).toBe(1);
 expect(await db.operation.count({where:{organizationId:identity.organization.id,key:{in:[roleKey,assignmentKey]}}})).toBe(2);
 expect(await db.auditLog.count({where:{organizationId:identity.organization.id,action:'custom_role_created'}})).toBe(1);
 expect(await db.auditLog.count({where:{organizationId:identity.organization.id,entityId:employee.id,action:'membership_updated'}})).toBe(1);
 expect((await db.organizationUser.findUniqueOrThrow({where:{id:employee.id}})).customRoleId).toBe(target.id);
 await expect(page.getByRole('status').filter({hasText:'Saqlanmagan'})).toHaveCount(0);
});

test('Role editor preserves discarded drafts and a known revision conflict remains editable without a fake pending result',async({page})=>{
 const identity=await owner(page),existing=await profile(identity.organization.id,identity.user.id,'Existing state profile');
 await page.goto('/roles');
 await page.route('**/api/roles?**',route=>route.fulfill({status:503,contentType:'application/json',body:JSON.stringify({success:false,error:{code:'INTERNAL_ERROR',message:'Fixture role list unavailable'}})}));
 await page.getByRole('button',{name:'Rollarni yuklash',exact:true}).click();
 await expect(page.getByRole('alert').filter({hasText:'Fixture role list unavailable'})).toBeVisible();
 await page.unroute('**/api/roles?**');await page.getByRole('button',{name:'Rollarni yuklash',exact:true}).click();
 await page.getByRole('button',{name:'Tahrirlash',exact:true}).click();
 await page.getByLabel('GET /api/products',{exact:true}).uncheck();await page.getByLabel('GET /api/products',{exact:true}).check();
 await expect(page.getByRole('status').filter({hasText:'Saqlanmagan rol'})).toHaveCount(0);
 await page.getByLabel('Nom',{exact:true}).fill('Unsaved state profile');
 page.once('dialog',dialog=>dialog.dismiss());await page.getByRole('button',{name:'Yangi rol',exact:true}).click();
 await expect(page.getByLabel('Nom',{exact:true})).toHaveValue('Unsaved state profile');
 page.once('dialog',dialog=>dialog.dismiss());await page.getByRole('button',{name:'Bekor qilish',exact:true}).click();
 await expect(page.getByLabel('Nom',{exact:true})).toHaveValue('Unsaved state profile');
 await page.getByLabel('Sabab',{exact:true}).fill('Reviewed stale role edit');
 await page.route('**/api/roles/'+existing.id,route=>route.fulfill({status:409,contentType:'application/json',body:JSON.stringify({success:false,error:{code:'ROLE_REVISION_CHANGED',message:'Fixture stale revision'}})}));
 await page.getByRole('button',{name:'Saqlash',exact:true}).click();
 await expect(page.getByRole('alert').filter({hasText:'Fixture stale revision'})).toBeVisible();
 await expect(page.getByLabel('Nom',{exact:true})).toBeEnabled();
 await expect(page.getByLabel('Nom',{exact:true})).toHaveValue('Unsaved state profile');
 await expect(page.getByRole('button',{name:'Original rol amalini tekshirish',exact:true})).toHaveCount(0);
 expect(await db.operation.count({where:{organizationId:identity.organization.id,type:'users.role.update'}})).toBe(0);
 expect((await db.customRole.findUniqueOrThrow({where:{id:existing.id}})).name).toBe(existing.name);
 page.once('dialog',dialog=>dialog.accept());await page.getByRole('button',{name:'Bekor qilish',exact:true}).click();
 await expect(page.getByLabel('Nom',{exact:true})).toHaveCount(0);
});

test('Acknowledged role save remains saved when only the following list refresh fails',async({page})=>{
 const identity=await owner(page),approve=await authenticator(page);
 await page.goto('/roles');await page.getByRole('button',{name:'Rollarni yuklash',exact:true}).click();
 await page.getByRole('button',{name:'Yangi rol',exact:true}).click();
 await page.getByLabel('Nom',{exact:true}).fill('Acknowledged refresh profile');
 await page.getByLabel('GET /api/products',{exact:true}).check();await page.getByLabel('Sabab',{exact:true}).fill('Reviewed role with failed following read');
 await page.route('**/api/roles?**',route=>route.fulfill({status:503,contentType:'application/json',body:JSON.stringify({success:false,error:{code:'INTERNAL_ERROR',message:'Fixture following refresh unavailable'}})}));
 await page.getByRole('button',{name:'Saqlash',exact:true}).click();await approve();
 await expect(page.getByText('Rol saqlandi. Vakolat o‘zgargan xodimlar qayta kirishi kerak.',{exact:true})).toBeVisible();
 await expect(page.getByRole('alert').filter({hasText:'Amal saqlandi; ro‘yxat yangilanmadi'})).toBeVisible();
 await expect(page.getByLabel('Nom',{exact:true})).toHaveCount(0);
 expect(await db.customRole.count({where:{organizationId:identity.organization.id,name:'Acknowledged refresh profile'}})).toBe(1);
 expect(await db.operation.count({where:{organizationId:identity.organization.id,type:'users.role.create'}})).toBe(1);
 await page.unroute('**/api/roles?**');await page.getByRole('button',{name:'Rollarni yuklash',exact:true}).click();
 await expect(page.getByText(/Acknowledged refresh profile — Admin/)).toBeVisible();
});
