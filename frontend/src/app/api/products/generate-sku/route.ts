import { NextRequest, NextResponse } from 'next/server'
import prisma from '@/lib/prisma'
import { requireRole } from '@/lib/auth'

export async function GET(req: NextRequest) {
  const auth = requireRole(req, ['admin', 'cashier', 'superadmin'])
  if (auth instanceof NextResponse) return auth
  const { user } = auth

  try {
    const { searchParams } = new URL(req.url)
    const category = searchParams.get('category')
    if (!category) return NextResponse.json({ success: false, message: 'Category required' }, { status: 400 })

    const prefix = category.trim().toUpperCase().substring(0, 3)
    const row = await prisma.product.findFirst({
      where: { tenant_id: user.tenant_id!, sku: { startsWith: prefix } },
      orderBy: { sku: 'desc' }
    })

    let nextNumber = 1
    if (row?.sku) {
      const lastNum = parseInt(row.sku.replace(prefix, '')) || 0
      nextNumber = lastNum + 1
    }

    const sku = `${prefix}${String(nextNumber).padStart(3, '0')}`
    return NextResponse.json({ success: true, sku })
  } catch (err) {
    console.error('Generate SKU error:', err)
    return NextResponse.json({ success: false, message: 'Error generating SKU' }, { status: 500 })
  }
}
