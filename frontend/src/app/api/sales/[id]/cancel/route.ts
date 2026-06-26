import { NextRequest, NextResponse } from 'next/server'
import prisma from '@/lib/prisma'
import { requireRole } from '@/lib/auth'

export async function PUT(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const auth = requireRole(req, ['admin', 'superadmin'])
  if (auth instanceof NextResponse) return auth
  const { user } = auth
  const { id } = await params

  try {
    const sale = await prisma.$transaction(async (tx) => {
      const sale = await tx.sale.findFirst({ where: { id: parseInt(id), tenant_id: user.tenant_id! } })
      if (!sale) throw new Error('Sale not found')
      if (sale.status === 'cancelled') throw new Error('Sale already cancelled')

      const saleItems = await tx.saleItem.findMany({ where: { sale_id: parseInt(id) } })
      for (const item of saleItems) {
        await tx.product.update({ where: { id: item.product_id }, data: { stock: { increment: item.quantity } } })
      }
      await tx.sale.update({ where: { id: parseInt(id) }, data: { status: 'cancelled' } })
      return sale
    })

    // Loyalty reversal (non-blocking)
    if (sale.customer_id) {
      try {
        const loyaltySettings = await prisma.settings.findUnique({ where: { tenant_id: user.tenant_id! } })
        const rate = parseFloat(loyaltySettings?.loyalty_rate?.toString() || '100') || 100
        const cust = await prisma.customer.findUnique({ where: { id: sale.customer_id } })
        let balance = cust?.loyalty_points || 0

        const pointsEarned = Math.floor(parseFloat(sale.final_total.toString()) / rate)
        if (pointsEarned > 0) {
          balance = Math.max(0, balance - pointsEarned)
          await prisma.customer.update({ where: { id: sale.customer_id }, data: { loyalty_points: balance } })
          await prisma.loyaltyTransaction.create({
            data: { customer_id: sale.customer_id, sale_id: sale.id, type: 'reverse', points: pointsEarned, balance_after: balance, note: `Earn reversed — sale #${sale.id} cancelled` }
          })
        }

        const pointsRedeemed = sale.loyalty_points_redeemed || 0
        if (pointsRedeemed > 0) {
          balance = balance + pointsRedeemed
          await prisma.customer.update({ where: { id: sale.customer_id }, data: { loyalty_points: balance } })
          await prisma.loyaltyTransaction.create({
            data: { customer_id: sale.customer_id, sale_id: sale.id, type: 'reverse', points: pointsRedeemed, balance_after: balance, note: `Redeemed points restored — sale #${sale.id} cancelled` }
          })
        }
      } catch (loyaltyErr) {
        console.warn('Loyalty cancel reversal failed:', loyaltyErr)
      }
    }

    return NextResponse.json({ success: true, message: 'Sale cancelled and stock restored' })
  } catch (err) {
    console.error('Cancel sale error:', err)
    return NextResponse.json({ success: false, message: err instanceof Error ? err.message : 'Cancel failed' }, { status: 400 })
  }
}
