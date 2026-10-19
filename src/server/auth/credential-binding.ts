import {createHmac,randomBytes} from 'node:crypto'
import {AccessError} from './policy'
// A request proof must bind the chosen password without publishing a fast
// password-guessing oracle. Reuse existing private deployment keys; never log it.
const developmentKey=randomBytes(32)
export function credentialBinding(value:string){
 const challenge=process.env.AUTH_CHALLENGE_SECRET,jwt=process.env.JWT_SECRET
 const key=challenge&&/^[0-9a-f]{64}$/i.test(challenge)?Buffer.from(challenge,'hex'):jwt&&Buffer.byteLength(jwt)>=32?Buffer.from(jwt):process.env.NODE_ENV!=='production'?developmentKey:null
 if(!key)throw new AccessError(503,'AUTH_BINDING_UNAVAILABLE','Xavfsiz credential tasdig‘i sozlanmagan')
 return createHmac('sha256',key).update('pos-staff-password-binding-v1\0').update(value).digest('hex')
}
