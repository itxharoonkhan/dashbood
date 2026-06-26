import { NextRequest, NextResponse } from 'next/server'
import prisma from '@/lib/prisma'
import { requireRole } from '@/lib/auth'
import { nextTenantNumber } from '@/lib/tenant-sequence'

export async function GET(req: NextRequest) {
  const auth = requireRole(req, ['admin', 'superadmin'])
  if (auth instanceof NextResponse) return auth
  const { user } = auth

  try {
    const rows = await prisma.$queryRaw<unknown[]>`
      SELECT s.*, c.name AS customer_name
      FROM sales s
      LEFT JOIN customers c ON s.customer_id = c.id
      WHERE s.tenant_id = ${user.tenant_id}
      ORDER BY s.id DESC
    `
    return NextResponse.json({ success: true, data: rows })
  } catch (err) {
    console.error('Sales list error:', err)
    return NextResponse.json({ success: false, message: 'Error fetching sales' }, { status: 500 })
  }
}

export async function POST(req: NextRequest) {
  const auth = requireRole(req, ['admin', 'cashier', 'superadmin'])
  if (auth instanceof NextResponse) return auth
  const { user } = auth

  let body: any
  try {
    body = await req.json()
  } catch {
    return NextResponse.json({ success: false, message: 'Invalid request body' }, { status: 400 })
  }

  const {
    customer_id: provided_id, items, discount = 0, payment_method, payments,
    amount_paid, cash_received, tax: frontendTax, customer_name, customer_phone,
    coupon_code, coupon_discount = 0, loyalty_points_redeem = 0
  } = body

  const isSplit = Array.isArray(payments) && payments.length >= 2
  const resolvedPaymentMethod = isSplit ? 'split' : payment_method

  if (!items || items.length === 0) {
    return NextResponse.json({ success: false, message: 'No items provided in cart' }, { status: 400 })
  }
  if (amount_paid === undefined || amount_paid === null || typeof amount_paid !== 'number') {
    return NextResponse.json({ success: false, message: 'Valid payment amount is required' }, { status: 400 })
  }

  try {
    const result = await prisma.$transaction(async (tx) => {
      // Find active shift
      const activeShift = await tx.shift.findFirst({
        where: { cashier_id: user.id, status: 'open', tenant_id: user.tenant_id! }
      })
      const shift_id = activeShift?.id || null

      let customer_id = provided_id || null

      // Auto-create/find customer by name+phone
      if (customer_name && !customer_id) {
        if (customer_phone) {
          const existing = await tx.customer.findFirst({
            where: { phone: customer_phone, tenant_id: user.tenant_id! }
          })
          if (existing) {
            customer_id = existing.id
            await tx.customer.update({ where: { id: existing.id }, data: { name: customer_name } })
          } else {
            const customer_number = await nextTenantNumber('customers', user.tenant_id!)
            const newCustomer = await tx.customer.create({
              data: { customer_number, name: customer_name, phone: customer_phone, tenant_id: user.tenant_id! }
            })
            customer_id = newCustomer.id
          }
        } else {
          const existing = await tx.customer.findFirst({
            where: { name: customer_name, phone: null, tenant_id: user.tenant_id! }
          })
          if (existing) {
            customer_id = existing.id
          } else {
            const customer_number = await nextTenantNumber('customers', user.tenant_id!)
            const newCustomer = await tx.customer.create({
              data: { customer_number, name: customer_name, tenant_id: user.tenant_id! }
            })
            customer_id = newCustomer.id
          }
        }
      }

      let subtotal = 0
      for (const item of items) subtotal += item.quantity * item.price

      const tax = frontendTax !== undefined ? frontendTax : 0
      const appliedCouponDiscount = parseFloat(coupon_discount) || 0
      const pointsToRedeem = parseInt(loyalty_points_redeem) || 0
      const final_total = amount_paid

      // Validate coupon
      let coupon_id = null
      if (coupon_code) {
        const coupon = await tx.coupon.findFirst({
          where: { code: coupon_code.trim().toUpperCase(), is_active: true, is_deleted: false, tenant_id: user.tenant_id! }
        })
        if (coupon) {
          const limitOk = coupon.usage_limit === null || coupon.used_count < coupon.usage_limit
          const notExpired = !coupon.expiry_date || new Date(coupon.expiry_date) >= new Date()
          if (limitOk && notExpired) coupon_id = coupon.id
        }
      }

      if (isSplit) {
        const splitSum = payments.reduce((s: number, p: { amount: string }) => s + (parseFloat(p.amount) || 0), 0)
        if (Math.abs(splitSum - amount_paid) > 0.01) {
          throw new Error(`Split payment sum (${splitSum}) does not match total (${amount_paid})`)
        }
      }

      const cashReceivedVal = (typeof cash_received === 'number' && cash_received > 0) ? cash_received : null
      const sale_number = await nextTenantNumber('sales', user.tenant_id!)

      const sale = await tx.sale.create({
        data: {
          sale_number,
          customer_id: customer_id || null,
          cashier_id: user.id,
          shift_id,
          total: subtotal,
          discount,
          tax,
          final_total,
          cash_received: cashReceivedVal,
          payment_method: resolvedPaymentMethod,
          coupon_id,
          coupon_discount: appliedCouponDiscount,
          loyalty_points_redeemed: pointsToRedeem,
          tenant_id: user.tenant_id!
        }
      })

      // Insert sale items + update stock
      for (const item of items) {
        const product = await tx.product.findFirst({
          where: { id: item.product_id, tenant_id: user.tenant_id! }
        })
        if (!product) throw new Error(`Product not found (ID: ${item.product_id})`)
        if (product.stock < item.quantity) throw new Error(`Insufficient stock for ${product.name}. Available: ${product.stock}`)

        await tx.saleItem.create({
          data: { sale_id: sale.id, product_id: item.product_id, quantity: item.quantity, price: item.price }
        })
        await tx.product.update({
          where: { id: item.product_id },
          data: { stock: { decrement: item.quantity } }
        })
      }

      // Split payments
      if (isSplit) {
        for (const p of payments) {
          await tx.salePayment.create({
            data: { sale_id: sale.id, method: p.method, amount: parseFloat(p.amount) || 0 }
          })
        }
      }

      // Coupon usage
      if (coupon_id && appliedCouponDiscount > 0) {
        await tx.couponUsage.create({ data: { coupon_id, sale_id: sale.id, discount: appliedCouponDiscount } })
        await tx.coupon.update({ where: { id: coupon_id }, data: { used_count: { increment: 1 } } })
      }

      // Loyalty redemption
      if (pointsToRedeem > 0 && customer_id) {
        const cust = await tx.customer.findUnique({ where: { id: customer_id } })
        if (!cust || cust.loyalty_points < pointsToRedeem) throw new Error('Insufficient loyalty points')
        const newBalance = cust.loyalty_points - pointsToRedeem
        await tx.customer.update({ where: { id: customer_id }, data: { loyalty_points: newBalance } })
        await tx.loyaltyTransaction.create({
          data: { customer_id, sale_id: sale.id, type: 'redeem', points: pointsToRedeem, balance_after: newBalance, note: `Redeemed at sale #${sale_number}` }
        })
      }

      return { sale, sale_number, final_total, customer_id }
    })

    // Loyalty earn (non-blocking, after commit)
    let points_earned = 0
    if (result.customer_id) {
      try {
        const loyaltySettings = await prisma.settings.findUnique({ where: { tenant_id: user.tenant_id! } })
        const rate = parseFloat(loyaltySettings?.loyalty_rate?.toString() || '100') || 100
        points_earned = Math.floor(result.final_total / rate)
        if (points_earned > 0) {
          const cust = await prisma.customer.findUnique({ where: { id: result.customer_id } })
          const newBal = (cust?.loyalty_points || 0) + points_earned
          await prisma.customer.update({ where: { id: result.customer_id }, data: { loyalty_points: newBal } })
          await prisma.loyaltyTransaction.create({
            data: { customer_id: result.customer_id, sale_id: result.sale.id, type: 'earn', points: points_earned, balance_after: newBal, note: `Earned from sale #${result.sale_number}` }
          })
        }
      } catch (loyaltyErr) {
        console.warn('Loyalty earn failed (non-critical):', loyaltyErr)
      }
    }

    return NextResponse.json({
      success: true,
      message: 'Sale completed successfully',
      sale_id: result.sale.id,
      sale_number: result.sale_number,
      final_total: result.final_total,
      change: 0,
      points_earned
    })
  } catch (err) {
    console.error('Sale error:', err)
    return NextResponse.json({ success: false, message: err instanceof Error ? err.message : 'Sale failed' }, { status: 400 })
  }
}
