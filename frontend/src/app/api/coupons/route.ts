import { NextRequest, NextResponse } from 'next/server'
import prisma from '@/lib/prisma'
import { requireRole } from '@/lib/auth'

export async function GET(req: NextRequest) {
  const auth = requireRole(req, ['admin', 'superadmin'])
  if (auth instanceof NextResponse) return auth
  const { user } = auth

  try {
    const rows = await prisma.coupon.findMany({
      where: { is_deleted: false, tenant_id: user.tenant_id! },
      orderBy: { created_at: 'desc' }
    })
    return NextResponse.json({ success: true, data: rows })
  } catch (err) {
    console.error('Coupons list error:', err)
    return NextResponse.json({ success: false, message: 'Failed to fetch coupons' }, { status: 500 })
  }
}

export async function POST(req: NextRequest) {
  const auth = requireRole(req, ['admin', 'superadmin'])
  if (auth instanceof NextResponse) return auth
  const { user } = auth

  try {
    const { code, type, value, min_order_value, usage_limit, expiry_date, is_active } = await req.json()

    if (!code || !type || value === undefined || value === null) {
      return NextResponse.json({ success: false, message: 'Code, type and value are required' }, { status: 400 })
    }
    if (!['flat', 'percentage'].includes(type)) {
      return NextResponse.json({ success: false, message: 'Type must be flat or percentage' }, { status: 400 })
    }
    if (parseFloat(value) <= 0) return NextResponse.json({ success: false, message: 'Value must be greater than 0' }, { status: 400 })
    if (type === 'percentage' && parseFloat(value) > 100) {
      return NextResponse.json({ success: false, message: 'Percentage cannot exceed 100' }, { status: 400 })
    }

    const upperCode = code.trim().toUpperCase()
    const existing = await prisma.coupon.findFirst({ where: { code: upperCode, is_deleted: false, tenant_id: user.tenant_id! } })
    if (existing) return NextResponse.json({ success: false, message: 'Coupon code already exists' }, { status: 400 })

    const coupon = await prisma.coupon.create({
      data: {
        code: upperCode, type, value: parseFloat(value),
        min_order_value: parseFloat(min_order_value) || 0,
        usage_limit: usage_limit ? parseInt(usage_limit) : null,
        expiry_date: expiry_date || null,
        is_active: is_active !== false,
        tenant_id: user.tenant_id!
      }
    })
    return NextResponse.json({ success: true, message: 'Coupon created successfully', data: coupon })
  } catch (err) {
    console.error('Coupon create error:', err)
    return NextResponse.json({ success: false, message: 'Failed to create coupon' }, { status: 500 })
  }
}
