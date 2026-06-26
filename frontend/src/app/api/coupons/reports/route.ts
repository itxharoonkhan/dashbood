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
    const period    = searchParams.get('period') || 'month'
    const startDate = searchParams.get('startDate')
    const endDate   = searchParams.get('endDate')
    const dateRx    = /^\d{4}-\d{2}-\d{2}$/

    let dateFilter: string
    if (startDate && endDate && dateRx.test(startDate) && dateRx.test(endDate)) {
      dateFilter = `DATE(s.created_at) BETWEEN '${startDate}'::date AND '${endDate}'::date`
    } else if (period === 'today') dateFilter = `DATE(s.created_at) = CURRENT_DATE`
    else if (period === 'week')    dateFilter = `s.created_at >= CURRENT_DATE - INTERVAL '7 days'`
    else if (period === 'year')    dateFilter = `s.created_at >= CURRENT_DATE - INTERVAL '1 year'`
    else if (period === 'all')     dateFilter = `1=1`
    else                           dateFilter = `s.created_at >= CURRENT_DATE - INTERVAL '1 month'`

    const df  = Prisma.raw(dateFilter)
    const tid = user.tenant_id!

    const summary = await prisma.$queryRaw<unknown[]>(Prisma.sql`
      SELECT
        COUNT(*)::int                        AS total_uses,
        COALESCE(SUM(s.coupon_discount), 0)  AS total_discount,
        COUNT(DISTINCT s.coupon_id)::int     AS unique_coupons_used
      FROM sales s
      WHERE s.coupon_id IS NOT NULL
        AND s.coupon_discount > 0
        AND s.tenant_id = ${tid}
        AND ${df}
    `)

    const topCoupons = await prisma.$queryRaw<unknown[]>(Prisma.sql`
      SELECT
        c.id, c.code, c.type, c.value,
        COUNT(s.id)::int                              AS usage_count,
        COALESCE(SUM(s.coupon_discount), 0)           AS total_discount,
        COALESCE(AVG(s.final_total + s.coupon_discount), 0) AS avg_order_value
      FROM coupons c
      LEFT JOIN sales s
        ON  c.id = s.coupon_id
        AND s.coupon_discount > 0
        AND s.tenant_id = ${tid}
        AND ${df}
      WHERE c.is_deleted = false AND c.tenant_id = ${tid}
      GROUP BY c.id
      ORDER BY usage_count DESC
      LIMIT 5
    `)

    const daily = await prisma.$queryRaw<unknown[]>(Prisma.sql`
      SELECT
        DATE(s.created_at)              AS date,
        COUNT(*)::int                   AS uses,
        COALESCE(SUM(s.coupon_discount), 0) AS discount
      FROM sales s
      WHERE s.coupon_id IS NOT NULL
        AND s.coupon_discount > 0
        AND s.tenant_id = ${tid}
        AND ${df}
      GROUP BY DATE(s.created_at)
      ORDER BY date ASC
    `)

    return NextResponse.json({
      success: true,
      data: {
        summary:    Array.isArray(summary) ? summary[0] : {},
        topCoupons,
        daily,
      },
    })
  } catch (err) {
    console.error('Coupon reports error:', err)
    return NextResponse.json({ success: false, message: 'Failed to fetch coupon reports' }, { status: 500 })
  }
}
