import { NextRequest, NextResponse } from 'next/server'
import prisma from '@/lib/prisma'
import { requireRole } from '@/lib/auth'

export async function PUT(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const auth = requireRole(req, ['admin', 'superadmin'])
  if (auth instanceof NextResponse) return auth
  const { user } = auth
  const { id } = await params
  const userId = parseInt(id)

  try {
    const isSuperAdmin = user.role === 'superadmin'
    const target = await prisma.user.findFirst({
      where: isSuperAdmin ? { id: userId } : { id: userId, tenant_id: user.tenant_id }
    })
    if (!target) return NextResponse.json({ success: false, message: 'User not found' }, { status: 404 })

    await prisma.user.update({ where: { id: userId }, data: { failedAttempts: 0, lockUntil: null } })
    return NextResponse.json({ success: true, message: 'Account unlocked successfully' })
  } catch (err) {
    console.error('Unlock error:', err)
    return NextResponse.json({ success: false, message: 'Failed to unlock account' }, { status: 500 })
  }
}
