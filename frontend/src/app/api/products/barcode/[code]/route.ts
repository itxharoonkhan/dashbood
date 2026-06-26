import { NextRequest, NextResponse } from 'next/server'
import prisma from '@/lib/prisma'
import { requireRole } from '@/lib/auth'

export async function GET(req: NextRequest, { params }: { params: Promise<{ code: string }> }) {
  const auth = requireRole(req, ['admin', 'cashier', 'superadmin'])
  if (auth instanceof NextResponse) return auth
  const { user } = auth
  const { code } = await params

  try {
    const product = await prisma.product.findFirst({
      where: {
        OR: [{ barcode: code }, { sku: code }],
        tenant_id: user.tenant_id!,
        is_deleted: false,
      }
    })
    if (!product) return NextResponse.json({ success: false, message: 'Product not found with this barcode' }, { status: 404 })
    return NextResponse.json({ success: true, data: product })
  } catch (err) {
    console.error('Barcode lookup error:', err)
    return NextResponse.json({ success: false, message: 'Error fetching product by barcode' }, { status: 500 })
  }
}
