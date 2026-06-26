import { NextRequest, NextResponse } from 'next/server'
import bcrypt from 'bcryptjs'
import jwt from 'jsonwebtoken'
import prisma from '@/lib/prisma'

export async function POST(req: NextRequest) {
  try {
    let { email, password } = await req.json()
    email = email?.trim()?.toLowerCase()
    password = password?.trim()

    if (!email || !password) {
      return NextResponse.json({ success: false, message: 'Email and password required.' }, { status: 400 })
    }

    const user = await prisma.user.findUnique({ where: { email } })
    if (!user) {
      return NextResponse.json({ success: false, message: 'Invalid email or password.' }, { status: 401 })
    }

    // Check tenant status
    if (user.tenant_id) {
      const tenant = await prisma.tenant.findUnique({ where: { id: user.tenant_id } })
      if (!tenant || tenant.status !== 'active') {
        return NextResponse.json({
          success: false,
          message: 'Your business account has been suspended or deactivated. Please contact support.'
        }, { status: 403 })
      }
    }

    // Check lock
    const now = new Date()
    if (user.lockUntil && user.lockUntil > now) {
      const remainingMs = user.lockUntil.getTime() - now.getTime()
      const remainingMins = Math.max(1, Math.ceil(remainingMs / (60 * 1000)))
      return NextResponse.json({
        success: false,
        message: `Account locked. Please try again in ${remainingMins} minutes.`,
        lockUntil: user.lockUntil.getTime()
      }, { status: 429 })
    }

    const isMatch = await bcrypt.compare(password, user.password)
    if (!isMatch) {
      const newAttempts = (user.failedAttempts || 0) + 1
      if (newAttempts >= 3) {
        const lockUntil = new Date(Date.now() + 30 * 60 * 1000)
        await prisma.user.update({ where: { id: user.id }, data: { failedAttempts: newAttempts, lockUntil } })
        return NextResponse.json({
          success: false,
          message: 'Account locked for 30 mins due to 3 failed attempts.',
          lockUntil: lockUntil.getTime()
        }, { status: 429 })
      }
      await prisma.user.update({ where: { id: user.id }, data: { failedAttempts: newAttempts } })
      return NextResponse.json({
        success: false,
        message: `Invalid password. Attempt ${newAttempts} of 3.`
      }, { status: 401 })
    }

    await prisma.user.update({ where: { id: user.id }, data: { failedAttempts: 0, lockUntil: null } })

    if (!process.env.JWT_SECRET) throw new Error('JWT_SECRET missing')

    let permissions: string[] = []
    try { permissions = JSON.parse(user.permissions || '[]') } catch { permissions = [] }

    const token = jwt.sign(
      { id: user.id, role: user.role, permissions, tenant_id: user.tenant_id },
      process.env.JWT_SECRET,
      { expiresIn: '1d' }
    )

    return NextResponse.json({
      success: true,
      token,
      user: { id: user.id, name: user.name, role: user.role, permissions, tenant_id: user.tenant_id }
    })
  } catch (err) {
    console.error('Login error:', err)
    return NextResponse.json({ success: false, message: 'Server login error' }, { status: 500 })
  }
}
