import { NextRequest, NextResponse } from 'next/server'
import prisma from '@/lib/prisma'
import { requireRole } from '@/lib/auth'

const toPaise = (rupees: number) => Math.round(parseFloat(String(rupees)) * 100)
const toRupees = (paise: number) => paise / 100

export async function POST(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const auth = requireRole(req, ['admin', 'cashier', 'superadmin'])
  if (auth instanceof NextResponse) return auth
  const { user } = auth
  const { id } = await params

  try {
    const { type, amount, reason } = await req.json()

    if (!['cash_out', 'cash_in'].includes(type)) {
      return NextResponse.json({ success: false, message: 'Type must be cash_out or cash_in' }, { status: 400 })
    }
    if (!amount || isNaN(parseFloat(amount)) || parseFloat(amount) <= 0) {
      return NextResponse.json({ success: false, message: 'Valid amount required' }, { status: 400 })
    }

    const shift = await prisma.shift.findFirst({ where: { id: parseInt(id), tenant_id: user.tenant_id! } })
    if (!shift) return NextResponse.json({ success: false, message: 'Shift not found' }, { status: 404 })
    if (shift.status !== 'open') return NextResponse.json({ success: false, message: 'Shift is not open' }, { status: 400 })

    if (type === 'cash_out') {
      const salesResult = await prisma.$queryRaw<[{ total_sales: number }]>`
        SELECT COALESCE(SUM(final_total), 0) AS total_sales FROM sales WHERE shift_id = ${parseInt(id)} AND status = 'completed'
      `
      const movResult = await prisma.$queryRaw<[{ total_out: bigint }]>`
        SELECT COALESCE(SUM(amount), 0) AS total_out FROM shift_cash_movements WHERE shift_id = ${parseInt(id)} AND type = 'cash_out'
      `
      const openingPaise = Number(shift.opening_cash)
      const salesPaise = toPaise(parseFloat(String(salesResult[0].total_sales)) || 0)
      const prevOutPaise = Number(movResult[0].total_out) || 0
      const availablePaise = openingPaise + salesPaise - prevOutPaise
      const requestedPaise = toPaise(parseFloat(amount))

      if (requestedPaise > availablePaise) {
        return NextResponse.json({
          success: false,
          message: `Drawer mein sirf Rs. ${toRupees(availablePaise).toFixed(2)} available hain.`
        }, { status: 400 })
      }
    }

    await prisma.shiftCashMovement.create({
      data: { shift_id: parseInt(id), type, amount: BigInt(toPaise(parseFloat(amount))), reason: reason || null }
    })

    return NextResponse.json({ success: true, message: `${type === 'cash_out' ? 'Cash Out' : 'Cash In'} recorded` })
  } catch (err) {
    console.error('Cash movement error:', err)
    return NextResponse.json({ success: false, message: 'Failed to record cash movement' }, { status: 500 })
  }
}
