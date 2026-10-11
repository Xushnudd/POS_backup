import {createHash} from 'node:crypto'
import {Prisma,type PrismaClient} from '@prisma/client'
import {AccessError} from '../auth/policy'
import {tenantExport} from './tenant-export'

type Dataset=Record<string,unknown>[]
type Archive={organizationId:string;datasets:Record<string,Dataset>;manifest:{datasets:{model:string;rows:number;sha256:string}[];omittedModels:Record<string,string>;omittedFields:Record<string,string[]>}}
function canonical(value:unknown):string {
 if(Array.isArray(value))return '['+value.map(canonical).join(',')+']'
 if(value!==null&&typeof value==='object')return '{'+Object.entries(value).sort(([a],[b])=>a<b?-1:a>b?1:0).map(([key,item])=>JSON.stringify(key)+':'+canonical(item)).join(',')+'}'
 return JSON.stringify(value)
}
const digest=(value:unknown)=>createHash('sha256').update(canonical(value)).digest('hex')
function keyed(model:string,rows:Dataset){
 const schema=Prisma.dmmf.datamodel.models.find(value=>value.name===model)
 const fields=schema?.fields.filter(value=>value.isId).map(value=>value.name)
 const primary=fields?.length?fields:schema?.primaryKey?.fields??schema?.uniqueFields[0]
 if(!primary?.length)throw new AccessError(503,'RECOVERY_SCHEMA_UNREVIEWED')
 const result=new Map<string,{key:Record<string,unknown>;sha256:string}>()
 for(const row of rows){
  const key=Object.fromEntries(primary.map(field=>[field,row[field]]))
  if(Object.values(key).some(value=>value===undefined||value===null))throw new AccessError(503,'RECOVERY_ROW_KEY_MISSING')
  const encoded=canonical(key)
  if(result.has(encoded))throw new AccessError(503,'RECOVERY_DUPLICATE_KEY')
  result.set(encoded,{key,sha256:digest(row)})
 }
 return result
}
// Read-only comparison only. The portable archive deliberately omits credentials
// and is never an SQL restore, upsert, balance setter or posting command.
export async function planTenantRecovery(organizationId:string,source:Pick<PrismaClient,'$transaction'>,target:Pick<PrismaClient,'$transaction'>,review:{reviewer:string;caseReference:string}){
 const exportedSource=await tenantExport(organizationId,source,{readOnly:true})
 const exportedTarget=await tenantExport(organizationId,target,{readOnly:true})
 const recovered=JSON.parse(exportedSource.data.toString()) as Archive,current=JSON.parse(exportedTarget.data.toString()) as Archive
 if(recovered.datasets.Organization?.length!==1||current.datasets.Organization?.length!==1)throw new AccessError(404,'RECOVERY_ORGANIZATION_NOT_FOUND')
 const differences=[]
 for(const model of Object.keys(recovered.datasets).sort()){
  const before=keyed(model,recovered.datasets[model]),after=keyed(model,current.datasets[model]??[])
  const missing=[],changed=[],currentOnly=[]
  for(const [key,row] of before){const present=after.get(key);if(!present)missing.push(row);else if(present.sha256!==row.sha256)changed.push({key:row.key,recoveredSHA256:row.sha256,currentSHA256:present.sha256})}
  for(const [key,row] of after)if(!before.has(key))currentOnly.push(row)
  const schema=Prisma.dmmf.datamodel.models.find(value=>value.name===model)!
  differences.push({model,recoveredRows:before.size,currentRows:after.size,missing,changed,currentOnly,foreignKeys:schema.fields.filter(field=>field.kind==='object'&&field.relationFromFields?.length).map(field=>({model:field.type,fields:field.relationFromFields,references:field.relationToFields})),reviewOnly:true})
 }
 return {
  format:'pos-tenant-recovery-plan',version:1,organizationId,createdAt:new Date().toISOString(),...review,
  sourceSnapshotAt:exportedSource.asOf,targetSnapshotAt:exportedTarget.asOf,
  recoveredArchiveSHA256:exportedSource.sha256,currentArchiveSHA256:exportedTarget.sha256,
  recoveredBusinessSHA256:digest(recovered.datasets),currentBusinessSHA256:digest(current.datasets),
  scope:'portable business fields only; omitted credential/security/operational models are not restored',
  applyEnabled:false,overwriteEnabled:false,deleteEnabled:false,
  warnings:['Source and target snapshots are sequential, not one distributed snapshot. Recheck against a drained target before any future apply.','Shared users/platform configuration require separate review; never revert credentials, sessions, roles or financial journals from this plan.','Current-only records are preserved. Financial/inventory corrections require existing audited posting/reversal commands, not raw upserts.','No provider status, offline browser queue or external legal approval is inferred.'],
  omittedModels:recovered.manifest.omittedModels,
  omittedFields:recovered.manifest.omittedFields,
  differences,
 }
}
