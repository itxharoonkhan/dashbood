import { NextRequest, NextResponse } from 'next/server'
import prisma from '@/lib/prisma'
import { requireRole } from '@/lib/auth'

export async function GET(req: NextRequest) {
  const auth = requireRole(req, ['admin', 'cashier', 'superadmin'])
  if (auth instanceof NextResponse) return auth
  const { user } = auth

  try {
    const lowStockItems = await prisma.product.findMany({
      where: { tenant_id: user.tenant_id!, is_deleted: false },
      select: { name: true, stock: true, threshold: true },
      take: 5,
      orderBy: { stock: 'asc' }
    })
    // Filter to truly low-stock after fetch (Prisma doesn't support column comparison in where)
    const lowStock = lowStockItems.filter((p: { stock: number; threshold: number; name: string }) => p.stock <= p.threshold)

    const insights: unknown[] = [{ type: 'info', title: 'System Status', message: 'POS system is running smoothly' }]
    if (lowStock.length > 0) {
      insights.push({ type: 'warning', title: 'Low Stock Alert', message: 'Some products are low in stock', items: lowStock })
    }
    return NextResponse.json({ success: true, data: insights })
  } catch (err) {
    console.error('Insights error:', err)
    return NextResponse.json({ success: false, message: 'Error fetching insights' }, { status: 500 })
  }
}
