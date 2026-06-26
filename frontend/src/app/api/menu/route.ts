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

    const products = await prisma.product.findMany({
      where: {
        tenant_id: user.tenant_id!, is_deleted: false,
        ...(category ? { category } : {})
      },
      include: { product_variants: { where: { is_active: true }, orderBy: { id: 'asc' } } },
      orderBy: [{ category: 'asc' }, { name: 'asc' }]
    })

    const items = products.map(p => ({
      ...p,
      price: parseFloat(p.selling_price.toString()),
      variants: p.product_variants,
      has_variants: p.product_variants.length > 0,
    }))

    const grouped: Record<string, typeof items> = {}
    for (const p of items) {
      const cat = p.category ?? 'Uncategorized'
      if (!grouped[cat]) grouped[cat] = []
      grouped[cat].push(p)
    }

    const categories = Object.keys(grouped).sort()

    return NextResponse.json({ success: true, data: { items, categories }, grouped })
  } catch (err) {
    return NextResponse.json({ success: false, message: 'Failed to fetch menu' }, { status: 500 })
  }
}
