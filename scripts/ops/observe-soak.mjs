import assert from 'node:assert/strict';
import {readFile, writeFile} from 'node:fs/promises';
import {setTimeout as delay} from 'node:timers/promises';
import {resolve, dirname, basename} from 'node:path';
import {PrismaClient} from '@prisma/client';

// Read-only companion: samples while requests are in flight, not just after waves.
const url=new URL(process.env.DATABASE_URL??'');
assert.equal(url.hostname,'127.0.0.1');assert.equal(url.port,'55439');
assert.equal(url.pathname,'/pos_test');assert.equal(url.username,'pos_test');
const path=resolve(process.argv[2]??'');
assert.equal(dirname(path),resolve('tasks/evidence'));
assert.match(basename(path),/^soak-[0-9a-f-]{36}\.json$/);
const first=JSON.parse(await readFile(path,'utf8'));
assert.match(first.runId,/^[0-9a-f-]{36}$/);
url.searchParams.set('application_name','pos_soak_observer_'+first.runId);
url.searchParams.set('connection_limit','1');
const db=new PrismaClient({datasources:{db:{url:url.toString()}}});
const output=resolve('tasks/evidence','soak-observer-'+first.runId+'.json');
const result={runId:first.runId,startedAt:new Date().toISOString(),readOnly:true,
  intervalMs:1000,scope:'only run application_name; observer connection excluded',
  coverage:'observer begins at its own timestamp; earlier load is not claimed',samples:[]};
let sinceWrite=0;
try {
  for(;;){
    const run=JSON.parse(await readFile(path,'utf8'));
    if(run.endedAt||run.failure){result.endedAt=new Date().toISOString();result.mainAccepted=run.accepted;break;}
    const [connections]=await db.$queryRaw`SELECT count(*)::int AS total,
      count(*) FILTER(WHERE state='active')::int AS active,
      count(*) FILTER(WHERE state='idle in transaction')::int AS idleInTransaction,
      count(*) FILTER(WHERE state='active' AND wait_event_type='Lock')::int AS lockWaiting,
      count(*) FILTER(WHERE state='active' AND wait_event_type IS NOT NULL)::int AS waiting
      FROM pg_stat_activity WHERE application_name=${'pos_soak_'+first.runId}`;
    const pid=run.samples.at(-1)?.pid;
    let rssBytes=null;
    if(pid){try{const status=await readFile('/proc/'+pid+'/status','utf8');rssBytes=Number(status.match(/^VmRSS:\s+(\d+)/m)?.[1]??0)*1024;}catch{/* restart */}}
    result.samples.push({at:new Date().toISOString(),pid,rssBytes,connections});
    if(++sinceWrite>=30){await writeFile(output,JSON.stringify(result,null,2)+'\n',{mode:0o600});sinceWrite=0;}
    await delay(1000);
  }
  await writeFile(output,JSON.stringify(result,null,2)+'\n',{mode:0o600});
  console.info(JSON.stringify({output,samples:result.samples.length,mainAccepted:result.mainAccepted}));
}finally{await db.$disconnect();}
