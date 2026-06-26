import { NextRequest, NextResponse } from 'next/server'
import prisma from '@/lib/prisma'
import { requireRole } from '@/lib/auth'

export async function GET(req: NextRequest) {
  const auth = requireRole(req, ['admin', 'cashier', 'superadmin'])
  if (auth instanceof NextResponse) return auth
  const { user } = auth

  try {
    const settings = await prisma.settings.findUnique({ where: { tenant_id: user.tenant_id! } })
    return NextResponse.json({ success: true, data: settings || {} })
  } catch (err) {
    console.error('Settings GET error:', err)
    return NextResponse.json({ success: false, message: 'Error fetching settings' }, { status: 500 })
  }
}

export async function PUT(req: NextRequest) {
  const auth = requireRole(req, ['admin', 'superadmin'])
  if (auth instanceof NextResponse) return auth
  const { user } = auth

  try {
    const updates = await req.json()
    const allowedFields = ['store_name', 'store_address', 'store_phone', 'store_email', 'store_gstin', 'currency', 'tax_rate', 'items_per_page', 'theme', 'invoice_prefix', 'low_stock_alert', 'mode']
    const data: Record<string, unknown> = {}
    for (const field of allowedFields) {
      if (field in updates) data[field] = updates[field] === '' ? null : updates[field]
    }

    if (Object.keys(data).length === 0) {
      return NextResponse.json({ success: false, message: 'No fields to update' }, { status: 400 })
    }

    const updated = await prisma.settings.update({ where: { tenant_id: user.tenant_id! }, data })
    return NextResponse.json({ success: true, message: 'Settings updated successfully', data: updated })
  } catch (err) {
    console.error('Settings PUT error:', err)
    return NextResponse.json({ success: false, message: 'Error updating settings' }, { status: 500 })
  }
}
