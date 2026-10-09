import test from 'node:test';
import assert from 'node:assert/strict';
import {CATALOG_TTL_MS,catalogKey,minimalCatalog,usableCatalog,type CachedCatalog} from '../src/lib/catalog-cache';
import type {Product} from '../src/types';
test('Local catalog scopes, exact TTL boundary, clock rollback and format version fail closed',()=>{
 const scope={organizationId:'A',userId:'U',deviceId:'D',registerId:'R'},query='search',now=1000000;
 const product={id:'P',organizationId:'A',name:'Item',sku:'SKU',barcode:'B',unit:'dona',salePrice:10,costPrice:5,minStock:2,isActive:true} as Product;
 const value:CachedCatalog={id:catalogKey(scope,query),schemaVersion:1,scope,query,lease:{version:'a'.repeat(64),issuedAt:new Date(now).toISOString(),expiresAt:new Date(now+CATALOG_TTL_MS).toISOString()},products:[product]};
 assert.equal(usableCatalog(value,scope,query,now),true);assert.equal(usableCatalog(value,scope,query,now+CATALOG_TTL_MS-1),true);
 for(const point of [now-1,now+CATALOG_TTL_MS])assert.equal(usableCatalog(value,scope,query,point),false);
 for(const field of ['organizationId','userId','deviceId','registerId'])assert.equal(usableCatalog(value,{...scope,[field]:'OTHER'},query,now),false);
 assert.equal(usableCatalog(value,scope,'other query',now),false);
 assert.equal(usableCatalog({...value,schemaVersion:2} as unknown as CachedCatalog,scope,query,now),false);
 assert.equal(usableCatalog({...value,products:[{...product,organizationId:'B'}]},scope,query,now),false);
 assert.equal(usableCatalog({...value,products:[{...product,isActive:false}]},scope,query,now),false);
 assert.equal(usableCatalog({...value,lease:{...value.lease,expiresAt:new Date(now+CATALOG_TTL_MS+1).toISOString()}},scope,query,now),false);
 assert.equal(usableCatalog({...value,products:Array(51).fill(product)},scope,query,now),false);
});
test('Catalog storage strips cost, balance, private image URLs and description even for owners',()=>{
 const product={id:'P',organizationId:'A',name:'Item',sku:'SKU',barcode:'B',unit:'dona',salePrice:10,costPrice:5,minStock:2,balance:500,imageUrl:'/api/files/private',description:'private',isActive:true} as Product;
 const saved=minimalCatalog([product])[0];assert.equal(saved.salePrice,10);
 for(const key of ['costPrice','minStock','balance','imageUrl','description'])assert.equal(key in saved,false);
});
