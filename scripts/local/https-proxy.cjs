// Local development transport: HTTP is served directly, optional HTTPS stays separate.
const http=require('node:http'),https=require('node:https'),net=require('node:net'),fs=require('node:fs');
function createProxy({key,cert,upstream={hostname:'app',port:3000}}){
 function headers(request,secure){
  const host=request.headers.host;
  if(!(secure?host==='localhost:3443':['localhost:3000','localhost:3443'].includes(host)))return null;
  const result={...request.headers,host,'x-forwarded-host':host,'x-forwarded-proto':secure?'https':'http','x-real-ip':request.socket.remoteAddress};
  delete result['x-forwarded-for'];delete result.forwarded;return result;
 }
 function forward(request,response,secure){
  const outgoing=headers(request,secure);
  if(!outgoing){response.writeHead(421,{'Cache-Control':'no-store'});response.end('Use localhost:3000 or localhost:3443');return;}
  const target=http.request({...upstream,path:request.url,method:request.method,headers:outgoing},result=>{
   response.writeHead(result.statusCode??502,result.headers);result.pipe(response);result.on('error',()=>response.destroy());
  });
  target.on('error',()=>{if(!response.headersSent)response.writeHead(502,{'Cache-Control':'no-store'});response.end('Local app is unavailable');});
  request.on('aborted',()=>target.destroy());response.on('close',()=>{if(!response.writableEnded)target.destroy()});request.pipe(target);
 }
 const plain=http.createServer((req,res)=>forward(req,res,false));
 const tls=https.createServer({key,cert,minVersion:'TLSv1.2'},(req,res)=>forward(req,res,true));
 // Next dev HMR uses WebSockets. Preserve the actual Origin and support upgrades
 // on both transports without opening a second application mutation path.
 function upgrade(request,socket,head,secure){
  const outgoing=headers(request,secure),origin=request.headers.origin;
  if(!outgoing||request.headers.upgrade?.toLowerCase()!=='websocket'||origin&&origin!==(secure?'https://':'http://')+outgoing.host){socket.end('HTTP/1.1 403 Forbidden\r\nConnection: close\r\nContent-Length: 0\r\n\r\n');return;}
  const target=http.request({...upstream,path:request.url,method:request.method,headers:outgoing});
  target.on('error',()=>socket.destroy());
  target.on('response',response=>{response.resume();socket.end('HTTP/1.1 502 Bad Gateway\r\nConnection: close\r\nContent-Length: 0\r\n\r\n')});
  target.on('upgrade',(response,remote,remoteHead)=>{
   const fields=[];for(let i=0;i<response.rawHeaders.length;i+=2)fields.push(response.rawHeaders[i]+': '+response.rawHeaders[i+1]);
   socket.write('HTTP/1.1 101 Switching Protocols\r\n'+fields.join('\r\n')+'\r\n\r\n');
   if(head.length)remote.write(head);if(remoteHead.length)socket.write(remoteHead);
   remote.on('error',()=>socket.destroy());socket.on('error',()=>remote.destroy());socket.on('close',()=>remote.destroy());
   remote.pipe(socket).pipe(remote);
  });
  socket.once('close',()=>target.destroy());target.end();
 }
 for(const [server,secure] of [[plain,false],[tls,true]]){
  server.headersTimeout=15000;server.requestTimeout=30000;server.keepAliveTimeout=5000;
  server.on('upgrade',(req,socket,head)=>upgrade(req,socket,head,secure));
 }
 const sockets=new Set();
 const track=socket=>{if(sockets.has(socket))return;sockets.add(socket);socket.once('close',()=>sockets.delete(socket));};
 plain.on('connection',track);
 const mixed=net.createServer(socket=>{
  track(socket);socket.on('error',()=>{});
  socket.setTimeout(15000,()=>socket.destroy());
  socket.once('data',first=>{
   socket.pause();socket.setTimeout(0);
   const server=first[0]===22?tls:first[0]>=65&&first[0]<=90?plain:null;
   if(!server){socket.destroy();return;}
   socket.unshift(first);server.emit('connection',socket);process.nextTick(()=>{if(!socket.destroyed)socket.resume()});
  });
 });
 const closeConnections=()=>{for(const socket of sockets)socket.destroy();plain.closeAllConnections();};
 return {plain,tls,mixed,closeConnections};
}
module.exports={createProxy};
if(require.main===module){
 const {plain,mixed,closeConnections}=createProxy({key:fs.readFileSync('/local/tls/key.pem'),cert:fs.readFileSync('/local/tls/cert.pem')});
 plain.listen(3000,'0.0.0.0');mixed.listen(3443,'0.0.0.0');
 console.log('Local HTTP: http://localhost:3000 or http://localhost:3443. Optional HTTPS: https://localhost:3443. No HTTPS redirect.');
 const stop=()=>{plain.close();mixed.close();setTimeout(()=>{closeConnections();process.exit(0)},5000).unref();};
 process.on('SIGTERM',stop);process.on('SIGINT',stop);
}
