import { NextRequest, NextResponse } from 'next/server'
import prisma from '@/lib/prisma'
import { requireRole } from '@/lib/auth'

export async function GET(req: NextRequest) {
  const auth = requireRole(req, ['admin', 'superadmin'])
  if (auth instanceof NextResponse) return auth
  const { user } = auth

  try {
    const { searchParams } = new URL(req.url)
    const from = searchParams.get('from')
    const to = searchParams.get('to')

    const dateFilter = from && to
      ? `AND expense_date BETWEEN '${from}'::date AND '${to}'::date`
      : ''

    const [byCategory, byMonth, totals] = await Promise.all([
      prisma.$queryRawUnsafe<unknown[]>(`
        SELECT category, SUM(amount) AS total
        FROM expenses WHERE tenant_id = ${user.tenant_id} AND is_deleted = false ${dateFilter}
        GROUP BY category ORDER BY total DESC
      `),
      prisma.$queryRawUnsafe<unknown[]>(`
        SELECT TO_CHAR(expense_date, 'YYYY-MM') AS month, SUM(amount) AS total
        FROM expenses WHERE tenant_id = ${user.tenant_id} AND is_deleted = false ${dateFilter}
        GROUP BY month ORDER BY month ASC
      `),
      prisma.$queryRawUnsafe<unknown[]>(`
        SELECT
          COALESCE(SUM(amount), 0) AS total_all,
          COALESCE(SUM(CASE WHEN expense_date = CURRENT_DATE THEN amount END), 0) AS today,
          COALESCE(SUM(CASE WHEN expense_date >= DATE_TRUNC('month', CURRENT_DATE)::date THEN amount END), 0) AS this_month,
          COUNT(*)::int AS total_entries
        FROM expenses WHERE tenant_id = ${user.tenant_id} AND is_deleted = false ${dateFilter}
      `)
    ])

    return NextResponse.json({ success: true, data: { byCategory, byMonth, totals: Array.isArray(totals) ? totals[0] : {} } })
  } catch (err) {
    console.error('Expenses summary error:', err)
    return NextResponse.json({ success: false, message: 'Failed to fetch summary' }, { status: 500 })
  }
}
