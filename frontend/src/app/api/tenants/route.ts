import { NextRequest, NextResponse } from 'next/server'
import prisma from '@/lib/prisma'
import { requireRole } from '@/lib/auth'
import bcrypt from 'bcryptjs'

export async function GET(req: NextRequest) {
  const auth = requireRole(req, ['superadmin'])
  if (auth instanceof NextResponse) return auth

  try {
    const tenants = await prisma.$queryRaw<unknown[]>`
      SELECT t.*, COUNT(DISTINCT u.id)::int AS user_count,
        COALESCE(SUM(s.final_total), 0) AS total_revenue
      FROM tenants t
      LEFT JOIN users u ON u.tenant_id = t.id
      LEFT JOIN sales s ON s.tenant_id = t.id AND s.status = 'completed'
      GROUP BY t.id ORDER BY t.created_at DESC
    `
    return NextResponse.json({ success: true, data: tenants })
  } catch (err) {
    console.error('Tenants list error:', err)
    return NextResponse.json({ success: false, message: 'Failed to fetch tenants' }, { status: 500 })
  }
}

export async function POST(req: NextRequest) {
  const auth = requireRole(req, ['superadmin'])
  if (auth instanceof NextResponse) return auth

  try {
    const { name, slug, email, plan, admin_name, admin_email, admin_password } = await req.json()
    if (!name || !slug || !admin_name || !admin_email || !admin_password) {
      return NextResponse.json({ success: false, message: 'All fields required' }, { status: 400 })
    }

    const slugExists = await prisma.tenant.findFirst({ where: { slug } })
    if (slugExists) return NextResponse.json({ success: false, message: 'Slug already taken' }, { status: 400 })
    const emailExists = await prisma.user.findFirst({ where: { email: admin_email } })
    if (emailExists) return NextResponse.json({ success: false, message: 'Admin email already exists' }, { status: 400 })

    const tenant = await prisma.$transaction(async (tx) => {
      const t = await tx.tenant.create({ data: { name, slug, email: email || admin_email, plan: plan || 'basic' } })
      const hash = await bcrypt.hash(admin_password, 10)
      await tx.user.create({
        data: { name: admin_name, email: admin_email, password: hash, role: 'admin', tenant_id: t.id, permissions: '[]' }
      })
      await tx.settings.create({ data: { tenant_id: t.id } })
      return t
    })

    return NextResponse.json({ success: true, message: 'Tenant created', data: tenant })
  } catch (err) {
    console.error('Tenant create error:', err)
    return NextResponse.json({ success: false, message: 'Failed to create tenant' }, { status: 500 })
  }
}
