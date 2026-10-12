import test from 'node:test'
import assert from 'node:assert/strict'
import {Prisma} from '@prisma/client'
import {TENANT_DIRECT_MODELS,TENANT_PARENT_MODELS,TENANT_PARENT_SCOPES,SHARED_MODELS} from '@/server/auth/tenant-models'
import {tenantScope} from '@/server/auth/policy'
import type {TokenPayload} from '@/lib/auth'
const context={organizationId:'tenant-a',role:'admin',storeIds:['branch-a'],userId:'actor',organizationUserId:'member'} as TokenPayload
test('Every model has one explicit root; child roots are required schema relations, never implicit globals',()=>{
 const names=['Organization',...TENANT_DIRECT_MODELS,...Object.keys(TENANT_PARENT_MODELS),...SHARED_MODELS]
 assert.equal(new Set(names).size,names.length)
 assert.deepEqual([...names].sort(),Prisma.dmmf.datamodel.models.map(m=>m.name).sort())
 for(const name of TENANT_DIRECT_MODELS){const m=Prisma.dmmf.datamodel.models.find(m=>m.name===name)!;assert.ok(m.fields.find(f=>f.name==='organizationId'&&f.isRequired))}
 for(const [name,[parent,key]] of Object.entries(TENANT_PARENT_MODELS)){
  const m=Prisma.dmmf.datamodel.models.find(m=>m.name===name)!,relation=TENANT_PARENT_SCOPES[name]
  assert.ok(m.fields.find(f=>f.name===key&&f.isRequired),name)
  assert.ok(m.fields.find(f=>f.name===relation[1]&&f.type===parent&&f.relationFromFields?.includes(key)),name)
  assert.ok(JSON.stringify(tenantScope(name,context)).includes('tenant-a'),name)
 }
 for(const name of SHARED_MODELS){if(name==='User')continue;assert.throws(()=>tenantScope(name,context),{code:'UNSCOPED_MODEL'},name)}
 assert.throws(()=>tenantScope('FutureUnreviewedModel',context),{code:'UNSCOPED_MODEL'})
})
test('Child scopes retain branch and cashier restrictions through every parent',()=>{
 assert.deepEqual(tenantScope('SupplierAllocationRelease',context),{allocation:{invoice:{organizationId:'tenant-a',storeId:{in:['branch-a']}}}})
 assert.deepEqual(tenantScope('PurchaseReceiptLine',context),{receipt:{order:{organizationId:'tenant-a',storeId:{in:['branch-a']}}}})
 const cashier={...context,role:'cashier' as const}
 assert.deepEqual(tenantScope('SaleReturnItem',cashier),{saleReturn:{sale:{organizationId:'tenant-a',store:{organizationId:'tenant-a',id:{in:['branch-a']}},cashierId:'actor'}}})
})
test('Insert roots are explicit, nested organization connects cannot bypass scope and parent checks are required',async()=>{
 const {tenantInsertReference}=await import('@/server/auth/tenant-write')
 assert.equal(tenantInsertReference('Product',{organizationId:'tenant-a'},context),null)
 assert.equal(tenantInsertReference('Product',{organization:{connect:{id:'tenant-a'}}},context),null)
 assert.throws(()=>tenantInsertReference('Product',{organizationId:'tenant-b'},context),{code:'TENANT_MISMATCH'})
 assert.throws(()=>tenantInsertReference('Product',{},context),{code:'TENANT_MISMATCH'})
 assert.deepEqual(tenantInsertReference('SaleItem',{sale:{connect:{id:'sale-a'}}},context),{model:'Sale',id:'sale-a'})
 assert.throws(()=>tenantInsertReference('SaleItem',{sale:{create:{}}},context),{code:'TENANT_SCOPE_REQUIRED'})
 assert.throws(()=>tenantInsertReference('User',{},context),{code:'UNSCOPED_MODEL'})
})
test('Global product valuation order is owner-only and cannot be forged through generic tenant inserts',async()=>{
 const {tenantInsertReference}=await import('@/server/auth/tenant-write')
 for(const model of ['InventoryValuationSequence','InventoryValuationEvent']){
  assert.throws(()=>tenantScope(model,context),{code:'OWNER_REQUIRED'})
  assert.deepEqual(tenantScope(model,{...context,role:'owner'}),{organizationId:'tenant-a'})
  assert.throws(()=>tenantInsertReference(model,{organizationId:'tenant-a'},{...context,role:'owner'}),{code:'VALUATION_JOURNAL_READ_ONLY'})
 }
})
