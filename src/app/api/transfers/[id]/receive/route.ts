import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
import { verifyToken, extractTokenFromHeader } from '@/lib/auth'

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

    const transfer = await prisma.stockTransfer.findUnique({
      where: { id },
      include: {
        items: true,
        toStore: true,
      },
    })

    if (!transfer) {
      return NextResponse.json(
        { success: false, error: { code: 'NOT_FOUND', message: 'Transfer topilmadi' } },
        { status: 404 }
      )
    }

    if (transfer.status !== 'sent') {
      return NextResponse.json(
        { success: false, error: { code: 'INVALID_STATUS', message: 'Transfer hali yuborilmagan' } },
        { status: 400 }
      )
    }

    // Receive transfer in transaction
    const receivedTransfer = await prisma.$transaction(async (tx) => {
      // Update transfer status
      const updatedTransfer = await tx.stockTransfer.update({
        where: { id },
        data: {
          status: 'received',
          receivedAt: new Date(),
        },
      })

      // Create stock document for transfer_in
      const stockDocument = await tx.stockDocument.create({
        data: {
          organizationId: transfer.organizationId,
          storeId: transfer.toStoreId,
          documentType: 'transfer_in',
          documentNo: `TRF-IN-${Date.now()}`,
          createdBy: payload.userId,
          confirmedBy: payload.userId,
          confirmedAt: new Date(),
          status: 'confirmed',
        },
      })

      // Create stock document items
      await tx.stockDocumentItem.createMany({
        data: transfer.items.map(item => ({
          stockDocumentId: stockDocument.id,
          productId: item.productId,
          quantity: item.quantity,
          unitCost: item.unitCost,
        })),
      })

      // Update inventory - increase stock in destination store
      for (const item of transfer.items) {
        // Create inventory movement
        await tx.inventoryMovement.create({
          data: {
            organizationId: transfer.organizationId,
            storeId: transfer.toStoreId,
            productId: item.productId,
            movementType: 'stock_document',
            quantityDelta: item.quantity,
            unitCost: item.unitCost,
            sourceType: 'stock_document',
            sourceId: stockDocument.id,
            createdBy: payload.userId,
          },
        })

        // Update inventory balance
        const balance = await tx.inventoryBalance.findUnique({
          where: {
            storeId_productId: {
              storeId: transfer.toStoreId,
              productId: item.productId,
            },
          },
        })

        if (balance) {
          await tx.inventoryBalance.update({
            where: {
              storeId_productId: {
                storeId: transfer.toStoreId,
                productId: item.productId,
              },
            },
            data: {
              quantity: {
                increment: item.quantity,
              },
            },
          })
        } else {
          await tx.inventoryBalance.create({
            data: {
              storeId: transfer.toStoreId,
              productId: item.productId,
              quantity: item.quantity,
            },
          })
        }
      }

      return updatedTransfer
    })

    return NextResponse.json({
      success: true,
      data: receivedTransfer,
      message: 'Transfer muvaffaqiyatli qabul qilindi',
    })

  } catch (error) {
    console.error('Receive transfer error:', error)
    return NextResponse.json(
      { success: false, error: { code: 'INTERNAL_ERROR', message: 'Server xatosi' } },
      { status: 500 }
    )
  }
}