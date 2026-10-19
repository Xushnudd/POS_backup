import {test} from 'node:test';
import assert from 'node:assert/strict';
import {api,ApiError} from '@/lib/api';

test('HTTP failures without a vendor error code preserve status and request identity; transport failures remain unknown',async()=>{
 const original=globalThis.fetch;
 try {
  globalThis.fetch=async()=>new Response(JSON.stringify({message:'Request rejected'}),{status:409,headers:{'content-type':'application/json','x-request-id':'test-request'}});
  await assert.rejects(api.request('/test-error'),(error:unknown)=>{
   assert.ok(error instanceof ApiError);assert.equal(error.code,'INTERNAL_ERROR');assert.equal(error.status,409);assert.equal(error.requestId,'test-request');assert.match(error.message,/Request rejected/);return true;
  });
  globalThis.fetch=async()=>new Response(JSON.stringify({success:false,error:{code:'CONCURRENT_CONFLICT',message:'Original operation conflict'}}),{status:409});
  await assert.rejects(api.request('/test-error'),(error:unknown)=>{
   assert.ok(error instanceof ApiError);assert.equal(error.code,'CONCURRENT_CONFLICT');assert.equal(error.status,409);return true;
  });
  globalThis.fetch=async()=>{throw new TypeError('test-only transport failure')};
  await assert.rejects(api.request('/test-error'),(error:unknown)=>{
   assert.ok(error instanceof ApiError);assert.equal(error.code,'NETWORK_ERROR');assert.equal(error.status,undefined);assert.match(error.message,/noma’lum/);return true;
  });
 }finally{globalThis.fetch=original;}
});
