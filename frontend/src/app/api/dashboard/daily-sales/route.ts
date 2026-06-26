import { NextRequest, NextResponse } from 'next/server'
import prisma from '@/lib/prisma'
import { requireRole } from '@/lib/auth'

export async function GET(req: NextRequest) {
  const auth = requireRole(req, ['admin', 'cashier', 'superadmin'])
  if (auth instanceof NextResponse) return auth
  const { user } = auth

  try {
    const rows = await prisma.$queryRaw<unknown[]>`
      SELECT DATE(s.created_at) AS date, COUNT(DISTINCT s.id)::int AS sales_count,
        SUM(s.final_total) - COALESCE(SUM(ret_sum.refund_amount), 0) AS revenue
      FROM sales s
      LEFT JOIN (
        SELECT sale_id, SUM(refund_amount) AS refund_amount FROM sale_returns GROUP BY sale_id
      ) ret_sum ON s.id = ret_sum.sale_id
      WHERE s.tenant_id = ${user.tenant_id} AND s.created_at >= CURRENT_DATE - INTERVAL '7 days'
      GROUP BY DATE(s.created_at) ORDER BY date DESC
    `
    return NextResponse.json({ success: true, data: rows })
  } catch (err) {
    console.error('Daily sales error:', err)
    return NextResponse.json({ success: false, message: 'Error fetching daily sales' }, { status: 500 })
  }
}
