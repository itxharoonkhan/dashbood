import { NextRequest, NextResponse } from 'next/server'
import prisma from '@/lib/prisma'
import { requireRole } from '@/lib/auth'

export async function GET(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const auth = requireRole(req, ['admin', 'cashier', 'superadmin'])
  if (auth instanceof NextResponse) return auth
  const { user } = auth
  const { id } = await params

  try {
    const customer = await prisma.customer.findFirst({
      where: { id: parseInt(id), tenant_id: user.tenant_id!, is_deleted: false }
    })
    if (!customer) return NextResponse.json({ success: false, message: 'Customer not found' }, { status: 404 })
    return NextResponse.json({ success: true, data: customer })
  } catch (err) {
    console.error('Get customer error:', err)
    return NextResponse.json({ success: false, message: 'Error fetching customer' }, { status: 500 })
  }
}

export async function PUT(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const auth = requireRole(req, ['admin', 'superadmin'])
  if (auth instanceof NextResponse) return auth
  const { user } = auth
  const { id } = await params

  try {
    const { name, email, phone, address, city, pincode, gst_number } = await req.json()
    const existing = await prisma.customer.findFirst({
      where: { id: parseInt(id), tenant_id: user.tenant_id!, is_deleted: false }
    })
    if (!existing) return NextResponse.json({ success: false, message: 'Customer not found' }, { status: 404 })

    const updated = await prisma.customer.update({
      where: { id: parseInt(id) },
      data: { name, email: email || null, phone: phone || null, address: address || null, city: city || null, pincode: pincode || null, gst_number: gst_number || null }
    })
    return NextResponse.json({ success: true, message: 'Customer updated successfully', data: updated })
  } catch (err) {
    console.error('Update customer error:', err)
    return NextResponse.json({ success: false, message: 'Error updating customer' }, { status: 500 })
  }
}

export async function DELETE(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const auth = requireRole(req, ['admin', 'superadmin'])
  if (auth instanceof NextResponse) return auth
  const { user } = auth
  const { id } = await params

  try {
    const result = await prisma.$executeRaw`
      UPDATE customers SET is_deleted = true
      WHERE id = ${parseInt(id)} AND tenant_id = ${user.tenant_id!} AND is_deleted = false
    `
    if (result === 0) return NextResponse.json({ success: false, message: 'Customer not found' }, { status: 404 })
    return NextResponse.json({ success: true, message: 'Customer deleted successfully' })
  } catch (err) {
    console.error('Delete customer error:', err)
    return NextResponse.json({ success: false, message: 'Error deleting customer' }, { status: 500 })
  }
}
