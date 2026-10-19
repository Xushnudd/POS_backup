import {test} from 'node:test'
import assert from 'node:assert/strict'
import {durableRequestMethod} from '../src/lib/durable-request'
const profile='/taxes/aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa'
test('legacy original POST remains recoverable and tax profile PUT is explicit',()=>{
 assert.equal(durableRequestMethod('/finance/expenses',undefined),'POST')
 assert.equal(durableRequestMethod('/taxes','POST'),'POST')
 assert.equal(durableRequestMethod(profile,'PUT'),'PUT')
})
test('tampered recovery method cannot turn an original action into an unauthorized method or arbitrary PUT',()=>{
 for(const value of ['DELETE','PATCH','GET','put',null,{},0])assert.throws(()=>durableRequestMethod(profile,value))
 for(const path of ['/taxes','/taxes/not-a-uuid','/taxes/aaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa','/taxes/aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa/versions','/users/aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa',profile+'?force=true','https://outside.invalid'+profile])assert.throws(()=>durableRequestMethod(path,'PUT'))
})

test('only a UUID file endpoint accepts recoverable DELETE',()=>{
 assert.equal(durableRequestMethod('/files/aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa','DELETE'),'DELETE')
 for(const path of ['/files','/files/not-a-uuid','/files/aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa?force=true',profile,'/products/aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa'])assert.throws(()=>durableRequestMethod(path,'DELETE'))
})

test('brand update recovery is limited to its existing UUID resource endpoint',()=>{
 assert.equal(durableRequestMethod('/brands/aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa','PUT'),'PUT')
 for(const path of ['/brands','/brands/not-a-uuid','/brands/aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa/children','/brands/aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa?all=true'])assert.throws(()=>durableRequestMethod(path,'PUT'))
})
