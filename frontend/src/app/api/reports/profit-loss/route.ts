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
    let expenseDateFilter: string
    if (startDate && endDate && dateRx.test(startDate) && dateRx.test(endDate)) {
      dateFilter = `AND DATE(s.created_at) BETWEEN '${startDate}'::date AND '${endDate}'::date`
      expenseDateFilter = `AND e.expense_date BETWEEN '${startDate}'::date AND '${endDate}'::date`
    } else if (period === 'today') {
      dateFilter = `AND DATE(s.created_at) = CURRENT_DATE`
      expenseDateFilter = `AND e.expense_date = CURRENT_DATE`
    } else if (period === 'week') {
      dateFilter = `AND s.created_at >= CURRENT_DATE - INTERVAL '7 days'`
      expenseDateFilter = `AND e.expense_date >= CURRENT_DATE - INTERVAL '7 days'`
    } else if (period === 'year') {
      dateFilter = `AND s.created_at >= CURRENT_DATE - INTERVAL '1 year'`
      expenseDateFilter = `AND e.expense_date >= CURRENT_DATE - INTERVAL '1 year'`
    } else {
      dateFilter = `AND s.created_at >= CURRENT_DATE - INTERVAL '1 month'`
      expenseDateFilter = `AND e.expense_date >= CURRENT_DATE - INTERVAL '1 month'`
    }

    const [revenueRaw, expenseRaw] = await Promise.all([
      prisma.$queryRawUnsafe<unknown[]>(`
        SELECT COALESCE(SUM(final_total), 0) AS total_revenue, COALESCE(SUM(discount), 0) AS total_discounts
        FROM sales s WHERE tenant_id = ${tid} AND status = 'completed' ${dateFilter}
      `),
      prisma.$queryRawUnsafe<unknown[]>(`
        SELECT COALESCE(SUM(amount), 0) AS total_expenses, category
        FROM expenses e WHERE tenant_id = ${tid} AND is_deleted = false ${expenseDateFilter}
        GROUP BY category
      `)
    ])

    const revenue = (Array.isArray(revenueRaw) ? revenueRaw[0] as { total_revenue: number; total_discounts: number } : { total_revenue: 0, total_discounts: 0 })
    const totalExpenses = (expenseRaw as { total_expenses: number }[]).reduce((s, r) => s + parseFloat(String(r.total_expenses)), 0)
    const grossProfit = parseFloat(String(revenue.total_revenue))
    const netProfit = grossProfit - totalExpenses

    return NextResponse.json({
      success: true,
      data: {
        total_revenue: parseFloat(String(revenue.total_revenue)),
        total_discounts: parseFloat(String(revenue.total_discounts)),
        gross_profit: parseFloat(grossProfit.toFixed(2)),
        total_expenses: parseFloat(totalExpenses.toFixed(2)),
        net_profit: parseFloat(netProfit.toFixed(2)),
        expenses_by_category: expenseRaw
      }
    })
  } catch (err) {
    console.error('Profit-loss error:', err)
    return NextResponse.json({ success: false, message: 'Failed to fetch profit-loss report' }, { status: 500 })
  }
}
