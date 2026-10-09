const {spawn,spawnSync}=require('node:child_process')
const {mkdtempSync,readFileSync,rmSync,chmodSync,cpSync}=require('node:fs')
const {tmpdir}=require('node:os')
const path=require('node:path')
const https=require('node:https'),http=require('node:http')
const connection=new URL(process.env.DATABASE_URL??'postgresql://invalid/invalid')
if(connection.hostname!=='127.0.0.1'||connection.pathname!=='/pos_test')throw new Error('Isolated test DB required')
const directory=mkdtempSync(path.join(tmpdir(),'pos-e2e-tls-'))
chmodSync(directory,0o700)
const key=path.join(directory,'key.pem'),cert=path.join(directory,'cert.pem')
const generated=spawnSync('openssl',['req','-x509','-newkey','rsa:2048','-nodes','-keyout',key,'-out',cert,'-days','1','-subj','/CN=localhost','-addext','subjectAltName=DNS:localhost,IP:127.0.0.1'],{stdio:'ignore'})
if(generated.status!==0){rmSync(directory,{recursive:true,force:true});throw new Error('Test TLS certificate generation failed')}
const standalone=path.resolve('.next/standalone')
cpSync('.next/static',path.join(standalone,'.next/static'),{recursive:true})
cpSync('public',path.join(standalone,'public'),{recursive:true})
const child=spawn(process.execPath,[path.join(standalone,'server.js')],{cwd:standalone,env:{...process.env,PORT:'3101',HOSTNAME:'127.0.0.1',APP_ORIGIN:'https://localhost:3100',NODE_ENV:'production'},stdio:'inherit'})
const server=https.createServer({key:readFileSync(key),cert:readFileSync(cert)},(request,response)=>{
 // Test-only transport outage: also affects service-worker requests. Browser
 // setOffline implementations do not consistently disconnect worker networking.
 if(request.url==='/__test-offline-navigation'){request.destroy();return}
 const upstream=http.request({hostname:'127.0.0.1',port:3101,path:request.url,method:request.method,headers:{...request.headers,'x-forwarded-proto':'https','x-forwarded-host':'localhost:3100','x-real-ip':'127.0.0.1'}},result=>{
  response.writeHead(result.statusCode??502,result.headers);result.pipe(response)
 })
 upstream.on('error',()=>{if(!response.headersSent)response.writeHead(503);response.end()})
 request.pipe(upstream)
})
server.listen(3100,'127.0.0.1')
let stopping=false
function stop(){if(stopping)return;stopping=true;server.close();child.kill('SIGTERM');rmSync(directory,{recursive:true,force:true})}
process.on('SIGTERM',stop);process.on('SIGINT',stop)
child.on('exit',code=>{stop();process.exit(code??0)})
