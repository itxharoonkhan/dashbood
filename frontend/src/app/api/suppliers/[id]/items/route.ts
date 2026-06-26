import { NextRequest, NextResponse } from 'next/server'
import prisma from '@/lib/prisma'
import { requireRole } from '@/lib/auth'

export async function GET(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const auth = requireRole(req, ['admin', 'superadmin'])
  if (auth instanceof NextResponse) return auth
  const { user } = auth
  const { id } = await params

  try {
    // Verify supplier belongs to this tenant
    const supplier = await prisma.supplier.findFirst({ where: { id: parseInt(id), tenant_id: user.tenant_id! } })
    if (!supplier) return NextResponse.json({ success: false, message: 'Supplier not found' }, { status: 404 })

    const rows = await prisma.$queryRaw<unknown[]>`
      SELECT si.*, p.name AS product_name, p.sku, p.stock AS current_stock, p.threshold
      FROM supplier_items si
      JOIN products p ON p.id = si.product_id
      WHERE si.supplier_id = ${parseInt(id)} AND p.tenant_id = ${user.tenant_id!}
      ORDER BY si.is_primary DESC, p.name ASC
    `
    return NextResponse.json({ success: true, data: rows })
  } catch (err) {
    return NextResponse.json({ success: false, message: 'Failed to fetch supplier items' }, { status: 500 })
  }
}

export async function POST(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const auth = requireRole(req, ['admin', 'superadmin'])
  if (auth instanceof NextResponse) return auth
  const { user } = auth
  const { id } = await params

  try {
    const { product_id, unit_cost, lead_time_days, is_primary } = await req.json()
    if (!product_id) return NextResponse.json({ success: false, message: 'Product is required' }, { status: 400 })

    // Verify supplier and product belong to this tenant
    const supplier = await prisma.supplier.findFirst({ where: { id: parseInt(id), tenant_id: user.tenant_id! } })
    if (!supplier) return NextResponse.json({ success: false, message: 'Supplier not found' }, { status: 404 })
    const product = await prisma.product.findFirst({ where: { id: parseInt(product_id), tenant_id: user.tenant_id! } })
    if (!product) return NextResponse.json({ success: false, message: 'Product not found' }, { status: 404 })

    const existing = await prisma.supplierItem.findFirst({ where: { supplier_id: parseInt(id), product_id: parseInt(product_id) } })
    if (existing) {
      await prisma.supplierItem.update({
        where: { id: existing.id },
        data: { unit_cost: parseFloat(unit_cost) || 0, lead_time_days: parseInt(lead_time_days) || 0, is_primary: !!is_primary }
      })
    } else {
      await prisma.supplierItem.create({
        data: { supplier_id: parseInt(id), product_id: parseInt(product_id), unit_cost: parseFloat(unit_cost) || 0, lead_time_days: parseInt(lead_time_days) || 0, is_primary: !!is_primary }
      })
    }
    return NextResponse.json({ success: true, message: 'Item mapping saved' })
  } catch (err) {
    return NextResponse.json({ success: false, message: 'Failed to save item mapping' }, { status: 500 })
  }
}

export async function DELETE(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const auth = requireRole(req, ['admin', 'superadmin'])
  if (auth instanceof NextResponse) return auth
  const { user } = auth
  const { id } = await params
  const { searchParams } = new URL(req.url)
  const mapId = searchParams.get('mapId')

  try {
    // Verify supplier belongs to this tenant before deleting
    const supplier = await prisma.supplier.findFirst({ where: { id: parseInt(id), tenant_id: user.tenant_id! } })
    if (!supplier) return NextResponse.json({ success: false, message: 'Supplier not found' }, { status: 404 })

    if (mapId) {
      await prisma.$executeRaw`DELETE FROM supplier_items WHERE id = ${parseInt(mapId)} AND supplier_id = ${parseInt(id)}`
    }
    return NextResponse.json({ success: true, message: 'Mapping removed' })
  } catch (err) {
    return NextResponse.json({ success: false, message: 'Failed to remove mapping' }, { status: 500 })
  }
}
