import test,{after} from 'node:test';
import assert from 'node:assert/strict';
import {randomUUID,randomBytes} from 'node:crypto';
import {NextRequest} from 'next/server';
import {prisma} from '@/lib/prisma';
import {sessionHash} from '@/server/auth/session';
import {GET} from '@/app/api/organizations/[id]/users/route';
const url=new URL(process.env.DATABASE_URL??'');if(url.hostname!=='127.0.0.1'||url.port!=='55439'||url.pathname!=='/pos_test')throw Error('Isolated DB only');
const orgs:string[]=[],users:string[]=[];
after(async()=>{await prisma.organization.deleteMany({where:{id:{in:orgs}}});await prisma.user.deleteMany({where:{id:{in:users}}});await prisma.$disconnect()});
test('Opt-in staff pages preserve legacy complete DTO, apply global authorized sort/filter and never expose credential hashes',async()=>{
 const org=await prisma.organization.create({data:{name:'Staff list fixture',phone:randomUUID()}});orgs.push(org.id);
 const owner=await prisma.user.create({data:{fullName:'Owner',phone:randomUUID(),passwordHash:'not-a-login'}});users.push(owner.id);await prisma.organizationUser.create({data:{organizationId:org.id,userId:owner.id,role:'owner'}});
 const token=randomBytes(32).toString('base64url');await prisma.session.create({data:{organizationId:org.id,userId:owner.id,tokenHash:sessionHash(token),expiresAt:new Date(Date.now()+3600000),idleExpiresAt:new Date(Date.now()+3600000)}});
 for(let i=0;i<43;i++){const user=await prisma.user.create({data:{fullName:'Staff list member '+String(i).padStart(3,'0'),phone:randomUUID(),passwordHash:'must-not-leak'}});users.push(user.id);await prisma.organizationUser.create({data:{organizationId:org.id,userId:user.id,role:'cashier',isActive:i!==42}})}
 const read=(query='',id=org.id)=>GET(new NextRequest('http://localhost:3000/api/organizations/'+id+'/users'+query,{headers:{cookie:'pos_session='+token}}),{params:Promise.resolve({id})});
 const names:string[]=[];for(let page=1;page<=3;page++){const response=await read('?search=Staff+list+member&sort=name_desc&page='+page+'&limit=20');assert.equal(response.status,200);const result=await response.json();assert.equal(result.pagination.total,43);names.push(...result.data.map((row:{user:{fullName:string}})=>row.user.fullName));assert.ok(!JSON.stringify(result).includes('must-not-leak'));assert.ok(!JSON.stringify(result).includes('passwordHash'));}
 assert.deepEqual(names,Array.from({length:43},(_,i)=>'Staff list member '+String(42-i).padStart(3,'0')));
 const legacy=await(await read()).json();assert.equal(legacy.data.length,44);assert.equal(legacy.pagination,undefined);
 assert.equal((await(await read('?status=blocked&search=Staff+list')).json()).pagination.total,1);assert.equal((await(await read('?search=NO-SUCH-STAFF')).json()).pagination.total,0);
 for(const query of ['?page=0','?limit=201','?sort=passwordHash','?status=invented'])assert.equal((await read(query)).status,400);
 assert.equal((await read('?page=1',randomUUID())).status,404);
 assert.equal(await prisma.auditLog.count({where:{organizationId:org.id}}),0);
});
