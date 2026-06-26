import { NextRequest, NextResponse } from 'next/server'
import prisma from '@/lib/prisma'
import { requireRole } from '@/lib/auth'

export async function GET(req: NextRequest) {
  const auth = requireRole(req, ['admin', 'cashier', 'superadmin'])
  if (auth instanceof NextResponse) return auth
  const { user } = auth

  try {
    const rows = await prisma.$queryRaw<unknown[]>`
      SELECT s.id, s.sale_number, s.final_total AS grand_total, s.payment_method,
        s.created_at AS sale_date, s.table_name, c.name AS customer_name
      FROM sales s
      LEFT JOIN customers c ON s.customer_id = c.id
      WHERE s.tenant_id = ${user.tenant_id} AND s.status != 'cancelled'
      ORDER BY s.id DESC LIMIT 5
    `
    return NextResponse.json({ success: true, data: rows })
  } catch (err) {
    console.error('Recent sales error:', err)
    return NextResponse.json({ success: false, message: 'Error fetching recent sales' }, { status: 500 })
  }
}
