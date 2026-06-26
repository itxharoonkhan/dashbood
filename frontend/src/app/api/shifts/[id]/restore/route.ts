import { NextRequest, NextResponse } from 'next/server'
import prisma from '@/lib/prisma'
import { requireRole } from '@/lib/auth'

export async function PUT(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const auth = requireRole(req, ['admin', 'superadmin'])
  if (auth instanceof NextResponse) return auth
  const { user } = auth
  const { id } = await params

  try {
    const result = await prisma.$executeRaw`
      UPDATE shifts SET is_deleted = false
      WHERE id = ${parseInt(id)} AND tenant_id = ${user.tenant_id!} AND is_deleted = true
    `
    if (result === 0) return NextResponse.json({ success: false, message: 'Deleted shift not found' }, { status: 404 })
    return NextResponse.json({ success: true, message: 'Shift restored successfully' })
  } catch (err) {
    console.error('Restore shift error:', err)
    return NextResponse.json({ success: false, message: 'Failed to restore shift' }, { status: 500 })
  }
}

export async function DELETE(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const auth = requireRole(req, ['admin', 'superadmin'])
  if (auth instanceof NextResponse) return auth
  const { user } = auth
  const { id } = await params

  try {
    const shift = await prisma.shift.findFirst({ where: { id: parseInt(id), tenant_id: user.tenant_id!, is_deleted: false } })
    if (!shift) return NextResponse.json({ success: false, message: 'Shift not found' }, { status: 404 })
    if (shift.status === 'open') return NextResponse.json({ success: false, message: 'Cannot delete an open shift. Close it first.' }, { status: 400 })

    await prisma.shift.update({ where: { id: parseInt(id) }, data: { is_deleted: true } })
    return NextResponse.json({ success: true, message: 'Shift deleted successfully' })
  } catch (err) {
    console.error('Delete shift error:', err)
    return NextResponse.json({ success: false, message: 'Failed to delete shift' }, { status: 500 })
  }
}
