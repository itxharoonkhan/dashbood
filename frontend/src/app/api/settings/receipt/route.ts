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
      select: { receipt_logo: true, receipt_footer_message: true, receipt_show_tax: true, receipt_show_donation: true }
    })
    return NextResponse.json({ success: true, data: settings || {} })
  } catch (err) {
    console.error('Receipt settings GET error:', err)
    return NextResponse.json({ success: false, message: 'Error fetching receipt settings' }, { status: 500 })
  }
}

export async function PUT(req: NextRequest) {
  const auth = requireRole(req, ['admin', 'superadmin'])
  if (auth instanceof NextResponse) return auth
  const { user } = auth

  try {
    const { receipt_footer_message, receipt_show_tax, receipt_show_donation } = await req.json()
    if (receipt_footer_message !== undefined && receipt_footer_message.length > 150) {
      return NextResponse.json({ success: false, message: 'Footer message cannot exceed 150 characters' }, { status: 400 })
    }

    const updated = await prisma.settings.update({
      where: { tenant_id: user.tenant_id! },
      data: { receipt_footer_message: receipt_footer_message ?? '', receipt_show_tax: !!receipt_show_tax, receipt_show_donation: !!receipt_show_donation },
      select: { receipt_logo: true, receipt_footer_message: true, receipt_show_tax: true, receipt_show_donation: true }
    })
    return NextResponse.json({ success: true, message: 'Receipt settings updated successfully', data: updated })
  } catch (err) {
    console.error('Receipt settings PUT error:', err)
    return NextResponse.json({ success: false, message: 'Error updating receipt settings' }, { status: 500 })
  }
}
