import { AccessError } from './policy'

export type AuthenticationPurpose='verify_phone'|'verify_email'|'password_reset'|'step_up'
export type AuthenticationMessage={purpose:AuthenticationPurpose;destination:string;secret:string;expiresAt:Date}
export interface SmsProvider {readonly id:string;readonly channel:'sms';readonly mode:'real'|'mock';send(message:AuthenticationMessage):Promise<void>}
export interface EmailProvider {readonly id:string;readonly channel:'email';readonly mode:'real'|'mock';send(message:AuthenticationMessage):Promise<void>}
export type AuthenticationDelivery=SmsProvider|EmailProvider
// Bindings remain empty until a real provider and its official contract are approved.
const providers:readonly AuthenticationDelivery[]=Object.freeze([])
export function authenticationDelivery(channel:'sms'|'email',injected?:AuthenticationDelivery):AuthenticationDelivery{
 const provider=injected??providers.find(item=>item.channel===channel)
 if(!provider||provider.channel!==channel||provider.mode==='mock'&&process.env.NODE_ENV==='production')throw new AccessError(503,'AUTH_DELIVERY_UNAVAILABLE','Tasdiqlash xizmati hali sozlanmagan')
 return provider
}
export function authenticationDeliveryStatus(){return {sms:providers.some(p=>p.channel==='sms'&&p.mode==='real'),email:providers.some(p=>p.channel==='email'&&p.mode==='real'),totp:false}}
// TOTP/WebAuthn must be backed by an audited implementation, never home-grown crypto.
export interface AuthenticatorProvider {readonly kind:'totp'|'webauthn';verify(input:{userId:string;challengeId:string;response:string}):Promise<boolean>}
