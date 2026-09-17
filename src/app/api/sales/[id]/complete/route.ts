import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
import { verifyToken, extractTokenFromHeader } from '@/lib/auth'
import { z } from 'zod'

const completeSaleSchema = z.object({
  payments: z.array(z.object({
    paymentType: z.enum(['cash', 'card', 'transfer', 'credit']),
    amount: z.number().positive(),
    referenceNo: z.string().optional(),
  })),
})

export async function POST(
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

    const body = await request.json()
    const validatedData = completeSaleSchema.parse(body)

    const sale = await prisma.sale.findUnique({
      where: { id },
      include: {
        items: true,
        organization: true,
        store: true,
      },
    })

    if (!sale) {
      return NextResponse.json(
        { success: false, error: { code: 'NOT_FOUND', message: 'Savdo topilmadi' } },
        { status: 404 }
      )
    }

    if (sale.status !== 'draft') {
      return NextResponse.json(
        { success: false, error: { code: 'INVALID_STATUS', message: 'Savdo allaqachon yakunlangan' } },
        { status: 400 }
      )
    }

    // Validate payment amounts
    const totalPayment = validatedData.payments.reduce((sum, p) => sum + p.amount, 0)
    if (Math.abs(totalPayment - Number(sale.totalAmount)) > 0.01) {
      return NextResponse.json(
        { success: false, error: { code: 'INVALID_PAYMENT', message: 'To\'lov summasi savdo summasiga teng bo\'lishi kerak' } },
        { status: 400 }
      )
    }

    // Check stock if organization doesn't allow negative stock
    if (!sale.organization.allowNegativeStock) {
      for (const item of sale.items) {
        const balance = await prisma.inventoryBalance.findUnique({
          where: {
            storeId_productId: {
              storeId: sale.storeId,
              productId: item.productId,
            },
          },
        })

        if (!balance || Number(balance.quantity) < Number(item.quantity)) {
          return NextResponse.json(
            { success: false, error: { code: 'INSUFFICIENT_STOCK', message: `${item.productName} uchun yetarli qoldiq yo\'q` } },
            { status: 400 }
          )
        }
      }
    }

    // Complete sale in transaction
    const completedSale = await prisma.$transaction(async (tx) => {
      // Update sale status
      const updatedSale = await tx.sale.update({
        where: { id },
        data: {
          status: 'completed',
          completedAt: new Date(),
        },
      })

      // Create payments
      for (const payment of validatedData.payments) {
        await tx.payment.create({
          data: {
            organizationId: sale.organizationId,
            storeId: sale.storeId,
            shiftId: sale.shiftId,
            saleId: id,
            customerId: sale.customerId,
            paymentType: payment.paymentType,
            direction: 'in',
            amount: payment.amount,
            referenceNo: payment.referenceNo,
            receivedBy: payload.userId,
          },
        })
      }

      // Update inventory
      for (const item of sale.items) {
        // Create inventory movement
        await tx.inventoryMovement.create({
          data: {
            organizationId: sale.organizationId,
            storeId: sale.storeId,
            productId: item.productId,
            movementType: 'sale',
            quantityDelta: -item.quantity,
            unitCost: item.unitCost,
            sourceType: 'sale',
            sourceId: id,
            createdBy: payload.userId,
          },
        })

        // Update inventory balance
        const balance = await tx.inventoryBalance.findUnique({
          where: {
            storeId_productId: {
              storeId: sale.storeId,
              productId: item.productId,
            },
          },
        })

        if (balance) {
          await tx.inventoryBalance.update({
            where: {
              storeId_productId: {
                storeId: sale.storeId,
                productId: item.productId,
              },
            },
            data: {
              quantity: {
                decrement: item.quantity,
              },
            },
          })
        } else {
          await tx.inventoryBalance.create({
            data: {
              storeId: sale.storeId,
              productId: item.productId,
              quantity: -item.quantity,
            },
          })
        }
      }

      return updatedSale
    })

    return NextResponse.json({
      success: true,
      data: completedSale,
      message: 'Savdo muvaffaqiyatli yakunlandi',
    })

  } catch (error) {
    if (error instanceof z.ZodError) {
      return NextResponse.json(
        { success: false, error: { code: 'VALIDATION_ERROR', message: 'Ma\'lumotlar noto\'g\'ri', details: error.errors } },
        { status: 400 }
      )
    }

    console.error('Complete sale error:', error)
    return NextResponse.json(
      { success: false, error: { code: 'INTERNAL_ERROR', message: 'Server xatosi' } },
      { status: 500 }
    )
  }
}