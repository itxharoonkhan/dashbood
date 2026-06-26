import { NextRequest, NextResponse } from 'next/server'
import { Prisma } from '@prisma/client'
import prisma from '@/lib/prisma'
import { requireRole } from '@/lib/auth'

const dateRx = /^\d{4}-\d{2}-\d{2}$/

function salesDateSql(startDate: string | null, endDate: string | null) {
  if (startDate && endDate && dateRx.test(startDate) && dateRx.test(endDate)) {
    return Prisma.raw(`AND DATE(s.created_at) BETWEEN '${startDate}'::date AND '${endDate}'::date`)
  }
  return Prisma.raw(`AND s.created_at >= CURRENT_DATE - INTERVAL '1 month'`)
}

function expenseDateSql(startDate: string | null, endDate: string | null) {
  if (startDate && endDate && dateRx.test(startDate) && dateRx.test(endDate)) {
    return Prisma.raw(`AND e.expense_date BETWEEN '${startDate}'::date AND '${endDate}'::date`)
  }
  return Prisma.raw(`AND e.expense_date >= CURRENT_DATE - INTERVAL '1 month'`)
}

export async function GET(req: NextRequest) {
  const auth = requireRole(req, ['admin', 'superadmin'])
  if (auth instanceof NextResponse) return auth
  const { user } = auth

  try {
    const { searchParams } = new URL(req.url)
    const startDate = searchParams.get('startDate')
    const endDate   = searchParams.get('endDate')
    const tid = user.tenant_id!

    const sDate = salesDateSql(startDate, endDate)
    const eDate = expenseDateSql(startDate, endDate)

    const salesPerformance = await prisma.$queryRaw<unknown[]>(Prisma.sql`
      SELECT DATE(s.created_at)::text AS period_label,
        COUNT(*)::int AS total_sales,
        COALESCE(SUM(s.final_total), 0)::float AS revenue
      FROM sales s
      WHERE s.tenant_id = ${tid} AND s.status = 'completed' ${sDate}
      GROUP BY DATE(s.created_at)
      ORDER BY DATE(s.created_at) ASC
    `)

    const categoryDistribution = await prisma.$queryRaw<unknown[]>(Prisma.sql`
      SELECT
        COALESCE(p.category, 'Uncategorised') AS name,
        COALESCE(SUM(si.quantity * si.price), 0)::float AS value,
        COALESCE(SUM(si.quantity), 0)::int AS total_qty
      FROM sale_items si
      JOIN products p ON p.id = si.product_id
      JOIN sales s ON s.id = si.sale_id
      WHERE s.tenant_id = ${tid} AND s.status = 'completed' ${sDate}
      GROUP BY p.category
      ORDER BY value DESC
    `)

    const revenueRaw = await prisma.$queryRaw<unknown[]>(Prisma.sql`
      SELECT
        COALESCE(SUM(final_total), 0)::float AS total_revenue,
        COALESCE(SUM(tax), 0)::float         AS total_tax_collected,
        COUNT(*)::int                         AS transaction_count
      FROM sales s
      WHERE tenant_id = ${tid} AND status = 'completed' ${sDate}
    `)

    const costRaw = await prisma.$queryRaw<unknown[]>(Prisma.sql`
      SELECT COALESCE(SUM(si.quantity * p.cost_price), 0)::float AS total_cost
      FROM sale_items si
      JOIN products p ON p.id = si.product_id
      JOIN sales s    ON s.id = si.sale_id
      WHERE s.tenant_id = ${tid} AND s.status = 'completed' ${sDate}
    `)

    const expenseRaw = await prisma.$queryRaw<unknown[]>(Prisma.sql`
      SELECT COALESCE(SUM(amount), 0)::float AS total_expenses
      FROM expenses e
      WHERE tenant_id = ${tid} AND is_deleted = false ${eDate}
    `)

    const rev           = (Array.isArray(revenueRaw) ? revenueRaw[0] : {}) as Record<string, number>
    const totalRevenue  = parseFloat(String(rev?.total_revenue ?? 0))
    const totalCost     = parseFloat(String(
      (Array.isArray(costRaw) ? costRaw[0] as Record<string, number> : {})?.total_cost ?? 0
    ))
    const totalExpenses = parseFloat(String(
      (Array.isArray(expenseRaw) ? expenseRaw[0] as Record<string, number> : {})?.total_expenses ?? 0
    ))
    const grossProfit  = totalRevenue - totalCost
    const netProfit    = grossProfit - totalExpenses
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
          total_revenue:  totalRevenue,
          total_cost:     totalCost,
          gross_profit:   grossProfit,
          total_expenses: totalExpenses,
          net_profit:     netProfit,
          profit_margin:  profitMargin,
        },
      },
    })
  } catch (err) {
    console.error('Reports all error:', err)
    return NextResponse.json({ success: false, message: 'Failed to fetch reports' }, { status: 500 })
  }
}
