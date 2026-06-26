import { NextRequest, NextResponse } from 'next/server'
import prisma from '@/lib/prisma'
import { requireRole } from '@/lib/auth'

export async function POST(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const auth = requireRole(req, ['admin', 'cashier', 'superadmin'])
  if (auth instanceof NextResponse) return auth
  const { user } = auth
  const { id } = await params
  const { items, reason } = await req.json()

  if (!items || items.length === 0) {
    return NextResponse.json({ success: false, message: 'No items selected for return' }, { status: 400 })
  }

  try {
    const { sale, return_id, refundAmount, points_reversed, points_restored } = await prisma.$transaction(async (tx) => {
      const sale = await tx.sale.findFirst({ where: { id: parseInt(id), tenant_id: user.tenant_id! } })
      if (!sale) throw new Error('Sale not found')
      if (sale.status === 'cancelled') throw new Error('Cannot return a cancelled sale')

      const originalItems = await tx.saleItem.findMany({ where: { sale_id: parseInt(id) } })

      const saleSubtotal = parseFloat(sale.total.toString()) || 0
      const finalTotal = parseFloat(sale.final_total.toString()) || 0
      let returnedSubtotal = 0

      for (const item of items) {
        const original = originalItems.find(oi => oi.id === item.sale_item_id)
        if (!original) throw new Error(`Item (id: ${item.sale_item_id}) not found in this sale`)

        const alreadyReturnedRows = await tx.$queryRaw<[{ returned: number }]>`
          SELECT COALESCE(SUM(sri.quantity), 0)::int AS returned
          FROM sale_return_items sri
          JOIN sale_returns sr ON sri.return_id = sr.id
          WHERE sr.sale_id = ${parseInt(id)} AND sri.sale_item_id = ${item.sale_item_id}
        `
        const alreadyReturned = alreadyReturnedRows[0].returned || 0
        const available = original.quantity - alreadyReturned

        if (item.quantity > available) {
          throw new Error(`Cannot return ${item.quantity} units — only ${available} available to return`)
        }
        returnedSubtotal += item.quantity * parseFloat(original.price.toString())
      }

      const ratio = saleSubtotal > 0 ? Math.min(returnedSubtotal / saleSubtotal, 1) : 0
      const refundAmount = parseFloat((finalTotal * ratio).toFixed(2))

      const saleReturn = await tx.saleReturn.create({
        data: { sale_id: parseInt(id), reason: reason || null, refund_amount: refundAmount }
      })

      for (const item of items) {
        const original = originalItems.find(oi => oi.id === item.sale_item_id)!
        await tx.saleReturnItem.create({
          data: { return_id: saleReturn.id, sale_item_id: item.sale_item_id, product_id: original.product_id, quantity: item.quantity, price: original.price }
        })
        await tx.product.update({ where: { id: original.product_id }, data: { stock: { increment: item.quantity } } })
      }

      return { sale, return_id: saleReturn.id, refundAmount, points_reversed: 0, points_restored: 0 }
    })

    // Loyalty reversal (non-blocking)
    let pts_reversed = points_reversed
    let pts_restored = points_restored

    if (sale.customer_id) {
      try {
        const loyaltySettings = await prisma.settings.findUnique({ where: { tenant_id: user.tenant_id! } })
        const rate = parseFloat(loyaltySettings?.loyalty_rate?.toString() || '100') || 100
        const cust = await prisma.customer.findUnique({ where: { id: sale.customer_id } })
        let balance = cust?.loyalty_points || 0
        const saleSubtotal = parseFloat(sale.total.toString()) || 0
        const finalTotal = parseFloat(sale.final_total.toString()) || 0

        const originalItems = await prisma.saleItem.findMany({ where: { sale_id: parseInt(id) } })
        let returnedSubtotal = 0
        for (const item of items) {
          const original = originalItems.find(oi => oi.id === item.sale_item_id)
          if (original) returnedSubtotal += item.quantity * parseFloat(original.price.toString())
        }
        const ratio = saleSubtotal > 0 ? Math.min(returnedSubtotal / saleSubtotal, 1) : 0

        const pointsEarned = Math.floor(finalTotal / rate)
        const pointsToReverse = Math.floor(pointsEarned * ratio)
        if (pointsToReverse > 0) {
          pts_reversed = pointsToReverse
          balance = Math.max(0, balance - pointsToReverse)
          await prisma.customer.update({ where: { id: sale.customer_id }, data: { loyalty_points: balance } })
          await prisma.loyaltyTransaction.create({
            data: { customer_id: sale.customer_id, sale_id: sale.id, type: 'reverse', points: pointsToReverse, balance_after: balance, note: `Earned pts reversed — return on sale #${sale.id}` }
          })
        }

        const redeemedPts = sale.loyalty_points_redeemed || 0
        const pointsToRestore = Math.floor(redeemedPts * ratio)
        if (pointsToRestore > 0) {
          pts_restored = pointsToRestore
          balance = balance + pointsToRestore
          await prisma.customer.update({ where: { id: sale.customer_id }, data: { loyalty_points: balance } })
          await prisma.loyaltyTransaction.create({
            data: { customer_id: sale.customer_id, sale_id: sale.id, type: 'earn', points: pointsToRestore, balance_after: balance, note: `Redeemed pts restored — return on sale #${sale.id}` }
          })
        }
      } catch (loyaltyErr) {
        console.warn('Loyalty return adjustment failed:', loyaltyErr)
      }
    }

    return NextResponse.json({
      success: true, message: 'Return processed successfully',
      refund_amount: refundAmount, return_id, points_reversed: pts_reversed, points_restored: pts_restored
    })
  } catch (err) {
    console.error('Return error:', err)
    return NextResponse.json({ success: false, message: err instanceof Error ? err.message : 'Return failed' }, { status: 400 })
  }
}
