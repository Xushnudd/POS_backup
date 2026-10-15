/* Public shell only. Never cache HTML from the application, APIs, files or receipts. */
const CACHE='shuni-public-shell-v4';
const PUBLIC=['/pwa/offline.html','/pwa/icon-192.png','/pwa/icon-512.png','/pwa/cash.html','/pwa/cash-crypto.js','/pwa/cash-store.js','/pwa/cash-screen.js','/pwa/locale.js','/pwa/money.js','/pwa/format.js','/pwa/messages.js','/pwa/static-locale.js'];
self.addEventListener('install',event=>{event.waitUntil(caches.open(CACHE).then(cache=>cache.addAll(PUBLIC)))});
// Deliberately no skipWaiting/clients.claim: an update cannot replace a live checkout.
self.addEventListener('activate',event=>{event.waitUntil(caches.keys().then(keys=>Promise.all(keys.filter(key=>key.startsWith('shuni-public-shell-')&&key!==CACHE).map(key=>caches.delete(key)))))});
self.addEventListener('fetch',event=>{
 const request=event.request,url=new URL(request.url);
 if(request.method!=='GET'||url.origin!==self.location.origin||url.search)return;
 if(url.pathname.startsWith('/api/')||url.pathname.startsWith('/_next/'))return;
 if(PUBLIC.includes(url.pathname)){event.respondWith(caches.open(CACHE).then(cache=>cache.match(url.pathname)).then(cached=>cached||fetch(request)));return;}
 if(request.mode==='navigate')event.respondWith(fetch(request).catch(()=>caches.open(CACHE).then(cache=>cache.match('/pwa/offline.html')).then(response=>response||Response.error())));
});
