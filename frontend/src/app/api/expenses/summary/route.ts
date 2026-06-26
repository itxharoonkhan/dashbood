import { NextRequest, NextResponse } from 'next/server'
import { Prisma } from '@prisma/client'
import prisma from '@/lib/prisma'
import { requireRole } from '@/lib/auth'

export async function GET(req: NextRequest) {
  const auth = requireRole(req, ['admin', 'superadmin'])
  if (auth instanceof NextResponse) return auth
  const { user } = auth

  try {
    const { searchParams } = new URL(req.url)
    const from = searchParams.get('from')
    const to   = searchParams.get('to')

    const dateRx = /^\d{4}-\d{2}-\d{2}$/
    const dateSql = from && to && dateRx.test(from) && dateRx.test(to)
      ? Prisma.raw(`AND expense_date BETWEEN '${from}'::date AND '${to}'::date`)
      : Prisma.raw('')

    const tid = user.tenant_id!

    const byCategory = await prisma.$queryRaw<unknown[]>(Prisma.sql`
      SELECT category, SUM(amount) AS total
      FROM expenses
      WHERE tenant_id = ${tid} AND is_deleted = false ${dateSql}
      GROUP BY category ORDER BY total DESC
    `)

    const byMonth = await prisma.$queryRaw<unknown[]>(Prisma.sql`
      SELECT TO_CHAR(expense_date, 'YYYY-MM') AS month, SUM(amount) AS total
      FROM expenses
      WHERE tenant_id = ${tid} AND is_deleted = false ${dateSql}
      GROUP BY month ORDER BY month ASC
    `)

    const totalsRaw = await prisma.$queryRaw<unknown[]>(Prisma.sql`
      SELECT
        COALESCE(SUM(amount), 0) AS total_all,
        COALESCE(SUM(CASE WHEN expense_date = CURRENT_DATE THEN amount END), 0) AS today,
        COALESCE(SUM(CASE WHEN expense_date >= DATE_TRUNC('month', CURRENT_DATE)::date THEN amount END), 0) AS this_month,
        COUNT(*)::int AS total_entries
      FROM expenses
      WHERE tenant_id = ${tid} AND is_deleted = false ${dateSql}
    `)

    return NextResponse.json({
      success: true,
      data: {
        byCategory,
        byMonth,
        totals: Array.isArray(totalsRaw) ? totalsRaw[0] : {},
      },
    })
  } catch (err) {
    console.error('Expenses summary error:', err)
    return NextResponse.json({ success: false, message: 'Failed to fetch summary' }, { status: 500 })
  }
}
