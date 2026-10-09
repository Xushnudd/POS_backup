import {test,after} from 'node:test'
import assert from 'node:assert/strict'
import {randomUUID,randomBytes} from 'node:crypto'
import {NextRequest} from 'next/server'
import {prisma} from '@/lib/prisma'
import {sessionHash} from '@/server/auth/session'
const connection=new URL(process.env.DATABASE_URL??'');if(connection.hostname!=='127.0.0.1'||connection.port!=='55439'||connection.pathname!=='/pos_test')throw new Error('Isolated DB only');const orgs:string[]=[],users:string[]=[];after(async()=>{await prisma.organization.deleteMany({where:{id:{in:orgs}}});await prisma.user.deleteMany({where:{id:{in:users}}});await prisma.$disconnect();});
async function fixture(){const org=await prisma.organization.create({data:{name:'Mutation live authorization',phone:randomUUID()}});orgs.push(org.id);const user=await prisma.user.create({data:{fullName:'Authorized owner',phone:randomUUID(),passwordHash:'not-a-login'}});users.push(user.id);const member=await prisma.organizationUser.create({data:{organizationId:org.id,userId:user.id,role:'owner'}}),store=await prisma.store.create({data:{organizationId:org.id,name:'Original branch'}}),product=await prisma.product.create({data:{organizationId:org.id,name:'Original product',sku:randomUUID(),barcode:randomUUID(),unit:'dona',salePrice:100,costPrice:40}});const token=randomBytes(32).toString('base64url'),session=await prisma.session.create({data:{userId:user.id,organizationId:org.id,tokenHash:sessionHash(token),expiresAt:new Date(Date.now()+3600000),idleExpiresAt:new Date(Date.now()+3600000)}});return {org,user,member,store,product,session,cookie:'pos_session='+token};}
test('Revocation between HTTP validation and CRUD transaction prevents writes and audit; manager approval cannot use stale membership',async()=>{
 for(const action of ['product','category','customer','supplier','store','discount-policy','staff'] as const){const f=await fixture();let path:string,body:Record<string,unknown>,method='POST',route:string;
 if(action==='product'){path='products/'+f.product.id;route='products/[id]';method='PUT';body={salePrice:1};}
 else if(action==='category'){path=route='categories';body={organizationId:f.org.id,name:'Unauthorized category'};}
 else if(action==='customer'){path=route='customers';body={organizationId:f.org.id,fullName:'Unauthorized customer',phone:'998'+Date.now().toString().slice(-9),creditLimit:100};}
 else if(action==='supplier'){path=route='suppliers';body={organizationId:f.org.id,name:'Unauthorized supplier'};}
 else if(action==='store'){path='stores/'+f.store.id;route='stores/[id]';method='PUT';body={name:'Unauthorized store'};}
 else if(action==='staff'){path='organizations/'+f.org.id+'/users';route='organizations/[id]/users';body={fullName:'Unauthorized staff',phone:'998'+Date.now(),password:'test-only-password',role:'cashier',storeIds:[f.store.id]};}
 else{path=route='settings/discounts';method='PUT';body={cashierMaxPercent:100,adminMaxPercent:100,requireReasonFromPercent:0};}
 const request=new NextRequest('http://localhost:3000/api/'+path,{method,headers:{cookie:f.cookie,origin:'http://localhost:3000','content-type':'application/json'},body:JSON.stringify(body)});
 // Common guard clones the body first; revoke only when the authorized handler
 // reads its validated body, deterministically before its business transaction.
 Object.defineProperty(request,'json',{value:async()=>{await prisma.session.update({where:{id:f.session.id},data:{revokedAt:new Date()}});return body;}});
 const routeModule=await import('../src/app/api/'+route+'/route');const response=await routeModule[method](request,{params:Promise.resolve({id:action==='product'?f.product.id:action==='store'?f.store.id:f.org.id})});assert.equal(response.status,401,action+' revoked before transaction');assert.equal(await prisma.auditLog.count({where:{organizationId:f.org.id}}),0);assert.equal((await prisma.product.findUniqueOrThrow({where:{id:f.product.id}})).salePrice.toString(),'100');assert.equal((await prisma.store.findUniqueOrThrow({where:{id:f.store.id}})).name,'Original branch');assert.equal(await prisma.category.count({where:{organizationId:f.org.id}}),0);assert.equal(await prisma.customer.count({where:{organizationId:f.org.id}}),0);assert.equal(await prisma.supplier.count({where:{organizationId:f.org.id}}),0);assert.equal(await prisma.discountPolicy.count({where:{organizationId:f.org.id}}),0);assert.equal(await prisma.organizationUser.count({where:{organizationId:f.org.id}}),1);
 }
});

test('Catalog server version is tenant-bound and changes with authoritative price/unit metadata; private response is never shared-cacheable',async()=>{
 const f=await fixture(),other=await fixture(),{GET}=await import('../src/app/api/products/route');
 const list=async(organizationId=f.org.id)=>GET(new NextRequest('http://localhost:3000/api/products?'+new URLSearchParams({organizationId,limit:'50'}),{headers:{cookie:f.cookie}}),{params:Promise.resolve({})});
 const first=await list();assert.equal(first.status,200);assert.equal(first.headers.get('cache-control'),'private, no-store');const body=await first.json();const lease=body.catalogLease;assert.match(lease.version,/^[a-f0-9]{64}$/);assert.equal(Date.parse(lease.expiresAt)-Date.parse(lease.issuedAt),300000);assert.equal(body.data.length,1);assert.equal(body.data[0].organizationId,f.org.id);
 const second=await(await list()).json();assert.equal(second.catalogLease.version,lease.version);
 await prisma.product.update({where:{id:f.product.id},data:{salePrice:'101'}});const changed=await(await list()).json();assert.notEqual(changed.catalogLease.version,lease.version);assert.equal(changed.data[0].salePrice,'101');
 assert.equal((await list(other.org.id)).status,403);
 await prisma.session.update({where:{id:f.session.id},data:{revokedAt:new Date()}});assert.equal((await list()).status,401);
});
