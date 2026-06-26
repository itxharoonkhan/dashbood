import { NextRequest, NextResponse } from 'next/server'
import prisma from '@/lib/prisma'
import { requireRole } from '@/lib/auth'

export async function GET(req: NextRequest) {
  const auth = requireRole(req, ['admin', 'superadmin'])
  if (auth instanceof NextResponse) return auth
  const { user } = auth

  try {
    const { searchParams } = new URL(req.url)
    const days = parseInt(searchParams.get('days') || '30')
    const tid = user.tenant_id

    const data = await prisma.$queryRawUnsafe<unknown[]>(`
      SELECT DATE(s.created_at) AS date,
        COUNT(*)::int AS transactions,
        COALESCE(SUM(s.final_total), 0) AS revenue,
        COALESCE(SUM(s.discount), 0) AS discounts,
        COALESCE(SUM(s.tax), 0) AS tax
      FROM sales s
      WHERE s.tenant_id = ${tid} AND s.status = 'completed'
        AND s.created_at >= CURRENT_DATE - INTERVAL '${days} days'
      GROUP BY DATE(s.created_at)
      ORDER BY date ASC
    `)

    return NextResponse.json({ success: true, data })
  } catch (err) {
    return NextResponse.json({ success: false, message: 'Failed to fetch daily sales' }, { status: 500 })
  }
}
