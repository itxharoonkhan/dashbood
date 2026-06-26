import { NextRequest, NextResponse } from 'next/server'
import prisma from '@/lib/prisma'
import { requireRole } from '@/lib/auth'

export async function POST(req: NextRequest) {
  const auth = requireRole(req, ['admin', 'cashier', 'superadmin'])
  if (auth instanceof NextResponse) return auth
  const { user } = auth

  try {
    const { code, subtotal } = await req.json()
    if (!code) return NextResponse.json({ success: false, message: 'Coupon code is required' }, { status: 400 })

    const coupon = await prisma.coupon.findFirst({
      where: { code: code.trim().toUpperCase(), is_deleted: false, tenant_id: user.tenant_id! }
    })
    if (!coupon) return NextResponse.json({ success: false, message: 'Invalid coupon code' }, { status: 404 })
    if (!coupon.is_active) return NextResponse.json({ success: false, message: 'This coupon is currently inactive' }, { status: 400 })
    if (coupon.expiry_date && new Date(coupon.expiry_date) < new Date()) {
      return NextResponse.json({ success: false, message: 'This coupon has expired' }, { status: 400 })
    }
    if (coupon.usage_limit !== null && coupon.used_count >= coupon.usage_limit) {
      return NextResponse.json({ success: false, message: 'This coupon has reached its usage limit' }, { status: 400 })
    }

    const orderSubtotal = parseFloat(subtotal) || 0
    const minOrder = parseFloat(coupon.min_order_value.toString()) || 0
    if (orderSubtotal < minOrder) {
      return NextResponse.json({ success: false, message: `Minimum order of Rs. ${minOrder.toFixed(2)} required` }, { status: 400 })
    }

    const couponValue = parseFloat(coupon.value.toString()) || 0
    let discount = 0
    if (coupon.type === 'flat') discount = Math.min(couponValue, orderSubtotal)
    else discount = (orderSubtotal * couponValue) / 100
    discount = parseFloat(discount.toFixed(2))

    return NextResponse.json({
      success: true,
      message: `Coupon applied! You save Rs. ${discount.toFixed(2)}`,
      discount,
      coupon: { id: coupon.id, code: coupon.code, type: coupon.type, value: coupon.value }
    })
  } catch (err) {
    console.error('Coupon validate error:', err)
    return NextResponse.json({ success: false, message: 'Failed to validate coupon' }, { status: 500 })
  }
}
