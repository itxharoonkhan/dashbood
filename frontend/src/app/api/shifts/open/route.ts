import { NextRequest, NextResponse } from 'next/server'
import prisma from '@/lib/prisma'
import { requireRole } from '@/lib/auth'

const toPaise = (rupees: number) => Math.round(parseFloat(String(rupees)) * 100)
const toRupees = (paise: bigint | null) => paise !== null ? Number(paise) / 100 : null

export async function POST(req: NextRequest) {
  const auth = requireRole(req, ['admin', 'cashier', 'superadmin'])
  if (auth instanceof NextResponse) return auth
  const { user } = auth

  try {
    const { opening_cash } = await req.json()
    if (opening_cash === undefined || opening_cash === null || isNaN(parseFloat(opening_cash))) {
      return NextResponse.json({ success: false, message: 'Opening cash amount is required' }, { status: 400 })
    }
    if (parseFloat(opening_cash) < 0) {
      return NextResponse.json({ success: false, message: 'Opening cash cannot be negative' }, { status: 400 })
    }

    const existing = await prisma.shift.findFirst({
      where: { cashier_id: user.id, status: 'open', tenant_id: user.tenant_id! }
    })
    if (existing) {
      return NextResponse.json({ success: false, message: 'You already have an open shift. Close it before opening a new one.' }, { status: 400 })
    }

    const openingCashPaise = BigInt(toPaise(opening_cash))
    const shift = await prisma.shift.create({
      data: { cashier_id: user.id, opening_cash: openingCashPaise, status: 'open', tenant_id: user.tenant_id! }
    })
    const cashier = await prisma.user.findUnique({ where: { id: user.id }, select: { name: true } })

    return NextResponse.json({
      success: true,
      message: 'Shift opened successfully',
      data: {
        ...shift,
        opening_cash: Number(shift.opening_cash),
        closing_cash: shift.closing_cash !== null ? Number(shift.closing_cash) : null,
        expected_cash: shift.expected_cash !== null ? Number(shift.expected_cash) : null,
        variance: shift.variance !== null ? Number(shift.variance) : null,
        opening_cash_rupees: toRupees(shift.opening_cash),
        cashier_name: cashier?.name ?? ''
      }
    })
  } catch (err) {
    console.error('Open shift error:', err)
    return NextResponse.json({ success: false, message: 'Failed to open shift' }, { status: 500 })
  }
}
