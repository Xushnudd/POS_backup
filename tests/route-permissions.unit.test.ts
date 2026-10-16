import { test } from 'node:test'
import assert from 'node:assert/strict'
import { readdirSync, readFileSync } from 'node:fs'
import { join, relative } from 'node:path'
import { assertRoutePermission, AccessError } from '@/server/auth/policy'
import { ROUTE_PERMISSIONS, routePermissionRoles } from '@/server/auth/route-permissions'

// The two document viewers are approved capability-only POST boundaries, not
// session-authorized business actions. Their origin, token, tenant, expiry,
// consent and restore fences are exercised by integration/browser tests.
const publicPaths = new Set(['/api/auth/login','/api/auth/register','/api/auth/logout','/api/auth/invitations/accept','/api/auth/password-reset/request','/api/auth/password-reset/complete','/api/health/live','/api/health/ready','/api/receipt-view','/api/reminder-view'])
function files(dir: string): string[] {
  return readdirSync(dir,{withFileTypes:true}).flatMap(entry => entry.isDirectory() ? files(join(dir,entry.name)) : entry.name === 'route.ts' ? [join(dir,entry.name)] : [])
}
test('Every protected exported action has an explicit reviewed permission entry, without stale entries', () => {
  const root = join(process.cwd(),'src/app/api'), actual: string[] = []
  for (const file of files(root)) {
    const path = '/api/' + relative(root,file).replace(/\/route\.ts$/,'')
    if (publicPaths.has(path)) continue
    const source = readFileSync(file,'utf8')
    assert.match(source,/withApi/,path)
    for (const match of source.matchAll(/export\s+(?:async\s+)?(?:const|function)\s+(GET|HEAD|POST|PUT|PATCH|DELETE|OPTIONS)\b/g)) actual.push(match[1]+' '+path)
  }
  assert.deepEqual(actual.sort(),Object.keys(ROUTE_PERMISSIONS).sort())
  assert.ok(actual.length >= 243)
  for (const [key, roles] of Object.entries(ROUTE_PERMISSIONS)) {
    const [method,template] = key.split(' ')
    const path = template.replace(/\[[^\]]+\]/g,'00000000-0000-4000-8000-000000000001')
    for (const role of ['owner','admin','cashier','unrecognized']) {
      if (roles.includes(role as 'owner')) assert.doesNotThrow(() => assertRoutePermission(path,method,role),key+' '+role)
      else assert.throws(() => assertRoutePermission(path,method,role),error => error instanceof AccessError && error.status === 403,key+' '+role)
    }
  }
})
test('Security-sensitive roles, static routes and unknown methods fail closed independently of the matrix inventory', () => {
  for (const role of ['owner','admin','cashier']) {
    for (const path of ['/api/future-admin','/api/products/new/unreviewed','/api/organizations//users'])
      assert.throws(() => assertRoutePermission(path,'POST',role),AccessError)
    assert.throws(() => assertRoutePermission('/api/products','TRACE',role),AccessError)
  }
  assert.doesNotThrow(() => assertRoutePermission('/api/organizations/switch','POST','cashier'))
  assert.doesNotThrow(() => assertRoutePermission('/api/products','HEAD','cashier'))
  assert.throws(() => assertRoutePermission('/api/products','POST','cashier'),AccessError)
  assert.throws(() => assertRoutePermission('/api/organizations/00000000-0000-4000-8000-000000000001/users','GET','admin'),AccessError)
  assert.throws(() => assertRoutePermission('/api/reports/profit','GET','cashier'),AccessError)
  assert.throws(() => assertRoutePermission('/api/sales/00000000-0000-4000-8000-000000000001/void','POST','cashier'),AccessError)
  assert.doesNotThrow(() => assertRoutePermission('/api/sales','POST','cashier'))
  assert.deepEqual(routePermissionRoles('/api/products/prices','POST'),ROUTE_PERMISSIONS['POST /api/products/prices'])
})
