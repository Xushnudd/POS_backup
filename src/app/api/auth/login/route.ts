import { consumeLimit, clearLimit } from '@/server/auth/rate-limit'
import { AccessError } from '@/server/auth/policy'
import { withApi } from '@/server/api'
import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
import { verifyPassword } from '@/lib/auth'
import { z } from 'zod'
import {loginClientHash,recordLogin} from '@/server/security/service'
import { createSession, sessionHash, setSessionCookie } from '@/server/auth/session'
import {assertAuthenticationRestoreReady} from '@/server/auth/restore-state'
import {activeMembershipWhere} from '@/server/auth/custom-role-policy'

const loginSchema = z.object({
  phone: z.string().min(9),
  password: z.string().min(1).max(72),
  deviceId:z.string().uuid().optional(),
})

async function handlePOST(request: NextRequest) {
  try {
    const body = await request.json()
    const validatedData = loginSchema.parse(body)

    await assertAuthenticationRestoreReady()
    await consumeLimit('login-account',validatedData.phone)
    if (process.env.TRUST_PROXY_IP === 'true') await consumeLimit('login-ip',request.headers.get('x-real-ip')??'unknown',30)
    // Find user by phone
    const user = await prisma.user.findUnique({
      where: { phone: validatedData.phone },
      include: {
        organizationUsers: {
          where: activeMembershipWhere,
          include: {
            organization: true,
          }
        }
      }
    })

    if (!user) {
      return NextResponse.json(
        { success: false, error: { code: 'INVALID_CREDENTIALS', message: 'Telefon raqam yoki parol noto\'g\'ri' } },
        { status: 401 }
      )
    }

    if (!user.isActive) {
      return NextResponse.json(
        { success: false, error: { code: 'USER_INACTIVE', message: 'Hisob faol emas' } },
        { status: 403 }
      )
    }

    // Verify password
    const isValidPassword = await verifyPassword(validatedData.password, user.passwordHash)

    if (!isValidPassword) {
      const membership=user.organizationUsers[0]
      if(membership)await prisma.$transaction(async tx=>{
        await tx.$queryRaw`SELECT id FROM "User" WHERE id=${user.id} FOR UPDATE`
        const current=await tx.user.findUniqueOrThrow({where:{id:user.id}})
        const activeMembership=await tx.organizationUser.findFirst({where:{id:membership.id,userId:user.id,isActive:true}})
        if(current.isActive&&activeMembership)await recordLogin(tx,{userId:user.id,organizationId:activeMembership.organizationId,success:false})
      })
      return NextResponse.json(
        { success: false, error: { code: 'INVALID_CREDENTIALS', message: 'Telefon raqam yoki parol noto\'g\'ri' } },
        { status: 401 }
      )
    }

    // Get first active organization (for simplicity, in real app you'd let user choose)
    const firstOrgUser = user.organizationUsers[0]
    if (!firstOrgUser) {
      return NextResponse.json(
        { success: false, error: { code: 'NO_ORGANIZATION', message: 'Tashkilot topilmadi' } },
        { status: 403 }
      )
    }

    const authenticated = await prisma.$transaction(async tx=>{
      await tx.$queryRaw`SELECT id FROM "User" WHERE id=${user.id} FOR UPDATE`
      const current=await tx.user.findUniqueOrThrow({where:{id:user.id}})
      if(!current.isActive||current.passwordHash!==user.passwordHash)throw new AccessError(409,'LOGIN_CHANGED','Hisob o‘zgardi; qayta kiring')
      const membership=await tx.organizationUser.findFirst({where:{id:firstOrgUser.id,userId:user.id,...activeMembershipWhere,role:{in:['owner','admin','cashier']}},include:{customRole:true}})
      if(!membership)throw new AccessError(403,'NO_ORGANIZATION')
      const token=await createSession(tx,user.id,membership.organizationId)
      const session=await tx.session.findUniqueOrThrow({where:{tokenHash:sessionHash(token)},select:{id:true}})
      await recordLogin(tx,{userId:user.id,organizationId:membership.organizationId,success:true,sessionId:session.id,clientHash:loginClientHash(request.headers.get('user-agent'),validatedData.deviceId)})
      await tx.user.update({where:{id:user.id},data:{lastLoginAt:new Date()}})
      await clearLimit('login-account',validatedData.phone,tx)
      return {token,role:membership.role,customRole:membership.customRole?{id:membership.customRole.id,name:membership.customRole.name,revision:membership.customRole.revision,permissions:membership.customRole.permissions}:undefined}
    })

    const response = NextResponse.json({
      success: true,
      data: {
        token: "cookie-session",
        user: {
          id: user.id,
          fullName: user.fullName,
          phone: user.phone,
          email: user.email,
          organizationUserId: firstOrgUser.id,
          ...(authenticated.customRole?{customRole:authenticated.customRole}:{}),
        },
        organization: firstOrgUser.organization,
        role: authenticated.role,
      },
      message: 'Muvaffaqiyatli kirdingiz'
    })
    setSessionCookie(response, authenticated.token)
    return response

  } catch (error) {
    if (error instanceof AccessError) throw error
    if (error instanceof z.ZodError) {
      return NextResponse.json(
        { success: false, error: { code: 'VALIDATION_ERROR', message: 'Ma\'lumotlar noto\'g\'ri', details: error.issues } },
        { status: 400 }
      )
    }

    throw error
  }
}
export const POST = withApi(handlePOST, { public: true })
