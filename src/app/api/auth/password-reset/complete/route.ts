import { NextRequest,NextResponse } from 'next/server'
import { withApi } from '@/server/api'
import { completePasswordReset } from '@/server/auth/challenges'
import { consumeLimit } from '@/server/auth/rate-limit'
import { SESSION_COOKIE } from '@/server/auth/session'
export const POST=withApi(async(request:NextRequest)=>{
 if(process.env.TRUST_PROXY_IP==='true')await consumeLimit('password-reset.complete.ip',request.headers.get('x-real-ip')??'unknown',10,15*60000)
 const response=NextResponse.json({success:true,data:await completePasswordReset(await request.json())})
 response.cookies.set(SESSION_COOKIE,'',{path:'/',maxAge:0,httpOnly:true,secure:process.env.NODE_ENV==='production',sameSite:'lax'});return response
},{public:true})
