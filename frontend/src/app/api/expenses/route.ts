import { NextRequest, NextResponse } from 'next/server'
import { Prisma } from '@prisma/client'
import prisma from '@/lib/prisma'
import { requireRole } from '@/lib/auth'

export async function GET(req: NextRequest) {
  const auth = requireRole(req, ['admin', 'cashier', 'superadmin'])
  if (auth instanceof NextResponse) return auth
  const { user } = auth

  try {
    const { searchParams } = new URL(req.url)
    const from = searchParams.get('from')
    const to = searchParams.get('to')
    const category = searchParams.get('category')
    const isAdmin = user.role === 'admin' || user.role === 'superadmin'

    const dateRx = /^\d{4}-\d{2}-\d{2}$/
    const filters: string[] = []
    if (!isAdmin) filters.push(`e.created_by = ${user.id}`)
    if (from && to && dateRx.test(from) && dateRx.test(to)) {
      filters.push(`e.expense_date BETWEEN '${from}'::date AND '${to}'::date`)
    }
    if (category) {
      // safe: category is a known enum value, but still use parameterized via queryRaw template below
      filters.push(`e.category = '${category.replace(/'/g, "''")}'`)
    }
    const extraWhere = filters.length > 0 ? 'AND ' + filters.join(' AND ') : ''

    const rows = await prisma.$queryRaw<unknown[]>(Prisma.sql`
      SELECT e.*, u.name AS created_by_name
      FROM expenses e
      JOIN users u ON e.created_by = u.id
      WHERE e.tenant_id = ${user.tenant_id!} AND e.is_deleted = false ${Prisma.raw(extraWhere)}
      ORDER BY e.expense_date DESC, e.created_at DESC
    `)
    return NextResponse.json({ success: true, data: rows })
  } catch (err) {
    console.error('Expenses list error:', err)
    return NextResponse.json({ success: false, message: 'Failed to fetch expenses' }, { status: 500 })
  }
}

export async function POST(req: NextRequest) {
  const auth = requireRole(req, ['admin', 'cashier', 'superadmin'])
  if (auth instanceof NextResponse) return auth
  const { user } = auth

  try {
    const { title, amount, category, payment_method, notes, expense_date } = await req.json()
    if (!title || !category || !expense_date) {
      return NextResponse.json({ success: false, message: 'Title, category, and date are required' }, { status: 400 })
    }
    const parsed = parseFloat(amount)
    if (isNaN(parsed) || parsed <= 0) {
      return NextResponse.json({ success: false, message: 'Amount must be greater than 0' }, { status: 400 })
    }

    const activeShift = await prisma.shift.findFirst({
      where: { cashier_id: user.id, status: 'open', tenant_id: user.tenant_id! }
    })

    const expense = await prisma.expense.create({
      data: {
        title: title.trim(), amount: parsed, category,
        payment_method: payment_method || 'cash',
        notes: notes?.trim() || null,
        expense_date: new Date(expense_date),
        created_by: user.id,
        shift_id: activeShift?.id || null,
        tenant_id: user.tenant_id!
      }
    })

    const row = await prisma.$queryRaw<unknown[]>`
      SELECT e.*, u.name AS created_by_name FROM expenses e JOIN users u ON e.created_by = u.id WHERE e.id = ${expense.id}
    `
    return NextResponse.json({ success: true, data: Array.isArray(row) ? row[0] : expense }, { status: 201 })
  } catch (err) {
    console.error('Create expense error:', err)
    return NextResponse.json({ success: false, message: 'Failed to create expense' }, { status: 500 })
  }
}
