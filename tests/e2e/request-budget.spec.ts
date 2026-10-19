import {test,expect} from '@playwright/test'
import {request} from 'node:https'
test('Production HTTPS rejects an unfinished JSON body before authentication business logic and accepts a fresh retry',async({page})=>{
 const result=await new Promise<{status:number;code:string}>((resolve,reject)=>{
  const req=request('https://localhost:3100/api/auth/login',{method:'POST',rejectUnauthorized:false,headers:{Origin:'https://localhost:3100','Content-Type':'application/json','Content-Length':'100'}},response=>{
   let body='';response.setEncoding('utf8');response.on('data',chunk=>{body+=chunk});response.on('end',()=>{clearTimeout(timer);req.destroy();try{resolve({status:response.statusCode??0,code:JSON.parse(body).error.code})}catch(error){reject(error)}})
  })
  const timer=setTimeout(()=>{req.destroy();reject(new Error('Local slow body did not reach its deadline'))},20000)
  req.on('error',error=>{clearTimeout(timer);reject(error)});req.write('{')
 })
 expect(result).toEqual({status:408,code:'REQUEST_BODY_TIMEOUT'})
 const retry=await page.request.post('/api/auth/login',{headers:{Origin:'https://localhost:3100'},data:{}})
 expect(retry.status()).toBe(400)
 expect((await retry.json()).error.code).toBe('VALIDATION_ERROR')
})
