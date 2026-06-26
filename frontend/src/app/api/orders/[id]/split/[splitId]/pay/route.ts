import { NextRequest, NextResponse } from 'next/server'
import prisma from '@/lib/prisma'
import { requireRole } from '@/lib/auth'

export async function PUT(req: NextRequest, { params }: { params: Promise<{ id: string; splitId: string }> }) {
  const auth = requireRole(req, ['admin', 'cashier', 'superadmin'])
  if (auth instanceof NextResponse) return auth
  const { user } = auth
  const { id, splitId } = await params

  try {
    const order = await prisma.restaurantOrder.findFirst({ where: { id: parseInt(id), tenant_id: user.tenant_id! } })
    if (!order) return NextResponse.json({ success: false, message: 'Order not found' }, { status: 404 })

    const split = await prisma.billSplit.findFirst({ where: { id: parseInt(splitId), order_id: order.id } })
    if (!split) return NextResponse.json({ success: false, message: 'Split not found' }, { status: 404 })
    if (split.paid) return NextResponse.json({ success: false, message: 'Split already paid' }, { status: 400 })

    await prisma.billSplit.update({ where: { id: split.id }, data: { paid: true } })

    const allSplits = await prisma.billSplit.findMany({ where: { order_id: order.id } })
    const allPaid = allSplits.every(s => s.id === split.id ? true : s.paid)
    if (allPaid) {
      await prisma.$transaction(async (tx) => {
        await tx.restaurantOrder.update({ where: { id: order.id }, data: { status: 'paid' } })
        await tx.restaurantTable.update({ where: { id: order.table_id }, data: { status: 'available' } })
      })
    }

    return NextResponse.json({ success: true, message: 'Split payment recorded', all_paid: allPaid })
  } catch (err) {
    console.error('Split pay error:', err)
    return NextResponse.json({ success: false, message: 'Failed to record split payment' }, { status: 500 })
  }
}
