import { NextRequest, NextResponse } from 'next/server'
import prisma from '@/lib/prisma'
import { requireRole } from '@/lib/auth'

export async function POST(req: NextRequest) {
  const auth = requireRole(req, ['admin', 'superadmin'])
  if (auth instanceof NextResponse) return auth
  const { user } = auth

  try {
    const formData = await req.formData()
    const file = formData.get('file') as File | null
    if (!file) return NextResponse.json({ success: false, message: 'No file uploaded' }, { status: 400 })

    const text = await file.text()
    const lines = text.split('\n').filter(l => l.trim())
    if (lines.length < 2) return NextResponse.json({ success: false, message: 'CSV file is empty or has no data rows' }, { status: 400 })

    // Parse CSV manually
    const headers = lines[0].split(',').map(h => h.trim().replace(/^﻿/, '').replace(/[^\x20-\x7E]/g, ''))
    const results: Record<string, string>[] = []
    for (let i = 1; i < lines.length; i++) {
      const values = lines[i].split(',')
      const row: Record<string, string> = {}
      headers.forEach((h, idx) => { row[h] = (values[idx] || '').trim() })
      results.push(row)
    }

    let importedCount = 0
    const errors: string[] = []

    for (const [index, row] of results.entries()) {
      try {
        const name = row.name || row.Name
        const category = row.category || row.Category
        const sku = row.sku || row.SKU
        const price = parseFloat(row.selling_price || row.price || row.Price || '0')
        const cost = parseFloat(row.cost_price || row.cost || row.Cost || '0')
        const stock = parseInt(row.stock || row.Stock || '0')
        const threshold = parseInt(row.threshold || row.Threshold || '5')
        const unit = row.unit_type || row.unit || 'pcs'

        if (!name) { errors.push(`Row ${index + 1}: Name is missing`); continue }

        if (sku) {
          const existing = await prisma.product.findFirst({ where: { sku, tenant_id: user.tenant_id! } })
          if (existing) { errors.push(`Row ${index + 1}: SKU ${sku} already exists`); continue }
        }

        await prisma.product.create({
          data: { name, category: category || null, sku: sku || null, selling_price: price, cost_price: cost, stock, threshold, unit_type: unit, tenant_id: user.tenant_id! }
        })
        importedCount++
      } catch (rowErr: unknown) {
        errors.push(`Row ${index + 1}: ${rowErr instanceof Error ? rowErr.message : 'Unknown error'}`)
      }
    }

    return NextResponse.json({
      success: true,
      message: `Successfully imported ${importedCount} products`,
      totalRows: results.length,
      errors: errors.length > 0 ? errors : null
    })
  } catch (err) {
    console.error('Bulk import error:', err)
    return NextResponse.json({ success: false, message: 'Internal server error during import' }, { status: 500 })
  }
}
