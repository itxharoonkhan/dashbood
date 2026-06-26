import { NextRequest, NextResponse } from 'next/server'
import prisma from '@/lib/prisma'
import { requireRole } from '@/lib/auth'

export async function GET(req: NextRequest) {
  const auth = requireRole(req, ['admin', 'superadmin'])
  if (auth instanceof NextResponse) return auth
  const { user } = auth

  try {
    const rows = await prisma.$queryRaw<unknown[]>`
      SELECT s.*, COUNT(DISTINCT si.id)::int AS mapped_items, COUNT(DISTINCT po.id)::int AS total_pos
      FROM suppliers s
      LEFT JOIN supplier_items si ON si.supplier_id = s.id
      LEFT JOIN purchase_orders po ON po.supplier_id = s.id
      WHERE s.is_deleted = false AND s.tenant_id = ${user.tenant_id}
      GROUP BY s.id ORDER BY s.created_at DESC
    `
    return NextResponse.json({ success: true, data: rows })
  } catch (err) {
    console.error('Suppliers list error:', err)
    return NextResponse.json({ success: false, message: 'Failed to fetch suppliers' }, { status: 500 })
  }
}

export async function POST(req: NextRequest) {
  const auth = requireRole(req, ['admin', 'superadmin'])
  if (auth instanceof NextResponse) return auth
  const { user } = auth

  try {
    const { name, phone, email, address, notes, status } = await req.json()
    if (!name?.trim()) return NextResponse.json({ success: false, message: 'Supplier name is required' }, { status: 400 })

    const supplier = await prisma.supplier.create({
      data: { name: name.trim(), phone: phone || null, email: email || null, address: address || null, notes: notes || null, status: status || 'active', tenant_id: user.tenant_id! }
    })
    return NextResponse.json({ success: true, message: 'Supplier created', data: supplier })
  } catch (err) {
    console.error('Supplier create error:', err)
    return NextResponse.json({ success: false, message: 'Failed to create supplier' }, { status: 500 })
  }
}
