import { NextRequest, NextResponse } from 'next/server'
import prisma from '@/lib/prisma'
import { requireRole } from '@/lib/auth'

export async function PUT(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const auth = requireRole(req, ['admin', 'cashier', 'superadmin'])
  if (auth instanceof NextResponse) return auth
  const { user } = auth
  const { id } = await params

  try {
    const { title, amount, category, payment_method, notes, expense_date } = await req.json()
    const existing = await prisma.expense.findFirst({ where: { id: parseInt(id), tenant_id: user.tenant_id!, is_deleted: false } })
    if (!existing) return NextResponse.json({ success: false, message: 'Expense not found' }, { status: 404 })

    if (user.role !== 'admin' && user.role !== 'superadmin' && existing.created_by !== user.id) {
      return NextResponse.json({ success: false, message: 'Not authorized to edit this expense' }, { status: 403 })
    }

    const parsed = parseFloat(amount)
    if (isNaN(parsed) || parsed <= 0) {
      return NextResponse.json({ success: false, message: 'Amount must be greater than 0' }, { status: 400 })
    }

    await prisma.expense.update({
      where: { id: parseInt(id) },
      data: { title: title.trim(), amount: parsed, category, payment_method: payment_method || 'cash', notes: notes?.trim() || null, expense_date: new Date(expense_date) }
    })

    const row = await prisma.$queryRaw<unknown[]>`
      SELECT e.*, u.name AS created_by_name FROM expenses e JOIN users u ON e.created_by = u.id WHERE e.id = ${parseInt(id)}
    `
    return NextResponse.json({ success: true, data: Array.isArray(row) ? row[0] : {} })
  } catch (err) {
    console.error('Update expense error:', err)
    return NextResponse.json({ success: false, message: 'Failed to update expense' }, { status: 500 })
  }
}

export async function DELETE(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const auth = requireRole(req, ['admin', 'cashier', 'superadmin'])
  if (auth instanceof NextResponse) return auth
  const { user } = auth
  const { id } = await params

  try {
    const existing = await prisma.expense.findFirst({ where: { id: parseInt(id), tenant_id: user.tenant_id!, is_deleted: false } })
    if (!existing) return NextResponse.json({ success: false, message: 'Expense not found' }, { status: 404 })

    if (user.role !== 'admin' && user.role !== 'superadmin' && existing.created_by !== user.id) {
      return NextResponse.json({ success: false, message: 'Not authorized to delete this expense' }, { status: 403 })
    }

    await prisma.expense.update({ where: { id: parseInt(id) }, data: { is_deleted: true } })
    return NextResponse.json({ success: true, message: 'Expense deleted' })
  } catch (err) {
    console.error('Delete expense error:', err)
    return NextResponse.json({ success: false, message: 'Failed to delete expense' }, { status: 500 })
  }
}
