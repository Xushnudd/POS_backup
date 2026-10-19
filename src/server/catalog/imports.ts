import {z} from 'zod'
import {Prisma} from '@prisma/client'
import {prisma} from '@/lib/prisma'
import type {TokenPayload} from '@/lib/auth'
import {AccessError} from '../auth/policy'
import {assertLiveContext,audit,payloadHash,runOperation} from '../operations'
import {priceActor} from './prices'
import {amountSchema} from '../sales/service'
import {nonnegativeQuantitySchema} from './service'
import {spreadsheetRows} from './spreadsheets'
import {csv} from '../exports/csv'
export const importFileSchema=z.object({format:z.enum(['csv','xlsx']),content:z.string().min(4).max(700000)}).strict()
export const importCommitSchema=importFileSchema.extend({operationId:z.string().uuid(),confirmationHash:z.string().regex(/^[a-f0-9]{64}$/),reason:z.string().trim().min(3).max(2000),acceptValidRows:z.literal(true)}).strict()
const rowSchema=z.object({name:z.string().trim().min(2).max(200),sku:z.string().trim().min(2).max(100),barcode:z.string().trim().min(2).max(200),unit:z.string().trim().regex(/^[a-z][a-z0-9_-]{0,31}$/),salePrice:amountSchema,costPrice:nonnegativeQuantitySchema,minStock:nonnegativeQuantitySchema,category:z.string().max(200),additional:z.array(z.string().trim().min(2).max(200)).max(50)})
const aliases:Record<string,string>={'Mahsulot':'name','SKU':'sku','Asosiy barkod':'barcode','Qo‘shimcha barkodlar':'additional','Birlik':'unit','Kategoriya':'category','Sotuv narxi':'salePrice','Tannarx':'costPrice','Minimal qoldiq':'minStock',name:'name',sku:'sku',barcode:'barcode',unit:'unit',salePrice:'salePrice',costPrice:'costPrice',minStock:'minStock',category:'category',additional:'additional'}
function owner(ctx:TokenPayload){if(ctx.role!=='owner')throw new AccessError(403,'OWNER_REQUIRED')}
async function previewTx(tx:Prisma.TransactionClient,ctx:TokenPayload,input:z.infer<typeof importFileSchema>,sheet:string[][]){
 const header=(sheet[0]??[]).map(x=>x.replace(/^\uFEFF/,'')),keys=header.map(h=>aliases[h]);
 if(['name','sku','barcode','unit','salePrice','costPrice'].some(k=>!keys.includes(k))||new Set(keys.filter(Boolean)).size!==keys.filter(Boolean).length||header.some(h=>!aliases[h]&&h!=='ID'))throw new AccessError(400,'IMPORT_HEADERS','Ustunlar andozaga mos emas; katalog eksportidan foydalaning')
 const units=await tx.unit.findMany({where:{organizationId:ctx.organizationId,isActive:true},select:{code:true,precision:true}}),categories=await tx.category.findMany({where:{organizationId:ctx.organizationId,isActive:true},select:{id:true,name:true}})
 const skuIndex=keys.indexOf('sku'),barcodeIndex=keys.indexOf('barcode'),additionalIndex=keys.indexOf('additional')
 const requestedSKU=sheet.slice(1).map(r=>r[skuIndex]?.trim()).filter(Boolean),requestedCodes=sheet.slice(1).flatMap(r=>[r[barcodeIndex]?.trim(),...(additionalIndex>=0?(r[additionalIndex]??'').split('|').map(c=>c.trim()):[])]).filter(Boolean)
 const existingSKU=new Set((await tx.product.findMany({where:{organizationId:ctx.organizationId,sku:{in:requestedSKU}},select:{sku:true}})).map(p=>p.sku))
 const existingCodes=new Set((await tx.productBarcode.findMany({where:{organizationId:ctx.organizationId,value:{in:requestedCodes}},select:{value:true}})).map(p=>p.value))
 const rows:{line:number;data?:z.infer<typeof rowSchema>&{categoryId?:string};errors:string[]}[]=[],seenSKU=new Set<string>(),seenBarcode=new Set<string>()
 for(let i=1;i<sheet.length;i++){
  if(sheet[i].every(v=>!v))continue
  const record:Record<string,unknown>={category:'',minStock:'0',additional:[]};keys.forEach((k,n)=>{if(k)record[k]=sheet[i][n]??''});record.additional=String(record.additional||'').split('|').map(v=>v.trim()).filter(v=>Boolean(v)&&v!==record.barcode)
  const parsed=rowSchema.safeParse(record),errors:string[]=[];if(!parsed.success){rows.push({line:i+1,errors:parsed.error.issues.map(e=>e.path.join('.')+': '+e.message)});continue}
  const data=parsed.data,unit=units.find(u=>u.code===data.unit);if(!unit)errors.push('Birlik faol emas');else if(new Prisma.Decimal(data.minStock).decimalPlaces()>unit.precision)errors.push('Minimal qoldiq birlik aniqligiga mos emas')
  const matches=categories.filter(c=>c.name===data.category);if(data.category&&matches.length!==1)errors.push('Kategoriya topilmadi yoki noaniq')
  const codes=[data.barcode,...data.additional];if(seenSKU.has(data.sku))errors.push('Faylda takror SKU');seenSKU.add(data.sku)
  if(new Set(codes).size!==codes.length||codes.some(c=>seenBarcode.has(c)))errors.push('Faylda takror barkod');codes.forEach(c=>seenBarcode.add(c))
  if(existingSKU.has(data.sku))errors.push('SKU katalogda mavjud')
  if(codes.some(c=>existingCodes.has(c)))errors.push('Barkod katalogda mavjud')
  rows.push({line:i+1,data:{...data,...(matches.length===1?{categoryId:matches[0].id}:{})},errors})
 }
 if(!rows.length)throw new AccessError(400,'IMPORT_EMPTY')
 const fileHash=payloadHash(input),confirmationHash=payloadHash({fileHash,organizationId:ctx.organizationId,rows})
 return {fileHash,confirmationHash,rows,total:rows.length,valid:rows.filter(r=>r.errors.length===0).length,invalid:rows.filter(r=>r.errors.length>0).length,errorCSV:csv([['Qator','Xatolar'],...rows.filter(r=>r.errors.length).map(r=>[r.line,r.errors.join('; ')])])}
}
export async function previewCatalogImport(ctx:TokenPayload,input:z.infer<typeof importFileSchema>){owner(ctx);const sheet=await spreadsheetRows(input.format,input.content);return prisma.$transaction(async tx=>{await assertLiveContext(tx,ctx);return previewTx(tx,ctx,input,sheet)},{isolationLevel:'RepeatableRead',timeout:15000})}
export async function commitCatalogImport(ctx:TokenPayload,input:z.infer<typeof importCommitSchema>){owner(ctx);const sheet=await spreadsheetRows(input.format,input.content);return runOperation(ctx,'catalog.import',input.operationId,input,async tx=>{
 const preview=await previewTx(tx,ctx,{format:input.format,content:input.content},sheet);if(preview.confirmationHash!==input.confirmationHash)throw new AccessError(409,'IMPORT_CHANGED','Katalog o‘zgardi; faylni qayta oldindan ko‘ring')
 if(preview.valid===0)throw new AccessError(400,'IMPORT_NO_VALID_ROWS')
 await priceActor(tx,ctx,'catalog.import');const created=[]
 for(const row of preview.rows.filter(r=>r.errors.length===0)){
  const {additional,category,...data}=row.data!;void category
  const product=await tx.product.create({data:{...data,organizationId:ctx.organizationId}})
  for(const value of additional)await tx.productBarcode.create({data:{organizationId:ctx.organizationId,productId:product.id,value}})
  created.push({line:row.line,id:product.id,sku:product.sku})
 }
 const result={fileHash:preview.fileHash,created,skipped:preview.rows.filter(r=>r.errors.length),errorCSV:preview.errorCSV}
 await audit(tx,ctx,'CatalogImport',input.operationId,'catalog_imported',{fileHash:preview.fileHash,created,skipped:result.skipped.map(r=>({line:r.line,errors:r.errors})),reason:input.reason})
 return result
 })}
