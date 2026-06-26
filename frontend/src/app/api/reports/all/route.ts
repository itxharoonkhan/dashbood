import { NextRequest, NextResponse } from 'next/server'
import prisma from '@/lib/prisma'
import { requireRole } from '@/lib/auth'

const dateRx = /^\d{4}-\d{2}-\d{2}$/

function salesDateFilter(startDate: string | null, endDate: string | null) {
  if (startDate && endDate && dateRx.test(startDate) && dateRx.test(endDate)) {
    return `AND DATE(s.created_at) BETWEEN '${startDate}'::date AND '${endDate}'::date`
  }
  return `AND s.created_at >= CURRENT_DATE - INTERVAL '1 month'`
}

function expenseDateFilter(startDate: string | null, endDate: string | null) {
  if (startDate && endDate && dateRx.test(startDate) && dateRx.test(endDate)) {
    return `AND e.expense_date BETWEEN '${startDate}'::date AND '${endDate}'::date`
  }
  return `AND e.expense_date >= CURRENT_DATE - INTERVAL '1 month'`
}

export async function GET(req: NextRequest) {
  const auth = requireRole(req, ['admin', 'superadmin'])
  if (auth instanceof NextResponse) return auth
  const { user } = auth

  try {
    const { searchParams } = new URL(req.url)
    const startDate = searchParams.get('startDate')
    const endDate   = searchParams.get('endDate')
    const tid = user.tenant_id ?? 0

    const sDateF = salesDateFilter(startDate, endDate)
    const eDateF = expenseDateFilter(startDate, endDate)

    // Run queries sequentially — avoids concurrent WebSocket issues with NeonDB
    const salesPerformance = await prisma.$queryRawUnsafe<unknown[]>(`
      SELECT DATE(s.created_at)::text AS period_label,
        COUNT(*)::int AS total_sales,
        COALESCE(SUM(s.final_total), 0)::float AS revenue
      FROM sales s
      WHERE s.tenant_id = ${tid} AND s.status = 'completed' ${sDateF}
      GROUP BY DATE(s.created_at)
      ORDER BY DATE(s.created_at) ASC
    `)

    const categoryDistribution = await prisma.$queryRawUnsafe<unknown[]>(`
      SELECT COALESCE(p.category, 'Uncategorised') AS category,
        COALESCE(SUM(si.quantity), 0)::int AS total_qty,
        COALESCE(SUM(si.quantity * si.price), 0)::float AS total_revenue
      FROM sale_items si
      JOIN products p ON p.id = si.product_id
      JOIN sales s ON s.id = si.sale_id
      WHERE s.tenant_id = ${tid} AND s.status = 'completed' ${sDateF}
      GROUP BY p.category
      ORDER BY total_revenue DESC
    `)

    const revenueRaw = await prisma.$queryRawUnsafe<unknown[]>(`
      SELECT
        COALESCE(SUM(final_total), 0)::float AS total_revenue,
        COALESCE(SUM(tax), 0)::float AS total_tax_collected,
        COUNT(*)::int AS transaction_count
      FROM sales s
      WHERE tenant_id = ${tid} AND status = 'completed' ${sDateF}
    `)

    const expenseRaw = await prisma.$queryRawUnsafe<unknown[]>(`
      SELECT COALESCE(SUM(amount), 0)::float AS total_expenses
      FROM expenses e
      WHERE tenant_id = ${tid} AND is_deleted = false ${eDateF}
    `)

    const rev = (Array.isArray(revenueRaw) ? revenueRaw[0] : {}) as Record<string, number>
    const totalRevenue  = parseFloat(String(rev?.total_revenue  ?? 0))
    const totalExpenses = parseFloat(String(
      (Array.isArray(expenseRaw) ? expenseRaw[0] : {} as Record<string, number>)?.total_expenses ?? 0
    ))
    const netProfit    = totalRevenue - totalExpenses
    const profitMargin = totalRevenue > 0
      ? parseFloat(((netProfit / totalRevenue) * 100).toFixed(1))
      : 0

    return NextResponse.json({
      success: true,
      data: {
        salesPerformance,
        categoryDistribution,
        taxSummary: {
          total_tax_collected: rev?.total_tax_collected ?? 0,
          transaction_count:   rev?.transaction_count   ?? 0,
        },
        profitLoss: {
          total_revenue:   totalRevenue,
          total_expenses:  totalExpenses,
          net_profit:      netProfit,
          profit_margin:   profitMargin,
        },
      },
    })
  } catch (err) {
    console.error('Reports all error:', err)
    return NextResponse.json({ success: false, message: 'Failed to fetch reports' }, { status: 500 })
  }
}
