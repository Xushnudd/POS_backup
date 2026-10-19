import {test} from 'node:test'
import assert from 'node:assert/strict'
import {CUSTOM_ROLE_TEMPLATES,allowedCustomPermission,assertCustomRoutePermission,permissionKey} from '@/server/auth/custom-role-policy'
import type {TokenPayload} from '@/lib/auth'
test('Custom role templates only restrict reviewed base-role permissions, with static precedence and no owner escalation',()=>{
 assert.deepEqual(CUSTOM_ROLE_TEMPLATES.map(row=>row.name),['Omborchi','Buxgalter','Kuzatuvchi'])
 for(const row of CUSTOM_ROLE_TEMPLATES){assert.ok(row.permissions.length>0);for(const key of row.permissions)assert.ok(allowedCustomPermission(key,row.baseRole),key)}
 assert.equal(allowedCustomPermission('POST /api/roles','admin'),false)
 assert.equal(allowedCustomPermission('GET /api/reports/profit','cashier'),false)
 assert.equal(allowedCustomPermission('GET /api/future','admin'),false)
 assert.equal(permissionKey('/api/products/prices','POST'),'POST /api/products/prices')
 assert.equal(permissionKey('/api/products/00000000-0000-4000-8000-000000000001','HEAD'),'GET /api/products/[id]')
})
test('Restricted profiles retain personal account controls, allow only explicit business actions and fail closed',()=>{
 const ctx={customRole:{id:'role',name:'Read only',revision:1,permissions:['GET /api/products']}} as TokenPayload
 assert.doesNotThrow(()=>assertCustomRoutePermission(ctx,'/api/products','HEAD'))
 assert.doesNotThrow(()=>assertCustomRoutePermission(ctx,'/api/auth/totp','GET'))
 assert.doesNotThrow(()=>assertCustomRoutePermission(ctx,'/api/organizations/switch','POST'))
 assert.throws(()=>assertCustomRoutePermission(ctx,'/api/products','POST'),{code:'FORBIDDEN'})
 assert.throws(()=>assertCustomRoutePermission(ctx,'/api/products/unknown','GET'),{code:'FORBIDDEN'})
 assert.throws(()=>assertCustomRoutePermission(ctx,'/api/future','GET'),{code:'FORBIDDEN'})
})
