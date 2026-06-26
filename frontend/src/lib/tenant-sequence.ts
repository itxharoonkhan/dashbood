import prisma from './prisma'

export async function nextTenantNumber(
  table: 'sales' | 'customers' | 'purchase_orders',
  tenantId: number
): Promise<number> {
  if (table === 'sales') {
    const result = await prisma.$queryRaw<[{ max: number | null }]>`
      SELECT MAX(sale_number) AS max FROM sales WHERE tenant_id = ${tenantId}
    `
    return (Number(result[0].max) || 0) + 1
  } else if (table === 'customers') {
    const result = await prisma.$queryRaw<[{ max: number | null }]>`
      SELECT MAX(customer_number) AS max FROM customers WHERE tenant_id = ${tenantId}
    `
    return (Number(result[0].max) || 0) + 1
  } else {
    const result = await prisma.$queryRaw<[{ max: number | null }]>`
      SELECT MAX(po_number) AS max FROM purchase_orders WHERE tenant_id = ${tenantId}
    `
    return (Number(result[0].max) || 0) + 1
  }
}
