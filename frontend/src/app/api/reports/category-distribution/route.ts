import { NextRequest, NextResponse } from 'next/server'
import prisma from '@/lib/prisma'
import { requireRole } from '@/lib/auth'

export async function GET(req: NextRequest) {
  const auth = requireRole(req, ['admin', 'superadmin'])
  if (auth instanceof NextResponse) return auth
  const { user } = auth

  try {
    const { searchParams } = new URL(req.url)
    const period = searchParams.get('period') || 'month'
    const startDate = searchParams.get('startDate')
    const endDate = searchParams.get('endDate')
    const dateRx = /^\d{4}-\d{2}-\d{2}$/
    const tid = user.tenant_id

    let dateFilter: string
    if (startDate && endDate && dateRx.test(startDate) && dateRx.test(endDate)) {
      dateFilter = `AND DATE(s.created_at) BETWEEN '${startDate}'::date AND '${endDate}'::date`
    } else if (period === 'today') dateFilter = `AND DATE(s.created_at) = CURRENT_DATE`
    else if (period === 'week') dateFilter = `AND s.created_at >= CURRENT_DATE - INTERVAL '7 days'`
    else if (period === 'year') dateFilter = `AND s.created_at >= CURRENT_DATE - INTERVAL '1 year'`
    else dateFilter = `AND s.created_at >= CURRENT_DATE - INTERVAL '1 month'`

    const data = await prisma.$queryRawUnsafe<unknown[]>(`
      SELECT p.category,
        COALESCE(SUM(si.quantity), 0) AS total_qty,
        COALESCE(SUM(si.quantity * si.price), 0) AS total_revenue,
        COUNT(DISTINCT si.id)::int AS line_items
      FROM sale_items si
      JOIN products p ON p.id = si.product_id
      JOIN sales s ON s.id = si.sale_id
      WHERE s.tenant_id = ${tid} AND s.status = 'completed' ${dateFilter}
      GROUP BY p.category
      ORDER BY total_revenue DESC
    `)

    return NextResponse.json({ success: true, data })
  } catch (err) {
    return NextResponse.json({ success: false, message: 'Failed to fetch category distribution' }, { status: 500 })
  }
}
