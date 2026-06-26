import { NextRequest, NextResponse } from 'next/server'
import prisma from '@/lib/prisma'
import { requireRole } from '@/lib/auth'

export async function GET(req: NextRequest) {
  const auth = requireRole(req, ['admin', 'superadmin'])
  if (auth instanceof NextResponse) return auth
  const { user } = auth

  try {
    const isSuperAdmin = user.role === 'superadmin'
    const rows = await prisma.user.findMany({
      where: isSuperAdmin ? {} : { tenant_id: user.tenant_id },
      select: {
        id: true, name: true, email: true, role: true, permissions: true,
        failedAttempts: true, lockUntil: true, created_at: true,
        tenant_id: isSuperAdmin ? true : undefined
      },
      orderBy: { created_at: 'desc' }
    })
    return NextResponse.json({ success: true, data: rows })
  } catch (err) {
    console.error('Accounts fetch error:', err)
    return NextResponse.json({ success: false, message: 'Failed to fetch accounts' }, { status: 500 })
  }
}
