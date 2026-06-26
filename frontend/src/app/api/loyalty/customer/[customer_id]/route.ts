import { NextRequest, NextResponse } from 'next/server'
import prisma from '@/lib/prisma'
import { requireRole } from '@/lib/auth'

export async function GET(req: NextRequest, { params }: { params: Promise<{ customer_id: string }> }) {
  const auth = requireRole(req, ['admin', 'cashier', 'superadmin'])
  if (auth instanceof NextResponse) return auth
  const { user } = auth
  const { customer_id } = await params

  try {
    const customer = await prisma.customer.findFirst({
      where: { id: parseInt(customer_id), tenant_id: user.tenant_id!, is_deleted: false },
      select: { id: true, name: true, phone: true, loyalty_points: true }
    })
    if (!customer) return NextResponse.json({ success: false, message: 'Customer not found' }, { status: 404 })

    const txList = await prisma.loyaltyTransaction.findMany({
      where: { customer_id: customer.id },
      orderBy: { created_at: 'desc' },
      take: 50,
      include: { sale: { select: { sale_number: true } } }
    })

    return NextResponse.json({ success: true, data: { customer, transactions: txList } })
  } catch (err) {
    return NextResponse.json({ success: false, message: 'Failed to fetch loyalty history' }, { status: 500 })
  }
}
