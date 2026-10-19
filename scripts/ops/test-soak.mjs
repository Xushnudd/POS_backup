import assert from 'node:assert/strict';
import {spawn} from 'node:child_process';
import {randomBytes, randomUUID, createHash} from 'node:crypto';
import {readFile, writeFile, statfs, mkdir} from 'node:fs/promises';
import {resolve} from 'node:path';
import {cpus, totalmem, platform, release} from 'node:os';
import {performance} from 'node:perf_hooks';
import {createServer} from 'node:net';
import {setTimeout as delay} from 'node:timers/promises';
import {PrismaClient} from '@prisma/client';

// Deliberately refuses every non-local database. No production load generator.
const url = new URL(process.env.DATABASE_URL ?? '');
assert.equal(url.hostname, '127.0.0.1'); assert.equal(url.port, '55439');
assert.equal(url.pathname, '/pos_test'); assert.equal(url.username, 'pos_test');
const smoke = process.argv.includes('--smoke');
assert.ok(process.argv.slice(2).every(arg => arg === '--smoke'), 'Unknown argument');
const runId = randomUUID(); url.searchParams.set('application_name', 'pos_soak_' + runId);
url.searchParams.set('connection_limit', '10');
const db = new PrismaClient({datasources:{db:{url:url.toString()}}});
const directory = resolve('.next/standalone');
const output = resolve('tasks/evidence', 'soak-' + runId + '.json');
const probe = createServer();
await new Promise((yes,no) => { probe.once('error',no); probe.listen(0,'127.0.0.1',yes); });
const port = probe.address().port;
await new Promise((yes,no) => probe.close(error => error ? no(error) : yes()));
const base = 'http://127.0.0.1:' + port, origin = 'https://localhost:' + port;
const token = randomBytes(32).toString('base64url');
const secret = randomBytes(48).toString('hex');
const challengeSecret = randomBytes(32).toString('hex');
const initialStock = 100000;
const record = {runId, mode:smoke?'smoke':'acceptance', startedAt:new Date().toISOString(),
  profile:{synthetic:true, normalRegisters:20, stressConcurrentCheckouts:40, waveIntervalMs:30000,
    normalStressMinutes:smoke?null:15, normalSoakMinutes:smoke?null:120,
    referencePeak:'20 simultaneous checkouts every 30 seconds; PLAN1 synthetic profile, not measured pilot demand',
    database:'isolated pos_test on loopback:55439; shared historical test dataset',
    transport:'private loopback HTTP; HTTPS origin/cookie policy retained, no external traffic'},
  hardware:{platform:platform(), kernel:release(), node:process.version, cpu:cpus()[0]?.model,
    logicalCpus:cpus().length, memoryBytes:totalmem()}, phases:[], samples:[], restarts:[],
  requests:{successful:0, retryable:0, networkUnknown:0, byStatus:{}}, accepted:false};
