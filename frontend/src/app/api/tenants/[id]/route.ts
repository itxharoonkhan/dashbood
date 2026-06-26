import { NextRequest, NextResponse } from 'next/server'
import prisma from '@/lib/prisma'
import { requireRole } from '@/lib/auth'

export async function GET(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const auth = requireRole(req, ['superadmin'])
  if (auth instanceof NextResponse) return auth
  const { id } = await params

  try {
    const tenant = await prisma.tenant.findUnique({ where: { id: parseInt(id) } })
    if (!tenant) return NextResponse.json({ success: false, message: 'Tenant not found' }, { status: 404 })
    return NextResponse.json({ success: true, data: tenant })
  } catch (err) {
    return NextResponse.json({ success: false, message: 'Failed to fetch tenant' }, { status: 500 })
  }
}

export async function PUT(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const auth = requireRole(req, ['superadmin'])
  if (auth instanceof NextResponse) return auth
  const { id } = await params

  try {
    const { name, slug, plan, status } = await req.json()
    const tenant = await prisma.tenant.findUnique({ where: { id: parseInt(id) } })
    if (!tenant) return NextResponse.json({ success: false, message: 'Tenant not found' }, { status: 404 })

    if (slug && slug !== tenant.slug) {
      const dup = await prisma.tenant.findFirst({ where: { slug, id: { not: parseInt(id) } } })
      if (dup) return NextResponse.json({ success: false, message: 'Slug already taken' }, { status: 400 })
    }

    const updated = await prisma.tenant.update({
      where: { id: parseInt(id) },
      data: { name: name || tenant.name, slug: slug || tenant.slug, plan: plan || tenant.plan, status: status || tenant.status }
    })
    return NextResponse.json({ success: true, data: updated })
  } catch (err) {
    return NextResponse.json({ success: false, message: 'Failed to update tenant' }, { status: 500 })
  }
}

export async function DELETE(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const auth = requireRole(req, ['superadmin'])
  if (auth instanceof NextResponse) return auth
  const { id } = await params

  try {
    await prisma.tenant.update({ where: { id: parseInt(id) }, data: { status: 'suspended' } })
    return NextResponse.json({ success: true, message: 'Tenant suspended' })
  } catch (err) {
    return NextResponse.json({ success: false, message: 'Failed to suspend tenant' }, { status: 500 })
  }
}
