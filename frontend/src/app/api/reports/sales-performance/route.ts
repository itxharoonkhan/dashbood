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

    let groupBy: string
    let dateLabel: string
    if (period === 'today') {
      groupBy = `EXTRACT(HOUR FROM s.created_at)::int`
      dateLabel = `CONCAT(EXTRACT(HOUR FROM s.created_at)::int, ':00')`
    } else if (period === 'year') {
      groupBy = `TO_CHAR(s.created_at, 'YYYY-MM')`
      dateLabel = `TO_CHAR(s.created_at, 'Mon YYYY')`
    } else {
      groupBy = `DATE(s.created_at)`
      dateLabel = `DATE(s.created_at)::text`
    }

    let dateFilter: string
    if (startDate && endDate && dateRx.test(startDate) && dateRx.test(endDate)) {
      dateFilter = `AND DATE(s.created_at) BETWEEN '${startDate}'::date AND '${endDate}'::date`
    } else if (period === 'today') {
      dateFilter = `AND DATE(s.created_at) = CURRENT_DATE`
    } else if (period === 'week') {
      dateFilter = `AND s.created_at >= CURRENT_DATE - INTERVAL '7 days'`
    } else if (period === 'year') {
      dateFilter = `AND s.created_at >= CURRENT_DATE - INTERVAL '1 year'`
    } else {
      dateFilter = `AND s.created_at >= CURRENT_DATE - INTERVAL '1 month'`
    }

    const performance = await prisma.$queryRawUnsafe<unknown[]>(`
      SELECT ${dateLabel} AS period_label, ${groupBy} AS period_key,
        COUNT(*)::int AS transactions,
        COALESCE(SUM(s.final_total), 0) AS revenue
      FROM sales s
      WHERE s.tenant_id = ${tid} AND s.status = 'completed' ${dateFilter}
      GROUP BY period_key, period_label
      ORDER BY period_key ASC
    `)

    return NextResponse.json({ success: true, data: performance })
  } catch (err) {
    console.error('Sales performance error:', err)
    return NextResponse.json({ success: false, message: 'Failed to fetch sales performance' }, { status: 500 })
  }
}
