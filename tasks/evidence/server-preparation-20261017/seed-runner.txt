// Disposable test fixture preparation. No actual load is measured here.
const fs=require('node:fs'),{spawn,spawnSync}=require('node:child_process');
const connection=new URL(process.env.DATABASE_URL??'');
if(connection.hostname!=='127.0.0.1'||connection.port!=='55439'||connection.pathname!=='/pos_test'||connection.username!=='pos_test')throw Error('Isolated review DB only');
const directory='tasks/evidence/server-preparation-20261017/';
async function main(){
 const startedAt=new Date().toISOString();let log='',stopped=false;
 const child=spawn(process.execPath,['--require','./scripts/test-resolver.cjs','.test-build/tests/performance/core-profile.js','--seed-only'],{env:process.env,stdio:['ignore','pipe','pipe']});
 const closed=new Promise((resolve,reject)=>{child.on('error',reject);child.on('close',(code,signal)=>resolve({code,signal}))});
 child.stdout.on('data',chunk=>{log+=chunk.toString();if(!stopped&&log.includes('volume: 20 active tills created')){stopped=true;child.kill('SIGTERM')}});
 child.stderr.on('data',chunk=>{log+=chunk.toString()});
 const result=await closed;fs.writeFileSync(directory+'seed-initial.log',log,{flag:'wx'});
 fs.writeFileSync(directory+'seed-initial.json',JSON.stringify({startedAt,endedAt:new Date().toISOString(),...result,intentionallyStoppedAfterTwentyRegisters:stopped,measurement:false,scope:'isolated_synthetic_fixture_preparation'},null,2)+'\n',{flag:'wx'});
 if(!stopped||result.signal!=='SIGTERM')throw Error('Synthetic fixture initialization failed');
 const prepare=spawnSync(process.execPath,['--require','./scripts/test-resolver.cjs','-e',fs.readFileSync(directory+'prepare-runner.txt','utf8')],{env:process.env,stdio:'inherit'});
 if(prepare.status!==0)throw Error('Synthetic product preparation failed');
 const id=fs.readFileSync('/tmp/pos-review-fixture-id','utf8');
 const resume=spawnSync(process.execPath,['--require','./scripts/test-resolver.cjs','.test-build/tests/performance/core-resume-seed.js'],{env:{...process.env,POS_PROFILE_TEST_ORG:id},stdio:'inherit'});
 if(resume.status!==0)throw Error('Synthetic item preparation failed');
}
main().catch(error=>{console.error(error.message);process.exitCode=1});
