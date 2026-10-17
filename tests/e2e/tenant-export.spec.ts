import {test,expect} from '@playwright/test'
import {PrismaClient} from '@prisma/client'
import {randomUUID,createHash} from 'node:crypto'
import {execFileSync} from 'node:child_process'
import {readFileSync} from 'node:fs'
const connection=new URL(process.env.DATABASE_URL??'');if(connection.hostname!=='127.0.0.1'||connection.port!=='55439'||connection.pathname!=='/pos_test')throw new Error('Isolated export browser DB only')
const db=new PrismaClient(),orgs:string[]=[],users:string[]=[]
test.afterAll(async()=>{await db.organization.deleteMany({where:{id:{in:orgs}}});await db.user.deleteMany({where:{id:{in:users}}});await db.$disconnect()})
test('Owner recovers original tenant export enqueue after lost ACK and downloads an exact manifest from the production worker',async({page})=>{
 expect((await page.request.post('/api/auth/register',{headers:{Origin:'https://localhost:3100'},data:{fullName:'Archive owner',phone:'archive-'+randomUUID(),password:'test-only-password',organizationName:'Tenant archive browser'}})).ok()).toBe(true)
 const me=(await(await page.request.get('/api/auth/me')).json()).data;orgs.push(me.organization.id);users.push(me.user.id)
 await db.product.create({data:{organizationId:me.organization.id,name:'Exact archive item',sku:randomUUID(),barcode:randomUUID(),unit:'dona',salePrice:'0.01',costPrice:'12345678901234.123456'}})
 const product=await db.product.findFirstOrThrow({where:{organizationId:me.organization.id}}),fileBytes=Buffer.alloc(524288,42)
 await db.fileAsset.createMany({data:Array.from({length:25},(_,i)=>({organizationId:me.organization.id,productId:product.id,createdBy:me.user.id,name:'browser-large-'+i+'.webp',mime:'image/webp',width:1,height:1,data:fileBytes,size:fileBytes.length,sha256:createHash('sha256').update(fileBytes).digest('hex')}))})
 await page.goto('/jobs');await page.getByLabel('Fon ishining turi',{exact:true}).selectOption('tenant_export')
 await expect(page.getByText(/Parol, PIN, sessiya va tasdiqlash kodlari chiqarilmaydi/)).toBeVisible()
 await page.getByLabel('Fon ishini tasdiqlash sababi',{exact:true}).fill('Owner reviewed full tenant business archive')
 await page.getByRole('button',{name:'Tashkilot eksportini navbatga qo‘yish: oldindan ko‘rish',exact:true}).click()
 let dropped=false,original='',replay=''
 await page.route('**/api/jobs',async route=>{if(route.request().method()==='POST'){if(!dropped){original=route.request().postData()!;dropped=true;expect((await route.fetch()).ok()).toBe(true);await route.abort('failed')}else{replay=route.request().postData()!;await route.continue()}}else await route.continue()})
 await page.getByRole('button',{name:'Amalni tasdiqlash',exact:true}).click()
 await expect(page.getByRole('button',{name:'Original amalni qayta tekshirish',exact:true})).toBeVisible()
 await page.reload();await page.getByRole('button',{name:'Saqlangan amalni qayta tekshirish',exact:true}).click()
 await expect(page.getByRole('heading',{name:'Tashkilot JSON eksporti · Navbatda',exact:true})).toBeVisible()
 expect(JSON.parse(replay)).toEqual(JSON.parse(original));expect(await db.backgroundJob.count({where:{organizationId:me.organization.id}})).toBe(1)
 execFileSync(process.execPath,['--require','./scripts/worker-resolver.cjs','.worker-build/scripts/workers/jobs.js','--once'],{env:{...process.env,NODE_ENV:'production',APP_ORIGIN:'https://localhost:3100'},timeout:30000,stdio:'pipe'})
 await page.getByRole('button',{name:'Fon ishlarini yangilash',exact:true}).click()
 await expect(page.getByRole('heading',{name:'Tashkilot JSON eksporti · Yakunlangan',exact:true})).toBeVisible()
 const [download]=await Promise.all([page.waitForEvent('download'),page.getByRole('button',{name:'Tashkilot JSON faylini yuklash',exact:true}).click()])
 const bytes=readFileSync((await download.path())!),archive=JSON.parse(bytes.toString())
 expect(archive.organizationId).toBe(me.organization.id);expect(archive.datasets.Product[0].costPrice).toBe('12345678901234.123456');expect(archive.datasets.Product[0].salePrice).toBe('0.01')
 expect(archive.datasets.User[0]).not.toHaveProperty('passwordHash');expect(archive.datasets).not.toHaveProperty('Session');expect(archive.manifest.omittedModels.Session).toBeTruthy()
 for(const entry of archive.manifest.datasets){const rows=archive.datasets[entry.model];expect(rows).toHaveLength(entry.rows);expect(createHash('sha256').update(rows.map((row:unknown)=>JSON.stringify(row)+'\n').join('')).digest('hex')).toBe(entry.sha256)}
 const job=await db.backgroundJob.findFirstOrThrow({where:{organizationId:me.organization.id}}),artifact=await db.jobExport.findUniqueOrThrow({where:{jobId:job.id}})
 expect(artifact.data).toBeNull();expect(artifact.size).toBeGreaterThan(16*1024*1024);expect(artifact.chunkCount).toBeGreaterThan(64);expect(archive.datasets.FileAsset).toHaveLength(25)
 expect(artifact.sha256).toBe(createHash('sha256').update(bytes).digest('hex'));expect(await db.auditLog.count({where:{entityId:job.id,action:'export_downloaded'}})).toBe(1);expect(await db.operation.count({where:{organizationId:me.organization.id,type:'job.enqueue'}})).toBe(1)
})
