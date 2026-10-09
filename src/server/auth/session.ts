import { createHash, randomBytes } from 'node:crypto'
import { Prisma } from '@prisma/client'
import { prisma } from '@/lib/prisma'
import type { NextRequest, NextResponse } from 'next/server'

export const SESSION_COOKIE = 'pos_session'
const ABSOLUTE_MS = 24 * 60 * 60 * 1000
const IDLE_MS = 8 * 60 * 60 * 1000
export const sessionHash = (token: string) => createHash('sha256').update(token).digest('hex')

export async function createSession(tx: Prisma.TransactionClient, userId: string, organizationId: string, options?:{pinStoreId:string}) {
  const token = randomBytes(32).toString('base64url')
  const now = Date.now()
  await tx.session.create({ data: {
    tokenHash: sessionHash(token), userId, organizationId,
    expiresAt: new Date(now + (options?IDLE_MS:ABSOLUTE_MS)), idleExpiresAt: new Date(now + IDLE_MS),
    authenticationMethod:options?'pin':'password',pinStoreId:options?.pinStoreId,
  } })
  return token
}
export function setSessionCookie(response: NextResponse, token: string) {
  response.cookies.set(SESSION_COOKIE, token, {
    httpOnly: true, secure: process.env.NODE_ENV === 'production', sameSite: 'lax',
    path: '/', maxAge: ABSOLUTE_MS / 1000,
  })
}
export function getRequestToken(request: NextRequest) {
  return request.cookies.get(SESSION_COOKIE)?.value ?? null
}
export async function verifySession(token: string, options?:{touch?:boolean}) {
  if (!/^[A-Za-z0-9_-]{43}$/.test(token)) return null
  const now = new Date()
  const session = await prisma.session.findUnique({ where: { tokenHash: sessionHash(token) }, include: { user: true } })
  if (!session || session.revokedAt || !session.user.isActive || session.expiresAt <= now || session.idleExpiresAt <= now) return null
  const membership = await prisma.organizationUser.findUnique({
    where: { organizationId_userId: { organizationId: session.organizationId, userId: session.userId } },
    include: { userStores: { include: { store: true } } },
  })
  if (!membership?.isActive || !['owner','admin','cashier'].includes(membership.role)) return null
  // PIN sessions stay cashier-only in the assigned branch even after role changes.
  if(session.authenticationMethod==='pin' && (membership.role!=='cashier'||!membership.pinHash||!membership.userStores.some(x=>x.storeId===session.pinStoreId&&x.store.isActive&&x.store.organizationId===session.organizationId)))return null;
  // A conditional touch cannot resurrect revoked or expired sessions.
  const liveWhere={id:session.id,revokedAt:null, idleExpiresAt:{gt:now},expiresAt:{gt:now}}
  if(options?.touch===false){
    // Automated account-status polling must not count as user activity.
    if(!await prisma.session.count({where:liveWhere}))return null
  }else{
    const touched=await prisma.session.updateMany({where:liveWhere,data:{idleExpiresAt:new Date(Math.min(session.expiresAt.getTime(),now.getTime()+IDLE_MS))}})
    if(!touched.count)return null
  }
  return {
    userId: session.userId, organizationId: session.organizationId,
    organizationUserId: membership.id, role: membership.role,
    storeIds: membership.userStores.filter(x => x.store.isActive && x.store.organizationId === session.organizationId && (session.authenticationMethod!=='pin'||x.storeId===session.pinStoreId)).map(x => x.storeId),
    sessionId: session.id,
  }
}
