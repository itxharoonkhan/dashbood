import { NextRequest, NextResponse } from 'next/server'
import prisma from '@/lib/prisma'
import { requireRole } from '@/lib/auth'

export async function GET(req: NextRequest) {
  const auth = requireRole(req, ['admin', 'superadmin'])
  if (auth instanceof NextResponse) return auth
  const { user } = auth

  try {
    const rows = await prisma.product.findMany({
      where: { tenant_id: user.tenant_id!, is_deleted: true },
      orderBy: { id: 'desc' }
    })
    return NextResponse.json({ success: true, data: rows })
  } catch (err) {
    console.error('Products trash error:', err)
    return NextResponse.json({ success: false, message: 'Error fetching deleted products' }, { status: 500 })
  }
}
