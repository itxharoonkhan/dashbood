import { NextRequest, NextResponse } from 'next/server'
import prisma from '@/lib/prisma'
import { requireRole } from '@/lib/auth'

export async function GET(req: NextRequest) {
  const auth = requireRole(req, ['admin', 'cashier', 'superadmin'])
  if (auth instanceof NextResponse) return auth
  const { user } = auth

  try {
    const kots = await prisma.$queryRaw<unknown[]>`
      SELECT k.id, k.order_id, k.kot_number, k.status, k.printed_at,
        o.table_id, t.name AS table_name, t.floor_section,
        JSON_AGG(JSON_BUILD_OBJECT(
          'id', oi.id,
          'product_id', oi.product_id,
          'product_name', p.name,
          'quantity', oi.quantity,
          'notes', oi.notes,
          'status', oi.status
        ) ORDER BY oi.id) AS items
      FROM kots k
      JOIN restaurant_orders o ON o.id = k.order_id
      JOIN restaurant_tables t ON t.id = o.table_id
      JOIN restaurant_order_items oi ON oi.kot_id = k.id
      JOIN products p ON p.id = oi.product_id
      WHERE o.tenant_id = ${user.tenant_id} AND k.status IN ('pending', 'cooking')
      GROUP BY k.id, o.table_id, t.name, t.floor_section
      ORDER BY k.printed_at ASC
    `
    return NextResponse.json({ success: true, data: kots })
  } catch (err) {
    console.error('Kitchen KOTs error:', err)
    return NextResponse.json({ success: false, message: 'Failed to fetch KOTs' }, { status: 500 })
  }
}

export async function PUT(req: NextRequest) {
  const auth = requireRole(req, ['admin', 'cashier', 'superadmin'])
  if (auth instanceof NextResponse) return auth
  const { user } = auth
  const { searchParams } = new URL(req.url)
  const action = searchParams.get('action')

  try {
    const { kot_id, item_id, status } = await req.json()

    if (action === 'update-kot-status') {
      if (!kot_id || !status) return NextResponse.json({ success: false, message: 'kot_id and status required' }, { status: 400 })
      // Verify KOT belongs to tenant
      const kot = await prisma.$queryRaw<{ id: number }[]>`
        SELECT k.id FROM kots k JOIN restaurant_orders o ON o.id = k.order_id WHERE k.id = ${parseInt(kot_id)} AND o.tenant_id = ${user.tenant_id}
      `
      if (!kot.length) return NextResponse.json({ success: false, message: 'KOT not found' }, { status: 404 })
      await prisma.kot.update({ where: { id: parseInt(kot_id) }, data: { status } })
      return NextResponse.json({ success: true, message: `KOT marked as ${status}` })
    }

    if (action === 'update-item-status') {
      if (!item_id || !status) return NextResponse.json({ success: false, message: 'item_id and status required' }, { status: 400 })
      // Verify item belongs to this tenant via its KOT → order
      const item = await prisma.restaurantOrderItem.findFirst({
        where: { id: parseInt(item_id) },
        include: { kot: { include: { order: { select: { tenant_id: true } } } } }
      })
      if (!item || item.kot?.order?.tenant_id !== user.tenant_id) return NextResponse.json({ success: false, message: 'Item not found' }, { status: 404 })

      await prisma.restaurantOrderItem.update({ where: { id: parseInt(item_id) }, data: { status } })

      if (item.kot_id) {
        const remaining = await prisma.restaurantOrderItem.count({ where: { kot_id: item.kot_id, status: { not: 'served' } } })
        if (remaining === 0) {
          await prisma.kot.update({ where: { id: item.kot_id }, data: { status: 'served' } })
        }
      }
      return NextResponse.json({ success: true, message: `Item marked as ${status}` })
    }

    return NextResponse.json({ success: false, message: 'Invalid action' }, { status: 400 })
  } catch (err) {
    console.error('Kitchen update error:', err)
    return NextResponse.json({ success: false, message: 'Failed to update kitchen status' }, { status: 500 })
  }
}
