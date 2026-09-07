import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
import { verifyToken, extractTokenFromHeader } from '@/lib/auth'

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params
    const token = extractTokenFromHeader(request.headers.get('authorization'))
    if (!token) {
      return NextResponse.json(
        { success: false, error: { code: 'UNAUTHORIZED', message: 'Avtorizatsiya talab qilinadi' } },
        { status: 401 }
      )
    }

    const payload = verifyToken(token)
    if (!payload) {
      return NextResponse.json(
        { success: false, error: { code: 'INVALID_TOKEN', message: 'Noto\'g\'ri token' } },
        { status: 401 }
      )
    }

    const customer = await prisma.customer.findUnique({
      where: { id },
    })

    if (!customer) {
      return NextResponse.json(
        { success: false, error: { code: 'NOT_FOUND', message: 'Mijoz topilmadi' } },
        { status: 404 }
      )
    }

    // Calculate debt: sales on credit - credit payments
    const creditSales = await prisma.payment.aggregate({
      where: {
        customerId: id,
        paymentType: 'credit',
        direction: 'in',
      },
      _sum: {
        amount: true,
      },
    })

    const creditPayments = await prisma.payment.aggregate({
      where: {
        customerId: id,
        paymentType: 'credit',
        direction: 'out',
      },
      _sum: {
        amount: true,
      },
    })

    const totalDebt = (creditSales._sum.amount || 0) - (creditPayments._sum.amount || 0)

    // Get recent transactions
    const recentPayments = await prisma.payment.findMany({
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
        remainingCredit: customer.creditLimit - totalDebt,
        recentPayments,
      },
    })

  } catch (error) {
    console.error('Get customer debt error:', error)
    return NextResponse.json(
      { success: false, error: { code: 'INTERNAL_ERROR', message: 'Server xatosi' } },
      { status: 500 }
    )
  }
}