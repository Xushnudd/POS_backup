import assert from 'node:assert/strict';
import {spawn} from 'node:child_process';
import {randomBytes,randomUUID,createHash} from 'node:crypto';
import {resolve} from 'node:path';
import {createServer} from 'node:net';
import {setTimeout as delay} from 'node:timers/promises';
import {PrismaClient} from '@prisma/client';
const connection=new URL(process.env.DATABASE_URL??'');
if(connection.hostname!=='127.0.0.1'||connection.port!=='55439'||connection.username!=='pos_test'||connection.pathname!=='/pos_test')throw new Error('Isolated test database required');
const probe=createServer();await new Promise((resolveListen,reject)=>{probe.once('error',reject);probe.listen(0,'127.0.0.1',resolveListen)});
const port=probe.address().port;await new Promise((resolveClose,reject)=>probe.close(error=>error?reject(error):resolveClose()));
const base='http://127.0.0.1:'+port,origin='https://localhost:'+port;
const db=new PrismaClient(),directory=resolve('.next/standalone');
let child,exited,org,user;
async function start(database=process.env.DATABASE_URL){
 child=spawn(process.execPath,[resolve(directory,'server.js')],{cwd:directory,env:{...process.env,NODE_ENV:'production',HOSTNAME:'127.0.0.1',PORT:String(port),APP_ORIGIN:origin,DATABASE_URL:database},stdio:'ignore'});
 exited=new Promise(resolveExit=>child.once('exit',(code,signal)=>resolveExit({code,signal})));
 const deadline=Date.now()+30000;
 for(;;){
  if(child.exitCode!==null)throw new Error('Test server exited before liveness');
  try{if((await fetch(base+'/api/health/live',{signal:AbortSignal.timeout(1000)})).ok)break;}catch{ /* Wait for the owned process to bind. */ }
  if(Date.now()>deadline)throw new Error('Test server liveness timeout');await delay(100);
 }
}
async function stop(){
 if(!child)return;
 const owned=child;owned.kill('SIGTERM');
 const outcome=await Promise.race([exited,delay(15000,null,{ref:false})]);
 if(!outcome){owned.kill('SIGKILL');await exited;throw new Error('Graceful shutdown deadline exceeded');}
 child=undefined;
}
async function readiness(expected){assert.equal((await fetch(base+'/api/health/ready',{signal:AbortSignal.timeout(5000)})).status,expected);}
try{
 org=await db.organization.create({data:{name:'Restart fixture',phone:randomUUID()}});
 user=await db.user.create({data:{fullName:'Restart owner',phone:randomUUID(),passwordHash:'not-a-login'}});
 const member=await db.organizationUser.create({data:{organizationId:org.id,userId:user.id,role:'owner'}});
 const store=await db.store.create({data:{organizationId:org.id,name:'Restart branch'}}),register=await db.register.create({data:{storeId:store.id,name:'Restart register',code:randomUUID()}});
 const shift=await db.shift.create({data:{registerId:register.id,organizationUserId:member.id,openingCash:0}}),product=await db.product.create({data:{organizationId:org.id,name:'Restart item',sku:randomUUID(),barcode:randomUUID(),unit:'dona',salePrice:'1.01',costPrice:'0.50'}});
 await db.inventoryBalance.create({data:{storeId:store.id,productId:product.id,quantity:3}});
 const token=randomBytes(32).toString('base64url');await db.session.create({data:{organizationId:org.id,userId:user.id,tokenHash:createHash('sha256').update(token).digest('hex'),expiresAt:new Date(Date.now()+3600000),idleExpiresAt:new Date(Date.now()+3600000)}});
 const request=async(path,body)=>{const response=await fetch(base+'/api'+path,{method:body?'POST':'GET',headers:{cookie:'pos_session='+token,origin,'content-type':'application/json'},...(body?{body:JSON.stringify(body)}:{}),signal:AbortSignal.timeout(15000)});assert.equal(response.status,200);return response.json()};
 await start();await readiness(200);
 const draftBody={organizationId:org.id,storeId:store.id,registerId:register.id,shiftId:shift.id,operationId:randomUUID(),items:[{productId:product.id,quantity:'1'}]};
 const first=(await request('/sales',draftBody)).data,held=(await request('/sales',{...draftBody,operationId:randomUUID()})).data;
 const complete={payments:[{paymentType:'cash',amount:'1.01'}]};
 await request('/sales/'+first.id+'/complete',complete);
 await stop();await start();await readiness(200);
 assert.equal((await request('/sales/'+held.id)).data.status,'draft');
 await request('/sales/'+first.id+'/complete',complete);
 await request('/sales/'+held.id+'/complete',complete);
 await stop();await start();await readiness(200);
 await request('/sales/'+held.id+'/complete',complete);
 assert.equal(await db.sale.count({where:{organizationId:org.id,status:'completed'}}),2);
 assert.equal(await db.payment.count({where:{organizationId:org.id}}),2);
 assert.equal(await db.inventoryMovement.count({where:{organizationId:org.id,sourceType:'sale'}}),2);
 assert.equal((await db.inventoryBalance.findUniqueOrThrow({where:{storeId_productId:{storeId:store.id,productId:product.id}}})).quantity.toString(),'1');
 await stop();
 await start('postgresql://build_only:build-only-placeholder@127.0.0.1:9/build_only');await readiness(503);await stop();
 console.info('PASS: actual standalone SIGTERM/restart twice preserves completed and held sales; replay payment2/movement2/balance1; disconnected dependency live200/ready503; localhost internal transport only');
}finally{
 await stop();
 if(org)await db.organization.delete({where:{id:org.id}});
 if(user)await db.user.delete({where:{id:user.id}});
 await db.$disconnect();
}
