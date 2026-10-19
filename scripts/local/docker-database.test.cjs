const test=require('node:test'),assert=require('node:assert/strict');
const {spawn}=require('node:child_process');
const path=require('node:path');
const {databaseEnvironment}=require('./docker-database.cjs');
const fixture={POSTGRES_USER:'local user',POSTGRES_PASSWORD:'test-only:$@/#?% value',POSTGRES_DB:'local database',DATABASE_URL:'postgresql://host-only@localhost:5432/host'};
test('Local Compose derives its DB URL from POSTGRES settings and safely encodes credentials without modifying host environment',()=>{
 const before=JSON.stringify(fixture),env=databaseEnvironment(fixture),url=new URL(env.DATABASE_URL);
 assert.equal(url.hostname,'db');assert.equal(url.port,'5432');
 assert.equal(decodeURIComponent(url.username),fixture.POSTGRES_USER);assert.equal(decodeURIComponent(url.password),fixture.POSTGRES_PASSWORD);assert.equal(decodeURIComponent(url.pathname.slice(1)),fixture.POSTGRES_DB);
 assert.equal(JSON.stringify(fixture),before);assert.notEqual(env.DATABASE_URL,fixture.DATABASE_URL);
 assert.throws(()=>databaseEnvironment({POSTGRES_PASSWORD:''}),/requires POSTGRES_PASSWORD/);
});
test('Local wrapper supplies the derived URL to the real child and forwards graceful SIGTERM', {timeout:10000},async t=>{
 const code='const u=new URL(process.env.DATABASE_URL);if(u.hostname!=="db"||decodeURIComponent(u.password)!==process.env.POSTGRES_PASSWORD)process.exit(2);process.on("SIGTERM",()=>process.exit(0));setInterval(()=>{},1000);console.log("ready");';
 const child=spawn(process.execPath,[path.join(__dirname,'docker-database.cjs'),'-e',code],{env:fixture,stdio:['ignore','pipe','pipe']});
 t.after(()=>{if(child.exitCode===null)child.kill('SIGKILL')});
 let diagnostics='';child.stderr.on('data',chunk=>{diagnostics+=chunk});
 const exited=new Promise((resolve,reject)=>{child.once('error',reject);child.once('exit',(code,signal)=>resolve({code,signal}))});
 await new Promise((resolve,reject)=>{child.stdout.once('data',chunk=>chunk.toString().includes('ready')?resolve():reject(Error('Unexpected local child output')));child.once('exit',()=>reject(Error('Local child exited before readiness')))});
 child.kill('SIGTERM');assert.deepEqual(await exited,{code:0,signal:null});assert.equal(diagnostics,'');
});
