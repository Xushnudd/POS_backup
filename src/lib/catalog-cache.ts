import type {Product} from '@/types';
export const CATALOG_TTL_MS=5*60*1000;
export type CatalogScope={organizationId:string;userId:string;deviceId:string;registerId:string};
export type CatalogLease={version:string;issuedAt:string;expiresAt:string};
export type CachedCatalog={id:string;schemaVersion:1;scope:CatalogScope;query:string;lease:CatalogLease;products:Product[]};
export const catalogKey=(scope:CatalogScope,query:string)=>JSON.stringify([scope.organizationId,scope.userId,scope.deviceId,scope.registerId,query]);
export function usableCatalog(value:CachedCatalog|undefined,scope:CatalogScope,query:string,now=Date.now()){
 if(!value||value.schemaVersion!==1||value.id!==catalogKey(scope,query)||catalogKey(value.scope,value.query)!==value.id)return false;
 const issued=Date.parse(value.lease.issuedAt),expires=Date.parse(value.lease.expiresAt);
 return /^[a-f0-9]{64}$/.test(value.lease.version)&&Number.isFinite(issued)&&issued<=now&&expires>now&&expires-issued>0&&expires-issued<=CATALOG_TTL_MS&&value.products.length<=50&&value.products.every(p=>p.organizationId===scope.organizationId&&p.isActive);
}
// IndexedDB is local convenience storage, never an authorization or payment proof.
export function minimalCatalog(products:Product[]):Product[]{
 const keys=['id','organizationId','categoryId','name','sku','barcode','unit','unitPrecision','salePrice','isActive'] as const;
 return products.map(product=>Object.fromEntries(keys.filter(key=>key in product).map(key=>[key,product[key]])) as unknown as Product);
}
