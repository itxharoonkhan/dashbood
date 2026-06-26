import { NextRequest, NextResponse } from 'next/server'
import { ItemStatus } from '@prisma/client'
import prisma from '@/lib/prisma'
import { requireRole } from '@/lib/auth'

export async function PATCH(req: NextRequest, { params }: { params: Promise<{ id: string; itemId: string }> }) {
  const auth = requireRole(req, ['admin', 'cashier', 'superadmin'])
  if (auth instanceof NextResponse) return auth
  const { user } = auth
  const { id, itemId } = await params

  try {
    const { action, quantity, notes, status } = await req.json()

    const order = await prisma.restaurantOrder.findFirst({ where: { id: parseInt(id), tenant_id: user.tenant_id! } })
    if (!order) return NextResponse.json({ success: false, message: 'Order not found' }, { status: 404 })
    if (order.status === 'paid' || order.status === 'cancelled') {
      return NextResponse.json({ success: false, message: `Cannot modify items on a ${order.status} order` }, { status: 400 })
    }

    const item = await prisma.restaurantOrderItem.findFirst({ where: { id: parseInt(itemId), order_id: order.id } })
    if (!item) return NextResponse.json({ success: false, message: 'Item not found' }, { status: 404 })

    if (action === 'cancel' || status === 'cancelled') {
      await prisma.restaurantOrderItem.update({ where: { id: item.id }, data: { status: ItemStatus.cancelled } })
      return NextResponse.json({ success: true, message: 'Item cancelled' })
    }

    const updateData: { quantity?: number; notes?: string | null; status?: ItemStatus } = {}
    if (quantity !== undefined) updateData.quantity = parseInt(quantity) || 1
    if (notes !== undefined) updateData.notes = notes || null
    if (status && Object.values(ItemStatus).includes(status as ItemStatus)) {
      updateData.status = status as ItemStatus
    }

    await prisma.restaurantOrderItem.update({ where: { id: item.id }, data: updateData })
    return NextResponse.json({ success: true, message: 'Item updated' })
  } catch (err) {
    return NextResponse.json({ success: false, message: 'Failed to update item' }, { status: 500 })
  }
}
