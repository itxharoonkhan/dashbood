import { NextRequest, NextResponse } from 'next/server'
import prisma from '@/lib/prisma'
import { requireRole } from '@/lib/auth'

const toRupees = (paise: bigint | null | undefined) => paise != null ? Number(paise) / 100 : null

export async function GET(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const auth = requireRole(req, ['admin', 'cashier', 'superadmin'])
  if (auth instanceof NextResponse) return auth
  const { user } = auth
  const { id } = await params

  try {
    const isAdmin = user.role === 'admin' || user.role === 'superadmin'
    const shift = await prisma.shift.findFirst({
      where: {
        id: parseInt(id),
        tenant_id: user.tenant_id!,
        is_deleted: false,
        ...(isAdmin ? {} : { cashier_id: user.id })
      },
      include: { cashier: { select: { name: true } } }
    })
    if (!shift) return NextResponse.json({ success: false, message: 'Shift not found' }, { status: 404 })

    const salesResult = await prisma.$queryRaw<[{ transaction_count: number; total_sales: number }]>`
      SELECT COUNT(*)::int AS transaction_count, COALESCE(SUM(final_total), 0) AS total_sales
      FROM sales WHERE shift_id = ${parseInt(id)} AND status = 'completed'
    `

    const movements = await prisma.shiftCashMovement.findMany({
      where: { shift_id: parseInt(id) },
      orderBy: { created_at: 'asc' }
    })

    const totalCashOutRupees = movements
      .filter(m => m.type === 'cash_out')
      .reduce((sum, m) => sum + (Number(m.amount) / 100), 0)

    return NextResponse.json({
      success: true,
      data: {
        ...shift,
        cashier_name: shift.cashier.name,
        opening_cash: Number(shift.opening_cash),
        closing_cash: shift.closing_cash !== null ? Number(shift.closing_cash) : null,
        opening_cash_rupees: toRupees(shift.opening_cash),
        closing_cash_rupees: toRupees(shift.closing_cash),
        expected_cash_rupees: toRupees(shift.expected_cash),
        variance_rupees: toRupees(shift.variance),
        transaction_count: salesResult[0].transaction_count || 0,
        total_sales_rupees: parseFloat(String(salesResult[0].total_sales)) || 0,
        total_cash_out_rupees: totalCashOutRupees,
        movements: movements.map(m => ({
          ...m, amount: Number(m.amount), amount_rupees: Number(m.amount) / 100
        }))
      }
    })
  } catch (err) {
    console.error('Shift report error:', err)
    return NextResponse.json({ success: false, message: 'Failed to fetch shift report' }, { status: 500 })
  }
}
