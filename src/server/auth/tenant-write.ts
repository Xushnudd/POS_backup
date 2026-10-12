import {AccessError} from './policy'
import {TENANT_DIRECT_MODELS,TENANT_PARENT_MODELS,TENANT_PARENT_SCOPES} from './tenant-models'
import type {TokenPayload} from '@/lib/auth'
// Top-level inserts require an explicit root. Nested relations are checked by
// native tenant FK/constraint triggers in the same transaction.
export function tenantInsertReference(model:string,value:unknown,context:TokenPayload):{model:string;id:string}|null{
 if(['InventoryValuationSequence','InventoryValuationEvent'].includes(model))throw new AccessError(403,'VALUATION_JOURNAL_READ_ONLY','Tannarx tartibi faqat original DB postingdan yoziladi')
 if(!value||typeof value!=='object'||Array.isArray(value))throw new AccessError(400,'TENANT_SCOPE_REQUIRED')
 const data=value as Record<string,unknown>
 if((TENANT_DIRECT_MODELS as readonly string[]).includes(model)){
  const root=data.organizationId??(data.organization as {connect?:{id?:unknown}}|undefined)?.connect?.id
  if(root!==context.organizationId)throw new AccessError(403,'TENANT_MISMATCH')
  return null
 }
 const parent=TENANT_PARENT_MODELS[model],scope=TENANT_PARENT_SCOPES[model]
 if(!parent||!scope)throw new AccessError(403,'UNSCOPED_MODEL')
 const id=data[parent[1]]??(data[scope[1]] as {connect?:{id?:unknown}}|undefined)?.connect?.id
 if(typeof id!=='string'||!id)throw new AccessError(400,'TENANT_SCOPE_REQUIRED')
 return {model:parent[0],id}
}
