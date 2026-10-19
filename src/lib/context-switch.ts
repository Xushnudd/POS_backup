import {loadDraft,pendingOperations,type OfflineScope} from './offline'
import {hasUnresolvedCash} from './offline-cash-store'

// A register change must not rebind a saved cart or an unresolved payment.
// These checks protect local recovery; server authorization remains authoritative.
export async function assertContextSwitchReady(scope:OfflineScope,requireEmptyCart=false){
 if((await pendingOperations(scope)).length)throw new Error('Avval kutilayotgan savdo natijalarini tekshiring')
 if(await hasUnresolvedCash(scope.organizationId,scope.userId,scope.deviceId))throw new Error('Avval offline naqd ruxsatining asl natijasini hal qiling.')
 if(requireEmptyCart){
  const saved=await loadDraft(scope) as {attempt?:unknown;cart?:{items?:unknown[];customer?:unknown;note?:string;cartDiscount?:number;discountReason?:string};serviceType?:string}|undefined
  if(saved?.attempt||saved?.cart?.items?.length||saved?.cart?.customer||saved?.cart?.note||saved?.cart?.cartDiscount||saved?.cart?.discountReason||saved?.serviceType)throw new Error('Filial yoki kassani almashtirishdan oldin savatni server qoralamasi sifatida saqlang yoki tozalang.')
 }
}
