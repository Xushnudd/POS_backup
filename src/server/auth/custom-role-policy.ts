import type {TokenPayload} from '@/lib/auth'
import {AccessError} from './policy'
import {ROUTE_PERMISSIONS,type BusinessRole} from './route-permissions'
import type {Prisma} from '@prisma/client'
export const activeMembershipWhere:Prisma.OrganizationUserWhereInput={isActive:true,OR:[{customRoleId:null},{role:'admin',customRole:{isActive:true,baseRole:'admin'}},{role:'cashier',customRole:{isActive:true,baseRole:'cashier'}}]}
const personal=(key:string)=>key.includes(' /api/auth/')||['GET /api/organizations','GET /api/organizations/[id]','POST /api/organizations/switch'].includes(key)
export function permissionKey(path:string,method:string):string|undefined{
 const verb=method==='HEAD'?'GET':method,key=verb+' '+path
 if(Object.hasOwn(ROUTE_PERMISSIONS,key))return key
 const parts=path.split('/')
 return Object.keys(ROUTE_PERMISSIONS).filter(key=>key.includes('[')).sort((a,b)=>(a.match(/\[/g)?.length??0)-(b.match(/\[/g)?.length??0)).find(key=>{
  const [candidateMethod,template]=key.split(' '),segments=template.split('/')
  return candidateMethod===verb&&segments.length===parts.length&&segments.every((segment,index)=>/^\[[^\]]+\]$/.test(segment)?parts[index].length>0:segment===parts[index])
 })
}
export function allowedCustomPermission(key:string,baseRole:'admin'|'cashier'){
 return Object.hasOwn(ROUTE_PERMISSIONS,key)&&ROUTE_PERMISSIONS[key].includes(baseRole as BusinessRole)&&!personal(key)
}
export function assertCustomRoutePermission(context:TokenPayload,path:string,method:string){
 if(!context.customRole)return
 const key=permissionKey(path,method)
 if(!key||(!personal(key)&&!context.customRole.permissions.includes(key)))throw new AccessError(403,'FORBIDDEN','Ushbu maxsus rolga bu amal berilmagan')
}
const select=(predicate:(key:string)=>boolean)=>Object.keys(ROUTE_PERMISSIONS).filter(key=>allowedCustomPermission(key,'admin')&&predicate(key))
export const CUSTOM_ROLE_TEMPLATES=[
 {name:'Omborchi',baseRole:'admin' as const,permissions:select(key=>/ \/api\/(inventory|stock-documents|stock-counts|transfers)(\/|$)/.test(key)||key.startsWith('GET /api/products')||/^GET \/api\/(categories|units|stores)(\/|$)/.test(key))},
 {name:'Buxgalter',baseRole:'admin' as const,permissions:select(key=>key.startsWith('GET /api/')&&/ \/api\/(reports|finance|suppliers|supplier-invoices|supplier-payments|purchase-orders|customers|shifts|stores)(\/|$)/.test(key))},
 {name:'Kuzatuvchi',baseRole:'admin' as const,permissions:select(key=>/^GET \/api\/(products|categories|units|inventory\/balances|stores|sales)(\/|$)/.test(key))},
]
