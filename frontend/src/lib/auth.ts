import jwt from 'jsonwebtoken'
import { NextRequest, NextResponse } from 'next/server'

export interface JwtUser {
  id: number
  role: 'superadmin' | 'admin' | 'cashier'
  permissions: string[]
  tenant_id: number | null
}

export function getUser(req: NextRequest): JwtUser | null {
  const auth = req.headers.get('authorization')
  if (!auth?.startsWith('Bearer ')) return null
  try {
    return jwt.verify(auth.slice(7), process.env.JWT_SECRET!) as JwtUser
  } catch {
    return null
  }
}

export function requireAuth(req: NextRequest): { user: JwtUser } | NextResponse {
  const user = getUser(req)
  if (!user) return NextResponse.json({ success: false, message: 'Unauthorized' }, { status: 401 })
  return { user }
}

export function requireRole(req: NextRequest, roles: string[]): { user: JwtUser } | NextResponse {
  const result = requireAuth(req)
  if (result instanceof NextResponse) return result
  if (!roles.includes(result.user.role)) {
    return NextResponse.json({ success: false, message: 'Forbidden' }, { status: 403 })
  }
  return result
}
