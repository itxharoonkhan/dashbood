import { NextRequest, NextResponse } from 'next/server'
import prisma from '@/lib/prisma'
import { requireRole } from '@/lib/auth'

export async function GET(req: NextRequest) {
  const auth = requireRole(req, ['admin', 'cashier', 'superadmin'])
  if (auth instanceof NextResponse) return auth
  const { user } = auth

  try {
    const rows = await prisma.$queryRaw<unknown[]>`
      SELECT t.*, o.id AS active_order_id
      FROM restaurant_tables t
      LEFT JOIN restaurant_orders o ON o.table_id = t.id AND o.status IN ('open', 'billed')
      WHERE t.is_deleted = false AND t.tenant_id = ${user.tenant_id}
      ORDER BY t.name ASC
    `
    return NextResponse.json({ success: true, data: rows })
  } catch (err) {
    console.error('Tables list error:', err)
    return NextResponse.json({ success: false, message: 'Failed to fetch tables' }, { status: 500 })
  }
}

export async function POST(req: NextRequest) {
  const auth = requireRole(req, ['admin', 'superadmin'])
  if (auth instanceof NextResponse) return auth
  const { user } = auth

  try {
    const { name, capacity, floor_section } = await req.json()
    if (!name?.trim()) return NextResponse.json({ success: false, message: 'Table name is required' }, { status: 400 })

    const existing = await prisma.restaurantTable.findFirst({ where: { name: name.trim(), is_deleted: false, tenant_id: user.tenant_id! } })
    if (existing) return NextResponse.json({ success: false, message: `Table "${name}" already exists` }, { status: 400 })

    const table = await prisma.restaurantTable.create({
      data: { name: name.trim(), capacity: parseInt(capacity) || 4, floor_section: floor_section || 'Main', tenant_id: user.tenant_id! }
    })
    return NextResponse.json({ success: true, message: 'Table created', data: table })
  } catch (err) {
    return NextResponse.json({ success: false, message: 'Failed to create table' }, { status: 500 })
  }
}
