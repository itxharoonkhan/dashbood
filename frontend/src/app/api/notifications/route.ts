import { NextRequest, NextResponse } from 'next/server'
import prisma from '@/lib/prisma'
import { requireRole } from '@/lib/auth'

async function syncLowStockNotifications(tenantId: number) {
  const lowStockProducts = await prisma.$queryRaw<{ id: number; name: string; stock: number; threshold: number }[]>`
    SELECT id, name, stock, threshold FROM products WHERE tenant_id = ${tenantId} AND is_deleted = false AND stock <= threshold
  `

  for (const p of lowStockProducts) {
    const exists = await prisma.notification.findFirst({
      where: { tenant_id: tenantId, product_id: p.id, is_read: false }
    })
    if (!exists) {
      await prisma.notification.create({
        data: {
          tenant_id: tenantId,
          product_id: p.id,
          product_name: p.name,
          current_stock: p.stock,
          threshold: p.threshold
        }
      })
    }
  }

  // Auto-mark-read notifications for products that are no longer low stock
  await prisma.$executeRaw`
    UPDATE notifications n
    SET is_read = true
    WHERE n.tenant_id = ${tenantId} AND n.is_read = false
      AND NOT EXISTS (
        SELECT 1 FROM products p WHERE p.id = n.product_id AND p.stock <= p.threshold AND p.is_deleted = false
      )
  `
}

export async function GET(req: NextRequest) {
  const auth = requireRole(req, ['admin', 'cashier', 'superadmin'])
  if (auth instanceof NextResponse) return auth
  const { user } = auth

  try {
    await syncLowStockNotifications(user.tenant_id!)

    const notifications = await prisma.notification.findMany({
      where: { tenant_id: user.tenant_id! },
      orderBy: [{ is_read: 'asc' }, { created_at: 'desc' }],
      take: 50
    })

    const unread = notifications.filter(n => !n.is_read).length
    return NextResponse.json({ success: true, data: notifications, unread })
  } catch (err) {
    console.error('Notifications error:', err)
    return NextResponse.json({ success: false, message: 'Failed to fetch notifications' }, { status: 500 })
  }
}

export async function PATCH(req: NextRequest) {
  const auth = requireRole(req, ['admin', 'cashier', 'superadmin'])
  if (auth instanceof NextResponse) return auth
  const { user } = auth

  try {
    const body = await req.json()
    const { id, mark_all } = body

    if (mark_all) {
      await prisma.$executeRaw`
        UPDATE notifications SET is_read = true
        WHERE tenant_id = ${user.tenant_id!} AND is_read = false
      `
    } else if (id) {
      await prisma.$executeRaw`
        UPDATE notifications SET is_read = true
        WHERE id = ${parseInt(id)} AND tenant_id = ${user.tenant_id!}
      `
    }
    return NextResponse.json({ success: true, message: 'Notifications updated' })
  } catch (err) {
    return NextResponse.json({ success: false, message: 'Failed to update notifications' }, { status: 500 })
  }
}
