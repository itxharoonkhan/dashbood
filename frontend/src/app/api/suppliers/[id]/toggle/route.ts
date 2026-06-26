import { NextRequest, NextResponse } from 'next/server'
import prisma from '@/lib/prisma'
import { requireRole } from '@/lib/auth'

export async function PATCH(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const auth = requireRole(req, ['admin', 'superadmin'])
  if (auth instanceof NextResponse) return auth
  const { user } = auth
  const { id } = await params

  try {
    const supplier = await prisma.supplier.findFirst({ where: { id: parseInt(id), is_deleted: false, tenant_id: user.tenant_id! } })
    if (!supplier) return NextResponse.json({ success: false, message: 'Supplier not found' }, { status: 404 })

    const newStatus = supplier.status === 'active' ? 'inactive' : 'active'
    await prisma.supplier.update({ where: { id: parseInt(id) }, data: { status: newStatus } })
    return NextResponse.json({ success: true, message: `Supplier ${newStatus}`, status: newStatus })
  } catch (err) {
    return NextResponse.json({ success: false, message: 'Failed to toggle supplier status' }, { status: 500 })
  }
}
