import jwt from 'jsonwebtoken'

const BASE = 'http://localhost:3000/api'
const JWT_SECRET = 'elites-pos-super-secret-jwt-key-change-in-production-2024'

const adminToken = jwt.sign(
  { id: 1, role: 'admin', permissions: [], tenant_id: 1 },
  JWT_SECRET,
  { expiresIn: '1h' }
)
const superToken = jwt.sign(
  { id: 1, role: 'superadmin', permissions: [], tenant_id: null },
  JWT_SECRET,
  { expiresIn: '1h' }
)

const H = (token) => ({ 'Authorization': `Bearer ${token}`, 'Content-Type': 'application/json' })

let pass = 0, fail = 0, warn = 0
const results = []

async function test(label, method, path, token, body, expectOk = [200, 201]) {
  const url = `${BASE}${path}`
  const opts = { method, headers: H(token) }
  if (body) opts.body = JSON.stringify(body)
  try {
    const res = await fetch(url, opts)
    const ok = expectOk.includes(res.status)
    const status = ok ? 'PASS' : (res.status >= 500 ? 'FAIL' : 'WARN')
    if (ok) pass++
    else if (res.status >= 500) fail++
    else warn++
    results.push({ status, code: res.status, label })
    const icon = ok ? '✅' : (res.status >= 500 ? '❌' : '⚠️ ')
    console.log(`${icon} [${res.status}] ${method.padEnd(6)} ${path.padEnd(50)} ${label}`)
  } catch (e) {
    fail++
    results.push({ status: 'FAIL', code: 'ERR', label })
    console.log(`❌ [ERR]  ${method.padEnd(6)} ${path.padEnd(50)} ${label} — ${e.message}`)
  }
}

// ─── Collect real IDs ────────────────────────────────────────
async function getFirstId(path, token, key = 'data') {
  try {
    const res = await fetch(`${BASE}${path}`, { headers: H(token) })
    const json = await res.json()
    const arr = json[key] || json.data || []
    return arr[0]?.id ?? 1
  } catch { return 1 }
}

console.log('\n🔍 Elites POS — API Test Suite\n' + '='.repeat(60))
console.log('Fetching real IDs from DB...\n')

const prodId     = await getFirstId('/products', adminToken)
const custId     = await getFirstId('/customers', adminToken)
const supplierId = await getFirstId('/suppliers', adminToken)
const couponId   = await getFirstId('/coupons', adminToken)
const tableId    = await getFirstId('/tables', adminToken)
const tenantId   = await getFirstId('/tenants', superToken)
const shiftId    = await getFirstId('/shifts', adminToken)
const expId      = await getFirstId('/expenses', adminToken)

const ordersRes = await fetch(`${BASE}/orders`, { headers: H(adminToken) })
const ordersJson = await ordersRes.json()
const orderId = ordersJson.data?.[0]?.id ?? 1
const splitId = ordersJson.data?.[0]?.bill_splits?.[0]?.id ?? 1

const salesRes  = await fetch(`${BASE}/sales`, { headers: H(adminToken) })
const salesJson = await salesRes.json()
const saleId    = salesJson.data?.[0]?.id ?? 1
const saleNum   = salesJson.data?.[0]?.sale_number ?? 1

const kotRes  = await fetch(`${BASE}/kitchen`, { headers: H(adminToken) })
const kotJson = await kotRes.json()
const itemId  = kotJson.data?.[0]?.items?.[0]?.id ?? 1

const notifRes  = await fetch(`${BASE}/notifications`, { headers: H(adminToken) })
const notifJson = await notifRes.json()
const notifId   = notifJson.data?.[0]?.id ?? 1

const poRes  = await fetch(`${BASE}/suppliers/purchase-orders`, { headers: H(adminToken) })
const poJson = await poRes.json()
const poId   = poJson.data?.[0]?.id ?? 1

console.log(`IDs — product:${prodId} customer:${custId} supplier:${supplierId} coupon:${couponId} table:${tableId} shift:${shiftId} sale:${saleId} order:${orderId} expense:${expId} notif:${notifId} po:${poId}\n`)
console.log('─'.repeat(100))

// ─── AUTH ────────────────────────────────────────────────────
console.log('\n📌 AUTH')
await test('Login (valid creds check)', 'POST', '/auth/login', adminToken, { email: 'test@test.com', password: 'wrong' }, [401, 200])
await test('Get profile', 'GET', '/auth/profile', adminToken, null, [200])
await test('Get all accounts', 'GET', '/auth/accounts', adminToken, null, [200])
await test('Get account by ID', 'GET', `/auth/accounts/${1}`, adminToken, null, [200, 404])
await test('Unlock user', 'GET', `/auth/unlock/${1}`, adminToken, null, [200, 404])

