import {expect,type Page} from '@playwright/test'
import {TOTP,URI} from 'otpauth'
/** Real enrolled factor and single-use counters; never bypass production MFA. */
export async function enrollCritical(page:Page,password:string){
 const headers={Origin:'https://localhost:3100'}
 if(process.env.AUTH_CRITICAL_MFA_REQUIRED!=='true')return {approve:async()=>{},post:async(path:string,data:Record<string,unknown>)=>page.request.post(path,{headers,data})}
 const enrollment=await page.request.post('/api/auth/totp/enroll',{headers,data:{password}});expect(enrollment.ok()).toBe(true)
 const factor=(await enrollment.json()).data,totp=URI.parse(factor.provisioningUri) as TOTP,stamp=Date.now()-30000
 expect((await page.request.post('/api/auth/totp/confirm',{headers,data:{factorId:factor.factorId,code:totp.generate({timestamp:stamp})}})).ok()).toBe(true)
 let previous=Math.floor(stamp/30000)
 const code=async()=>{await expect.poll(()=>Math.floor(Date.now()/30000),{timeout:35000,intervals:[250]}).toBeGreaterThan(previous);const now=Date.now();previous=Math.floor(now/30000);return totp.generate({timestamp:now})}
 return {
  approve:async()=>{const dialog=page.getByRole('dialog',{name:'Muhim amalni tasdiqlash',exact:true});await expect(dialog).toBeVisible();await dialog.getByLabel('Muhim amal uchun Authenticator kodi',{exact:true}).fill(await code());await dialog.getByRole('button',{name:'Amalni tasdiqlash',exact:true}).click();await expect(dialog).toHaveCount(0)},
  post:async(path:string,data:Record<string,unknown>)=>{const response=await page.request.post(path,{headers,data});if(response.status()!==403)return response;const error=(await response.json()).error;if(error?.code!=='STEP_UP_REQUIRED')return response;const binding=error.details;expect((await page.request.post('/api/auth/totp/proof',{headers,data:{action:binding.action,operationKey:binding.operationKey,payloadHash:binding.payloadHash,code:await code()}})).ok()).toBe(true);return page.request.post(path,{headers,data})},
 }
}
