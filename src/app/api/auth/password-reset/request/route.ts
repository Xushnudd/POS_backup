import { NextRequest,NextResponse } from 'next/server'
import { withApi } from '@/server/api'
import { requestPasswordReset } from '@/server/auth/challenges'
import { consumeLimit } from '@/server/auth/rate-limit'
export const POST=withApi(async(request:NextRequest)=>{
 if(process.env.TRUST_PROXY_IP==='true')await consumeLimit('password-reset.ip',request.headers.get('x-real-ip')??'unknown',10,15*60000)
 return NextResponse.json({success:true,data:await requestPasswordReset(await request.json())})
},{public:true})
