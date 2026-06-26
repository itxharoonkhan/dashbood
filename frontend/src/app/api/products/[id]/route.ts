import { NextRequest, NextResponse } from 'next/server'
import prisma from '@/lib/prisma'
import { requireRole } from '@/lib/auth'

export async function GET(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const auth = requireRole(req, ['admin', 'cashier', 'superadmin'])
  if (auth instanceof NextResponse) return auth
  const { user } = auth
  const { id } = await params

  try {
    const product = await prisma.product.findFirst({
      where: { id: parseInt(id), tenant_id: user.tenant_id!, is_deleted: false }
    })
    if (!product) return NextResponse.json({ success: false, message: 'Product not found' }, { status: 404 })
    return NextResponse.json({ success: true, data: product })
  } catch (err) {
    console.error('Get product error:', err)
    return NextResponse.json({ success: false, message: 'Error fetching product' }, { status: 500 })
  }
}

export async function PUT(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const auth = requireRole(req, ['admin', 'superadmin'])
  if (auth instanceof NextResponse) return auth
  const { user } = auth
  const { id } = await params

  try {
    const updates = await req.json()
    const existing = await prisma.product.findFirst({
      where: { id: parseInt(id), tenant_id: user.tenant_id!, is_deleted: false }
    })
    if (!existing) return NextResponse.json({ success: false, message: 'Product not found' }, { status: 404 })

    const allowedFields = ['name', 'category', 'sku', 'barcode', 'description', 'selling_price', 'cost_price', 'stock', 'threshold', 'unit_type', 'image']
    const data: Record<string, unknown> = {}
    for (const field of allowedFields) {
      if (field in updates) data[field] = updates[field] === '' ? null : updates[field]
    }

    if (Object.keys(data).length === 0) {
      return NextResponse.json({ success: false, message: 'No fields to update' }, { status: 400 })
    }

    const updated = await prisma.product.update({ where: { id: parseInt(id) }, data })
    return NextResponse.json({ success: true, message: 'Product updated successfully', data: updated })
  } catch (err) {
    console.error('Update product error:', err)
    return NextResponse.json({ success: false, message: 'Error updating product' }, { status: 500 })
  }
}

export async function DELETE(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const auth = requireRole(req, ['admin', 'superadmin'])
  if (auth instanceof NextResponse) return auth
  const { user } = auth
  const { id } = await params

  try {
    const result = await prisma.$executeRaw`
      UPDATE products SET is_deleted = true
      WHERE id = ${parseInt(id)} AND tenant_id = ${user.tenant_id!} AND is_deleted = false
    `
    if (result === 0) return NextResponse.json({ success: false, message: 'Product not found' }, { status: 404 })
    return NextResponse.json({ success: true, message: 'Product deleted successfully' })
  } catch (err) {
    console.error('Delete product error:', err)
    return NextResponse.json({ success: false, message: 'Error deleting product' }, { status: 500 })
  }
}
