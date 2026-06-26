import { NextRequest, NextResponse } from 'next/server'
import prisma from '@/lib/prisma'
import { requireRole } from '@/lib/auth'

export async function GET(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const auth = requireRole(req, ['admin', 'cashier', 'superadmin'])
  if (auth instanceof NextResponse) return auth
  const { user } = auth
  const { id } = await params

  try {
    const table = await prisma.restaurantTable.findFirst({ where: { id: parseInt(id), is_deleted: false, tenant_id: user.tenant_id! } })
    if (!table) return NextResponse.json({ success: false, message: 'Table not found' }, { status: 404 })
    return NextResponse.json({ success: true, data: table })
  } catch (err) {
    return NextResponse.json({ success: false, message: 'Failed to fetch table' }, { status: 500 })
  }
}

export async function PUT(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const auth = requireRole(req, ['admin', 'superadmin'])
  if (auth instanceof NextResponse) return auth
  const { user } = auth
  const { id } = await params

  try {
    const { name, capacity, floor_section, status } = await req.json()
    const table = await prisma.restaurantTable.findFirst({ where: { id: parseInt(id), is_deleted: false, tenant_id: user.tenant_id! } })
    if (!table) return NextResponse.json({ success: false, message: 'Table not found' }, { status: 404 })

    if (name && name !== table.name) {
      const dup = await prisma.restaurantTable.findFirst({ where: { name: name.trim(), id: { not: parseInt(id) }, is_deleted: false, tenant_id: user.tenant_id! } })
      if (dup) return NextResponse.json({ success: false, message: `Table "${name}" already exists` }, { status: 400 })
    }

    const updated = await prisma.restaurantTable.update({
      where: { id: parseInt(id) },
      data: {
        name: name?.trim() || table.name,
        capacity: parseInt(capacity) || table.capacity,
        floor_section: floor_section || table.floor_section,
        ...(status ? { status } : {})
      }
    })
    return NextResponse.json({ success: true, data: updated })
  } catch (err) {
    return NextResponse.json({ success: false, message: 'Failed to update table' }, { status: 500 })
  }
}

export async function DELETE(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const auth = requireRole(req, ['admin', 'superadmin'])
  if (auth instanceof NextResponse) return auth
  const { user } = auth
  const { id } = await params

  try {
    const table = await prisma.restaurantTable.findFirst({ where: { id: parseInt(id), is_deleted: false, tenant_id: user.tenant_id! } })
    if (!table) return NextResponse.json({ success: false, message: 'Table not found' }, { status: 404 })
    if (table.status === 'occupied') {
      return NextResponse.json({ success: false, message: 'Cannot delete an occupied table. Clear the table first.' }, { status: 400 })
    }
    await prisma.restaurantTable.update({ where: { id: parseInt(id) }, data: { is_deleted: true } })
    return NextResponse.json({ success: true, message: 'Table deleted' })
  } catch (err) {
    return NextResponse.json({ success: false, message: 'Failed to delete table' }, { status: 500 })
  }
}
