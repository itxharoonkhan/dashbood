import { NextRequest, NextResponse } from 'next/server'
import prisma from '@/lib/prisma'
import { requireRole } from '@/lib/auth'

// Vercel has no writable filesystem — store logo as base64 string in DB

export async function POST(req: NextRequest) {
  const auth = requireRole(req, ['admin', 'superadmin'])
  if (auth instanceof NextResponse) return auth
  const { user } = auth

  try {
    const { logo_base64 } = await req.json()
    if (!logo_base64) return NextResponse.json({ success: false, message: 'No logo data provided' }, { status: 400 })

    // Validate it looks like a base64 data URL
    if (!logo_base64.startsWith('data:image/')) {
      return NextResponse.json({ success: false, message: 'Invalid image format. Must be base64 data URL.' }, { status: 400 })
    }

    await prisma.settings.update({
      where: { tenant_id: user.tenant_id! },
      data: { receipt_logo: logo_base64 }
    })

    return NextResponse.json({ success: true, message: 'Logo uploaded successfully', data: { receipt_logo: logo_base64 } })
  } catch (err) {
    console.error('Logo upload error:', err)
    return NextResponse.json({ success: false, message: 'Error uploading logo' }, { status: 500 })
  }
}

export async function DELETE(req: NextRequest) {
  const auth = requireRole(req, ['admin', 'superadmin'])
  if (auth instanceof NextResponse) return auth
  const { user } = auth

  try {
    await prisma.settings.update({ where: { tenant_id: user.tenant_id! }, data: { receipt_logo: null } })
    return NextResponse.json({ success: true, message: 'Logo removed successfully' })
  } catch (err) {
    console.error('Logo delete error:', err)
    return NextResponse.json({ success: false, message: 'Error removing logo' }, { status: 500 })
  }
}
