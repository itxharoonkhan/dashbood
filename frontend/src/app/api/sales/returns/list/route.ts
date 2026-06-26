import { NextRequest, NextResponse } from 'next/server'
import prisma from '@/lib/prisma'
import { requireRole } from '@/lib/auth'

export async function GET(req: NextRequest) {
  const auth = requireRole(req, ['admin', 'superadmin'])
  if (auth instanceof NextResponse) return auth
  const { user } = auth

  try {
    const { searchParams } = new URL(req.url)
    const startDate = searchParams.get('startDate')
    const endDate = searchParams.get('endDate')
    const dateRx = /^\d{4}-\d{2}-\d{2}$/

    let dateFilter = ''
    const params: unknown[] = [user.tenant_id]

    if (startDate && endDate && dateRx.test(startDate) && dateRx.test(endDate)) {
      dateFilter = `AND DATE(sr.return_date) BETWEEN $2::date AND $3::date`
      params.push(startDate, endDate)
    }

    const rows = await prisma.$queryRawUnsafe<unknown[]>(`
      SELECT sr.id, sr.sale_id, s.sale_number, sr.return_date, sr.reason, sr.refund_amount,
        c.name AS customer_name, COUNT(sri.id) AS items_count
      FROM sale_returns sr
      JOIN sales s ON sr.sale_id = s.id
      LEFT JOIN customers c ON s.customer_id = c.id
      LEFT JOIN sale_return_items sri ON sr.id = sri.return_id
      WHERE s.tenant_id = $1 ${dateFilter}
      GROUP BY sr.id, sr.sale_id, s.sale_number, sr.return_date, sr.reason, sr.refund_amount, c.name
      ORDER BY sr.id DESC
    `, ...params)

    return NextResponse.json({ success: true, data: rows })
  } catch (err) {
    console.error('Returns list error:', err)
    return NextResponse.json({ success: false, message: 'Error fetching returns' }, { status: 500 })
  }
}
