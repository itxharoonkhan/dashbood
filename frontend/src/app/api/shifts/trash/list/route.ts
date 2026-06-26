import { NextRequest, NextResponse } from 'next/server'
import prisma from '@/lib/prisma'
import { requireRole } from '@/lib/auth'

export async function GET(req: NextRequest) {
  const auth = requireRole(req, ['admin', 'superadmin'])
  if (auth instanceof NextResponse) return auth
  const { user } = auth

  try {
    const rows = await prisma.$queryRaw<unknown[]>`
      SELECT s.*, u.name AS cashier_name FROM shifts s
      JOIN users u ON s.cashier_id = u.id
      WHERE s.tenant_id = ${user.tenant_id} AND s.is_deleted = true ORDER BY s.start_time DESC
    `
    return NextResponse.json({ success: true, data: rows })
  } catch (err) {
    console.error('Shifts trash error:', err)
    return NextResponse.json({ success: false, message: 'Failed to fetch deleted shifts' }, { status: 500 })
  }
}
