import { NextRequest, NextResponse } from 'next/server'
import prisma from '@/lib/prisma'
import { requireRole } from '@/lib/auth'

export async function GET(req: NextRequest) {
  const auth = requireRole(req, ['admin', 'cashier', 'superadmin'])
  if (auth instanceof NextResponse) return auth
  const { user } = auth

  try {
    const count = await prisma.notification.count({
      where: { tenant_id: user.tenant_id!, is_read: false }
    })
    return NextResponse.json({ success: true, count })
  } catch (err) {
    console.error('Notifications count error:', err)
    return NextResponse.json({ success: false, count: 0 }, { status: 500 })
  }
}
