import { NextRequest, NextResponse } from 'next/server'
import prisma from '@/lib/prisma'
import { requireRole } from '@/lib/auth'

export async function GET(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const auth = requireRole(req, ['admin', 'cashier', 'superadmin'])
  if (auth instanceof NextResponse) return auth
  const { user } = auth
  const { id } = await params

  try {
    const order = await prisma.restaurantOrder.findFirst({
      where: { id: parseInt(id), tenant_id: user.tenant_id! },
      include: {
        table: true,
        waiter: { select: { name: true } },
        items: { include: { product: { select: { name: true } } } },
        kots: { orderBy: { printed_at: 'desc' } },
        bill_splits: true
      }
    })
    if (!order) return NextResponse.json({ success: false, message: 'Order not found' }, { status: 404 })
    return NextResponse.json({ success: true, data: order })
  } catch (err) {
    return NextResponse.json({ success: false, message: 'Failed to fetch order' }, { status: 500 })
  }
}

export async function PUT(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const auth = requireRole(req, ['admin', 'cashier', 'superadmin'])
  if (auth instanceof NextResponse) return auth
  const { user } = auth
  const { id } = await params
  const { searchParams } = new URL(req.url)
  const action = searchParams.get('action')

  try {
    const order = await prisma.restaurantOrder.findFirst({ where: { id: parseInt(id), tenant_id: user.tenant_id! } })
    if (!order) return NextResponse.json({ success: false, message: 'Order not found' }, { status: 404 })

    if (action === 'cancel') {
      if (order.status === 'paid') {
        return NextResponse.json({ success: false, message: 'Cannot cancel a completed order' }, { status: 400 })
      }
      await prisma.$transaction(async (tx) => {
        await tx.restaurantOrder.update({ where: { id: order.id }, data: { status: 'cancelled' } })
        await tx.restaurantTable.update({ where: { id: order.table_id }, data: { status: 'available' } })
      })
      return NextResponse.json({ success: true, message: 'Order cancelled' })
    }

    if (action === 'reopen') {
      if (order.status !== 'billed') {
        return NextResponse.json({ success: false, message: 'Only billed orders can be reopened' }, { status: 400 })
      }
      await prisma.restaurantOrder.update({ where: { id: order.id }, data: { status: 'open' } })
      return NextResponse.json({ success: true, message: 'Order reopened' })
    }

    const { notes, pax } = await req.json()
    if (order.status === 'paid' || order.status === 'cancelled') {
      return NextResponse.json({ success: false, message: `Cannot edit a ${order.status} order` }, { status: 400 })
    }
    await prisma.restaurantOrder.update({
      where: { id: order.id },
      data: { notes: notes || null, ...(pax ? { pax: parseInt(pax) } : {}) }
    })
    return NextResponse.json({ success: true, message: 'Order updated' })
  } catch (err) {
    console.error('Order update error:', err)
    return NextResponse.json({ success: false, message: 'Failed to update order' }, { status: 500 })
  }
}

export async function DELETE(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const auth = requireRole(req, ['admin', 'superadmin'])
  if (auth instanceof NextResponse) return auth
  const { user } = auth
  const { id } = await params

  try {
    const order = await prisma.restaurantOrder.findFirst({ where: { id: parseInt(id), tenant_id: user.tenant_id! } })
    if (!order) return NextResponse.json({ success: false, message: 'Order not found' }, { status: 404 })
    if (order.status === 'paid') return NextResponse.json({ success: false, message: 'Cannot delete a completed order' }, { status: 400 })

    await prisma.$transaction(async (tx) => {
      await tx.restaurantOrder.update({ where: { id: order.id }, data: { status: 'cancelled' } })
      await tx.restaurantTable.update({ where: { id: order.table_id }, data: { status: 'available' } })
    })
    return NextResponse.json({ success: true, message: 'Order cancelled and table freed' })
  } catch (err) {
    return NextResponse.json({ success: false, message: 'Failed to delete order' }, { status: 500 })
  }
}
