import { NextRequest, NextResponse } from 'next/server'
import prisma from '@/lib/prisma'
import { requireRole } from '@/lib/auth'

export async function GET(req: NextRequest) {
  const auth = requireRole(req, ['admin', 'cashier', 'superadmin'])
  if (auth instanceof NextResponse) return auth
  const { user } = auth

  try {
    const { searchParams } = new URL(req.url)
    const phone = searchParams.get('phone')
    if (!phone) return NextResponse.json({ success: false, message: 'Phone required' }, { status: 400 })

    const customer = await prisma.customer.findFirst({
      where: { phone, tenant_id: user.tenant_id!, is_deleted: false },
      select: { id: true, name: true, phone: true, loyalty_points: true }
    })
    if (!customer) return NextResponse.json({ success: false, message: 'Customer not found' }, { status: 404 })

    return NextResponse.json({ success: true, data: customer })
  } catch (err) {
    return NextResponse.json({ success: false, message: 'Failed to lookup customer loyalty' }, { status: 500 })
  }
}
