import { NextRequest, NextResponse } from 'next/server'
import prisma from '@/lib/prisma'
import { requireRole } from '@/lib/auth'

export async function POST(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const auth = requireRole(req, ['admin', 'cashier', 'superadmin'])
  if (auth instanceof NextResponse) return auth
  const { user } = auth
  const { id } = await params

  try {
    const { items } = await req.json()
    if (!Array.isArray(items) || items.length === 0) {
      return NextResponse.json({ success: false, message: 'Items are required' }, { status: 400 })
    }

    const order = await prisma.restaurantOrder.findFirst({ where: { id: parseInt(id), tenant_id: user.tenant_id! } })
    if (!order) return NextResponse.json({ success: false, message: 'Order not found' }, { status: 404 })
    if (order.status === 'paid' || order.status === 'cancelled') {
      return NextResponse.json({ success: false, message: `Cannot add items to a ${order.status} order` }, { status: 400 })
    }

    const createdItems = await prisma.$transaction(async (tx) => {
      // Create KOT first
      const totalItems = await tx.restaurantOrderItem.count({ where: { order_id: order.id } })
      const kotNumber = `KOT-${order.id}-${Date.now()}`
      const kot = await tx.kot.create({
        data: { order_id: order.id, kot_number: kotNumber }
      })

      const created = []
      for (const it of items) {
        const product = await tx.product.findFirst({ where: { id: parseInt(it.product_id), is_deleted: false, tenant_id: user.tenant_id! } })
        if (!product) throw new Error(`Product ${it.product_id} not found`)

        const unitPrice = it.unit_price ? parseFloat(String(it.unit_price)) : parseFloat(product.selling_price.toString())

        const newItem = await tx.restaurantOrderItem.create({
          data: {
            order_id: order.id,
            product_id: product.id,
            kot_id: kot.id,
            quantity: parseInt(it.quantity) || 1,
            unit_price: unitPrice,
            notes: it.notes || null
          }
        })
        created.push(newItem)
      }

      return created
    })

    return NextResponse.json({ success: true, message: 'Items added and KOT sent', data: createdItems })
  } catch (err) {
    console.error('Add order items error:', err)
    return NextResponse.json({ success: false, message: err instanceof Error ? err.message : 'Failed to add items' }, { status: 500 })
  }
}
