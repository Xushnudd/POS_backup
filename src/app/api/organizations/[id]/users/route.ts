import {parseListQuery,staffListSorts} from '@/lib/list-query'
import {billingDatabaseError} from '@/server/billing/errors'
import {assertLiveContext,runOperation} from '@/server/operations'
import {assertCriticalAction} from '@/server/auth/critical-actions'
import {payloadHash} from '@/server/operations'
import {credentialBinding} from '@/server/auth/credential-binding'
import type {Prisma} from '@prisma/client'
import { newPasswordSchema } from '@/server/auth/password-policy'
import { prisma } from '@/lib/prisma'
import { AccessError } from '@/server/auth/policy'
import { withApi } from '@/server/api'
import { NextRequest, NextResponse } from 'next/server'
import { verifyToken, getRequestToken, hashPassword } from '@/lib/auth'
import { z } from 'zod'

const createUserSchema = z.object({
  operationId:z.string().uuid().optional(),
  fullName: z.string().min(2).max(200),
  phone: z.string().min(9).max(64),
  email: z.string().email().optional(),
  password: newPasswordSchema,
  role: z.enum(['owner', 'admin', 'cashier']),
  storeIds: z.array(z.string().max(200)).max(100).optional(),
}).strict()

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
    const q=request.nextUrl.searchParams;
    const paged=['page','limit','search','sort','status'].some(key=>q.has(key));
    let page=1,limit=20,skip=0,search='',sort:typeof staffListSorts[number]='source';
    if(paged){try{({page,limit,skip,search,sort}=parseListQuery(q,staffListSorts,'source'))}catch(error){throw new AccessError(400,error instanceof Error?error.message:'INVALID_FILTER')}}
    const status=q.get('status')??'all';if(!['all','active','blocked','archived'].includes(status))throw new AccessError(400,'INVALID_FILTER');
    const where:Prisma.OrganizationUserWhereInput={organizationId:id,...(status==='archived'?{archivedAt:{not:null}}:status==='all'?{}:{archivedAt:null,isActive:status==='active'}),...(search?{user:{OR:[{fullName:{contains:search,mode:'insensitive'}},{phone:{contains:search,mode:'insensitive'}}]}}:{})};
    const orderBy:Prisma.OrganizationUserOrderByWithRelationInput[]=sort==='name_asc'||sort==='name_desc'?[{user:{fullName:sort==='name_asc'?'asc':'desc'}},{id:'asc'}]:sort==='newest'||sort==='oldest'?[{createdAt:sort==='oldest'?'asc':'desc'},{id:'asc'}]:[{id:'asc'}];
    const result=await prisma.$transaction(async tx=>{
    await assertLiveContext(tx,payload);
    if(id!==payload.organizationId)throw new AccessError(403,'FORBIDDEN');
    // Preserve legacy role/scoped-query authorization; opt-in pages use the same scope.
    if(payload.role!=='owner')throw new AccessError(403,'OWNER_REQUIRED');
    const total=await tx.organizationUser.count({where});
    const organizationUsers = await tx.organizationUser.findMany({
      where,orderBy,...(paged?{skip,take:limit}:{}),
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

    return {success:true,...(paged?{pagination:{page,limit,total,totalPages:Math.ceil(total/limit)}}:{}),
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
    };
    },{isolationLevel:'RepeatableRead'});
    return NextResponse.json(result)

  } catch (error) {
    const billingError=billingDatabaseError(error);if(billingError)throw billingError
    if (error instanceof AccessError) throw error
    throw error
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

    if(payload.role!=='owner')throw new AccessError(403,'FORBIDDEN')
    if(process.env.AUTH_CRITICAL_MFA_REQUIRED==='true'&&!validatedData.operationId)throw new AccessError(400,'OPERATION_ID_REQUIRED')
    const {password,...metadata}=validatedData
    const binding={organizationId:id,...metadata,credentialProof:credentialBinding(password)}
    const work=async(tx:Prisma.TransactionClient)=>{
      await assertLiveContext(tx,payload)
      if(!validatedData.operationId)await assertCriticalAction(tx,payload,'users.member.create',payload.organizationUserId,payloadHash(binding))
      if(await tx.user.findUnique({where:{phone:validatedData.phone}}))throw new AccessError(409,'INVITATION_REQUIRED','Mavjud hisobga taklif yuborish kerak')
      const passwordHash=await hashPassword(password)
      const user = await tx.user.create({data:{fullName:validatedData.fullName,phone:validatedData.phone,email:validatedData.email,passwordHash}})
      const member = await tx.organizationUser.create({data:{organizationId:id,userId:user.id,role:validatedData.role}})
      if (validatedData.storeIds?.length) await tx.userStore.createMany({data:[...new Set(validatedData.storeIds)].map(storeId=>({organizationUserId:member.id,storeId}))})
      await tx.auditLog.create({data:{organizationId:id,actorId:payload.userId,entityType:'OrganizationUser',entityId:member.id,action:'staff_created'}})
      return {...member,user:{id:user.id,fullName:user.fullName,phone:user.phone,email:user.email}}
    }
    const organizationUser=validatedData.operationId?await runOperation(payload,'users.member.create',validatedData.operationId,binding,work):await prisma.$transaction(work)

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

    throw error
  }
}
export const GET = withApi(handleGET)

export const POST = withApi(handlePOST)
import {staffSelect} from '@/server/auth/user-dto'
