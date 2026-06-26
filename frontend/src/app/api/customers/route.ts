import { NextRequest, NextResponse } from 'next/server'
import prisma from '@/lib/prisma'
import { requireRole } from '@/lib/auth'
import { nextTenantNumber } from '@/lib/tenant-sequence'

export async function GET(req: NextRequest) {
  const auth = requireRole(req, ['admin', 'cashier', 'superadmin'])
  if (auth instanceof NextResponse) return auth
  const { user } = auth

  try {
    const rows = await prisma.$queryRaw<unknown[]>`
      SELECT c.*,
        COALESCE(COUNT(DISTINCT s.id), 0)::int AS total_orders,
        COALESCE(SUM(s.final_total), 0) AS total_spent
      FROM customers c
      LEFT JOIN sales s ON s.customer_id = c.id AND s.status = 'completed'
      WHERE c.tenant_id = ${user.tenant_id} AND c.is_deleted = false
      GROUP BY c.id
      ORDER BY c.created_at DESC
    `
    return NextResponse.json({ success: true, data: rows })
  } catch (err) {
    console.error('Customers list error:', err)
    return NextResponse.json({ success: false, message: 'Error fetching customers' }, { status: 500 })
  }
}

export async function POST(req: NextRequest) {
  const auth = requireRole(req, ['admin', 'cashier', 'superadmin'])
  if (auth instanceof NextResponse) return auth
  const { user } = auth

  try {
    const { name, email, phone, address, city, pincode, gst_number } = await req.json()
    if (!name?.trim()) return NextResponse.json({ success: false, message: 'Customer name is required' }, { status: 400 })

    const customer_number = await nextTenantNumber('customers', user.tenant_id!)
    const customer = await prisma.customer.create({
      data: {
        customer_number,
        name: name.trim(),
        email: email || null,
        phone: phone || null,
        address: address || null,
        city: city || null,
        pincode: pincode || null,
        gst_number: gst_number || null,
        tenant_id: user.tenant_id!
      }
    })
    return NextResponse.json({ success: true, message: 'Customer created successfully', data: customer })
  } catch (err) {
    console.error('Customer create error:', err)
    return NextResponse.json({ success: false, message: 'Error creating customer' }, { status: 500 })
  }
}