let child, exited, org, user, fixtures=[];
const latencies = new Map();
async function start() {
  child = spawn(process.execPath,[resolve(directory,'server.js')],{cwd:directory,
    env:{...process.env,NODE_ENV:'production',HOSTNAME:'127.0.0.1',PORT:String(port),
      APP_ORIGIN:origin,DATABASE_URL:url.toString(),JWT_SECRET:secret,AUTH_CHALLENGE_SECRET:challengeSecret,AUTH_TOTP_PREVIOUS_SECRETS:''},stdio:'ignore'});
  exited = new Promise(yes => child.once('exit',(code,signal) => yes({code,signal})));
  const deadline = Date.now()+30000;
  for (;;) {
    assert.equal(child.exitCode,null,'Owned server exited');
    try { if ((await fetch(base+'/api/health/ready',{signal:AbortSignal.timeout(3000)})).ok) return; } catch { /* owned startup */ }
    assert.ok(Date.now()<deadline,'Readiness timeout'); await delay(100);
  }
}
async function stop(signal='SIGTERM') {
  if (!child) return;
  const owned=child; owned.kill(signal);
  const outcome=await Promise.race([exited,delay(15000,null,{ref:false})]);
  if(!outcome){owned.kill('SIGKILL');await exited;throw Error('Owned process did not stop');}
  child=undefined; return outcome;
}
async function request(path,body,phase='recovery') {
  for(let attempt=0;attempt<10;attempt++){
    const begin=performance.now(); let response;
    try { response=await fetch(base+'/api'+path,{method:body?'POST':'GET',
      headers:{cookie:'pos_session='+token,origin,'content-type':'application/json'},
      ...(body?{body:JSON.stringify(body)}:{}),signal:AbortSignal.timeout(30000)}); }
    catch { record.requests.networkUnknown++; await delay(250*(attempt+1)); continue; }
    const duration=performance.now()-begin;
    if(!latencies.has(phase))latencies.set(phase,[]); latencies.get(phase).push(duration);
    record.requests.byStatus[response.status]=(record.requests.byStatus[response.status]??0)+1;
    const result=await response.json();
    if(response.ok){record.requests.successful++;assert.equal(result.success,true);return result.data;}
    if((response.status===409&&result.error?.code==='CONCURRENT_CONFLICT')||response.status===429||response.status===503){
      record.requests.retryable++;await delay(response.status===429?61000:250*(attempt+1));continue;
    }
    throw Error('HTTP '+response.status+' '+result.error?.code+' '+path);
  }
  throw Error('Retry budget exhausted: '+path);
}
async function checkout(f,phase) {
  const operationId=randomUUID();
  const draft={organizationId:org.id,storeId:f.storeId,registerId:f.registerId,shiftId:f.shiftId,
    operationId,items:[{productId:f.productId,quantity:'1'}]};
  const sale=await request('/sales',draft,phase);
  const completion={operationId:randomUUID(),payments:[{paymentType:'cash',amount:'1.01'}]};
  await request('/sales/'+sale.id+'/complete',completion,phase);
  // Every completed response is replayed, with exactly its original immutable key.
  await request('/sales/'+sale.id+'/complete',completion,phase);
  f.commands.push({draft,completion,saleId:sale.id});
}
async function sample(phase) {
  const proc=await readFile('/proc/'+child.pid+'/status','utf8');
  const rss=Number(proc.match(/^VmRSS:\s+(\d+)/m)?.[1]??0)*1024;
  const memory=Number(proc.match(/^VmSize:\s+(\d+)/m)?.[1]??0)*1024;
  const cpuStat=(await readFile('/proc/'+child.pid+'/stat','utf8')).split(') ')[1].split(' ');
  const io=await readFile('/proc/'+child.pid+'/io','utf8');
  const disk=await statfs(process.cwd());
  const [database]=await db.$queryRaw`SELECT pg_database_size(current_database())::text AS bytes,
    (SELECT count(*)::int FROM pg_stat_activity WHERE application_name=${'pos_soak_'+runId}) AS connections,
    (SELECT count(*)::int FROM pg_stat_activity WHERE application_name=${'pos_soak_'+runId} AND wait_event IS NOT NULL AND state='active') AS waiting,
    (SELECT deadlocks::text FROM pg_stat_database WHERE datname=current_database()) AS deadlocks`;
  const queues=await db.backgroundJob.groupBy({by:['state'],where:{organizationId:org.id},_count:true});
  record.samples.push({at:new Date().toISOString(),phase,pid:child.pid,rssBytes:rss,virtualBytes:memory,cpuUserTicks:Number(cpuStat[11]),cpuSystemTicks:Number(cpuStat[12]),
    readBytes:Number(io.match(/^read_bytes:\s+(\d+)/m)?.[1]??0),writeBytes:Number(io.match(/^write_bytes:\s+(\d+)/m)?.[1]??0),
    diskFreeBytes:disk.bavail*disk.bsize,database,queues});
  await persist();
}
async function persist(){await mkdir(resolve('tasks/evidence'),{recursive:true});await writeFile(output,JSON.stringify(record,null,2)+'\n',{mode:0o600});}
async function phase(name,count,durationMs,intervalMs) {
  const begin=performance.now(), startAt=new Date().toISOString(); let waves=0;
  while(performance.now()-begin<durationMs){
    const waveBegin=performance.now();
    await Promise.all(Array.from({length:count},(_,i)=>checkout(fixtures[i%fixtures.length],name))); waves++;
    await sample(name);
    console.info(JSON.stringify({phase:name,waves,elapsedSeconds:Math.floor((performance.now()-begin)/1000),sales:fixtures.reduce((sum,f)=>sum+f.commands.length,0)}));
    const elapsed=performance.now()-begin;
    const nextWave=(waveBegin-begin)+intervalMs;
    if(nextWave>=durationMs){await delay(Math.max(0,durationMs-elapsed)+1);break;}
    await delay(Math.max(0,nextWave-elapsed));
  }
  const values=latencies.get(name).sort((a,b)=>a-b), quantile=p=>values[Math.min(values.length-1,Math.floor(values.length*p))];
  record.phases.push({name,concurrentCheckouts:count,startAt,endedAt:new Date().toISOString(),durationMs:performance.now()-begin,
    requestedDurationMs:durationMs,waves,requests:values.length,p50Ms:quantile(.5),p95Ms:quantile(.95),p99Ms:quantile(.99),maxMs:values.at(-1)});
  await persist();
}
async function recovery(signal) {
  const f=fixtures[0];const command=f.commands.at(-1);
  const begin=performance.now();const outcome=await stop(signal);await start();
  // The server process and all in-memory pools are gone; persisted commands survive.
  const draft=await request('/sales',command.draft);assert.equal(draft.id,command.saleId);
  await request('/sales/'+command.saleId+'/complete',command.completion);
  record.restarts.push({signal,outcome,recoveryMs:performance.now()-begin,replayedSaleId:command.saleId});await persist();
}
async function verify() {
  const expected=fixtures.reduce((sum,f)=>sum+f.commands.length,0);
  assert.equal(await db.sale.count({where:{organizationId:org.id,status:'completed'}}),expected);
  assert.equal(await db.sale.count({where:{organizationId:org.id,status:{not:'completed'}}}),0);
  assert.equal(await db.saleItem.count({where:{sale:{organizationId:org.id}}}),expected);
  assert.equal(await db.payment.count({where:{organizationId:org.id}}),expected);
  assert.equal(await db.inventoryMovement.count({where:{organizationId:org.id,sourceType:'sale'}}),expected);
  const payments=await db.payment.aggregate({where:{organizationId:org.id},_sum:{amount:true}});
  assert.equal(payments._sum.amount.toFixed(2),(BigInt(expected)*101n/100n).toString()+'.'+String(BigInt(expected)*101n%100n).padStart(2,'0'));
  for(const f of fixtures){
    const balance=await db.inventoryBalance.findUniqueOrThrow({where:{storeId_productId:{storeId:f.storeId,productId:f.productId}}});
    assert.equal(balance.quantity.toString(),String(initialStock-f.commands.length));
    const movement=await db.inventoryMovement.aggregate({where:{organizationId:org.id,storeId:f.storeId,productId:f.productId},_sum:{quantityDelta:true}});
    assert.equal(movement._sum.quantityDelta.toString(),String(-f.commands.length));
  }
  record.invariants={completedSales:expected,saleItems:expected,payments:expected,saleMovements:expected,
    cashAmount:payments._sum.amount.toFixed(2),duplicates:0,missingCommands:0,stockChecks:fixtures.length};
  assert.equal(record.restarts.length,2);
  record.accepted=!smoke&&record.phases[0].durationMs>=900000&&record.phases[1].durationMs>=7200000;
}
try {
  org=await db.organization.create({data:{name:'Isolated soak '+runId,phone:randomUUID()}});
  user=await db.user.create({data:{fullName:'Synthetic soak owner',phone:randomUUID(),passwordHash:'not-a-login'}});
  const member=await db.organizationUser.create({data:{organizationId:org.id,userId:user.id,role:'owner'}});
  const store=await db.store.create({data:{organizationId:org.id,name:'Synthetic soak branch'}});
  const expiry=new Date(Date.now()+6*3600000);
  await db.session.create({data:{organizationId:org.id,userId:user.id,tokenHash:createHash('sha256').update(token).digest('hex'),expiresAt:expiry,idleExpiresAt:expiry}});
  for(let i=0;i<20;i++){
    const register=await db.register.create({data:{storeId:store.id,name:'Synthetic till '+i,code:'SOAK-'+i}});
    const shift=await db.shift.create({data:{registerId:register.id,organizationUserId:member.id,openingCash:0}});
    const product=await db.product.create({data:{organizationId:org.id,name:'Synthetic soak item '+i,sku:randomUUID(),barcode:randomUUID(),unit:'dona',salePrice:'1.01',costPrice:'0.123456'}});
    await db.inventoryBalance.create({data:{storeId:store.id,productId:product.id,quantity:initialStock}});
    fixtures.push({storeId:store.id,registerId:register.id,shiftId:shift.id,productId:product.id,commands:[]});
  }
  record.fixture={organizationId:org.id,registers:20,initialStockPerProduct:initialStock};
  await start();await phase('stress',40,smoke?15000:900000,smoke?15000:30000);
  await recovery('SIGKILL');
  await phase('soak',20,smoke?15000:7200000,smoke?15000:30000);
  await recovery('SIGTERM');await verify();
  record.endedAt=new Date().toISOString();await persist();
  console.info(JSON.stringify({result:smoke?'SMOKE_PASS_NOT_ACCEPTANCE':'ACCEPTANCE_PASS',output,invariants:record.invariants}));
} catch(error) {
  record.failure={message:error.message,at:new Date().toISOString()};await persist();throw error;
} finally {
  await stop();if(org)await db.organization.delete({where:{id:org.id}});
  if(user)await db.user.delete({where:{id:user.id}});await db.$disconnect();
}
