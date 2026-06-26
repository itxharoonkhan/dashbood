import { NextRequest, NextResponse } from 'next/server'
import prisma from '@/lib/prisma'
import { requireRole } from '@/lib/auth'

export async function GET(req: NextRequest) {
  const auth = requireRole(req, ['admin', 'cashier', 'superadmin'])
  if (auth instanceof NextResponse) return auth
  const { user } = auth

  try {
    const tid = user.tenant_id!

    const statsRows = await prisma.$queryRaw<unknown[]>`
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

    const recentSales = await prisma.$queryRaw<unknown[]>`
      SELECT s.id, s.sale_number, s.final_total AS grand_total, s.payment_method,
        s.created_at AS sale_date, s.table_name, c.name AS customer_name,
        STRING_AGG(CONCAT(sp.method, ':', ROUND(sp.amount::numeric, 2)::text), '|' ORDER BY sp.id) AS split_breakdown
      FROM sales s
      LEFT JOIN customers c ON s.customer_id = c.id
      LEFT JOIN sale_payments sp ON s.id = sp.sale_id
      WHERE s.tenant_id = ${tid} AND s.status != 'cancelled' AND DATE(s.created_at) = CURRENT_DATE
      GROUP BY s.id, s.sale_number, s.final_total, s.payment_method, s.created_at, s.table_name, c.name
      ORDER BY s.id DESC
    `

    const topCategories = await prisma.$queryRaw<unknown[]>`
      SELECT p.category, SUM(si.quantity)::int AS total_items_sold, SUM(si.quantity * si.price) AS total_revenue
      FROM sale_items si
      JOIN products p ON si.product_id = p.id
      JOIN sales s ON si.sale_id = s.id
      WHERE s.tenant_id = ${tid}
      GROUP BY p.category ORDER BY total_revenue DESC LIMIT 5
    `

    const dailySales = await prisma.$queryRaw<unknown[]>`
      SELECT DATE(s.created_at) AS date, COUNT(DISTINCT s.id)::int AS sales_count,
        SUM(s.final_total) - COALESCE(SUM(ret_sum.refund_amount), 0) AS revenue
      FROM sales s
      LEFT JOIN (
        SELECT sale_id, SUM(refund_amount) AS refund_amount FROM sale_returns GROUP BY sale_id
      ) ret_sum ON s.id = ret_sum.sale_id
      WHERE s.tenant_id = ${tid} AND s.status != 'cancelled' AND s.created_at >= CURRENT_DATE - INTERVAL '7 days'
      GROUP BY DATE(s.created_at) ORDER BY date DESC
    `

    return NextResponse.json({
      success: true,
      data: {
        stats: Array.isArray(statsRows) ? statsRows[0] : {},
        recentSales,
        topCategories,
        dailySales,
      },
    })
  } catch (err) {
    console.error('Dashboard all error:', err)
    return NextResponse.json({ success: false, message: 'Error fetching dashboard data' }, { status: 500 })
  }
}
