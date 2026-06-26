import { NextRequest, NextResponse } from 'next/server'
import prisma from '@/lib/prisma'
import { requireRole } from '@/lib/auth'

const toRupees = (paise: bigint | null) => paise !== null ? Number(paise) / 100 : null

export async function GET(req: NextRequest) {
  const auth = requireRole(req, ['admin', 'cashier', 'superadmin'])
  if (auth instanceof NextResponse) return auth
  const { user } = auth

  try {
    const shift = await prisma.shift.findFirst({
      where: { cashier_id: user.id, status: 'open', tenant_id: user.tenant_id! },
      include: { cashier: { select: { name: true } } }
    })
    if (!shift) return NextResponse.json({ success: true, data: null })

    return NextResponse.json({
      success: true,
      data: {
        ...shift,
        opening_cash: Number(shift.opening_cash),
        closing_cash: shift.closing_cash !== null ? Number(shift.closing_cash) : null,
        opening_cash_rupees: toRupees(shift.opening_cash),
        cashier_name: shift.cashier.name
      }
    })
  } catch (err) {
    console.error('Active shift error:', err)
    return NextResponse.json({ success: false, message: 'Failed to fetch active shift' }, { status: 500 })
  }
}
