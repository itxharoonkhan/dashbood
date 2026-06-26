import { NextRequest, NextResponse } from 'next/server'
import prisma from '@/lib/prisma'
import { requireRole } from '@/lib/auth'

export async function GET(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const auth = requireRole(req, ['admin', 'superadmin'])
  if (auth instanceof NextResponse) return auth
  const { user } = auth
  const { id } = await params

  try {
    const supplier = await prisma.supplier.findFirst({ where: { id: parseInt(id), tenant_id: user.tenant_id!, is_deleted: false } })
    if (!supplier) return NextResponse.json({ success: false, message: 'Supplier not found' }, { status: 404 })
    return NextResponse.json({ success: true, data: supplier })
  } catch (err) {
    return NextResponse.json({ success: false, message: 'Failed to fetch supplier' }, { status: 500 })
  }
}

export async function PUT(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const auth = requireRole(req, ['admin', 'superadmin'])
  if (auth instanceof NextResponse) return auth
  const { user } = auth
  const { id } = await params

  try {
    const { name, phone, email, address, notes, status } = await req.json()
    if (!name?.trim()) return NextResponse.json({ success: false, message: 'Supplier name is required' }, { status: 400 })

    const sup = await prisma.supplier.findFirst({ where: { id: parseInt(id), is_deleted: false, tenant_id: user.tenant_id! } })
    if (!sup) return NextResponse.json({ success: false, message: 'Supplier not found' }, { status: 404 })

    const updated = await prisma.supplier.update({
      where: { id: parseInt(id) },
      data: { name: name.trim(), phone: phone || null, email: email || null, address: address || null, notes: notes || null, status: status || 'active' }
    })
    return NextResponse.json({ success: true, message: 'Supplier updated', data: updated })
  } catch (err) {
    return NextResponse.json({ success: false, message: 'Failed to update supplier' }, { status: 500 })
  }
}

export async function DELETE(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const auth = requireRole(req, ['admin', 'superadmin'])
  if (auth instanceof NextResponse) return auth
  const { user } = auth
  const { id } = await params

  try {
    const result = await prisma.$executeRaw`
      UPDATE suppliers SET is_deleted = true, status = 'inactive'
      WHERE id = ${parseInt(id)} AND is_deleted = false AND tenant_id = ${user.tenant_id!}
    `
    if (result === 0) return NextResponse.json({ success: false, message: 'Supplier not found' }, { status: 404 })
    return NextResponse.json({ success: true, message: 'Supplier deleted' })
  } catch (err) {
    return NextResponse.json({ success: false, message: 'Failed to delete supplier' }, { status: 500 })
  }
}
