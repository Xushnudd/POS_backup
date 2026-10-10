import type { AuthenticationDelivery,AuthenticationMessage } from '@/server/auth/delivery'
export function mockAuthenticationDelivery(channel:'sms'|'email'){
 if(process.env.NODE_ENV==='production')throw new Error('Mock authentication delivery forbidden in production')
 const messages:AuthenticationMessage[]=[]
 const provider:AuthenticationDelivery={id:'test-only-auth-delivery',channel,mode:'mock',async send(message){messages.push({...message})}}
 return {provider,messages}
}
