export type OfflineScope={organizationId:string;userId:string;deviceId:string}
export type PendingOperation={id:string;scope:OfflineScope;type:'sale.create'|'sale.complete'|'sale.return'|'debt.collect';payload:Record<string,unknown>;state:'pending'|'synced'|'conflict';createdAt:string;result?:unknown;code?:string}
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
export const saveDraft=(scope:OfflineScope,value:unknown)=>transact('drafts','readwrite',store=>store.put({id:scopeKey(scope),value}))
export const loadDraft=async(scope:OfflineScope)=>(await transact<{value:unknown}|undefined>('drafts','readonly',store=>store.get(scopeKey(scope))))?.value
export const deleteDraft=(scope:OfflineScope)=>transact('drafts','readwrite',store=>store.delete(scopeKey(scope)))
export async function enqueue(operation:PendingOperation) {
 const old=await transact<PendingOperation|undefined>('operations','readonly',store=>store.get(operation.id))
 if (old) {
  if (scopeKey(old.scope)!==scopeKey(operation.scope)||JSON.stringify(old.payload)!==JSON.stringify(operation.payload)) throw new Error('Operation key conflict')
  return old
 }
 await transact('operations','readwrite',store=>store.add(operation));return operation
}
export async function pendingOperations(scope:OfflineScope) {
 const all=await transact<PendingOperation[]>('operations','readonly',store=>store.getAll())
 return all.filter(x=>scopeKey(x.scope)===scopeKey(scope)&&x.state!=='synced').sort((a,b)=>a.createdAt.localeCompare(b.createdAt))
}
export async function acknowledge(id:string,state:PendingOperation['state'],result?:unknown,code?:string) {
 const old=await transact<PendingOperation|undefined>('operations','readonly',store=>store.get(id))
 if (!old) throw new Error('Local operation not found')
 await transact('operations','readwrite',store=>store.put({...old,state,result,code}))
}
export async function synchronize(scope:OfflineScope) {
 const pending=(await pendingOperations(scope)).filter(x=>x.state==='pending').slice(0,25)
 if (!pending.length) return []
 const response=await fetch('/api/sync',{method:'POST',credentials:'same-origin',headers:{'content-type':'application/json'},body:JSON.stringify({commands:pending.map(x=>({operationId:x.id,type:x.type,payload:x.payload}))})})
 const body=await response.json()
 if (!response.ok) throw new Error(body.error?.message??'Synchronization failed')
 const results=body.data as {operationId:string;state:PendingOperation['state'];result?:unknown;code?:string}[]
 for (const result of results) await acknowledge(result.operationId,result.state,result.result,result.code)
 return results
}

export async function clearScope(scope:OfflineScope) {
 if ((await pendingOperations(scope)).length) throw new Error('Sinxronlanmagan amallar bor; avval natijani tekshiring')
 await deleteDraft(scope)
 const all=await transact<PendingOperation[]>('operations','readonly',store=>store.getAll())
 for (const operation of all) if (scopeKey(operation.scope)===scopeKey(scope)) await transact('operations','readwrite',store=>store.delete(operation.id))
}
