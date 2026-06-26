import { NextRequest, NextResponse } from 'next/server'
import prisma from '@/lib/prisma'
import { requireRole } from '@/lib/auth'

const toPaise = (rupees: number) => Math.round(parseFloat(String(rupees)) * 100)
const toRupees = (paise: number) => paise / 100

export async function PUT(req: NextRequest) {
  const auth = requireRole(req, ['admin', 'cashier', 'superadmin'])
  if (auth instanceof NextResponse) return auth
  const { user } = auth

  try {
    const { closing_cash } = await req.json()
    if (closing_cash === undefined || closing_cash === null || isNaN(parseFloat(closing_cash))) {
      return NextResponse.json({ success: false, message: 'Closing cash amount is required' }, { status: 400 })
    }
    if (parseFloat(closing_cash) < 0) {
      return NextResponse.json({ success: false, message: 'Closing cash cannot be negative' }, { status: 400 })
    }

    const shift = await prisma.shift.findFirst({
      where: { cashier_id: user.id, status: 'open', tenant_id: user.tenant_id! }
    })
    if (!shift) return NextResponse.json({ success: false, message: 'No active shift found' }, { status: 404 })

    const salesResult = await prisma.$queryRaw<[{ total_sales: number }]>`
      SELECT COALESCE(SUM(final_total), 0) AS total_sales FROM sales WHERE shift_id = ${shift.id} AND status = 'completed'
    `
    const totalSalesRupees = parseFloat(String(salesResult[0].total_sales)) || 0
    const totalSalesPaise = toPaise(totalSalesRupees)

    const movResult = await prisma.$queryRaw<[{ total_out: bigint }]>`
      SELECT COALESCE(SUM(amount), 0) AS total_out FROM shift_cash_movements WHERE shift_id = ${shift.id} AND type = 'cash_out'
    `
    const totalCashOutPaise = Number(movResult[0].total_out) || 0

    const openingCashPaise = Number(shift.opening_cash)
    const closingCashPaise = toPaise(closing_cash)
    const expectedCashPaise = openingCashPaise + totalSalesPaise - totalCashOutPaise
    const variancePaise = closingCashPaise - expectedCashPaise

    await prisma.shift.update({
      where: { id: shift.id },
      data: {
        closing_cash: BigInt(closingCashPaise),
        expected_cash: BigInt(expectedCashPaise),
        variance: BigInt(variancePaise),
        end_time: new Date(),
        status: 'closed'
      }
    })

    const txCount = await prisma.sale.count({ where: { shift_id: shift.id, status: 'completed' } })

    return NextResponse.json({
      success: true,
      message: 'Shift closed successfully',
      data: {
        shift_id: shift.id,
        opening_cash_rupees: toRupees(openingCashPaise),
        total_sales_rupees: totalSalesRupees,
        expected_cash_rupees: toRupees(expectedCashPaise),
        closing_cash_rupees: toRupees(closingCashPaise),
        variance_rupees: toRupees(variancePaise),
        transaction_count: txCount
      }
    })
  } catch (err) {
    console.error('Close shift error:', err)
    return NextResponse.json({ success: false, message: 'Failed to close shift' }, { status: 500 })
  }
}
