import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
import { withApi } from '@/server/api'
import { getRequestToken, sessionHash, SESSION_COOKIE } from '@/server/auth/session'
async function logout(request: NextRequest) {
  const token = getRequestToken(request)
  if (token) await prisma.session.updateMany({ where:{ tokenHash:sessionHash(token), revokedAt:null }, data:{revokedAt:new Date()} })
  const response = NextResponse.json({success:true})
  response.cookies.set(SESSION_COOKIE,'',{httpOnly:true,secure:process.env.NODE_ENV==='production',sameSite:'lax',path:'/',maxAge:0})
  return response
}
export const POST = withApi(logout, { public: true })
