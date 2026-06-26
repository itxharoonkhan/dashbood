import { NextRequest, NextResponse } from 'next/server'
import prisma from '@/lib/prisma'
import { requireRole } from '@/lib/auth'

export async function PATCH(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const auth = requireRole(req, ['admin', 'superadmin'])
  if (auth instanceof NextResponse) return auth
  const { user } = auth
  const { id } = await params

  try {
    const coupon = await prisma.coupon.findFirst({ where: { id: parseInt(id), is_deleted: false, tenant_id: user.tenant_id! } })
    if (!coupon) return NextResponse.json({ success: false, message: 'Coupon not found' }, { status: 404 })

    const newStatus = !coupon.is_active
    await prisma.coupon.update({ where: { id: parseInt(id) }, data: { is_active: newStatus } })
    return NextResponse.json({ success: true, message: newStatus ? 'Coupon activated' : 'Coupon deactivated', is_active: newStatus })
  } catch (err) {
    console.error('Coupon toggle error:', err)
    return NextResponse.json({ success: false, message: 'Failed to toggle coupon status' }, { status: 500 })
  }
}
