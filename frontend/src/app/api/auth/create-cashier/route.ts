import { NextRequest, NextResponse } from 'next/server'
import bcrypt from 'bcryptjs'
import prisma from '@/lib/prisma'
import { requireRole } from '@/lib/auth'

export async function POST(req: NextRequest) {
  const auth = requireRole(req, ['admin', 'superadmin'])
  if (auth instanceof NextResponse) return auth
  const { user } = auth

  try {
    let { name, email, password, role, permissions } = await req.json()
    name = name?.trim()
    email = email?.trim()?.toLowerCase()
    password = password?.trim()

    if (!name || !email || !password) {
      return NextResponse.json({ success: false, message: 'Name, email, and password are required.' }, { status: 400 })
    }

    const existing = await prisma.user.findUnique({ where: { email } })
    if (existing) {
      return NextResponse.json({ success: false, message: 'A user with this email already exists.' }, { status: 400 })
    }

    const ALLOWED_ROLES = ['cashier', 'manager']
    const assignedRole = ALLOWED_ROLES.includes(role) ? role : 'cashier'

    const hashedPassword = await bcrypt.hash(password, 10)
    await prisma.user.create({
      data: {
        name,
        email,
        password: hashedPassword,
        role: assignedRole,
        permissions: JSON.stringify(permissions || []),
        tenant_id: user.tenant_id
      }
    })

    return NextResponse.json({ success: true, message: 'User created successfully' })
  } catch (err) {
    console.error('Create cashier error:', err)
    return NextResponse.json({ success: false, message: 'Registration failed' }, { status: 500 })
  }
}
