import { NextRequest, NextResponse } from 'next/server'
import prisma from '@/lib/prisma'
import { requireRole } from '@/lib/auth'

const toRupees = (paise: bigint | null | undefined) => paise != null ? Number(paise) / 100 : null

export async function GET(req: NextRequest) {
  const auth = requireRole(req, ['admin', 'superadmin'])
  if (auth instanceof NextResponse) return auth
  const { user } = auth

  try {
    const rows = await prisma.$queryRaw<unknown[]>`
      SELECT s.*, u.name AS cashier_name,
        COALESCE((SELECT SUM(final_total) FROM sales WHERE shift_id = s.id AND status = 'completed'), 0) AS total_sales_rupees,
        COALESCE((SELECT COUNT(*) FROM sales WHERE shift_id = s.id AND status = 'completed'), 0)::int AS transaction_count
      FROM shifts s
      JOIN users u ON s.cashier_id = u.id
      WHERE s.tenant_id = ${user.tenant_id} AND s.is_deleted = false
      ORDER BY s.start_time DESC
    `

    const data = (rows as Array<Record<string, unknown>>).map(row => ({
      ...row,
      opening_cash: Number(row.opening_cash as bigint),
      closing_cash: row.closing_cash != null ? Number(row.closing_cash as bigint) : null,
      expected_cash: row.expected_cash != null ? Number(row.expected_cash as bigint) : null,
      variance: row.variance != null ? Number(row.variance as bigint) : null,
      opening_cash_rupees: row.opening_cash != null ? Number(row.opening_cash as bigint) / 100 : null,
      closing_cash_rupees: row.closing_cash != null ? Number(row.closing_cash as bigint) / 100 : null,
      expected_cash_rupees: row.expected_cash != null ? Number(row.expected_cash as bigint) / 100 : null,
      variance_rupees: row.variance != null ? Number(row.variance as bigint) / 100 : null,
      total_sales_rupees: parseFloat(String(row.total_sales_rupees)) || 0,
      transaction_count: parseInt(String(row.transaction_count)) || 0,
    }))

    return NextResponse.json({ success: true, data })
  } catch (err) {
    console.error('Shifts list error:', err)
    return NextResponse.json({ success: false, message: 'Failed to fetch shifts' }, { status: 500 })
  }
}
