import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
import { withApi } from '@/server/api'
import { getRequestToken, verifySession, SESSION_COOKIE } from '@/server/auth/session'
async function logoutAll(request: NextRequest) {
  const context = await verifySession(getRequestToken(request) ?? '')
  if (!context) return NextResponse.json({success:false},{status:401})
  await prisma.session.updateMany({where:{userId:context.userId,revokedAt:null},data:{revokedAt:new Date()}})
  const response = NextResponse.json({success:true})
  response.cookies.set(SESSION_COOKIE,'',{httpOnly:true,secure:process.env.NODE_ENV==='production',sameSite:'lax',path:'/',maxAge:0})
  return response
}
export const POST = withApi(logoutAll)
