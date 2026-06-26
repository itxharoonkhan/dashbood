import { NextRequest, NextResponse } from 'next/server'
import prisma from '@/lib/prisma'
import { requireRole } from '@/lib/auth'

export async function GET(req: NextRequest) {
  const auth = requireRole(req, ['admin', 'cashier', 'superadmin'])
  if (auth instanceof NextResponse) return auth
  const { user } = auth

  try {
    const { searchParams } = new URL(req.url)
    const search = searchParams.get('search') || ''
    const category = searchParams.get('category') || ''

    const rows = await prisma.product.findMany({
      where: {
        tenant_id: user.tenant_id!,
        is_deleted: false,
        ...(search ? {
          OR: [
            { name: { contains: search, mode: 'insensitive' } },
            { sku: { contains: search, mode: 'insensitive' } },
            { category: { contains: search, mode: 'insensitive' } }
          ]
        } : {}),
        ...(category ? { category } : {})
      },
      orderBy: { id: 'desc' }
    })

    return NextResponse.json({ success: true, data: rows })
  } catch (err) {
    console.error('Products list error:', err)
    return NextResponse.json({ success: false, message: 'Error fetching products' }, { status: 500 })
  }
}

export async function POST(req: NextRequest) {
  const auth = requireRole(req, ['admin', 'superadmin'])
  if (auth instanceof NextResponse) return auth
  const { user } = auth

  try {
    const { name, category, sku, barcode, description, selling_price, cost_price, stock, threshold, unit_type, image } = await req.json()

    if (!name) return NextResponse.json({ success: false, message: 'Product name is required' }, { status: 400 })

    if (sku?.trim()) {
      const existing = await prisma.product.findFirst({
        where: { sku: sku.trim(), tenant_id: user.tenant_id!, is_deleted: false }
      })
      if (existing) return NextResponse.json({ success: false, message: 'SKU already exists' }, { status: 400 })
    }

    const product = await prisma.product.create({
      data: {
        name,
        category: category || null,
        sku: sku || null,
        barcode: barcode || null,
        description: description || null,
        selling_price: parseFloat(selling_price) || 0,
        cost_price: parseFloat(cost_price) || 0,
        stock: parseInt(stock) || 0,
        threshold: parseInt(threshold) || 5,
        unit_type: unit_type || 'pcs',
        image: image || null,
        tenant_id: user.tenant_id!
      }
    })

    return NextResponse.json({ success: true, message: 'Product created successfully', id: product.id, data: product })
  } catch (err) {
    console.error('Product create error:', err)
    return NextResponse.json({ success: false, message: 'Error creating product' }, { status: 500 })
  }
}