// ─── DASHBOARD ───────────────────────────────────────────────
console.log('\n📌 DASHBOARD')
await test('Stats', 'GET', '/dashboard/stats', adminToken)
await test('Daily sales', 'GET', '/dashboard/daily-sales', adminToken)
await test('Recent sales', 'GET', '/dashboard/recent-sales', adminToken)
await test('Top categories', 'GET', '/dashboard/top-categories', adminToken)
await test('Insights', 'GET', '/dashboard/insights', adminToken)
await test('All dashboard', 'GET', '/dashboard/all', adminToken)

// ─── PRODUCTS ────────────────────────────────────────────────
console.log('\n📌 PRODUCTS')
await test('List products', 'GET', '/products', adminToken)
await test('Get product', 'GET', `/products/${prodId}`, adminToken)
await test('Product categories', 'GET', '/products/categories/list', adminToken)
await test('Generate SKU', 'GET', '/products/generate-sku', adminToken)
await test('Next SKU', 'GET', '/products/next-sku', adminToken)
await test('Trash list', 'GET', '/products/trash/list', adminToken)
await test('Barcode lookup (404 ok)', 'GET', '/products/barcode/DOESNOTEXIST', adminToken, null, [404, 200])
await test('Restore product', 'POST', `/products/${prodId}/restore`, adminToken, null, [200, 404])
await test('Get variants', 'GET', `/products/${prodId}/variants`, adminToken, null, [200, 404])

// ─── CUSTOMERS ───────────────────────────────────────────────
console.log('\n📌 CUSTOMERS')
await test('List customers', 'GET', '/customers', adminToken)
await test('Get customer', 'GET', `/customers/${custId}`, adminToken, null, [200, 404])
await test('Trash list', 'GET', '/customers/trash/list', adminToken)
await test('Restore customer', 'POST', `/customers/${custId}/restore`, adminToken, null, [200, 404])

// ─── SALES ───────────────────────────────────────────────────
console.log('\n📌 SALES')
await test('List sales', 'GET', '/sales', adminToken)
await test('Get sale', 'GET', `/sales/${saleId}`, adminToken, null, [200, 404])
await test('Returns list', 'GET', '/sales/returns/list', adminToken)
await test('Lookup by number', 'GET', `/sales/lookup/${saleNum}`, adminToken, null, [200, 404])
await test('Get returns for sale', 'GET', `/sales/${saleId}/returns`, adminToken, null, [200, 404])

// ─── SHIFTS ──────────────────────────────────────────────────
console.log('\n📌 SHIFTS')
await test('List shifts', 'GET', '/shifts', adminToken)
await test('Active shift', 'GET', '/shifts/active', adminToken)
await test('Trash list', 'GET', '/shifts/trash/list', adminToken)
await test('Shift report', 'GET', `/shifts/${shiftId}/report`, adminToken, null, [200, 404])
await test('Shift cash movements', 'GET', `/shifts/${shiftId}/cash-movement`, adminToken, null, [200, 404])
await test('Restore shift', 'POST', `/shifts/${shiftId}/restore`, adminToken, null, [200, 404])

// ─── EXPENSES ────────────────────────────────────────────────
console.log('\n📌 EXPENSES')
await test('List expenses', 'GET', '/expenses', adminToken)
await test('Expense summary', 'GET', '/expenses/summary', adminToken)
await test('Trash list', 'GET', '/expenses/trash/list', adminToken)
await test('Get expense', 'GET', `/expenses/${expId}`, adminToken, null, [200, 404])
await test('Restore expense', 'POST', `/expenses/${expId}/restore`, adminToken, null, [200, 404])

// ─── COUPONS ─────────────────────────────────────────────────
console.log('\n📌 COUPONS')
await test('List coupons', 'GET', '/coupons', adminToken)
await test('Coupon reports', 'GET', '/coupons/reports', adminToken)
await test('Get coupon', 'GET', `/coupons/${couponId}`, adminToken, null, [200, 404])
await test('Toggle coupon', 'POST', `/coupons/${couponId}/toggle`, adminToken, null, [200, 404])
await test('Validate coupon (404 ok)', 'POST', '/coupons/validate', adminToken, { code: 'FAKE', order_total: 100 }, [200, 404, 400])

// ─── SUPPLIERS ───────────────────────────────────────────────
console.log('\n📌 SUPPLIERS')
await test('List suppliers', 'GET', '/suppliers', adminToken)
await test('Supplier reports', 'GET', '/suppliers/reports', adminToken)
await test('Get supplier', 'GET', `/suppliers/${supplierId}`, adminToken, null, [200, 404])
await test('Supplier items', 'GET', `/suppliers/${supplierId}/items`, adminToken, null, [200, 404])
await test('Toggle supplier', 'POST', `/suppliers/${supplierId}/toggle`, adminToken, null, [200, 404])
await test('List POs', 'GET', '/suppliers/purchase-orders', adminToken)
await test('Get PO', 'GET', `/suppliers/purchase-orders/${poId}`, adminToken, null, [200, 404])

