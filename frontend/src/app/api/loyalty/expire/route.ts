import { NextRequest, NextResponse } from 'next/server'
import prisma from '@/lib/prisma'

export async function POST(req: NextRequest) {
  const apiKey = req.headers.get('x-api-key') || req.headers.get('authorization')?.replace('Bearer ', '')
  if (!apiKey || apiKey !== process.env.CRON_API_KEY) {
    return NextResponse.json({ success: false, message: 'Unauthorized' }, { status: 401 })
  }

  try {
    // Expire loyalty points older than 1 year that haven't been used
    const expiryCutoff = new Date()
    expiryCutoff.setFullYear(expiryCutoff.getFullYear() - 1)

    const expiredTxs = await prisma.loyaltyTransaction.findMany({
      where: {
        type: 'earn',
        created_at: { lt: expiryCutoff },
        customer: { loyalty_points: { gt: 0 } }
      },
      include: { customer: { select: { id: true, loyalty_points: true, tenant_id: true } } }
    })

    let totalExpired = 0

    for (const tx of expiredTxs) {
      const deduct = Math.min(tx.points, tx.customer.loyalty_points)
      if (deduct > 0) {
        await prisma.$transaction([
          prisma.customer.update({
            where: { id: tx.customer_id },
            data: { loyalty_points: { decrement: deduct } }
          }),
          prisma.loyaltyTransaction.create({
            data: {
              customer_id: tx.customer_id,
              type: 'expire',
              points: -deduct,
              balance_after: Math.max(0, tx.customer.loyalty_points - deduct),
              note: `Points expired (earned ${tx.created_at.toLocaleDateString()})`
            }
          })
        ])
        totalExpired += deduct
      }
    }

    return NextResponse.json({ success: true, message: `Expired ${totalExpired} loyalty points` })
  } catch (err) {
    console.error('Loyalty expire error:', err)
    return NextResponse.json({ success: false, message: 'Failed to expire loyalty points' }, { status: 500 })
  }
}
