import { NextRequest, NextResponse } from 'next/server'
import prisma from '@/lib/prisma'
import { requireRole } from '@/lib/auth'

export async function GET(req: NextRequest) {
  const auth = requireRole(req, ['admin', 'cashier', 'superadmin'])
  if (auth instanceof NextResponse) return auth
  const { user } = auth

  try {
    const rows = await prisma.product.findMany({
      where: { tenant_id: user.tenant_id!, sku: { not: null } },
      select: { sku: true },
      orderBy: { id: 'desc' }
    })

    let nextNum = 1
    for (const row of rows) {
      const sku = row.sku || ''
      const match = sku.match(/(\d+)$/)
      if (match) {
        const num = parseInt(match[1])
        if (num >= nextNum) nextNum = num + 1
      }
    }

    let padWidth = 3
    if (rows.length > 0) {
      const lastSku = rows[0].sku || ''
      const match = lastSku.match(/(\d+)$/)
      if (match) padWidth = Math.max(match[1].length, 3)
    }

    const sku = String(nextNum).padStart(padWidth, '0')
    return NextResponse.json({ success: true, sku })
  } catch (err) {
    console.error('Next SKU error:', err)
    return NextResponse.json({ success: false, message: 'Error generating SKU' }, { status: 500 })
  }
}
