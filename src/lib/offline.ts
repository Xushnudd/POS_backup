export type OfflineScope={organizationId:string;userId:string;deviceId:string}
export type PendingOperation={id:string;scope:OfflineScope;type:'sale.create'|'sale.complete'|'sale.return'|'debt.collect'|'debt.document'|'shift.correct'|'shift.cash';payload:Record<string,unknown>;state:'pending'|'synced'|'conflict'|'cancelled'|'rejected';createdAt:string;result?:unknown;code?:string}
const database='shuni-pos-local-v1'
function open():Promise<IDBDatabase> {
 return new Promise((resolve,reject)=>{
  const request=indexedDB.open(database,1)
  request.onupgradeneeded=()=>{request.result.createObjectStore('operations',{keyPath:'id'});request.result.createObjectStore('drafts',{keyPath:'id'})}
  request.onsuccess=()=>resolve(request.result);request.onerror=()=>reject(request.error)
 })
}
async function transact<T>(store:string,mode:IDBTransactionMode,work:(store:IDBObjectStore)=>IDBRequest<T>):Promise<T> {
 const db=await open()
 return new Promise((resolve,reject)=>{
  const transaction=db.transaction(store,mode);const request=work(transaction.objectStore(store));let result:T
  request.onsuccess=()=>{result=request.result}
  request.onerror=()=>reject(request.error)
  transaction.oncomplete=()=>{db.close();resolve(result)}
  transaction.onerror=()=>{db.close();reject(transaction.error)}
  transaction.onabort=()=>{db.close();reject(transaction.error??new Error('Local save failed'))}
 })
}
export function deviceId() {
 let id=localStorage.getItem('pos_device_id')
 if (!id) {id=crypto.randomUUID();localStorage.setItem('pos_device_id',id)}
 return id
}
const scopeKey=(scope:OfflineScope)=>`${scope.organizationId}:${scope.userId}:${scope.deviceId}`
function minimalDraft(value:unknown){
 if(!value||typeof value!=='object'||!('cart' in value))return value
 const saved=value as {cart?:{customer?:Record<string,unknown>|null;items?:{product?:Record<string,unknown>}[]}}
 if(!saved.cart)return value
 const pick=(source:Record<string,unknown>,keys:string[])=>Object.fromEntries(keys.filter(k=>k in source).map(k=>[k,source[k]]))
 return {...saved,cart:{...saved.cart,customer:saved.cart.customer?pick(saved.cart.customer,['id','organizationId','fullName','phone','creditLimit','isActive']):null,items:saved.cart.items?.map(item=>({...item,product:item.product?pick(item.product,['id','organizationId','name','sku','barcode','unit','unitPrecision','salePrice','isActive']):undefined}))}}
}
export const saveDraft=(scope:OfflineScope,value:unknown)=>transact('drafts','readwrite',store=>store.put({id:scopeKey(scope),version:1,value:minimalDraft(value)}))
export async function loadDraft(scope:OfflineScope){const saved=await transact<{version?:number;value:unknown}|undefined>('drafts','readonly',store=>store.get(scopeKey(scope)));if(saved?.version!==undefined&&saved.version!==1)throw new Error('Lokal savat versiyasi qo‘llab-quvvatlanmaydi');return saved?.value}
export const deleteDraft=(scope:OfflineScope)=>transact('drafts','readwrite',store=>store.delete(scopeKey(scope)))
// Read and write share one transaction: concurrent tabs cannot overwrite an
// acknowledgement, accept a changed payload, or resurrect terminal records.
async function mutateOperation<T>(id:string,change:(old:PendingOperation|undefined)=>{record?:PendingOperation;result:T}):Promise<T>{
 const db=await open()
 return new Promise((resolve,reject)=>{
  const tx=db.transaction('operations','readwrite'),store=tx.objectStore('operations'),query=store.get(id);let result:T;let failure:unknown
  query.onsuccess=()=>{try{const changed=change(query.result);result=changed.result;if(changed.record)store.put(changed.record)}catch(error){failure=error;tx.abort()}}
  tx.oncomplete=()=>{db.close();resolve(result)}
  tx.onabort=tx.onerror=()=>{db.close();reject(failure??tx.error??new Error('Local operation failed'))}
 })
}
export async function enqueue(operation:PendingOperation) {
 return mutateOperation(operation.id,old=>{
  if(old){if(scopeKey(old.scope)!==scopeKey(operation.scope)||old.type!==operation.type||JSON.stringify(old.payload)!==JSON.stringify(operation.payload))throw new Error('Operation key conflict');return {result:old}}
  return {record:operation,result:operation}
 })
}
export async function pendingOperations(scope:OfflineScope) {
 const all=await transact<PendingOperation[]>('operations','readonly',store=>store.getAll())
 return all.filter(x=>scopeKey(x.scope)===scopeKey(scope)&&['pending','conflict'].includes(x.state)).sort((a,b)=>a.createdAt.localeCompare(b.createdAt))
}
export async function acknowledge(id:string,state:PendingOperation['state'],result?:unknown,code?:string) {
 return mutateOperation(id,old=>{
  if(!old)throw new Error('Local operation not found')
  if(['synced','cancelled','rejected'].includes(old.state))return {result:undefined}
  return {record:{...old,state,result,code},result:undefined}
 })
}
// Owner debt corrections require explicit review/retry on the customer card.
// They are durable local intents, not automatic background sync commands.
async function synchronizeBatch(scope:OfflineScope) {
 const pending=(await pendingOperations(scope)).filter(x=>x.state==='pending'&&!['debt.document','shift.correct','shift.cash'].includes(x.type)).slice(0,25)
 if (!pending.length) return []
 const response=await fetch('/api/sync',{method:'POST',credentials:'same-origin',headers:{'content-type':'application/json'},body:JSON.stringify({commands:pending.map(x=>({operationId:x.id,type:x.type,payload:x.payload}))})})
 const body=await response.json()
 if (!response.ok) throw new Error(body.error?.message??'Synchronization failed')
 const results=body.data as {operationId:string;state:PendingOperation['state'];result?:unknown;code?:string}[]
 if(!Array.isArray(results)||results.length!==pending.length||new Set(results.map(r=>r.operationId)).size!==results.length||results.some(r=>!pending.some(p=>p.id===r.operationId)||!['synced','pending','conflict'].includes(r.state)))throw new Error('Invalid synchronization acknowledgement')
 for (const result of results) await acknowledge(result.operationId,result.state,result.result,result.code)
 return results
}

