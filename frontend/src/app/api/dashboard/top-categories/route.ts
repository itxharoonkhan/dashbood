import { NextRequest, NextResponse } from 'next/server'
import prisma from '@/lib/prisma'
import { requireRole } from '@/lib/auth'

export async function GET(req: NextRequest) {
  const auth = requireRole(req, ['admin', 'cashier', 'superadmin'])
  if (auth instanceof NextResponse) return auth
  const { user } = auth

  try {
    const rows = await prisma.$queryRaw<unknown[]>`
      SELECT p.category, SUM(si.quantity)::int AS total_items_sold, SUM(si.quantity * si.price) AS total_revenue
      FROM sale_items si
      JOIN products p ON si.product_id = p.id
      JOIN sales s ON si.sale_id = s.id
      WHERE s.tenant_id = ${user.tenant_id}
      GROUP BY p.category ORDER BY total_revenue DESC LIMIT 5
    `
    return NextResponse.json({ success: true, data: rows })
  } catch (err) {
    console.error('Top categories error:', err)
    return NextResponse.json({ success: false, message: 'Error fetching top categories' }, { status: 500 })
  }
}
