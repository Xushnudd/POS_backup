import {test} from 'node:test'
import assert from 'node:assert/strict'
import {isInternalProductImage} from '@/lib/product-image'
import {NextRequest} from 'next/server'
import {proxy} from '@/proxy'
test('Only exact internal asset paths render, including when legacy metadata is hostile or malformed',()=>{
 const id='12345678-1234-1234-1234-123456789abc'
 assert.equal(isInternalProductImage('/api/files/'+id),true)
 for(const value of [null,undefined,'https://external.invalid/image.png','http://external.invalid/image.png','//external.invalid/image.png','data:image/svg+xml,private','/api/files/'+id+'?redirect=https://external.invalid','/api/files/'+id+'/../image','/api/files/'+'-'.repeat(36),'/api/files/%31'+id.slice(1)])assert.equal(isInternalProductImage(value),false)
})
test('Browser CSP does not admit automatic remote product images',()=>{
 const response=proxy(new NextRequest('http://localhost:3000/products'))
 const directive=response.headers.get('Content-Security-Policy')!.split(';').find(value=>value.trim().startsWith('img-src'))!
 assert.equal(directive.trim(),"img-src 'self' data: blob:")
})
