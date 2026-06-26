import { NextRequest, NextResponse } from 'next/server'
import prisma from '@/lib/prisma'
import { requireRole } from '@/lib/auth'

export async function PATCH(req: NextRequest) {
  const auth = requireRole(req, ['admin', 'cashier', 'superadmin'])
  if (auth instanceof NextResponse) return auth
  const { user } = auth

  try {
    await prisma.$executeRaw`
      UPDATE notifications SET is_read = true
      WHERE tenant_id = ${user.tenant_id!} AND is_read = false
    `
    return NextResponse.json({ success: true, message: 'All notifications marked as read' })
  } catch (err) {
    console.error('Mark all read error:', err)
    return NextResponse.json({ success: false, message: 'Failed to update notifications' }, { status: 500 })
  }
}
