import { NextRequest, NextResponse } from 'next/server'
import prisma from '@/lib/prisma'
import { requireRole } from '@/lib/auth'

export async function GET(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const auth = requireRole(req, ['admin', 'cashier', 'superadmin'])
  if (auth instanceof NextResponse) return auth
  const { user } = auth
  const { id } = await params

  try {
    const saleRows = await prisma.$queryRaw<unknown[]>`
      SELECT s.*, c.name AS customer_name, c.phone AS customer_phone
      FROM sales s LEFT JOIN customers c ON s.customer_id = c.id
      WHERE s.id = ${parseInt(id)} AND s.tenant_id = ${user.tenant_id}
    `
    if (!Array.isArray(saleRows) || saleRows.length === 0) {
      return NextResponse.json({ success: false, message: 'Sale not found' }, { status: 404 })
    }
    const sale = saleRows[0] as { id: number }

    const items = await prisma.$queryRaw<unknown[]>`
      SELECT si.*, p.name AS product_name
      FROM sale_items si JOIN products p ON si.product_id = p.id
      WHERE si.sale_id = ${sale.id}
    `
    const payments = await prisma.salePayment.findMany({ where: { sale_id: sale.id }, orderBy: { id: 'asc' } })

    return NextResponse.json({ success: true, data: { sale, items, payments } })
  } catch (err) {
    console.error('Get sale error:', err)
    return NextResponse.json({ success: false, message: 'Error fetching sale' }, { status: 500 })
  }
}
