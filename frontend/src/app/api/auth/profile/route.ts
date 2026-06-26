import { NextRequest, NextResponse } from 'next/server'
import prisma from '@/lib/prisma'
import { requireAuth } from '@/lib/auth'

export async function GET(req: NextRequest) {
  const auth = requireAuth(req)
  if (auth instanceof NextResponse) return auth
  const { user } = auth

  try {
    const row = await prisma.user.findUnique({
      where: { id: user.id },
      select: { id: true, name: true, email: true, role: true, permissions: true, tenant_id: true }
    })
    if (!row) return NextResponse.json({ success: false, message: 'User not found' }, { status: 404 })

    let perms: string[] = []
    try { perms = JSON.parse(row.permissions || '[]') } catch { perms = [] }

    return NextResponse.json({ success: true, data: { ...row, permissions: perms } })
  } catch (err) {
    console.error('Profile error:', err)
    return NextResponse.json({ success: false, message: 'Profile fetch failed' }, { status: 500 })
  }
}
