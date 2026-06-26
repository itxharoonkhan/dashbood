import { NextRequest, NextResponse } from 'next/server'
import prisma from '@/lib/prisma'
import { requireRole } from '@/lib/auth'

export async function GET(req: NextRequest) {
  const auth = requireRole(req, ['admin', 'cashier', 'superadmin'])
  if (auth instanceof NextResponse) return auth
  const { user } = auth

  try {
    const tid = user.tenant_id!
    const rows = await prisma.$queryRaw<unknown[]>`
      SELECT
        (
          COALESCE((SELECT SUM(final_total) FROM sales WHERE tenant_id = ${tid} AND status != 'cancelled' AND DATE(created_at) = CURRENT_DATE), 0) -
          COALESCE((SELECT SUM(sr.refund_amount) FROM sale_returns sr JOIN sales s ON sr.sale_id = s.id WHERE s.tenant_id = ${tid} AND DATE(s.created_at) = CURRENT_DATE), 0)
        ) AS "todayRevenue",
        (SELECT COUNT(*) FROM sales WHERE tenant_id = ${tid} AND status != 'cancelled' AND DATE(created_at) = CURRENT_DATE)::int AS "todaySales",
        (SELECT COUNT(*) FROM customers WHERE tenant_id = ${tid})::int AS "totalCustomers",
        (SELECT COUNT(*) FROM products WHERE tenant_id = ${tid} AND stock <= threshold)::int AS "lowStock",
        (
          COALESCE((SELECT SUM(final_total) FROM sales WHERE tenant_id = ${tid} AND status != 'cancelled' AND EXTRACT(YEAR FROM created_at) = EXTRACT(YEAR FROM CURRENT_DATE) AND EXTRACT(WEEK FROM created_at) = EXTRACT(WEEK FROM CURRENT_DATE)), 0) -
          COALESCE((SELECT SUM(sr.refund_amount) FROM sale_returns sr JOIN sales s ON sr.sale_id = s.id WHERE s.tenant_id = ${tid} AND EXTRACT(YEAR FROM s.created_at) = EXTRACT(YEAR FROM CURRENT_DATE) AND EXTRACT(WEEK FROM s.created_at) = EXTRACT(WEEK FROM CURRENT_DATE)), 0)
        ) AS "weekRevenue",
        (
          COALESCE((SELECT SUM(final_total) FROM sales WHERE tenant_id = ${tid} AND status != 'cancelled' AND EXTRACT(YEAR FROM created_at) = EXTRACT(YEAR FROM CURRENT_DATE) AND EXTRACT(MONTH FROM created_at) = EXTRACT(MONTH FROM CURRENT_DATE)), 0) -
          COALESCE((SELECT SUM(sr.refund_amount) FROM sale_returns sr JOIN sales s ON sr.sale_id = s.id WHERE s.tenant_id = ${tid} AND EXTRACT(YEAR FROM s.created_at) = EXTRACT(YEAR FROM CURRENT_DATE) AND EXTRACT(MONTH FROM s.created_at) = EXTRACT(MONTH FROM CURRENT_DATE)), 0)
        ) AS "monthRevenue"
    `
    return NextResponse.json({ success: true, data: Array.isArray(rows) ? rows[0] : {} })
  } catch (err) {
    console.error('Dashboard stats error:', err)
    return NextResponse.json({ success: false, message: 'Error fetching dashboard stats' }, { status: 500 })
  }
}
