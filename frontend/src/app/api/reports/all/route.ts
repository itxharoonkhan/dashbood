import { NextRequest, NextResponse } from 'next/server'
import prisma from '@/lib/prisma'
import { requireRole } from '@/lib/auth'

function buildDateFilter(period: string, startDate: string | null, endDate: string | null, col = 's.created_at') {
  const dateRx = /^\d{4}-\d{2}-\d{2}$/
  if (startDate && endDate && dateRx.test(startDate) && dateRx.test(endDate)) {
    return `AND DATE(${col}) BETWEEN '${startDate}'::date AND '${endDate}'::date`
  }
  if (period === 'today') return `AND DATE(${col}) = CURRENT_DATE`
  if (period === 'week') return `AND ${col} >= CURRENT_DATE - INTERVAL '7 days'`
  if (period === 'year') return `AND ${col} >= CURRENT_DATE - INTERVAL '1 year'`
  if (period === 'all') return ''
  return `AND ${col} >= CURRENT_DATE - INTERVAL '1 month'`
}

export async function GET(req: NextRequest) {
  const auth = requireRole(req, ['admin', 'superadmin'])
  if (auth instanceof NextResponse) return auth
  const { user } = auth

  try {
    const { searchParams } = new URL(req.url)
    const period = searchParams.get('period') || 'month'
    const startDate = searchParams.get('startDate')
    const endDate = searchParams.get('endDate')
    const tid = user.tenant_id
    const dateF = buildDateFilter(period, startDate, endDate)

    const [summaryRaw, salesByPayment, topProducts, recentSales, customerStats] = await Promise.all([
      prisma.$queryRawUnsafe<unknown[]>(`
        SELECT
          COUNT(*)::int AS total_transactions,
          COALESCE(SUM(final_total), 0) AS total_revenue,
          COALESCE(SUM(discount), 0) AS total_discounts,
          COALESCE(SUM(tax), 0) AS total_tax,
          COALESCE(AVG(final_total), 0) AS avg_transaction_value
        FROM sales s WHERE s.tenant_id = ${tid} AND s.status = 'completed' ${dateF}
      `),
      prisma.$queryRawUnsafe<unknown[]>(`
        SELECT payment_method, COUNT(*)::int AS count, COALESCE(SUM(final_total), 0) AS total
        FROM sales s WHERE tenant_id = ${tid} AND status = 'completed' ${dateF}
        GROUP BY payment_method
      `),
      prisma.$queryRawUnsafe<unknown[]>(`
        SELECT p.id, p.name, p.category,
          COALESCE(SUM(si.quantity), 0) AS total_qty,
          COALESCE(SUM(si.quantity * si.price), 0) AS total_revenue
        FROM sale_items si
        JOIN products p ON p.id = si.product_id
        JOIN sales s ON s.id = si.sale_id
        WHERE s.tenant_id = ${tid} AND s.status = 'completed' ${dateF}
        GROUP BY p.id ORDER BY total_revenue DESC LIMIT 10
      `),
      prisma.$queryRawUnsafe<unknown[]>(`
        SELECT s.id, s.sale_number, s.final_total, s.payment_method, s.status, s.created_at,
          c.name AS customer_name
        FROM sales s LEFT JOIN customers c ON c.id = s.customer_id
        WHERE s.tenant_id = ${tid} AND s.status IN ('completed', 'cancelled') ${dateF}
        ORDER BY s.created_at DESC LIMIT 20
      `),
      prisma.$queryRawUnsafe<unknown[]>(`
        SELECT COUNT(DISTINCT customer_id)::int AS customers_served,
          COUNT(CASE WHEN customer_id IS NULL THEN 1 END)::int AS walk_ins
        FROM sales s WHERE tenant_id = ${tid} AND status = 'completed' ${dateF}
      `)
    ])

    return NextResponse.json({
      success: true,
      data: {
        summary: Array.isArray(summaryRaw) ? summaryRaw[0] : {},
        salesByPayment,
        topProducts,
        recentSales,
        customerStats: Array.isArray(customerStats) ? customerStats[0] : {}
      }
    })
  } catch (err) {
    console.error('Reports all error:', err)
    return NextResponse.json({ success: false, message: 'Failed to fetch reports' }, { status: 500 })
  }
}
