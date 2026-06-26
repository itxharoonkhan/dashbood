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

    const overall = await prisma.$queryRaw<unknown[]>(Prisma.sql`
      SELECT
        COALESCE(SUM(total), 0) AS taxable_amount,
        COALESCE(SUM(tax), 0) AS total_tax_collected,
        COALESCE(SUM(final_total), 0) AS total_with_tax,
        COUNT(*)::int AS transaction_count
      FROM sales s WHERE tenant_id = ${tid} AND status = 'completed' ${Prisma.raw(dateFilter)}
    `)
    const byMonth = await prisma.$queryRaw<unknown[]>(Prisma.sql`
      SELECT TO_CHAR(s.created_at, 'YYYY-MM') AS month,
        COALESCE(SUM(s.total), 0) AS taxable_amount,
        COALESCE(SUM(s.tax), 0) AS tax_collected
      FROM sales s WHERE s.tenant_id = ${tid} AND s.status = 'completed' ${Prisma.raw(dateFilter)}
      GROUP BY month ORDER BY month ASC
    `)

    return NextResponse.json({ success: true, data: { overall: Array.isArray(overall) ? overall[0] : {}, byMonth } })
  } catch (err) {
    return NextResponse.json({ success: false, message: 'Failed to fetch tax summary' }, { status: 500 })
  }
}
