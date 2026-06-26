import { NextRequest, NextResponse } from 'next/server'
import prisma from '@/lib/prisma'
import { requireRole } from '@/lib/auth'

export async function GET(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const auth = requireRole(req, ['admin', 'cashier', 'superadmin'])
  if (auth instanceof NextResponse) return auth
  const { user } = auth
  const { id } = await params

  try {
    const product = await prisma.product.findFirst({ where: { id: parseInt(id), tenant_id: user.tenant_id! } })
    if (!product) return NextResponse.json({ success: false, message: 'Product not found' }, { status: 404 })

    const variants = await prisma.productVariant.findMany({
      where: { product_id: parseInt(id), is_active: true },
      orderBy: [{ sort_order: 'asc' }, { id: 'asc' }]
    })
    return NextResponse.json({ success: true, data: variants })
  } catch (err) {
    console.error('Get variants error:', err)
    return NextResponse.json({ success: false, message: 'Failed to fetch variants' }, { status: 500 })
  }
}

export async function POST(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const auth = requireRole(req, ['admin', 'superadmin'])
  if (auth instanceof NextResponse) return auth
  const { user } = auth
  const { id } = await params

  try {
    const { variants } = await req.json()
    const productId = parseInt(id)

    const product = await prisma.product.findFirst({ where: { id: productId, tenant_id: user.tenant_id! } })
    if (!product) return NextResponse.json({ success: false, message: 'Product not found' }, { status: 404 })

    await prisma.$executeRaw`DELETE FROM product_variants WHERE product_id = ${productId}`

    if (variants && variants.length > 0) {
      for (let i = 0; i < variants.length; i++) {
        const v = variants[i]
        if (!v.name?.trim()) continue
        await prisma.productVariant.create({
          data: { product_id: productId, name: v.name.trim(), price: parseFloat(v.price) || 0, sort_order: i }
        })
      }
    }

    const rows = await prisma.productVariant.findMany({ where: { product_id: productId }, orderBy: { sort_order: 'asc' } })
    return NextResponse.json({ success: true, message: 'Variants saved', data: rows })
  } catch (err) {
    console.error('Save variants error:', err)
    return NextResponse.json({ success: false, message: 'Failed to save variants' }, { status: 500 })
  }
}
