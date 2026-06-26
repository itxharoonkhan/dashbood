import { NextRequest, NextResponse } from 'next/server'
import prisma from '@/lib/prisma'
import { requireRole } from '@/lib/auth'

export async function GET(req: NextRequest) {
  const auth = requireRole(req, ['admin', 'superadmin'])
  if (auth instanceof NextResponse) return auth
  const { user } = auth

  try {
    const rows = await prisma.$queryRaw<unknown[]>`
      SELECT e.*, u.name AS created_by_name FROM expenses e JOIN users u ON e.created_by = u.id
      WHERE e.tenant_id = ${user.tenant_id} AND e.is_deleted = true ORDER BY e.id DESC
    `
    return NextResponse.json({ success: true, data: rows })
  } catch (err) {
    console.error('Expenses trash error:', err)
    return NextResponse.json({ success: false, message: 'Failed to fetch deleted expenses' }, { status: 500 })
  }
}
