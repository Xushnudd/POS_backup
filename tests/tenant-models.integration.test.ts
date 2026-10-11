import {test,after} from 'node:test'
import assert from 'node:assert/strict'
import {randomUUID} from 'node:crypto'
import {prisma} from '@/lib/prisma'
import {TENANT_DIRECT_MODELS,TENANT_PARENT_MODELS,SHARED_MODELS} from '@/server/auth/tenant-models'
import {scopedPrisma} from '@/server/auth/scoped-prisma'
import type {TokenPayload} from '@/lib/auth'
const url=new URL(process.env.DATABASE_URL??'');if(url.hostname!=='127.0.0.1'||url.port!=='55439'||url.pathname!=='/pos_test')throw Error('Isolated DB only')
const orgs:string[]=[];after(async()=>{await prisma.organization.deleteMany({where:{id:{in:orgs}}});await prisma.$disconnect()})
test('Native table inventory matches the reviewed model roots; every tenant table has immutable ownership and deferred edge guards',async()=>{
 const rows=await prisma.$queryRaw<{name:string;owner:boolean;edges:boolean}[]>`SELECT c.relname AS name,EXISTS(SELECT 1 FROM pg_trigger t WHERE t.tgrelid=c.oid AND t.tgname='tenant_owner') AS owner,EXISTS(SELECT 1 FROM pg_trigger t WHERE t.tgrelid=c.oid AND t.tgname='tenant_edges' AND t.tgdeferrable AND t.tginitdeferred) AS edges FROM pg_class c JOIN pg_namespace n ON n.oid=c.relnamespace WHERE n.nspname='public' AND c.relkind='r' AND c.relname<>'_prisma_migrations'`
 const scoped=[...TENANT_DIRECT_MODELS,...Object.keys(TENANT_PARENT_MODELS)]
 assert.deepEqual(rows.map(r=>r.name).sort(),['Organization',...scoped,...SHARED_MODELS].sort())
 for(const name of scoped){const row=rows.find(r=>r.name===name)!;assert.ok(row.owner&&row.edges,name)}
 assert.equal(rows.find(r=>r.name==='Organization')?.owner,true)
 for(const name of SHARED_MODELS)assert.equal(rows.find(r=>r.name===name)?.edges,false,name)
})
test('Deferred cross-tenant parent reference and direct ownership mutation fail; scoped ORM rejects foreign creates and shared models',async()=>{
 const a=await prisma.organization.create({data:{name:'Tenant edge A',phone:randomUUID()}}),b=await prisma.organization.create({data:{name:'Tenant edge B',phone:randomUUID()}});orgs.push(a.id,b.id)
 const foreign=await prisma.category.create({data:{organizationId:b.id,name:'Foreign parent'}})
 await assert.rejects(prisma.category.create({data:{organizationId:a.id,parentId:foreign.id,name:'Rejected child'}}))
 assert.equal(await prisma.category.count({where:{organizationId:a.id}}),0)
 const own=await prisma.category.create({data:{organizationId:a.id,name:'Own parent'}})
 await assert.rejects(prisma.category.update({where:{id:own.id},data:{organizationId:b.id}}))
 const db=scopedPrisma({organizationId:a.id,role:'owner',storeIds:[],userId:randomUUID(),organizationUserId:randomUUID(),sessionId:randomUUID()} as TokenPayload)
 await assert.rejects(db.category.create({data:{organizationId:b.id,name:'Wrong root'}}),{code:'TENANT_MISMATCH'})
 await assert.rejects(db.billingPlan.findMany(),{code:'UNSCOPED_MODEL'})
 await prisma.category.create({data:{organizationId:a.id,parentId:own.id,name:'Allowed child'}})
 assert.equal(await db.category.count(),2)
 await prisma.organization.delete({where:{id:b.id}});assert.equal(await db.category.count(),2)
})
test('Concurrent SKU and alias inserts have exactly one winner inside a tenant; a second tenant can use the same identifiers',async()=>{
 const a=await prisma.organization.create({data:{name:'Concurrent catalogue A',phone:randomUUID()}}),b=await prisma.organization.create({data:{name:'Concurrent catalogue B',phone:randomUUID()}});orgs.push(a.id,b.id)
 const sku='RACE-'+randomUUID(),make=(organizationId:string)=>({organizationId,name:'Concurrent product',sku,barcode:randomUUID(),unit:'dona',salePrice:'1.01',costPrice:'0.123456'})
 const writes=await Promise.allSettled([prisma.product.create({data:make(a.id)}),prisma.product.create({data:make(a.id)})]);assert.equal(writes.filter(row=>row.status==='fulfilled').length,1)
 const own=await prisma.product.findFirstOrThrow({where:{organizationId:a.id,sku}}),other=await prisma.product.create({data:make(b.id)}),alias='ALIAS-'+randomUUID()
 const aliases=await Promise.allSettled([prisma.productBarcode.create({data:{organizationId:a.id,productId:own.id,value:alias}}),prisma.productBarcode.create({data:{organizationId:a.id,productId:own.id,value:alias}})]);assert.equal(aliases.filter(row=>row.status==='fulfilled').length,1)
 await prisma.productBarcode.create({data:{organizationId:b.id,productId:other.id,value:alias}});assert.equal(await prisma.productBarcode.count({where:{value:alias}}),2)
})
