/** IndexedDB is recovery storage, not authorization. Restrict recoverable HTTP methods;
 * server tenant/actor/permission and immutable-key checks remain authoritative. */
export function durableRequestMethod(path:string,value:unknown):'POST'|'PUT'|'DELETE'{
 if(value===undefined||value==='POST')return 'POST';
 if(value==='PUT'&&/^\/(?:taxes|brands)\/[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(path))return 'PUT';
 if(value==='DELETE'&&/^\/files\/[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(path))return 'DELETE';
 throw new Error('Lokal amal usuli noto‘g‘ri');
}
