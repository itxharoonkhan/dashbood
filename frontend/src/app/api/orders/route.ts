import { NextRequest, NextResponse } from 'next/server'
import prisma from '@/lib/prisma'
import { requireRole } from '@/lib/auth'

export async function GET(req: NextRequest) {
  const auth = requireRole(req, ['admin', 'cashier', 'superadmin'])
  if (auth instanceof NextResponse) return auth
  const { user } = auth

  try {
    const { searchParams } = new URL(req.url)
    const status = searchParams.get('status')
    const table_id = searchParams.get('table_id')

    const statusFilter = status ? `AND o.status = '${status.replace(/'/g, "''")}'` : ''
    const tableFilter = table_id ? `AND o.table_id = ${parseInt(table_id)}` : ''

    const rows = await prisma.$queryRawUnsafe<unknown[]>(`
      SELECT o.*,
        t.name AS table_name, t.floor_section,
        COUNT(oi.id)::int AS item_count
      FROM restaurant_orders o
      LEFT JOIN restaurant_tables t ON t.id = o.table_id
      LEFT JOIN restaurant_order_items oi ON oi.order_id = o.id
      WHERE o.tenant_id = ${user.tenant_id} ${statusFilter} ${tableFilter}
      GROUP BY o.id, t.name, t.floor_section
      ORDER BY o.created_at DESC
      LIMIT 100
    `)
    return NextResponse.json({ success: true, data: rows })
  } catch (err) {
    console.error('Orders list error:', err)
    return NextResponse.json({ success: false, message: 'Failed to fetch orders' }, { status: 500 })
  }
}

export async function POST(req: NextRequest) {
  const auth = requireRole(req, ['admin', 'cashier', 'superadmin'])
  if (auth instanceof NextResponse) return auth
  const { user } = auth

  try {
    const { table_id, waiter_name, pax, notes } = await req.json()
    if (!table_id) return NextResponse.json({ success: false, message: 'Table is required' }, { status: 400 })

    const table = await prisma.restaurantTable.findFirst({ where: { id: parseInt(table_id), is_deleted: false, tenant_id: user.tenant_id! } })
    if (!table) return NextResponse.json({ success: false, message: 'Table not found' }, { status: 404 })
    if (table.status === 'occupied') {
      return NextResponse.json({ success: false, message: 'Table is already occupied' }, { status: 400 })
    }

    const order = await prisma.$transaction(async (tx) => {
      const o = await tx.restaurantOrder.create({
        data: {
          table_id: parseInt(table_id),
          waiter_id: user.id,
          waiter_name: waiter_name || null,
          pax: parseInt(pax) || 1,
          notes: notes || null,
          tenant_id: user.tenant_id!
        }
      })
      await tx.restaurantTable.update({ where: { id: parseInt(table_id) }, data: { status: 'occupied' } })
      return o
    })

    return NextResponse.json({ success: true, message: 'Order created', data: order })
  } catch (err) {
    console.error('Order create error:', err)
    return NextResponse.json({ success: false, message: 'Failed to create order' }, { status: 500 })
  }
}
