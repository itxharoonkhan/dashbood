import { NextRequest, NextResponse } from 'next/server'
import prisma from '@/lib/prisma'
import { requireRole } from '@/lib/auth'

export async function GET(req: NextRequest) {
  const auth = requireRole(req, ['admin', 'cashier', 'superadmin'])
  if (auth instanceof NextResponse) return auth
  const { user } = auth

  try {
    const result = await prisma.$queryRaw<{ category: string; count: number }[]>`
      SELECT category, COUNT(*)::int AS count
      FROM products
      WHERE tenant_id = ${user.tenant_id} AND is_deleted = false
      GROUP BY category
      ORDER BY category ASC
    `
    return NextResponse.json({ success: true, data: result })
  } catch (err) {
    return NextResponse.json({ success: false, message: 'Failed to fetch menu categories' }, { status: 500 })
  }
}
