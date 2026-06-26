import { NextRequest, NextResponse } from 'next/server'
import prisma from '@/lib/prisma'
import { requireRole } from '@/lib/auth'

export async function PUT(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const auth = requireRole(req, ['admin', 'superadmin'])
  if (auth instanceof NextResponse) return auth
  const { user } = auth
  const { id } = await params

  try {
    const result = await prisma.$executeRaw`
      UPDATE restaurant_tables SET is_deleted = false
      WHERE id = ${parseInt(id)} AND tenant_id = ${user.tenant_id!} AND is_deleted = true
    `
    if (result === 0) return NextResponse.json({ success: false, message: 'Deleted table not found' }, { status: 404 })
    return NextResponse.json({ success: true, message: 'Table restored' })
  } catch (err) {
    return NextResponse.json({ success: false, message: 'Failed to restore table' }, { status: 500 })
  }
}
