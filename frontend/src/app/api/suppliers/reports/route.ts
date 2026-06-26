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
    const dateFilter = from && to && dateRx.test(from) && dateRx.test(to)
      ? `AND DATE(po.created_at) BETWEEN '${from}'::date AND '${to}'::date`
      : ''
    const tid = user.tenant_id

    const summary = await prisma.$queryRaw<unknown[]>(Prisma.sql`
      SELECT
        COUNT(po.id)::int AS total_pos,
        COUNT(DISTINCT po.supplier_id)::int AS suppliers_used
      FROM purchase_orders po WHERE po.tenant_id = ${tid} ${Prisma.raw(dateFilter)}
    `)
    const topSuppliers = await prisma.$queryRaw<unknown[]>(Prisma.sql`
      SELECT s.id, s.name, COUNT(po.id)::int AS po_count
      FROM suppliers s
      LEFT JOIN purchase_orders po ON po.supplier_id = s.id AND po.tenant_id = ${tid} ${Prisma.raw(dateFilter)}
      WHERE s.tenant_id = ${tid} AND s.is_deleted = false
      GROUP BY s.id ORDER BY po_count DESC LIMIT 10
    `)
    const byStatus = await prisma.$queryRaw<unknown[]>(Prisma.sql`
      SELECT status, COUNT(*)::int AS count
      FROM purchase_orders WHERE tenant_id = ${tid} ${Prisma.raw(dateFilter)}
      GROUP BY status
    `)
    const monthly = await prisma.$queryRaw<unknown[]>(Prisma.sql`
      SELECT TO_CHAR(created_at, 'YYYY-MM') AS month, COUNT(*)::int AS orders
      FROM purchase_orders WHERE tenant_id = ${tid} AND status != 'cancelled' ${Prisma.raw(dateFilter)}
      GROUP BY month ORDER BY month ASC
    `)

    return NextResponse.json({
      success: true,
      data: { summary: Array.isArray(summary) ? summary[0] : {}, topSuppliers, byStatus, monthly }
    })
  } catch (err) {
    console.error('Suppliers report error:', err)
    return NextResponse.json({ success: false, message: 'Failed to fetch supplier reports' }, { status: 500 })
  }
}
