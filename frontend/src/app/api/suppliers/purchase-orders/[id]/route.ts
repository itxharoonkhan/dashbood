import { NextRequest, NextResponse } from 'next/server'
import prisma from '@/lib/prisma'
import { requireRole } from '@/lib/auth'

export async function GET(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const auth = requireRole(req, ['admin', 'superadmin'])
  if (auth instanceof NextResponse) return auth
  const { user } = auth
  const { id } = await params

  try {
    const po = await prisma.purchaseOrder.findFirst({
      where: { id: parseInt(id), tenant_id: user.tenant_id! },
      include: {
        supplier: { select: { name: true, phone: true, email: true } },
        purchase_order_items: { include: { product: { select: { name: true, sku: true, stock: true } } } }
      }
    })
    if (!po) return NextResponse.json({ success: false, message: 'Purchase order not found' }, { status: 404 })

    // Flatten nested relations into the shape the frontend PODetail interface expects
    const { supplier, purchase_order_items, ...rest } = po as any
    const data = {
      ...rest,
      supplier_name: supplier?.name ?? null,
      supplier_phone: supplier?.phone ?? null,
      supplier_email: supplier?.email ?? null,
      items: (purchase_order_items ?? []).map((item: any) => ({
        id: item.id,
        product_id: item.product_id,
        product_name: item.product?.name ?? '',
        sku: item.product?.sku ?? null,
        current_stock: item.product?.stock ?? 0,
        quantity_ordered: item.quantity_ordered,
        quantity_received: item.quantity_received,
        unit_cost: Number(item.unit_cost),
      })),
      item_count: purchase_order_items?.length ?? 0,
      total_value: (purchase_order_items ?? []).reduce(
        (s: number, i: any) => s + Number(i.unit_cost) * i.quantity_ordered, 0
      ),
    }
    return NextResponse.json({ success: true, data })
  } catch (err) {
    return NextResponse.json({ success: false, message: 'Failed to fetch purchase order' }, { status: 500 })
  }
}

export async function PUT(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const auth = requireRole(req, ['admin', 'superadmin'])
  if (auth instanceof NextResponse) return auth
  const { user } = auth
  const { id } = await params
  const { searchParams } = new URL(req.url)
  const action = searchParams.get('action')

  try {
    const po = await prisma.purchaseOrder.findFirst({ where: { id: parseInt(id), tenant_id: user.tenant_id! } })
    if (!po) return NextResponse.json({ success: false, message: 'Purchase order not found' }, { status: 404 })

    if (action === 'receive') {
      const { items } = await req.json()
      if (po.status === 'cancelled') {
        return NextResponse.json({ success: false, message: 'Cannot receive cancelled PO' }, { status: 400 })
      }

      await prisma.$transaction(async (tx) => {
        for (const it of (items || [])) {
          const receivedQty = parseInt(String(it.received_quantity)) || 0
          if (receivedQty > 0) {
            await tx.purchaseOrderItem.updateMany({
              where: { id: parseInt(String(it.id)), po_id: po.id },
              data: { quantity_received: receivedQty }
            })
            await tx.product.updateMany({
              where: { id: it.product_id },
              data: { stock: { increment: receivedQty } }
            })
          }
        }
        await tx.purchaseOrder.update({ where: { id: po.id }, data: { status: 'received' } })
      })
      return NextResponse.json({ success: true, message: 'PO marked as received and stock updated' })
    }

    const { notes, expected_date, status } = await req.json()
    if (po.status === 'received') {
      return NextResponse.json({ success: false, message: 'Cannot edit a received PO' }, { status: 400 })
    }
    await prisma.purchaseOrder.update({
      where: { id: po.id },
      data: {
        notes: notes || null,
        expected_date: expected_date ? new Date(expected_date) : null,
        ...(status ? { status } : {})
      }
    })
    return NextResponse.json({ success: true, message: 'Purchase order updated' })
  } catch (err) {
    console.error('PO update error:', err)
    return NextResponse.json({ success: false, message: 'Failed to update purchase order' }, { status: 500 })
  }
}

export async function DELETE(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const auth = requireRole(req, ['admin', 'superadmin'])
  if (auth instanceof NextResponse) return auth
  const { user } = auth
  const { id } = await params

  try {
    const po = await prisma.purchaseOrder.findFirst({ where: { id: parseInt(id), tenant_id: user.tenant_id! } })
    if (!po) return NextResponse.json({ success: false, message: 'Purchase order not found' }, { status: 404 })
    if (po.status === 'received') {
      return NextResponse.json({ success: false, message: 'Cannot delete a received PO. Cancel it first.' }, { status: 400 })
    }
    await prisma.purchaseOrder.update({ where: { id: po.id }, data: { status: 'cancelled' } })
    return NextResponse.json({ success: true, message: 'Purchase order cancelled' })
  } catch (err) {
    return NextResponse.json({ success: false, message: 'Failed to cancel purchase order' }, { status: 500 })
  }
}