export async function clearScope(scope:OfflineScope) {
 const db=await open()
 return new Promise<void>((resolve,reject)=>{
  const tx=db.transaction(['operations','drafts'],'readwrite'),ops=tx.objectStore('operations'),query=ops.getAll();let failure:unknown
  query.onsuccess=()=>{
   const owned=(query.result as PendingOperation[]).filter(op=>scopeKey(op.scope)===scopeKey(scope))
   if(owned.some(op=>['pending','conflict'].includes(op.state))){failure=new Error('Sinxronlanmagan amallar bor; avval natijani tekshiring');tx.abort();return}
   for(const op of owned)ops.delete(op.id)
   tx.objectStore('drafts').delete(scopeKey(scope))
  }
  tx.oncomplete=()=>{db.close();resolve()}
  tx.onabort=tx.onerror=()=>{db.close();reject(failure??tx.error??new Error('Local clear failed'))}
 })
}

export async function markCancelled(id:string,scope:OfflineScope,result:unknown) {
 return mutateOperation(id,old=>{
  if(!old)return {result:undefined}
  if(scopeKey(old.scope)!==scopeKey(scope))throw new Error('Operation scope mismatch')
  if(old.state==='synced')return {result:undefined}
  return {record:{...old,state:'cancelled',code:'CANCELLED_WITH_SERVER_PROOF',result},result:undefined}
 })
}

export async function synchronize(scope:OfflineScope){
 if(navigator.locks)return navigator.locks.request('pos-sync:'+scopeKey(scope),()=>synchronizeBatch(scope))
 // Server idempotency remains the final duplicate protection without Web Locks.
 return synchronizeBatch(scope)
}
