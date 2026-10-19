import {test} from 'node:test'
import assert from 'node:assert/strict'
import {sanitizeResponse,sanitizeTotpPresentation} from '@/server/auth/response'
test('Response defense removes nested challenge, OTP, recovery and worker credentials while retaining public contracts',()=>{
 const hidden=['secretHash','sealedSecret','passwordDigest','provisioningUri','deliveryLease','leaseToken','otp','otpCode','verificationCode','recoveryCode','recoveryCodes','totpSecret','totpSeed']
 for(const field of hidden){
  const variants=[field,field.toUpperCase(),field.replace(/[A-Z]/g,c=>'_'+c.toLowerCase()),field.replace(/[A-Z]/g,c=>'-'+c.toLowerCase())]
  for(const key of variants){
   assert.deepEqual(sanitizeResponse({data:[{id:'safe',nested:{[key]:'SENSITIVE',code:'AUTH_CHALLENGE_INVALID',phone:'owner-visible'}}]}),{data:[{id:'safe',nested:{code:'AUTH_CHALLENGE_INVALID',phone:'owner-visible'}}]},key)
  }
 }
 const visible={token:'cookie-session',signature:'public-offline-proof',publicKey:{kty:'EC'},challengeId:'public-id',expiresAt:'2026-10-10'}
 assert.deepEqual(sanitizeResponse(visible),visible)
})
test('One-time TOTP presentation is limited to exact POST success DTOs, while all other credentials remain stripped',()=>{
 const recoveryCodes=Array.from({length:10},(_,i)=>i.toString(16).padStart(32,'0'))
 const provisioningUri='otpauth://totp/POS:actor?issuer=POS&secret=GEZDGNBVGY3TQOJQGEZDGNBVGY3TQOJQ&algorithm=SHA1&digits=6&period=30'
 const input={success:true,data:{factorId:'safe',provisioningUri,recoveryCodes,passwordDigest:'private',sealedSecret:'private'}}
 const enrollment=sanitizeTotpPresentation(input,'owner','/api/auth/totp/enroll','POST','enrollment') as {data:Record<string,unknown>}
 assert.deepEqual(enrollment.data,{factorId:'safe',provisioningUri})
 const confirmation=sanitizeTotpPresentation(input,'owner','/api/auth/totp/confirm','POST','recoveryCodes') as {data:Record<string,unknown>}
 assert.deepEqual(confirmation.data,{factorId:'safe',recoveryCodes})
 for(const [path,method] of [['/api/audit','POST'],['/api/auth/totp/confirm','GET'],['/api/auth/totp/proof','POST']])assert.deepEqual(sanitizeTotpPresentation(input,'owner',path,method,'recoveryCodes'),{success:true,data:{factorId:'safe'}})
 assert.deepEqual(sanitizeTotpPresentation({...input,success:false},'owner','/api/auth/totp/confirm','POST','recoveryCodes'),{success:false,data:{factorId:'safe'}})
 assert.deepEqual(sanitizeTotpPresentation({success:true,data:{provisioningUri:'javascript:alert(1)',recoveryCodes:['bad']}},'owner','/api/auth/totp/enroll','POST','enrollment'),{success:true,data:{}})
})
