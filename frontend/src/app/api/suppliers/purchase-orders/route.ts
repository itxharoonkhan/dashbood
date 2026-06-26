import { NextRequest, NextResponse } from 'next/server'
import prisma from '@/lib/prisma'
import { requireRole } from '@/lib/auth'
import { nextTenantNumber } from '@/lib/tenant-sequence'
import { Prisma } from '@prisma/client'

export async function GET(req: NextRequest) {
  const auth = requireRole(req, ['admin', 'superadmin'])
  if (auth instanceof NextResponse) return auth
  const { user } = auth

  try {
    const { searchParams } = new URL(req.url)
    const supplier_id = searchParams.get('supplier_id')
    const tid = user.tenant_id!
    const supplierFilter = supplier_id
      ? Prisma.sql`AND po.supplier_id = ${parseInt(supplier_id)}`
      : Prisma.sql``

    const rows = await prisma.$queryRaw<unknown[]>(Prisma.sql`
      SELECT po.*,
        s.name AS supplier_name,
        u.name AS created_by_name,
        COUNT(poi.id)::int AS item_count,
        COALESCE(SUM(poi.quantity_ordered * poi.unit_cost), 0) AS total_value,
        COALESCE(SUM(poi.quantity_ordered), 0)::int AS total_qty_ordered,
        COALESCE(SUM(poi.quantity_received), 0)::int AS total_qty_received
      FROM purchase_orders po
      JOIN suppliers s ON s.id = po.supplier_id
      JOIN users u ON u.id = po.created_by
      LEFT JOIN purchase_order_items poi ON poi.po_id = po.id
      WHERE po.tenant_id = ${tid} ${supplierFilter}
      GROUP BY po.id, s.name, u.name
      ORDER BY po.created_at DESC
    `)
    return NextResponse.json({ success: true, data: rows })
  } catch (err) {
    console.error('Purchase orders list error:', err)
    return NextResponse.json({ success: false, message: 'Failed to fetch purchase orders' }, { status: 500 })
  }
}

export async function POST(req: NextRequest) {
  const auth = requireRole(req, ['admin', 'superadmin'])
  if (auth instanceof NextResponse) return auth
  const { user } = auth

  try {
    const { supplier_id, items, notes, expected_date } = await req.json()
    if (!supplier_id || !Array.isArray(items) || items.length === 0) {
      return NextResponse.json({ success: false, message: 'Supplier and items are required' }, { status: 400 })
    }

    const supplier = await prisma.supplier.findFirst({ where: { id: parseInt(supplier_id), is_deleted: false, tenant_id: user.tenant_id! } })
    if (!supplier) return NextResponse.json({ success: false, message: 'Supplier not found' }, { status: 404 })

    const po_number = await nextTenantNumber('purchase_orders', user.tenant_id!)

    const order = await prisma.purchaseOrder.create({
      data: {
        po_number, supplier_id: parseInt(supplier_id),
        notes: notes || null,
        expected_date: expected_date ? new Date(expected_date) : null,
        created_by: user.id, tenant_id: user.tenant_id!
      }
    })
    for (const it of items as { product_id: number; quantity_ordered: number; unit_cost: number }[]) {
      await prisma.purchaseOrderItem.create({
        data: {
          po_id: order.id,
          product_id: parseInt(String(it.product_id)),
          quantity_ordered: parseInt(String(it.quantity_ordered)) || 0,
          unit_cost: parseFloat(String(it.unit_cost)) || 0
        }
      })
    }
    const po = order

    return NextResponse.json({ success: true, message: 'Purchase order created', data: po }, { status: 201 })
  } catch (err) {
    console.error('PO create error:', err)
    return NextResponse.json({ success: false, message: 'Failed to create purchase order' }, { status: 500 })
  }
}
