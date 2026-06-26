import { NextRequest, NextResponse } from 'next/server'
import prisma from '@/lib/prisma'
import { requireRole } from '@/lib/auth'

export async function PUT(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const auth = requireRole(req, ['admin', 'superadmin'])
  if (auth instanceof NextResponse) return auth
  const { user } = auth
  const { id } = await params

  try {
    const { code, type, value, min_order_value, usage_limit, expiry_date, is_active } = await req.json()
    const existing = await prisma.coupon.findFirst({ where: { id: parseInt(id), is_deleted: false, tenant_id: user.tenant_id! } })
    if (!existing) return NextResponse.json({ success: false, message: 'Coupon not found' }, { status: 404 })

    const upperCode = code ? code.trim().toUpperCase() : existing.code
    if (upperCode !== existing.code) {
      const dup = await prisma.coupon.findFirst({ where: { code: upperCode, id: { not: parseInt(id) }, is_deleted: false, tenant_id: user.tenant_id! } })
      if (dup) return NextResponse.json({ success: false, message: 'Coupon code already exists' }, { status: 400 })
    }

    const newType = type || existing.type
    const newValue = value !== undefined ? parseFloat(value) : parseFloat(existing.value.toString())
    if (newType === 'percentage' && newValue > 100) {
      return NextResponse.json({ success: false, message: 'Percentage cannot exceed 100' }, { status: 400 })
    }

    const updated = await prisma.coupon.update({
      where: { id: parseInt(id) },
      data: {
        code: upperCode, type: newType, value: newValue,
        min_order_value: parseFloat(min_order_value) || 0,
        usage_limit: usage_limit ? parseInt(usage_limit) : null,
        expiry_date: expiry_date || null,
        is_active: is_active !== undefined ? !!is_active : existing.is_active
      }
    })
    return NextResponse.json({ success: true, message: 'Coupon updated', data: updated })
  } catch (err) {
    console.error('Coupon update error:', err)
    return NextResponse.json({ success: false, message: 'Failed to update coupon' }, { status: 500 })
  }
}

export async function DELETE(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const auth = requireRole(req, ['admin', 'superadmin'])
  if (auth instanceof NextResponse) return auth
  const { user } = auth
  const { id } = await params

  try {
    const result = await prisma.$executeRaw`
      UPDATE coupons SET is_deleted = true, is_active = false
      WHERE id = ${parseInt(id)} AND is_deleted = false AND tenant_id = ${user.tenant_id!}
    `
    if (result === 0) return NextResponse.json({ success: false, message: 'Coupon not found' }, { status: 404 })
    return NextResponse.json({ success: true, message: 'Coupon deleted' })
  } catch (err) {
    console.error('Coupon delete error:', err)
    return NextResponse.json({ success: false, message: 'Failed to delete coupon' }, { status: 500 })
  }
}
