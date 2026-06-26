import { NextRequest, NextResponse } from 'next/server'
import prisma from '@/lib/prisma'
import { requireRole } from '@/lib/auth'

export async function GET(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const auth = requireRole(req, ['admin', 'cashier', 'superadmin'])
  if (auth instanceof NextResponse) return auth
  const { user } = auth
  const { id } = await params

  try {
    const saleCheck = await prisma.sale.findFirst({ where: { id: parseInt(id), tenant_id: user.tenant_id! } })
    if (!saleCheck) return NextResponse.json({ success: false, message: 'Sale not found' }, { status: 404 })

    const returnRows = await prisma.saleReturn.findMany({
      where: { sale_id: parseInt(id) },
      orderBy: { id: 'desc' },
      select: { id: true, return_date: true, reason: true, refund_amount: true }
    })

    const itemRows = await prisma.$queryRaw<Array<{ sale_item_id: number; qty_returned: number }>>`
      SELECT sri.sale_item_id, SUM(sri.quantity)::int AS qty_returned
      FROM sale_return_items sri
      JOIN sale_returns sr ON sri.return_id = sr.id
      WHERE sr.sale_id = ${parseInt(id)}
      GROUP BY sri.sale_item_id
    `

    const returned_qtys: Record<number, number> = {}
    for (const r of itemRows) returned_qtys[r.sale_item_id] = r.qty_returned

    return NextResponse.json({ success: true, data: { returns: returnRows, returned_qtys } })
  } catch (err) {
    console.error('Get returns error:', err)
    return NextResponse.json({ success: false, message: 'Error fetching sale returns' }, { status: 500 })
  }
}
