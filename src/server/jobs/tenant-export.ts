import {createHash} from 'node:crypto'
import {readdirSync,readFileSync} from 'node:fs'
import {join} from 'node:path'
import {Prisma,type PrismaClient} from '@prisma/client'
import {prisma} from '@/lib/prisma'
import {AccessError} from '../auth/policy'
import {MAX_EXPORT_BYTES} from './catalog-export'
import {DIRECT_MODELS,CHILD_RELATIONS,OMITTED_MODELS,SPECIAL_MODELS,OMITTED_FIELDS,REVIEWED_SCHEMA_SHA256} from './tenant-export-contract'
const models=Prisma.dmmf.datamodel.models
export function assertExportCoverage(){
 const shape=models.map(m=>({name:m.name,primaryKey:m.primaryKey,uniqueFields:m.uniqueFields,fields:m.fields.map(f=>({name:f.name,type:f.type,kind:f.kind,isList:f.isList,isId:f.isId}))}))
 if(createHash('sha256').update(JSON.stringify(shape)).digest('hex')!==REVIEWED_SCHEMA_SHA256)throw new AccessError(503,'EXPORT_SCHEMA_UNREVIEWED')
 const reviewed=new Set<string>([...DIRECT_MODELS,...Object.keys(CHILD_RELATIONS),...Object.keys(OMITTED_MODELS),...SPECIAL_MODELS])
 if(models.some(model=>!reviewed.has(model.name)))throw new AccessError(503,'EXPORT_SCHEMA_UNREVIEWED')
}
function scopedWhere(model:string,organizationId:string,depth=0):Record<string,unknown>{
 if(depth>10)throw new AccessError(503,'EXPORT_SCHEMA_UNREVIEWED')
 if((DIRECT_MODELS as readonly string[]).includes(model))return {organizationId}
 const relation=CHILD_RELATIONS[model],target=models.find(m=>m.name===model)?.fields.find(f=>f.name===relation)?.type
 if(!relation||!target)throw new AccessError(503,'EXPORT_SCHEMA_UNREVIEWED')
 return {[relation]:scopedWhere(target,organizationId,depth+1)}
}
type Reader={findMany(args:{where:Record<string,unknown>;select:Record<string,boolean>;orderBy:Record<string,string>[];skip:number;take:number}):Promise<Record<string,unknown>[]>}
function serialize(_key:string,value:unknown):unknown{
 if(typeof value==='bigint')return value.toString()
 // Buffer.toJSON runs before the replacer; Prisma may also return Uint8Array.
 if(value instanceof Uint8Array)return {encoding:'base64',data:Buffer.from(value).toString('base64')}
 if(value&&typeof value==='object'&&'type' in value&&value.type==='Buffer'&&'data' in value&&Array.isArray(value.data))return {encoding:'base64',data:Buffer.from(value.data).toString('base64')}
 return value
}
export async function tenantExport(organizationId:string,db:Pick<PrismaClient,'$transaction'>=prisma,options:{readOnly?:boolean}={}){
 assertExportCoverage()
 return db.$transaction(async tx=>{
  if(options.readOnly){
   await tx.$executeRaw`SET TRANSACTION READ ONLY`
   const directory=join(process.cwd(),'prisma/migrations')
   const expected=readdirSync(directory,{withFileTypes:true}).filter(entry=>entry.isDirectory()).map(entry=>({name:entry.name,checksum:createHash('sha256').update(readFileSync(join(directory,entry.name,'migration.sql'))).digest('hex')})).sort((a,b)=>a.name<b.name?-1:1)
   const applied=await tx.$queryRaw<{name:string;checksum:string}[]>`SELECT migration_name AS name,checksum FROM "_prisma_migrations" WHERE finished_at IS NOT NULL AND rolled_back_at IS NULL ORDER BY migration_name`
   const pending=await tx.$queryRaw<{count:bigint}[]>`SELECT count(*) FROM "_prisma_migrations" WHERE finished_at IS NULL AND rolled_back_at IS NULL`
   if(pending[0].count!==BigInt(0)||expected.length===0||expected.length!==applied.length||expected.some((migration,index)=>migration.name!==applied[index].name||migration.checksum!==applied[index].checksum))throw new AccessError(503,'RECOVERY_SCHEMA_UNREVIEWED')
  }
  const [snapshot]=await tx.$queryRaw<{asOf:Date}[]>`SELECT transaction_timestamp() AS "asOf"`
  const datasets: {model:string;rows:number;sha256:string}[]=[],chunks:Buffer[]=[]
  let bytes=0,rowCount=0
  const append=(text:string)=>{const chunk=Buffer.from(text);bytes+=chunk.length;if(bytes>MAX_EXPORT_BYTES)throw new AccessError(413,'EXPORT_TOO_LARGE');chunks.push(chunk)}
  append('{"format":"pos-tenant-export","version":1,"organizationId":'+JSON.stringify(organizationId)+',"asOf":'+JSON.stringify(snapshot.asOf.toISOString())+',"datasets":{')
  const names=[...DIRECT_MODELS,...Object.keys(CHILD_RELATIONS),...SPECIAL_MODELS].sort()
  for(const [index,name] of names.entries()){
   const model=models.find(m=>m.name===name)!
   const omitted=OMITTED_FIELDS[name]??[]
   const select=Object.fromEntries(model.fields.filter(f=>f.kind!=='object'&&!omitted.includes(f.name)).map(f=>[f.name,true]))
   let where:Record<string,unknown>
   if(name==='Organization')where={id:organizationId}
   else if(name==='User')where={organizationUsers:{some:{organizationId}}}
   else if(name==='BillingPlanVersion')where={OR:[{subscriptions:{some:{organizationId}}},{invoices:{some:{organizationId}}}]}
   else if(name==='SupportPolicyVersion')where={tickets:{some:{organizationId}}}
   else where=scopedWhere(name,organizationId)
   const primary=model.fields.filter(f=>f.isId).map(f=>f.name)
   const orderKeys=primary.length?primary:model.primaryKey?.fields??model.uniqueFields[0]
   if(!orderKeys?.length)throw new AccessError(503,'EXPORT_SCHEMA_UNREVIEWED')
   const reader=(tx as unknown as Record<string,Reader>)[name[0].toLowerCase()+name.slice(1)]
   append((index?',':'')+JSON.stringify(name)+':[')
   const hash=createHash('sha256');let count=0
   for(;;){
    const page=await reader.findMany({where,select,orderBy:orderKeys.map(key=>({[key]:'asc'})),skip:count,take:name==='FileAsset'?8:250})
    if(!page.length)break
    for(const row of page){
     if(name==='FileAsset'&&row.data!==null){const blob=Buffer.from(row.data as Uint8Array);if(blob.length!==row.size||createHash('sha256').update(blob).digest('hex')!==row.sha256)throw new AccessError(503,'EXPORT_CORRUPTED')}
     const encoded=JSON.stringify(row,serialize);append((count?',':'')+encoded);hash.update(encoded+'\n');count++;rowCount++;if(rowCount>100000)throw new AccessError(413,'EXPORT_TOO_LARGE')}
   }
   append(']');datasets.push({model:name,rows:count,sha256:hash.digest('hex')})
  }
  append('},"manifest":'+JSON.stringify({datasets,rowCount,omittedModels:OMITTED_MODELS,omittedFields:OMITTED_FIELDS,decimalEncoding:'string',binaryEncoding:'base64',purpose:'portable_business_data_not_database_restore',automaticDeletionEnabled:false})+'}')
  const data=Buffer.concat(chunks)
  return {data,size:data.length,sha256:createHash('sha256').update(data).digest('hex'),rowCount,filename:'organization-'+organizationId+'.json',mime:'application/json',asOf:snapshot.asOf.toISOString()}
 },{isolationLevel:'RepeatableRead',timeout:60000})
}