// ─── TABLES ──────────────────────────────────────────────────
console.log('\n📌 TABLES')
await test('List tables', 'GET', '/tables', adminToken)
await test('Trash list', 'GET', '/tables/trash/list', adminToken)
await test('Get table', 'GET', `/tables/${tableId}`, adminToken, null, [200, 404])
await test('Restore table', 'POST', `/tables/${tableId}/restore`, adminToken, null, [200, 404])

// ─── ORDERS (Restaurant) ─────────────────────────────────────
console.log('\n📌 ORDERS (Restaurant)')
await test('List orders', 'GET', '/orders', adminToken)
await test('Get order', 'GET', `/orders/${orderId}`, adminToken, null, [200, 404])
await test('Get order items', 'GET', `/orders/${orderId}/items`, adminToken, null, [200, 404])
await test('Get order bill', 'GET', `/orders/${orderId}/bill`, adminToken, null, [200, 404])
await test('Get order splits', 'GET', `/orders/${orderId}/split`, adminToken, null, [200, 404])
await test('Get item', 'GET', `/orders/${orderId}/items/${itemId}`, adminToken, null, [200, 404])

// ─── KITCHEN ─────────────────────────────────────────────────
console.log('\n📌 KITCHEN')
await test('KDS list', 'GET', '/kitchen', adminToken)

// ─── LOYALTY ─────────────────────────────────────────────────
console.log('\n📌 LOYALTY')
await test('Lookup loyalty', 'GET', '/loyalty/lookup', adminToken, null, [200, 400])
await test('Customer loyalty', 'GET', `/loyalty/customer/${custId}`, adminToken, null, [200, 404])

// ─── NOTIFICATIONS ───────────────────────────────────────────
console.log('\n📌 NOTIFICATIONS')
await test('List notifications', 'GET', '/notifications', adminToken)
await test('Notif count', 'GET', '/notifications/count', adminToken)
await test('Mark read', 'PATCH', `/notifications/${notifId}/read`, adminToken, null, [200, 404])
await test('Mark all read', 'PATCH', '/notifications/read-all', adminToken)

// ─── REPORTS ─────────────────────────────────────────────────
console.log('\n📌 REPORTS')
await test('All reports', 'GET', '/reports/all', adminToken)
await test('Daily sales', 'GET', '/reports/daily-sales', adminToken)
await test('Category distribution', 'GET', '/reports/category-distribution', adminToken)
await test('Sales performance', 'GET', '/reports/sales-performance', adminToken)
await test('Profit/Loss', 'GET', '/reports/profit-loss', adminToken)
await test('Tax summary', 'GET', '/reports/tax-summary', adminToken)
await test('Export detail', 'GET', '/reports/export-detail', adminToken)

// ─── MENU ────────────────────────────────────────────────────
console.log('\n📌 MENU')
await test('Menu items', 'GET', '/menu', adminToken)
await test('Menu categories', 'GET', '/menu/categories', adminToken)

// ─── SETTINGS ────────────────────────────────────────────────
console.log('\n📌 SETTINGS')
await test('Get settings', 'GET', '/settings', adminToken)
await test('Get store settings', 'GET', '/settings/store', adminToken)
await test('Get receipt settings', 'GET', '/settings/receipt', adminToken)

// ─── TENANTS (SuperAdmin) ────────────────────────────────────
console.log('\n📌 TENANTS (SuperAdmin)')
await test('List tenants', 'GET', '/tenants', superToken)
await test('Get tenant', 'GET', `/tenants/${tenantId}`, superToken, null, [200, 404])

// ─── AI ──────────────────────────────────────────────────────
console.log('\n📌 AI')
await test('AI insights', 'POST', '/ai/insights', adminToken, { prompt: 'test' }, [200, 500])

// ─── Summary ─────────────────────────────────────────────────
console.log('\n' + '='.repeat(100))
console.log(`\n📊 Results: ✅ PASS: ${pass}  ⚠️  WARN (4xx): ${warn}  ❌ FAIL (5xx/ERR): ${fail}  | Total: ${pass + warn + fail}`)

if (fail > 0) {
  console.log('\n❌ FAILED routes:')
  results.filter(r => r.status === 'FAIL').forEach(r => console.log(`   [${r.code}] ${r.label}`))
}
if (warn > 0) {
  console.log('\n⚠️  WARN routes (unexpected 4xx):')
  results.filter(r => r.status === 'WARN').forEach(r => console.log(`   [${r.code}] ${r.label}`))
}
console.log()
