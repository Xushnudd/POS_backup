import { AccessError } from '@/server/auth/policy'
import { scopedPrisma } from '@/server/auth/scoped-prisma'
import { withApi } from '@/server/api'
import { Prisma } from '@prisma/client'
import { NextRequest, NextResponse } from 'next/server'
import { verifyToken, getRequestToken } from '@/lib/auth'

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

    const customer = await db.customer.findUnique({
      where: { id },
    })

    if (!customer) {
      return NextResponse.json(
        { success: false, error: { code: 'NOT_FOUND', message: 'Mijoz topilmadi' } },
        { status: 404 }
      )
    }

    const ledger = await db.debtEntry.aggregate({
      where: { customerId: id }, _sum: { amount: true },
    })
    const totalDebt = new Prisma.Decimal(ledger._sum.amount ?? 0)

    let allocationTargets
    if (request.nextUrl.searchParams.has('targetsPage')) {
      if (payload.role!=='owner') throw new AccessError(403,'OWNER_REQUIRED')
      const raw=request.nextUrl.searchParams.get('targetsPage')??''
      if (!/^[1-9]\d*$/.test(raw)||!Number.isSafeInteger(Number(raw))||Number(raw)>100000) throw new AccessError(400,'INVALID_PAGE')
      const page=Number(raw),limit=50
      const groups=await db.debtEntry.groupBy({
        by:['saleId'],where:{customerId:id},_sum:{amount:true},_min:{effectiveAt:true},
        having:{amount:{_sum:{gt:0}}},orderBy:[{_min:{effectiveAt:'asc'}},{saleId:'asc'}],skip:(page-1)*limit,take:limit+1,
      })
      const selected=groups.slice(0,limit)
      const sales=await db.sale.findMany({where:{id:{in:selected.flatMap(group=>group.saleId?[group.saleId]:[])}},select:{id:true,receiptNo:true}})
      allocationTargets={page,hasMore:groups.length>limit,items:selected.map(group=>({saleId:group.saleId,receiptNo:sales.find(sale=>sale.id===group.saleId)?.receiptNo??null,balance:String(group._sum.amount??0)}))}
    }

    // Get recent transactions
    const recentPayments = await db.payment.findMany({
      where: {
        customerId: id,
        paymentType: 'credit',
      },
      orderBy: {
        createdAt: 'desc',
      },
      take: 10,
    })

    return NextResponse.json({
      success: true,
      data: {
        customerId: customer.id,
        customerName: customer.fullName,
        creditLimit: customer.creditLimit,
        totalDebt,
        remainingCredit: customer.creditLimit.sub(totalDebt),
        recentPayments,
        ...(allocationTargets?{allocationTargets}:{}),
      },
    })

  } catch (error) {
    if (error instanceof AccessError) throw error
    return NextResponse.json(
      { success: false, error: { code: 'INTERNAL_ERROR', message: 'Server xatosi' } },
      { status: 500 }
    )
  }
}
export const GET = withApi(handleGET)
