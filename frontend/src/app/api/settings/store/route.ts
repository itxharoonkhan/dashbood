import { NextRequest, NextResponse } from 'next/server'
import prisma from '@/lib/prisma'
import { requireRole } from '@/lib/auth'

export async function GET(req: NextRequest) {
  const auth = requireRole(req, ['admin', 'cashier', 'superadmin'])
  if (auth instanceof NextResponse) return auth
  const { user } = auth

  try {
    const settings = await prisma.settings.findUnique({
      where: { tenant_id: user.tenant_id! },
      select: { store_name: true, store_address: true, store_phone: true, store_email: true, store_gstin: true }
    })
    return NextResponse.json({ success: true, data: settings || {} })
  } catch (err) {
    console.error('Store settings GET error:', err)
    return NextResponse.json({ success: false, message: 'Error fetching store info' }, { status: 500 })
  }
}

export async function PUT(req: NextRequest) {
  const auth = requireRole(req, ['admin', 'superadmin'])
  if (auth instanceof NextResponse) return auth
  const { user } = auth

  try {
    const { store_name, store_address, store_phone, store_email, store_gstin } = await req.json()
    await prisma.settings.update({
      where: { tenant_id: user.tenant_id! },
      data: { store_name, store_address, store_phone, store_email, store_gstin }
    })
    return NextResponse.json({ success: true, message: 'Store info updated successfully' })
  } catch (err) {
    console.error('Store settings PUT error:', err)
    return NextResponse.json({ success: false, message: 'Error updating store info' }, { status: 500 })
  }
}
