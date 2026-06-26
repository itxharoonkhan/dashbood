import { NextRequest, NextResponse } from 'next/server'
import prisma from '@/lib/prisma'
import { requireRole } from '@/lib/auth'
import { Prisma } from '@prisma/client'

export async function GET(req: NextRequest) {
  const auth = requireRole(req, ['admin', 'superadmin'])
  if (auth instanceof NextResponse) return auth
  const { user } = auth

  try {
    const { searchParams } = new URL(req.url)
    const from = searchParams.get('from')
    const to = searchParams.get('to')
    const dateRx = /^\d{4}-\d{2}-\d{2}$/
    const tid = user.tenant_id!

    // Optional date filter scoped to purchase orders (applied in JOIN so all suppliers still appear)
    const poDateFilter = from && to && dateRx.test(from) && dateRx.test(to)
      ? Prisma.sql`AND po.created_at::date BETWEEN ${from}::date AND ${to}::date`
      : Prisma.sql``

    // Per-supplier aggregate stats required by the frontend SupplierStat interface
    const supplierStats = await prisma.$queryRaw<unknown[]>(Prisma.sql`
      SELECT
        s.id,
        s.name,
        s.phone,
        s.email,
        s.status,
        COUNT(DISTINCT po.id)::int AS total_pos,
        COALESCE(SUM(poi.quantity_ordered * poi.unit_cost), 0) AS total_ordered_value,
        COALESCE(SUM(CASE WHEN poi.quantity_received > 0 THEN poi.quantity_received * poi.unit_cost ELSE 0 END), 0) AS total_received_value,
        COUNT(DISTINCT CASE WHEN po.status IN ('draft', 'sent', 'partially_received') THEN po.id END)::int AS pending_pos
      FROM suppliers s
      LEFT JOIN purchase_orders po ON po.supplier_id = s.id ${poDateFilter}
      LEFT JOIN purchase_order_items poi ON poi.po_id = po.id
      WHERE s.tenant_id = ${tid} AND s.is_deleted = false
      GROUP BY s.id, s.name, s.phone, s.email, s.status
      ORDER BY total_pos DESC, s.name ASC
    `)

    return NextResponse.json({
      success: true,
      data: { supplierStats }
    })
  } catch (err) {
    console.error('Suppliers report error:', err)
    return NextResponse.json({ success: false, message: 'Failed to fetch supplier reports' }, { status: 500 })
  }
}
