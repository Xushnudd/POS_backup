const test=require('node:test'),assert=require('node:assert/strict');
const http=require('node:http'),https=require('node:https'),net=require('node:net'),tls=require('node:tls'),fs=require('node:fs'),os=require('node:os'),path=require('node:path');
const {execFileSync}=require('node:child_process');
const {createProxy}=require('./https-proxy.cjs');
const listen=server=>new Promise(resolve=>server.listen(0,'127.0.0.1',()=>resolve(server.address().port)));
function request(transport,port,headers,body){return new Promise((resolve,reject)=>{
 const req=transport.request({hostname:'127.0.0.1',port,path:'/api/auth/register?local=1',method:body?'POST':'GET',headers,agent:false,...(transport===https?{rejectUnauthorized:false}:{})},res=>{
  let data='';res.setEncoding('utf8');res.on('data',chunk=>{data+=chunk});res.on('end',()=>resolve({status:res.statusCode,headers:res.headers,body:data}));
 });req.on('error',reject);req.end(body);
});}
test('Local HTTP serves without redirects, optional TLS preserves Origin/cookies, and HMR upgrades work on both transports', {timeout:10000},async t=>{
 const dir=fs.mkdtempSync(path.join(os.tmpdir(),'pos-local-proxy-'));fs.chmodSync(dir,0o700);t.after(()=>fs.rmSync(dir,{recursive:true,force:true}));
 execFileSync('openssl',['req','-x509','-newkey','rsa:2048','-nodes','-keyout',dir+'/key.pem','-out',dir+'/cert.pem','-days','1','-subj','/CN=localhost','-addext','subjectAltName=DNS:localhost'],{stdio:'ignore'});
 let calls=0,upgrades=0;const seen=[];
 const allowed=new Set(['http://localhost:3000','http://localhost:3443','https://localhost:3443']);
 const backend=http.createServer((req,res)=>{
  calls++;let body='';req.on('data',part=>{body+=part});req.on('end',()=>{
   seen.push({origin:req.headers.origin,host:req.headers.host,proto:req.headers['x-forwarded-proto'],forwarded:req.headers.forwarded,body,url:req.url});
   res.writeHead(!req.headers.origin||allowed.has(req.headers.origin)?200:403,{'Content-Type':'application/json','Set-Cookie':'session=test-only; HttpOnly; Secure; SameSite=Lax','Cache-Control':'no-store'});res.end('{"local":true}');
  });
 });
 backend.on('upgrade',(_req,socket)=>{upgrades++;socket.write('HTTP/1.1 101 Switching Protocols\r\nConnection: Upgrade\r\nUpgrade: websocket\r\n\r\n');socket.on('data',data=>{if(data.toString()==='ping')socket.end('pong')});});
 const upstreamPort=await listen(backend);
 const {plain,mixed,closeConnections}=createProxy({key:fs.readFileSync(dir+'/key.pem'),cert:fs.readFileSync(dir+'/cert.pem'),upstream:{hostname:'127.0.0.1',port:upstreamPort}});
 const servers=[backend,plain,mixed];t.after(async()=>{closeConnections();await Promise.all(servers.map(s=>new Promise(resolve=>{s.close(resolve);s.closeAllConnections?.()})))});
 const httpPort=await listen(plain),tlsPort=await listen(mixed);
 const read=await request(http,httpPort,{Host:'localhost:3000'});assert.equal(read.status,200);assert.equal(read.headers.location,undefined);assert.equal(calls,1);assert.equal(seen[0].proto,'http');
 assert.equal((await request(http,httpPort,{Host:'attacker.invalid'})).status,421);assert.equal(calls,1);
 const body='{"operationId":"unchanged-original","amount":"0.10"}';
 const httpWrite=await request(http,tlsPort,{Host:'localhost:3443',Origin:'http://localhost:3443','Content-Type':'application/json'},body);
 assert.equal(httpWrite.status,200);assert.equal(httpWrite.headers.location,undefined);assert.equal(calls,2);assert.equal(seen[1].body,body);assert.equal(seen[1].proto,'http');
 const fragmented=await new Promise((resolve,reject)=>{
  const socket=net.connect({host:'127.0.0.1',port:tlsPort},()=>{socket.write('G');setTimeout(()=>socket.write('ET /register?next=1 HTTP/1.1\r\nHost: localhost:3443\r\nConnection: close\r\n\r\n'),20)});
  let response='';socket.setTimeout(3000,()=>socket.destroy(Error('Fragmented HTTP timed out')));socket.on('error',reject);socket.on('data',chunk=>{response+=chunk});socket.on('end',()=>resolve(response));
 });assert.match(fragmented,/HTTP\/1\.1 200/);assert.doesNotMatch(fragmented,/Location:/);assert.equal(seen[2].url,'/register?next=1');
 const secure=await request(https,tlsPort,{Host:'localhost:3443',Origin:'https://localhost:3443','Content-Type':'application/json','X-Forwarded-Proto':'http',Forwarded:'for=spoofed'},body);
 assert.equal(secure.status,200);assert.equal(calls,4);assert.equal(seen[3].origin,'https://localhost:3443');assert.equal(seen[3].proto,'https');assert.equal(seen[3].forwarded,undefined);assert.equal(seen[3].body,body);
 assert.match(secure.headers['set-cookie'][0],/HttpOnly; Secure; SameSite=Lax/);assert.equal(secure.headers['cache-control'],'no-store');
 assert.equal((await request(https,tlsPort,{Host:'localhost:3443',Origin:'http://attacker.invalid'},body)).status,403);assert.equal(calls,5);
 assert.equal((await request(https,tlsPort,{Host:'attacker.invalid'},body)).status,421);assert.equal(calls,5);
 for(const secureSocket of [false,true]){
  const result=await new Promise((resolve,reject)=>{
   let socket;const connected=()=>socket.write('GET /_next/webpack-hmr HTTP/1.1\r\nHost: localhost:3443\r\nOrigin: '+(secureSocket?'https':'http')+'://localhost:3443\r\nConnection: Upgrade\r\nUpgrade: websocket\r\n\r\n');
   socket=secureSocket?tls.connect({host:'127.0.0.1',port:tlsPort,rejectUnauthorized:false},connected):net.connect({host:'127.0.0.1',port:tlsPort},connected);
   let response='',sent=false;socket.setTimeout(3000,()=>socket.destroy(Error('HMR upgrade timed out')));socket.on('error',reject);socket.on('data',data=>{response+=data;if(!sent&&response.includes('\r\n\r\n')){sent=true;socket.write('ping')}});socket.on('end',()=>resolve(response));
  });assert.match(result,/101 Switching Protocols/);assert.match(result,/pong$/);
 }
 assert.equal(upgrades,2);
 await new Promise(resolve=>backend.close(resolve));const down=await request(https,tlsPort,{Host:'localhost:3443'},body);assert.equal(down.status,502);assert.equal(down.body,'Local app is unavailable');assert.equal(calls,5);
});
