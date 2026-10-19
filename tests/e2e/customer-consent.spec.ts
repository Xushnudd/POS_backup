import {test,expect,type Page} from '@playwright/test';
import {PrismaClient} from '@prisma/client';
import {randomUUID} from 'node:crypto';

const connection=new URL(process.env.DATABASE_URL??'');
if(connection.hostname!=='127.0.0.1'||connection.port!=='55439'||connection.pathname!=='/pos_test')throw Error('Isolated pos_test only');
const db=new PrismaClient(),orgs:string[]=[],users:string[]=[];
const headers={Origin:'https://localhost:3100'};
test.afterAll(async()=>{await db.organization.deleteMany({where:{id:{in:orgs}}});await db.user.deleteMany({where:{id:{in:users}}});await db.$disconnect();});
async function fixture(page:Page){
 expect((await page.request.post('/api/auth/register',{headers,data:{fullName:'Consent browser owner',phone:'consent-browser-'+randomUUID(),password:'test-only-password',organizationName:'Consent browser fixture'}})).ok()).toBe(true);
 const me=(await(await page.request.get('/api/auth/me')).json()).data;
 orgs.push(me.organization.id);users.push(me.user.id);
 const customer=await db.customer.create({data:{organizationId:me.organization.id,fullName:'Consent browser customer',phone:randomUUID()}});
 const path='/api/customers/'+customer.id+'/consents';
 await page.goto('/customers/'+customer.id);
 await expect(page.getByLabel('Rozilik dalilining identifikatori',{exact:true})).toBeEnabled();
 return {orgId:me.organization.id,customer,path};
}
async function fill(page:Page){
 await page.getByLabel('Rozilik qarori',{exact:true}).selectOption('grant');
 await page.getByLabel('Rozilik dalilining identifikatori',{exact:true}).fill('document:browser-synthetic');
 await page.getByLabel('Rozilik matni versiyasi',{exact:true}).fill('synthetic-v1');
}
async function submit(page:Page){
 await page.getByRole('button',{name:'Rozilik qarorini saqlash: oldindan ko‘rish',exact:true}).click();
 await page.getByRole('button',{name:'Amalni tasdiqlash',exact:true}).click();
}
const competing=(expectedRevision=0)=>({operationId:randomUUID(),expectedRevision,purpose:'marketing',channel:'email',granted:true,source:'written',evidenceRef:'document:competing-synthetic',policyVersion:'synthetic-v1'});

test('Empty consent evidence remains editable; confirmation requires valid input and lost success ACK replays exactly one event',async({page})=>{
 const f=await fixture(page),preview=page.getByRole('button',{name:'Rozilik qarorini saqlash: oldindan ko‘rish',exact:true});
 await expect(preview).toBeDisabled();
 await page.getByLabel('Rozilik dalilining identifikatori',{exact:true}).fill('invalid reference');
 await expect(page.getByLabel('Rozilik matni versiyasi',{exact:true})).toBeEnabled();
 await expect(preview).toBeDisabled();await fill(page);await expect(preview).toBeEnabled();
 let lost=false;const bodies:string[]=[];
 await page.route('**'+f.path,async route=>{
  if(route.request().method()!=='POST')return route.continue();
  bodies.push(route.request().postData()!);const response=await route.fetch();
  if(response.ok()&&!lost){lost=true;await route.abort('failed');}else await route.fulfill({response});
 });
 await submit(page);await expect.poll(()=>lost).toBe(true);
 await expect(page.getByRole('button',{name:'Original amalni qayta tekshirish',exact:true})).toBeEnabled();
 await page.reload();await page.getByRole('button',{name:'Original amalni qayta tekshirish',exact:true}).click();
 await expect(page.getByRole('button',{name:'Original amalni qayta tekshirish',exact:true})).toHaveCount(0);
 expect(bodies.length).toBe(2);expect(new Set(bodies).size).toBe(1);
 expect(await db.consentEvent.count({where:{customerId:f.customer.id}})).toBe(1);
 expect(await db.auditLog.count({where:{organizationId:f.orgId,entityType:'ConsentEvent'}})).toBe(1);
 await fill(page);await page.getByLabel('Rozilik qarori',{exact:true}).selectOption('withdraw');
 await submit(page);await expect.poll(()=>db.consentEvent.count({where:{customerId:f.customer.id}})).toBe(2);
 expect((await db.consentEvent.findFirstOrThrow({where:{customerId:f.customer.id},orderBy:{revision:'desc'}})).granted).toBe(false);
});

test('Concurrent consent revision rejection refreshes history and permits a fresh reviewed decision',async({page})=>{
 const f=await fixture(page);await fill(page);
 expect((await page.request.post(f.path,{headers,data:competing()})).ok()).toBe(true);
 const bodies:string[]=[];await page.route('**'+f.path,async route=>{if(route.request().method()==='POST')bodies.push(route.request().postData()!);await route.continue();});
 await submit(page);
 await expect(page.getByLabel('Rozilik dalilining identifikatori',{exact:true})).toBeEnabled();
 await expect(page.getByLabel('Rozilik dalilining identifikatori',{exact:true})).toHaveValue('document:browser-synthetic');
 await expect(page.getByRole('button',{name:'Original amalni qayta tekshirish',exact:true})).toHaveCount(0);
 await submit(page);await expect.poll(()=>db.consentEvent.count({where:{customerId:f.customer.id}})).toBe(2);
 expect(bodies.length).toBe(2);
 expect(JSON.parse(bodies[0]).expectedRevision).toBe(0);expect(JSON.parse(bodies[1]).expectedRevision).toBe(1);
 expect(JSON.parse(bodies[0]).operationId).not.toBe(JSON.parse(bodies[1]).operationId);
});

test('Recovered stale consent discards only a definitive rollback; unknown conflicts retain the original operation',async({page})=>{
 const f=await fixture(page);await fill(page);
 expect((await page.request.post(f.path,{headers,data:competing()})).ok()).toBe(true);
 let lost=false,unknown=true;const bodies:string[]=[];
 await page.route('**'+f.path,async route=>{
  if(route.request().method()!=='POST')return route.continue();
  bodies.push(route.request().postData()!);
  if(!lost){const response=await route.fetch();expect(response.status()).toBe(409);lost=true;return route.abort('failed');}
  if(unknown)return route.fulfill({status:409,contentType:'application/json',body:JSON.stringify({success:false,error:{code:'CONCURRENT_CONFLICT',message:'Synthetic transient conflict'}})});
  return route.continue();
 });
 await submit(page);await expect.poll(()=>lost).toBe(true);
 await page.reload();const retry=page.getByRole('button',{name:'Original amalni qayta tekshirish',exact:true});await retry.click();
 await expect(retry).toBeEnabled();await expect(page.getByLabel('Rozilik dalilining identifikatori',{exact:true})).toBeDisabled();
 expect(await db.consentEvent.count({where:{customerId:f.customer.id}})).toBe(1);
 unknown=false;await retry.click();await expect(retry).toHaveCount(0);
 await expect(page.getByLabel('Rozilik dalilining identifikatori',{exact:true})).toBeEnabled();
 expect(new Set(bodies).size).toBe(1);expect(bodies.length).toBe(3);
 await fill(page);await page.getByLabel('Rozilik qarori',{exact:true}).selectOption('withdraw');await submit(page);
 await expect.poll(()=>db.consentEvent.count({where:{customerId:f.customer.id}})).toBe(2);
});
