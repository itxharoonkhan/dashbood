import { NextRequest, NextResponse } from 'next/server'
import prisma from '@/lib/prisma'
import { requireRole } from '@/lib/auth'

export async function PUT(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const auth = requireRole(req, ['admin', 'cashier', 'superadmin'])
  if (auth instanceof NextResponse) return auth
  const { user } = auth
  const { id } = await params

  try {
    const order = await prisma.restaurantOrder.findFirst({ where: { id: parseInt(id), tenant_id: user.tenant_id! } })
    if (!order) return NextResponse.json({ success: false, message: 'Order not found' }, { status: 404 })
    if (order.status !== 'billed') {
      return NextResponse.json({ success: false, message: 'Order must be billed before completion' }, { status: 400 })
    }

    await prisma.$transaction(async (tx) => {
      await tx.restaurantOrder.update({ where: { id: order.id }, data: { status: 'paid' } })
      await tx.restaurantTable.update({ where: { id: order.table_id }, data: { status: 'available' } })
    })

    return NextResponse.json({ success: true, message: 'Order completed' })
  } catch (err) {
    console.error('Order complete error:', err)
    return NextResponse.json({ success: false, message: 'Failed to complete order' }, { status: 500 })
  }
}
