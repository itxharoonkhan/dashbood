import { NextRequest, NextResponse } from 'next/server'
import prisma from '@/lib/prisma'
import { requireRole } from '@/lib/auth'

export async function GET(req: NextRequest) {
  const auth = requireRole(req, ['admin', 'superadmin'])
  if (auth instanceof NextResponse) return auth
  const { user } = auth

  try {
    const rows = await prisma.restaurantTable.findMany({
      where: { is_deleted: true, tenant_id: user.tenant_id! },
      orderBy: { id: 'desc' }
    })
    return NextResponse.json({ success: true, data: rows })
  } catch (err) {
    return NextResponse.json({ success: false, message: 'Failed to fetch deleted tables' }, { status: 500 })
  }
}
