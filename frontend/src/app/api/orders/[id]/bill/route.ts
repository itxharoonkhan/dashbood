import { NextRequest, NextResponse } from 'next/server'
import prisma from '@/lib/prisma'
import { requireRole } from '@/lib/auth'

export async function PUT(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const auth = requireRole(req, ['admin', 'cashier', 'superadmin'])
  if (auth instanceof NextResponse) return auth
  const { user } = auth
  const { id } = await params

  try {
    const { discount_amount } = await req.json()
    const order = await prisma.restaurantOrder.findFirst({
      where: { id: parseInt(id), tenant_id: user.tenant_id! },
    })
    if (!order) return NextResponse.json({ success: false, message: 'Order not found' }, { status: 404 })
    if (order.status === 'billed') return NextResponse.json({ success: false, message: 'Bill already generated' }, { status: 400 })
    if (order.status !== 'open') {
      return NextResponse.json({ success: false, message: `Cannot generate bill for a ${order.status} order` }, { status: 400 })
    }

    const orderItems = await prisma.restaurantOrderItem.findMany({
      where: { order_id: order.id, status: { not: 'cancelled' } }
    })

    const settings = await prisma.settings.findFirst({ where: { tenant_id: user.tenant_id! } })
    const taxRate = settings ? parseFloat(settings.tax_rate.toString()) : 0

    const subtotal = orderItems.reduce((sum: number, item) => sum + parseFloat(item.unit_price.toString()) * item.quantity, 0)
    const disc = parseFloat(discount_amount) || 0
    const afterDiscount = Math.max(0, subtotal - disc)
    const taxAmount = parseFloat(((afterDiscount * taxRate) / 100).toFixed(2))
    const serviceCharge = parseFloat(((afterDiscount * 0) / 100).toFixed(2))
    const finalAmount = parseFloat((afterDiscount + taxAmount + serviceCharge).toFixed(2))

    await prisma.restaurantOrder.update({
      where: { id: order.id },
      data: { status: 'billed' }
    })

    return NextResponse.json({
      success: true,
      message: 'Bill generated',
      data: { subtotal, discount_amount: disc, tax_amount: taxAmount, service_charge: serviceCharge, final_amount: finalAmount }
    })
  } catch (err) {
    console.error('Bill generate error:', err)
    return NextResponse.json({ success: false, message: 'Failed to generate bill' }, { status: 500 })
  }
}
