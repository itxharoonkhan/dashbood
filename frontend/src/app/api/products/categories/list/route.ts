import { NextRequest, NextResponse } from 'next/server'
import prisma from '@/lib/prisma'
import { requireRole } from '@/lib/auth'

export async function GET(req: NextRequest) {
  const auth = requireRole(req, ['admin', 'cashier', 'superadmin'])
  if (auth instanceof NextResponse) return auth
  const { user } = auth

  try {
    const rows = await prisma.product.findMany({
      where: { tenant_id: user.tenant_id!, is_deleted: false, category: { not: null } },
      select: { category: true },
      distinct: ['category']
    })
    const categories = rows.map(r => r.category).filter(Boolean)
    return NextResponse.json({ success: true, data: categories })
  } catch (err) {
    console.error('Categories error:', err)
    return NextResponse.json({ success: false, message: 'Error fetching categories' }, { status: 500 })
  }
}
