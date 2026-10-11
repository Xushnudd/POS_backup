import {test,expect} from '@playwright/test'
import {PrismaClient} from '@prisma/client'
import {randomUUID} from 'node:crypto'
import {execFileSync} from 'node:child_process'
import {readFileSync} from 'node:fs'
import ExcelJS from 'exceljs'
const url=new URL(process.env.DATABASE_URL??'');if(url.hostname!=='127.0.0.1'||url.port!=='55439'||url.pathname!=='/pos_test')throw Error('Isolated browser DB only')
const db=new PrismaClient(),orgs:string[]=[],users:string[]=[]
test.afterAll(async()=>{await db.organization.deleteMany({where:{id:{in:orgs}}});await db.user.deleteMany({where:{id:{in:users}}});await db.$disconnect()})
test('Owner queues full filtered XLSX/PDF documents through UI, actual worker publishes and authenticated download preserves all 1001 rows',async({page})=>{
 const registered=await page.request.post('/api/auth/register',{headers:{Origin:'https://localhost:3100'},data:{fullName:'Report browser owner',phone:'report-browser-'+randomUUID(),password:'test-only-password',organizationName:'Report browser fixture'}});expect(registered.ok()).toBe(true)
 const identity=(await registered.json()).data;orgs.push(identity.organization.id);users.push(identity.user.id)
 for(let start=0;start<1001;start+=100)await db.product.createMany({data:Array.from({length:Math.min(100,1001-start)},(_,n)=>({organizationId:identity.organization.id,name:'REPORT-'+String(start+n).padStart(4,'0'),sku:randomUUID(),barcode:randomUUID(),unit:'dona',salePrice:'1.01',costPrice:'12.345678'}))})
 await db.product.create({data:{organizationId:identity.organization.id,name:'EXCLUDED-PRODUCT',sku:randomUUID(),barcode:randomUUID(),unit:'dona',salePrice:9,costPrice:9}})
 await page.goto('/jobs');await page.getByLabel('Fon ishining turi').selectOption('report_export');await page.getByLabel('Eksport hisoboti').selectOption('products');await page.getByLabel('Qidiruv',{exact:true}).fill('REPORT-');await page.getByLabel('Fon ishini tasdiqlash sababi').fill('Full filtered report browser acceptance')
 for(const format of ['xlsx','pdf']){
  await page.getByLabel('Hisobot fayli formati').selectOption(format)
  await page.getByRole('button',{name:'Hisobot eksportini navbatga qo‘yish: oldindan ko‘rish',exact:true}).click();await page.getByRole('button',{name:'Amalni tasdiqlash',exact:true}).click()
  await expect.poll(()=>db.backgroundJob.count({where:{organizationId:identity.organization.id,type:'report_export'}})).toBe(format==='xlsx'?1:2)
  execFileSync(process.execPath,['--require','./scripts/worker-resolver.cjs','.worker-build/scripts/workers/jobs.js','--once'],{env:{...process.env,NODE_ENV:'production',APP_ORIGIN:'https://localhost:3100'},stdio:'pipe',timeout:30000})
  await page.getByRole('button',{name:'Fon ishlarini yangilash',exact:true}).click()
  const job=await db.backgroundJob.findFirstOrThrow({where:{organizationId:identity.organization.id,type:'report_export'},orderBy:{createdAt:'desc'}});expect(job.state).toBe('succeeded')
  const article=page.getByRole('article').filter({hasText:job.id});await expect(article).toContainText('Yakunlangan')
  const downloadEvent=page.waitForEvent('download');await article.getByRole('button',{name:'Hisobot faylini yuklash',exact:true}).click();const download=await downloadEvent,path=await download.path();expect(path).toBeTruthy();const bytes=readFileSync(path!)
  if(format==='xlsx'){expect(download.suggestedFilename()).toMatch(/\.xlsx$/);const workbook=new ExcelJS.Workbook();await workbook.xlsx.load(bytes as never);const sheet=workbook.worksheets[0];expect(sheet.rowCount).toBe(1002);expect(sheet.getCell('I2').value).toBe('12.345678');expect(JSON.stringify(sheet.getSheetValues())).not.toContain('EXCLUDED-PRODUCT')}
  else{expect(download.suggestedFilename()).toMatch(/\.print\.html$/);const html=bytes.toString();for(let n=0;n<1001;n++)expect(html).toContain('REPORT-'+String(n).padStart(4,'0'));expect(html).not.toContain('EXCLUDED-PRODUCT');expect(html).toContain('PDF sifatida saqlash')}
  expect(await db.jobExport.count({where:{jobId:job.id}})).toBe(1)
 }
})
