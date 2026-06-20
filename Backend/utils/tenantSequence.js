// ===============================
// Per-tenant sequential numbering
// ===============================
// Global auto-increment ids (sales.id, customers.id, ...) are shared across all
// tenants, so they leak one tenant's volume into another's invoice/customer
// numbers. Each tenant should instead see its own sequence starting at 1.
//
// nextTenantNumber() returns the next number for a tenant. It MUST be called
// inside a transaction: it locks the tenant row (SELECT ... FOR UPDATE) so two
// concurrent inserts for the same tenant can't read the same MAX and collide.
// A UNIQUE(tenant_id, <column>) constraint is the final safety net.

// Whitelist of table -> per-tenant number column (never built from user input).
const SEQUENCE_COLUMNS = {
  sales: 'sale_number',
  customers: 'customer_number',
  purchase_orders: 'po_number',
};

async function nextTenantNumber(conn, table, tenantId) {
  const column = SEQUENCE_COLUMNS[table];
  if (!column) {
    throw new Error(`No per-tenant sequence configured for table: ${table}`);
  }

  // Serialize numbering for this tenant. Released on commit/rollback.
  await conn.query('SELECT id FROM tenants WHERE id = ? FOR UPDATE', [tenantId]);

  const [[row]] = await conn.query(
    `SELECT COALESCE(MAX(\`${column}\`), 0) + 1 AS next_no FROM \`${table}\` WHERE tenant_id = ?`,
    [tenantId]
  );
  return row.next_no;
}

module.exports = { nextTenantNumber };
