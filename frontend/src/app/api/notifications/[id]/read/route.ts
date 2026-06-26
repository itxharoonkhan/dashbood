import { NextRequest, NextResponse } from 'next/server'
import prisma from '@/lib/prisma'
import { requireRole } from '@/lib/auth'

export async function PATCH(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const auth = requireRole(req, ['admin', 'cashier', 'superadmin'])
  if (auth instanceof NextResponse) return auth
  const { user } = auth

  try {
    const { id } = await params
    await prisma.$executeRaw`
      UPDATE notifications SET is_read = true
      WHERE id = ${parseInt(id)} AND tenant_id = ${user.tenant_id!}
    `
    return NextResponse.json({ success: true, message: 'Notification marked as read' })
  } catch (err) {
    console.error('Mark read error:', err)
    return NextResponse.json({ success: false, message: 'Failed to update notification' }, { status: 500 })
  }
}
