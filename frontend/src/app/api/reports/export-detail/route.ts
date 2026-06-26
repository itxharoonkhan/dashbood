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
    const startDate = searchParams.get('startDate')
    const endDate = searchParams.get('endDate')
    const period = searchParams.get('period') || 'month'
    const dateRx = /^\d{4}-\d{2}-\d{2}$/
    const tid = user.tenant_id

    let dateFilter: string
    if (startDate && endDate && dateRx.test(startDate) && dateRx.test(endDate)) {
      dateFilter = `AND DATE(s.created_at) BETWEEN '${startDate}'::date AND '${endDate}'::date`
    } else if (period === 'today') dateFilter = `AND DATE(s.created_at) = CURRENT_DATE`
    else if (period === 'week') dateFilter = `AND s.created_at >= CURRENT_DATE - INTERVAL '7 days'`
    else if (period === 'year') dateFilter = `AND s.created_at >= CURRENT_DATE - INTERVAL '1 year'`
    else dateFilter = `AND s.created_at >= CURRENT_DATE - INTERVAL '1 month'`

    const sales = await prisma.$queryRaw<unknown[]>(Prisma.sql`
      SELECT s.id, s.sale_number, s.created_at, s.status,
        s.total, s.discount, s.tax, s.final_total,
        s.payment_method, s.coupon_discount,
        c.name AS customer_name, c.phone AS customer_phone,
        u.name AS cashier_name,
        STRING_AGG(p.name || ' x' || si.quantity::text, ', ' ORDER BY p.name) AS items_summary
      FROM sales s
      LEFT JOIN customers c ON c.id = s.customer_id
      LEFT JOIN users u ON u.id = s.cashier_id
      LEFT JOIN sale_items si ON si.sale_id = s.id
      LEFT JOIN products p ON p.id = si.product_id
      WHERE s.tenant_id = ${tid} AND s.status IN ('completed', 'cancelled') ${Prisma.raw(dateFilter)}
      GROUP BY s.id, c.name, c.phone, u.name
      ORDER BY s.created_at DESC
      LIMIT 10000
    `)

    return NextResponse.json({ success: true, data: sales, count: Array.isArray(sales) ? sales.length : 0 })
  } catch (err) {
    console.error('Export detail error:', err)
    return NextResponse.json({ success: false, message: 'Failed to export data' }, { status: 500 })
  }
}
