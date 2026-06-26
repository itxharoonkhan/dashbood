import { NextRequest, NextResponse } from 'next/server'
import prisma from '@/lib/prisma'
import { requireRole } from '@/lib/auth'

export async function DELETE(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
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

    if (target.role === 'admin') {
      const adminCount = await prisma.user.count({
        where: isSuperAdmin ? { role: 'admin' } : { role: 'admin', tenant_id: user.tenant_id }
      })
      if (adminCount <= 1) {
        return NextResponse.json({ success: false, message: 'Cannot delete the last admin account.' }, { status: 400 })
      }
    }

    await prisma.user.delete({ where: { id: userId } })
    return NextResponse.json({ success: true, message: 'Account deleted successfully' })
  } catch (err) {
    console.error('Delete account error:', err)
    return NextResponse.json({ success: false, message: 'Failed to delete account' }, { status: 500 })
  }
}
