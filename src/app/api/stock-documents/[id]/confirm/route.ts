import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
import { verifyToken, extractTokenFromHeader } from '@/lib/auth'

export async function POST(
  request: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
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

    const document = await prisma.stockDocument.findUnique({
      where: { id: params.id },
      include: {
        items: true,
        store: true,
      },
    })

    if (!document) {
      return NextResponse.json(
        { success: false, error: { code: 'NOT_FOUND', message: 'Hujjat topilmadi' } },
        { status: 404 }
      )
    }

    if (document.status !== 'draft') {
      return NextResponse.json(
        { success: false, error: { code: 'INVALID_STATUS', message: 'Hujjat allaqachon tasdiqlangan' } },
        { status: 400 }
      )
    }

    // Confirm document in transaction
    const confirmedDocument = await prisma.$transaction(async (tx) => {
      // Update document status
      const updatedDocument = await tx.stockDocument.update({
        where: { id: params.id },
        data: {
          status: 'confirmed',
          confirmedBy: payload.userId,
          confirmedAt: new Date(),
        },
      })

      // Update inventory based on document type
      for (const item of document.items) {
        let quantityDelta = 0

        switch (document.documentType) {
          case 'purchase':
          case 'transfer_in':
          case 'return_in':
            quantityDelta = Number(item.quantity)
            break
          case 'adjustment':
            // For adjustment, quantity can be positive or negative
            quantityDelta = Number(item.quantity)
            break
          case 'transfer_out':
            quantityDelta = -Number(item.quantity)
            break
        }

        // Create inventory movement
        await tx.inventoryMovement.create({
          data: {
            organizationId: document.organizationId,
            storeId: document.storeId,
            productId: item.productId,
            movementType: 'stock_document',
            quantityDelta,
            unitCost: item.unitCost,
            sourceType: 'stock_document',
            sourceId: params.id,
            createdBy: payload.userId,
          },
        })

        // Update inventory balance
        const balance = await tx.inventoryBalance.findUnique({
          where: {
            storeId_productId: {
              storeId: document.storeId,
              productId: item.productId,
            },
          },
        })

        if (balance) {
          await tx.inventoryBalance.update({
            where: {
              storeId_productId: {
                storeId: document.storeId,
                productId: item.productId,
              },
            },
            data: {
              quantity: {
                increment: quantityDelta,
              },
            },
          })
        } else {
          await tx.inventoryBalance.create({
            data: {
              storeId: document.storeId,
              productId: item.productId,
              quantity: quantityDelta,
            },
          })
        }
      }

      return updatedDocument
    })

    return NextResponse.json({
      success: true,
      data: confirmedDocument,
      message: 'Hujjat muvaffaqiyatli tasdiqlandi',
    })

  } catch (error) {
    console.error('Confirm stock document error:', error)
    return NextResponse.json(
      { success: false, error: { code: 'INTERNAL_ERROR', message: 'Server xatosi' } },
      { status: 500 }
    )
  }
}