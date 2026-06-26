import { NextRequest, NextResponse } from 'next/server'
import prisma from '@/lib/prisma'
import { requireRole } from '@/lib/auth'

export async function POST(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const auth = requireRole(req, ['admin', 'cashier', 'superadmin'])
  if (auth instanceof NextResponse) return auth
  const { user } = auth
  const { id } = await params

  try {
    const { split_type, number_of_splits, custom_amounts } = await req.json()
    const order = await prisma.restaurantOrder.findFirst({ where: { id: parseInt(id), tenant_id: user.tenant_id! } })
    if (!order) return NextResponse.json({ success: false, message: 'Order not found' }, { status: 404 })
    if (order.status !== 'billed') return NextResponse.json({ success: false, message: 'Generate bill before splitting' }, { status: 400 })

    // Delete existing unpaid splits
    await prisma.$executeRaw`DELETE FROM bill_splits WHERE order_id = ${order.id} AND paid = false`

    // Compute final amount from items
    const items = await prisma.restaurantOrderItem.findMany({ where: { order_id: order.id, status: { not: 'cancelled' } } })
    const settings = await prisma.settings.findFirst({ where: { tenant_id: user.tenant_id! } })
    const taxRate = settings ? parseFloat(settings.tax_rate.toString()) : 0
    const subtotal = items.reduce((s, i) => s + parseFloat(i.unit_price.toString()) * i.quantity, 0)
    const finalAmount = parseFloat((subtotal * (1 + taxRate / 100)).toFixed(2))

    let splits: { amount: number; label: string }[] = []

    if (split_type === 'equal') {
      const n = parseInt(number_of_splits) || 2
      const each = parseFloat((finalAmount / n).toFixed(2))
      const rem = parseFloat((finalAmount - each * (n - 1)).toFixed(2))
      splits = Array.from({ length: n }, (_, i) => ({ amount: i === n - 1 ? rem : each, label: `Person ${i + 1}` }))
    } else if (split_type === 'custom' && Array.isArray(custom_amounts)) {
      const total = custom_amounts.reduce((s: number, a: { amount: number; label?: string }) => s + parseFloat(String(a.amount)), 0)
      if (Math.abs(total - finalAmount) > 0.01) {
        return NextResponse.json({ success: false, message: `Custom amounts must sum to Rs. ${finalAmount.toFixed(2)}` }, { status: 400 })
      }
      splits = custom_amounts.map((a: { amount: number; label?: string }, i: number) => ({
        amount: parseFloat(String(a.amount)),
        label: a.label || `Person ${i + 1}`
      }))
    } else {
      return NextResponse.json({ success: false, message: 'Invalid split type' }, { status: 400 })
    }

    for (const s of splits) {
      await prisma.billSplit.create({
        data: {
          order_id: order.id,
          split_type: split_type === 'equal' ? 'equal' : 'by_item',
          person_label: s.label,
          amount: s.amount
        }
      })
    }
    const created = await prisma.billSplit.findMany({ where: { order_id: order.id }, orderBy: { id: 'asc' } })

    return NextResponse.json({ success: true, data: created })
  } catch (err) {
    console.error('Split order error:', err)
    return NextResponse.json({ success: false, message: 'Failed to split order' }, { status: 500 })
  }
}
