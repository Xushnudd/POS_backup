import {billingDatabaseError} from '@/server/billing/errors'
import {assertLiveContext} from '@/server/operations'
import { newPasswordSchema } from '@/server/auth/password-policy'
import { prisma } from '@/lib/prisma'
import { AccessError } from '@/server/auth/policy'
import { scopedPrisma } from '@/server/auth/scoped-prisma'
import { withApi } from '@/server/api'
import { NextRequest, NextResponse } from 'next/server'
import { verifyToken, getRequestToken, hashPassword } from '@/lib/auth'
import { z } from 'zod'

const createUserSchema = z.object({
  fullName: z.string().min(2),
  phone: z.string().min(9),
  email: z.string().email().optional(),
  password: newPasswordSchema,
  role: z.enum(['owner', 'admin', 'cashier']),
  storeIds: z.array(z.string()).optional(),
})

async function handleGET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params
    const token = getRequestToken(request)
    if (!token) {
      return NextResponse.json(
        { success: false, error: { code: 'UNAUTHORIZED', message: 'Avtorizatsiya talab qilinadi' } },
        { status: 401 }
      )
    }

    const payload = await verifyToken(token)
    if (!payload) {
      return NextResponse.json(
        { success: false, error: { code: 'INVALID_TOKEN', message: 'Noto\'g\'ri token' } },
        { status: 401 }
      )
    }
    const db = scopedPrisma(payload)

    const organizationUsers = await db.organizationUser.findMany({
      where: {
        organizationId: id,
      },
      include: {
        customRole:{select:{name:true,isActive:true}},
        user: {select:staffSelect},
        userStores: {
          include: {
            store: true,
          },
        },
      },
    })

    return NextResponse.json({
      success: true,
      data: organizationUsers.map(ou => ({
        id: ou.id,
        user: {
          id: ou.user.id,
          fullName: ou.user.fullName,
          phone: ou.user.phone,
          email: ou.user.email,
          isActive: ou.user.isActive,
        },
        role: ou.role,
        customRoleId:ou.customRoleId,
        customRoleName:ou.customRole?.name??null,
        customRoleActive:ou.customRole?.isActive??null,
        isActive: ou.isActive,
        archivedAt: ou.archivedAt,
        stores: ou.userStores.map(us => ({
          id: us.store.id,
          name: us.store.name,
        })),
        createdAt: ou.createdAt,
      })),
    })

  } catch (error) {
    const billingError=billingDatabaseError(error);if(billingError)throw billingError
    if (error instanceof AccessError) throw error
    return NextResponse.json(
      { success: false, error: { code: 'INTERNAL_ERROR', message: 'Server xatosi' } },
      { status: 500 }
    )
  }
}

async function handlePOST(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params
    const token = getRequestToken(request)
    if (!token) {
      return NextResponse.json(
        { success: false, error: { code: 'UNAUTHORIZED', message: 'Avtorizatsiya talab qilinadi' } },
        { status: 401 }
      )
    }

    const payload = await verifyToken(token)
    if (!payload) {
      return NextResponse.json(
        { success: false, error: { code: 'INVALID_TOKEN', message: 'Noto\'g\'ri token' } },
        { status: 401 }
      )
    }
    const body = await request.json()
    const validatedData = createUserSchema.parse(body)

    if (await prisma.user.findUnique({where:{phone:validatedData.phone}})) throw new AccessError(409,'INVITATION_REQUIRED','Mavjud hisobga taklif yuborish kerak')
    const passwordHash = await hashPassword(validatedData.password)
    const organizationUser = await prisma.$transaction(async tx => {
      await assertLiveContext(tx,payload)
      const user = await tx.user.create({data:{fullName:validatedData.fullName,phone:validatedData.phone,email:validatedData.email,passwordHash}})
      const member = await tx.organizationUser.create({data:{organizationId:id,userId:user.id,role:validatedData.role}})
      if (validatedData.storeIds?.length) await tx.userStore.createMany({data:[...new Set(validatedData.storeIds)].map(storeId=>({organizationUserId:member.id,storeId}))})
      await tx.auditLog.create({data:{organizationId:id,actorId:payload.userId,entityType:'OrganizationUser',entityId:member.id,action:'staff_created'}})
      return {...member,user:{id:user.id,fullName:user.fullName,phone:user.phone,email:user.email}}
    })

    return NextResponse.json({
      success: true,
      data: {
        ...organizationUser,
      },
      message: 'Foydalanuvchi muvaffaqiyatli qo\'shildi',
    })

  } catch (error) {
    const billingError=billingDatabaseError(error);if(billingError)throw billingError
    if (error instanceof AccessError) throw error
    if (error instanceof z.ZodError) {
      return NextResponse.json(
        { success: false, error: { code: 'VALIDATION_ERROR', message: 'Ma\'lumotlar noto\'g\'ri', details: error.issues } },
        { status: 400 }
      )
    }

    return NextResponse.json(
      { success: false, error: { code: 'INTERNAL_ERROR', message: 'Server xatosi' } },
      { status: 500 }
    )
  }
}
export const GET = withApi(handleGET)

export const POST = withApi(handlePOST)
import {staffSelect} from '@/server/auth/user-dto'
