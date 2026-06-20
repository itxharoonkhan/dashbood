# Elites POS System — Project Guide

Is document mein Elites POS System ki mukammal technical documentation di gayi hai. Har module, route, aur component ka maqsad aur kaam yahan clearly explain kiya gaya hai.

---

## Table of Contents

1. [Project Overview](#1-project-overview)
2. [Folder Structure](#2-folder-structure)
3. [Backend — Architecture & Implementation](#3-backend--architecture--implementation)
4. [Frontend — Architecture & Implementation](#4-frontend--architecture--implementation)
5. [Database Tables](#5-database-tables)
6. [Environment Variables](#6-environment-variables)
7. [Pages & Routes](#7-pages--routes)
8. [Default Login](#8-default-login)
9. [Implemented Features Summary](#9-implemented-features-summary)
10. [Deployment Notes](#10-deployment-notes)

---

## 1. Project Overview

Elites POS ek **full-stack, multi-tenant Point of Sale system** hai jo **retail shops aur restaurants** dono ke liye design kiya gaya hai.

- **Retail Mode** — Counter-based sales: barcode scan, cart management, checkout
- **Restaurant Mode** — Table management, KOT printing, kitchen display, bill splitting

| Layer     | Technology              | Port |
|-----------|-------------------------|------|
| Frontend  | Next.js 15 + React 19   | 9002 |
| Backend   | Node.js + Express.js    | 5001 |
| Database  | MySQL                   | 3306 |
| AI        | Google Gemini (Genkit)  | —    |

### Multi-Tenant Architecture

System **multi-tenant** hai — ek hi deployment (ek database + ek backend) par kai alag dukanein (**tenants**) chalti hain. Har tenant ka data `tenant_id` column se **bilkul isolated** hota hai; ek tenant ka data dusre ko kabhi nahi dikhta.

- Tenant **subdomain se nahi**, balki **login (JWT)** se identify hota hai — har user ke JWT token mein uska `tenant_id` hota hai.
- Har tenant-scoped query `WHERE tenant_id = ?` se filter hoti hai.
- Naya client onboard karna = SuperAdmin ek tenant bana deta hai (`POST /api/tenants`). Koi server change nahi.
- `tenants` table har dukan ka record rakhta hai (name, slug, plan, status).

**User Roles:**

| Role        | tenant_id | Access Level                                                        |
|-------------|-----------|---------------------------------------------------------------------|
| SuperAdmin  | NULL      | Platform owner — tenants (dukanein) create/manage karta hai          |
| Admin       | apne tenant ka | Full access apni dukan ke andar — settings, reports, users, all data |
| Cashier     | apne tenant ka | Sales, shifts, inventory view only (apni dukan ke andar)             |

---

## 2. Folder Structure

```
pos-system/
├── Backend/                   ← Express.js REST API server
│   ├── index.js               ← Server entry point, middleware registration
│   ├── db.js                  ← MySQL connection pool
│   ├── schema.sql             ← Base database schema
│   ├── schema_tenant_migration.sql            ← Multi-tenant migration (tenants + tenant_id + superadmin)
│   ├── schema_tenant_numbering_migration.sql  ← Per-tenant invoice/numbering sequences
│   ├── schema_softdelete_migration.sql        ← Soft-delete columns
│   ├── schema_po_numbering_migration.sql      ← Purchase order numbering
│   ├── schema_image_longtext_migration.sql    ← Product image LONGTEXT
│   ├── nodemon.json           ← Development server configuration
│   ├── middleware/
│   │   ├── authMiddleware.js      ← JWT token verification (sets req.user.tenant_id)
│   │   ├── roleMiddleware.js      ← Role-based access control
│   │   ├── superAdminMiddleware.js ← SuperAdmin-only route guard (tenants management)
│   │   ├── apiKeyMiddleware.js    ← API-key auth for cron jobs (no JWT)
│   │   └── errorMiddleware.js     ← Global error handler
│   ├── utils/
│   │   └── tenantSequence.js  ← Per-tenant sequential numbers (invoice, customer, PO)
│   ├── uploads/               ← Receipt logo storage (PNG/JPG/WEBP)
│   └── routes/
│       ├── auth.js            ← Authentication (login, account creation)
│       ├── tenants.js         ← Tenant (shop) management — SuperAdmin only
│       ├── products.js        ← Inventory management
│       ├── sales.js           ← POS transactions
│       ├── dashboard.js       ← Analytics & summary data
│       ├── customers.js       ← Customer database
│       ├── reports.js         ← Business reports (admin only)
│       ├── settings.js        ← Store configuration + receipt customization
│       ├── menu.js            ← Cashier-facing product catalog
│       ├── shifts.js          ← Cashier shift management
│       ├── coupons.js         ← Discount code management
│       ├── loyalty.js         ← Loyalty points system
│       ├── suppliers.js       ← Vendor & purchase order management
│       ├── notifications.js   ← System alerts (low stock, etc.)
│       ├── tables.js          ← Restaurant table management
│       ├── orders.js          ← Restaurant orders & KOT system
│       ├── kitchen.js         ← Kitchen display & KOT queue
│       └── expenses.js        ← Business expense tracking
│
└── frontend/                  ← Next.js 15 application
    └── src/
        ├── ai/                ← AI integration (Genkit + Gemini)
        ├── app/               ← Pages & Next.js API routes
        │   ├── dashboard/     ← Stats, charts, AI insights
        │   ├── sales/         ← POS terminal
        │   ├── inventory/     ← Product management
        │   ├── customers/     ← Customer records
        │   ├── reports/       ← Business reports
        │   │   ├── coupons/   ← Coupon usage report
        │   │   └── return-history/ ← Refund history
        │   ├── settings/      ← Store configuration
        │   ├── receipt-settings/ ← Receipt customization
        │   ├── shifts/        ← Shift management
        │   ├── coupons/       ← Discount code management
        │   ├── suppliers/     ← Vendor management
        │   ├── tables/        ← Restaurant floor plan & orders
        │   ├── kitchen/       ← Kitchen display (KOT queue)
        │   ├── expenses/      ← Expense tracking
        │   ├── superadmin/    ← Tenant management dashboard (SuperAdmin only)
        │   ├── login/         ← Authentication
        │   └── signup/        ← Account registration
        ├── components/        ← Reusable UI components
        ├── contexts/          ← Global state (auth, theme, language)
        ├── hooks/             ← Custom React hooks
        └── lib/               ← Utilities, API client, TypeScript types
```

---

## 3. Backend — Architecture & Implementation

### `index.js` — Server Entry Point

- Port **5001** par server initialize hota hai
- CORS configuration frontend origin ke liye
- Rate limiting:
  - General API: **500 requests / 15 minutes**
  - Auth endpoints: **50 requests / 15 minutes** (brute-force protection)
- File upload limit: **10MB**
- Tamam route modules yahan register hote hain
- Graceful shutdown support

---

### `db.js` — Database Connection

- MySQL ke saath **connection pool** (max 10 connections)
- Promise-based async/await API
- Server startup par connection verification
- Connection failure par descriptive error logging

---

### Middleware

| File | Responsibility |
|------|----------------|
| `authMiddleware.js` | JWT token verify karta hai — `Authorization: Bearer <token>` format required. Invalid/expired token par `401` return hota hai. Valid token se `req.user` populate hota hai — **`id`, `role`, `tenant_id`, `permissions`** (superadmin ke liye `tenant_id` NULL). |
| `roleMiddleware.js` | Admin-only routes ko cashier access se protect karta hai |
| `superAdminMiddleware.js` | Sirf **superadmin** ke liye routes guard karta hai (tenants management). Baaki roles ko `403`. |
| `apiKeyMiddleware.js` | Cron/scheduled jobs ke liye — JWT ke bajaye `x-api-key` header (`CRON_API_KEY`) verify karta hai. Loyalty expiry jaise tasks ke liye. |
| `errorMiddleware.js` | Saare unhandled errors catch karta hai, consistent error response format return karta hai. Production mein stack trace hide hoti hai. |

> **Tenant scoping:** Har tenant-scoped route (`products`, `sales`, `customers`, `settings`, `shifts`, `coupons`, `suppliers`, `tables`, `orders`, `expenses`, etc.) apni queries mein `req.user.tenant_id` use karta hai — taake har user ko sirf apni dukan ka data mile.

---

### API Routes

#### `auth.js` — Authentication

| Endpoint | Description |
|----------|-------------|
| `POST /api/auth/login` | Credentials verify karo, JWT token return karo (**token mein `tenant_id` embed hota hai**) |
| `POST /api/auth/create-cashier` | Admin ke liye naya cashier account create karna (**caller ke `tenant_id` se auto-link**) |
| `GET /api/auth/accounts` | User accounts list (admin → sirf apne tenant ke; superadmin → sab) |
| `PUT /api/auth/unlock/:id` | Locked account unlock karna (admin only, tenant-scoped) |
| `DELETE /api/auth/accounts/:id` | User account delete karna (admin only, tenant-scoped) |
| `GET /api/auth/profile` | Current logged-in user ka profile (`tenant_id` included) |

- Passwords **bcrypt** ke saath hash hote hain
- Failed login attempts track hote hain — **3 attempts ke baad 30-minute lockout**
- Login par tenant ka **status** check hota hai — agar tenant `suspended`/`inactive` ho to login block (superadmin exempt)
- Jo bhi naya user banta hai woh **automatically caller ke `tenant_id`** se juda hota hai

---

#### `tenants.js` — Tenant (Shop) Management *(SuperAdmin Only)*

| Endpoint | Description |
|----------|-------------|
| `GET /api/tenants` | Tamam tenants list (user count, sales count, revenue ke saath) |
| `GET /api/tenants/:id` | Single tenant detail |
| `POST /api/tenants` | Naya tenant create karna — saath hi uska **settings row + admin user** bhi banta hai |
| `PUT /api/tenants/:id` | Tenant update (name, status, plan) |
| `DELETE /api/tenants/:id` | Tenant suspend karna (soft — `status = 'suspended'`; tenant 1 delete nahi hota) |

- Sab endpoints `superAdminMiddleware` se protected
- `POST` ek transaction mein: tenant + uski default settings (currency PKR, tax, mode) + admin user create karta hai
- Naya client onboard karne ka **single point** — server par koi manual kaam nahi

---

#### `products.js` — Inventory Management

| Endpoint | Description |
|----------|-------------|
| `GET /api/products` | Tamam products retrieve karna (category filter supported) |
| `GET /api/products/:id` | Single product detail |
| `POST /api/products` | Naya product create karna |
| `PUT /api/products/:id` | Product details update karna |
| `DELETE /api/products/:id` | Product remove karna |
| `POST /api/products/bulk-import` | CSV file se bulk import |
| `GET /api/products/barcode/:code` | Barcode se product lookup (POS scanner use) |
| `GET /api/products/categories/list` | Distinct categories ki list |
| `GET /api/products/next-sku` | Next available SKU number |
| `GET /api/products/generate-sku` | Category-based SKU auto-generate |
| `GET /api/products/:id/variants` | Product ke variants retrieve karna |
| `POST /api/products/:id/variants` | Product ke variants save/replace karna |

- Negative stock prevention
- SKU auto-generation (category prefix + sequence number)
- Barcode field support
- Product variants (size, color) ke saath alag stock tracking

---

#### `sales.js` — POS Transactions

| Endpoint | Description |
|----------|-------------|
| `POST /api/sales` | Naya sale process karna |
| `GET /api/sales` | Sales history retrieve karna (admin only) |
| `GET /api/sales/:id` | Single transaction detail |
| `GET /api/sales/returns/list` | Tamam returns ki list (admin only) |
| `GET /api/sales/:id/returns` | Specific sale ke returns |
| `POST /api/sales/:id/return` | Return process karna (stock restore + points reverse) |
| `PUT /api/sales/:id/cancel` | Sale cancel karna (admin only) |

- Payment methods: **Cash, Card, UPI** (split payment supported)
- Coupon code validation aur application
- Loyalty points earn/redeem (sales transaction ke andar hi hota hai)
- Tax calculation
- Stock auto-decrement on sale

---

#### `dashboard.js` — Analytics

| Endpoint | Description |
|----------|-------------|
| `GET /api/dashboard/all` | Today revenue, week revenue, month revenue, sales count, low stock — ek hi call mein |
| `GET /api/dashboard/stats` | Stats only (today / week / month revenue) |
| `GET /api/dashboard/recent-sales` | Today ki recent sales feed |
| `GET /api/dashboard/top-categories` | Top 5 categories by revenue |
| `GET /api/dashboard/daily-sales` | Last 7 days ka daily breakdown |

- `weekRevenue` aur `monthRevenue` dashboard stats cards mein display hote hain
- Top-selling categories (donut chart)
- Recent sales feed (split payment format mein)

---

#### `customers.js` — Customer Management

| Endpoint | Description |
|----------|-------------|
| `GET /api/customers` | Tamam customer records |
| `GET /api/customers/:id` | Single customer detail |
| `POST /api/customers` | Naya customer register karna |
| `PUT /api/customers/:id` | Customer details update karna (admin only) |
| `DELETE /api/customers/:id` | Customer record remove karna (admin only) |

---

#### `reports.js` — Business Reports *(Admin Only)*

| Endpoint | Description |
|----------|-------------|
| `GET /api/reports/all` | Tamam report data ek hi call mein |
| `GET /api/reports/sales-performance` | Sales overview — today / week / month / year |
| `GET /api/reports/category-distribution` | Revenue by category |
| `GET /api/reports/profit-loss` | Profit & loss analysis |
| `GET /api/reports/tax-summary` | Tax collected ka summary |
| `GET /api/reports/daily-sales` | Daily sales breakdown |
| `GET /api/reports/export-detail` | Detailed export data (PDF/Excel ke liye) |

- PDF aur Excel export support

---

#### `settings.js` — Store Configuration

| Endpoint | Description |
|----------|-------------|
| `GET /api/settings` | Store settings fetch karna |
| `PUT /api/settings` | Settings update karna |
| `GET /api/settings/receipt` | Receipt customization settings |
| `PUT /api/settings/receipt` | Receipt settings update karna |
| `POST /api/settings/receipt/logo` | Logo upload karna (PNG/JPG/WEBP, max 2MB) |
| `DELETE /api/settings/receipt/logo` | Logo remove karna |

- Store name, address, phone, email
- Tax rate, currency symbol
- Low stock alert threshold
- Dark/Light theme preference
- Mode toggle: **Retail** ya **Restaurant**
- Receipt: logo, custom footer, tax line toggle, donation line toggle

---

#### `menu.js` — Cashier Product Catalog

| Endpoint | Description |
|----------|-------------|
| `GET /api/menu` | POS ke liye optimized product list (variants + stock included) |

- Name ya SKU se search
- Category filter

---

#### `shifts.js` — Cashier Shift Management

| Endpoint | Description |
|----------|-------------|
| `GET /api/shifts/active` | Current active shift check |
| `GET /api/shifts` | Tamam shifts history (admin only) |
| `POST /api/shifts/open` | Shift start (opening cash amount record) |
| `PUT /api/shifts/close` | Shift close (closing balance verify) |
| `POST /api/shifts/:id/cash-movement` | Mid-shift cash in/out record |
| `GET /api/shifts/:id/report` | Specific shift ka detailed report |
| `DELETE /api/shifts/:id` | Shift record delete karna (admin only) |

- Shift summary: total sales, refunds, cash variance
- History filters: cashier name, date range, status

---

#### `coupons.js` — Discount Codes

| Endpoint | Description |
|----------|-------------|
| `GET /api/coupons` | Tamam coupons list |
| `POST /api/coupons` | Naya coupon create karna (admin) |
| `PUT /api/coupons/:id` | Coupon update karna |
| `DELETE /api/coupons/:id` | Coupon delete karna |
| `POST /api/coupons/validate` | Code validate karna (POS checkout mein use) |
| `PATCH /api/coupons/:id/toggle` | Active/inactive status toggle |

- Types: **Flat** (fixed amount) ya **Percentage**
- Expiry date aur usage limit support

---

#### `loyalty.js` — Loyalty Points

| Endpoint | Description |
|----------|-------------|
| `GET /api/loyalty/lookup` | Phone number se customer ke points check karna (query param: `?phone=`) |
| `GET /api/loyalty/customer/:customer_id` | Customer ID se points history |
| `POST /api/loyalty/expire` | 12-month inactive customers ke points expire karna (scheduled cron task — **`x-api-key` header se protected**, JWT nahi) |

> **Note:** Points earn aur redeem `sales.js` transaction ke andar hote hain — alag /earn ya /redeem endpoints nahi hain.

- Earn rate: **PKR 100 = 1 point**
- Minimum redeem threshold: **100 points**
- Maximum discount via points: **30%**
- Return pe points automatically reverse hote hain

---

#### `suppliers.js` — Vendor Management

| Endpoint | Description |
|----------|-------------|
| `GET /api/suppliers` | Tamam suppliers list |
| `POST /api/suppliers` | Naya supplier add karna |
| `PUT /api/suppliers/:id` | Supplier details update karna |
| `DELETE /api/suppliers/:id` | Supplier remove karna |
| `GET /api/suppliers/:id/orders` | Supplier ke purchase orders |
| `POST /api/suppliers/:id/orders` | Naya purchase order create karna |

---

#### `notifications.js` — System Alerts

| Endpoint | Description |
|----------|-------------|
| `GET /api/notifications` | Tamam notifications retrieve karna |
| `GET /api/notifications/count` | Unread notifications ka count (bell icon ke liye) |
| `PATCH /api/notifications/:id/read` | Single notification mark as read |
| `PATCH /api/notifications/read-all` | Tamam notifications mark as read |

- Low stock threshold cross hone par automatic alert generate hoti hai
- Header mein bell icon unread count display karta hai

---

#### `tables.js` — Restaurant Table Management

| Endpoint | Description |
|----------|-------------|
| `GET /api/tables` | Floor plan ke saath tamam tables |
| `POST /api/tables` | Naya table add karna (admin) |
| `DELETE /api/tables/:id` | Table remove karna (admin) |
| `PATCH /api/tables/:id/status` | Table status update karna |

- Table statuses: **Available** (green), **Occupied** (red), **Bill Printed** (orange), **Split** (purple)
- Tables sections mein organize hoti hain (e.g. Main Hall, VIP)

---

#### `orders.js` — Restaurant Orders & KOT

| Endpoint | Description |
|----------|-------------|
| `GET /api/orders` | Orders list (filters: table, status) |
| `GET /api/orders/:id` | Single order detail (items, KOTs, splits) |
| `POST /api/orders` | Naya order open karna |
| `PUT /api/orders/:id` | Order notes / guest count update karna |
| `POST /api/orders/:id/items` | Order mein items add karna |
| `PATCH /api/orders/:id/items/:itemId` | Single item update ya void karna |
| `POST /api/orders/:id/kot` | KOT slip generate aur print karna |
| `POST /api/orders/:id/bill` | Customer bill print karna |
| `PUT /api/orders/:id/complete` | Payment complete + sales table mein record |
| `POST /api/orders/:id/split` | Bill split create karna |
| `PUT /api/orders/:id/split/:splitId/pay` | Split portion mark as paid |
| `PUT /api/orders/:id/reopen` | Bill print ke baad order reopen karna |
| `PUT /api/orders/:id/cancel` | Order cancel karna |

- Waiter name aur guest count per order track hota hai
- KOT number auto-increment
- Payment complete hone par `sales` table mein record automatically create hota hai — dashboard aur reports mein reflect hota hai

---

#### `kitchen.js` — Kitchen Display

| Endpoint | Description |
|----------|-------------|
| `GET /api/kitchen/kots` | Pending KOTs ki list |
| `PUT /api/kitchen/kots/:id/status` | KOT status update (pending → done) |
| `PUT /api/kitchen/items/:itemId/status` | Single item status update |

- Kitchen screen par pending orders real-time display hoti hain

---

#### `expenses.js` — Expense Tracking

| Endpoint | Description |
|----------|-------------|
| `GET /api/expenses` | Tamam business expenses |
| `GET /api/expenses/summary` | Category aur month-wise expense breakdown |
| `POST /api/expenses` | Naya expense record karna |
| `PUT /api/expenses/:id` | Expense update karna |
| `DELETE /api/expenses/:id` | Expense delete karna |

- Rent, utilities, salary, etc. categorized tracking
- Profit reports mein expenses automatically factor in hote hain

---

## 4. Frontend — Architecture & Implementation

### `ai/` — AI Integration

| File | Description |
|------|-------------|
| `genkit.ts` | Google Gemini (**Gemini 2.0 Flash**) ko Genkit framework ke saath initialize karta hai |
| `flows/daily-sales-insights-summary.ts` | Sales data input leta hai, Gemini se human-readable daily insight generate karta hai |

---

### `hooks/` — Custom React Hooks

| Hook | Description |
|------|-------------|
| `use-mobile.ts` | Screen width monitor karta hai (breakpoint: 768px) — sidebar responsive behavior ke liye |
| `use-toast.ts` | Toast notification system — ek waqt mein ek toast, 3 seconds auto-dismiss |

---

l

### `contexts/` — Global State Management

| Context | Description |
|---------|-------------|
| `auth-context.tsx` | Login state manage karta hai — token localStorage mein, protected route enforcement |
| `language-context.tsx` | English/Urdu toggle — `t("key")` function se translations, Urdu mein RTL direction |
| `theme-context.tsx` | Dark/Light mode — localStorage persist, system preference detection |

---

### `components/` — UI Component Library

#### `ui/` — Base Components *(shadcn/ui + Radix UI)*

| Component | Description |
|-----------|-------------|
| `button.tsx` | Primary, outline, ghost, destructive variants |
| `input.tsx` | Text/number inputs — 12-digit global limit enforced |
| `dialog.tsx` | Modal dialogs |
| `select.tsx` | Dropdown selects |
| `table.tsx` | Data tables |
| `card.tsx` | Content cards |
| `badge.tsx` | Status labels |
| `switch.tsx` | Toggle switches |
| `toast.tsx` | Notification popups |
| `chart.tsx` | Recharts wrapper |
| `skeleton.tsx` | Loading state placeholders |

#### `layout/` — App Shell

| File | Description |
|------|-------------|
| `dashboard-layout.tsx` | Main layout — sidebar + header + content area |
| `app-sidebar.tsx` | Left navigation menu |
| `notification-bell.tsx` | Header bell icon — unread count + notification dropdown |

#### `sales/` — POS Components

| File | Description |
|------|-------------|
| `payment-dialog.tsx` | Checkout dialog — payment method (Cash/Card/UPI), coupon, loyalty points, split payment |
| `receipt-print-dialog.tsx` | Receipt preview aur print — logo, footer, tax toggle apply hote hain |

#### `inventory/` — Product Components

| File | Description |
|------|-------------|
| `product-form-dialog.tsx` | Product add/edit form — SKU, barcode, variants, pricing |

#### `dashboard/` — Analytics Components

| File | Description |
|------|-------------|
| `ai-insights.tsx` | Gemini-generated daily sales summary card |
| `DonutChart.tsx` | Category revenue breakdown chart |

#### Root Components

| File | Description |
|------|-------------|
| `protected-route.tsx` | Auth guard — unauthenticated users ko login redirect karta hai |
| `providers.tsx` | Tamam context providers ko ek jagah wrap karta hai |
| `error-boundary.tsx` | React runtime errors catch karta hai, application crash prevent karta hai |
| `theme-toggle.tsx` | Dark/Light mode toggle button |

---

### `app/api/` — Next.js Server Routes

**`app/api/ai/insights/route.ts`**
- Sales data receive karta hai (POST)
- Genkit AI flow invoke karta hai
- 503 errors par 3 automatic retries
- AI-generated insight text return karta hai

---

## 5. Database Tables

> **Multi-tenant note:** In tables mein se zyada tar mein ab ek **`tenant_id`** column hai (`products`, `customers`, `sales`, `settings`, `shifts`, `coupons`, `suppliers`, `restaurant_tables`, `restaurant_orders`, `notifications`, `expenses`, `purchase_orders`). Har query is column se filter hoti hai. `users` mein bhi `tenant_id` hai (superadmin ke liye NULL).

| Table | Description |
|-------|-------------|
| `tenants` | **Har dukan (tenant) ka record — name, slug, plan, status** |
| `users` | SuperAdmin, admin aur cashier accounts (`tenant_id`, `role` includes `superadmin`) |
| `products` | Inventory — SKU, barcode, price, cost, stock (`tenant_id`) |
| `customers` | Customer profiles + loyalty point balance (`tenant_id`) |
| `sales` | Tamam transactions (retail + restaurant) — per-tenant `sale_number` (`tenant_id`) |
| `sale_items` | Per-transaction line items |
| `sale_payments` | Split payment breakdown per sale |
| `sale_returns` | Refund records |
| `sale_return_items` | Returned items detail |
| `settings` | Store configuration + receipt customization (per tenant) |
| `shifts` | Cashier shift records (`tenant_id`) |
| `coupons` | Discount codes (`tenant_id`) |
| `coupon_usages` | Coupon redemption records per sale |
| `loyalty_transactions` | Points ledger per customer (earn / redeem / reverse / expire) |
| `suppliers` | Vendor information (`tenant_id`) |
| `purchase_orders` | Supplier restock orders (`tenant_id`, per-tenant PO number) |
| `notifications` | System alerts (low stock, etc.) (`tenant_id`) |
| `restaurant_tables` | Floor plan — table names, sections, status (`tenant_id`) |
| `restaurant_orders` | Active table orders — waiter, guests (`tenant_id`) |
| `restaurant_order_items` | Per-order line items + notes |
| `kots` | Kitchen Order Ticket print history |
| `bill_splits` | Table bill split records |
| `expenses` | Business expense records (`tenant_id`) |

> **Per-tenant numbering:** `sales.sale_number`, `customers.customer_number`, aur `purchase_orders.po_number` har tenant ke liye **1 se shuru** hote hain. Yeh `utils/tenantSequence.js` ke `nextTenantNumber()` se generate hote hain (`MAX(column)+1 WHERE tenant_id`, transaction + row-lock ke saath) — koi alag counter table nahi.

---

## 6. Environment Variables

### Backend — `Backend/.env`

```env
PORT=5001
JWT_SECRET=elites-pos-secret-key-change-in-production-2024
CRON_API_KEY=random-secret-for-scheduled-tasks   # loyalty/expire jaise cron jobs ke liye
DB_HOST=localhost
DB_USER=root
DB_PASSWORD=abc12345
DB_NAME=pos_system
FRONTEND_URL=http://localhost:9002
```

### Frontend — `frontend/.env.local`

```env
NEXT_PUBLIC_API_URL=http://localhost:5001/api
GOOGLE_GENAI_API_KEY=your-gemini-api-key
```

---

## 7. Pages & Routes

| URL | Page | Access |
|-----|------|--------|
| `/login` | Login | Public |
| `/signup` | Account Registration | Public |
| `/superadmin` | Tenant (Shop) Management Dashboard | SuperAdmin only |
| `/dashboard` | Analytics, Charts, AI Insights | Admin + Cashier |
| `/sales` | POS Terminal | Admin + Cashier |
| `/inventory` | Product Management | Admin + Cashier |
| `/customers` | Customer Records | Admin + Cashier |
| `/reports` | Sales Reports, Profit Analysis | Admin only |
| `/reports/coupons` | Coupon Usage Report | Admin only |
| `/reports/return-history` | Refund History | Admin only |
| `/settings` | Store Configuration | Admin only |
| `/receipt-settings` | Receipt Customization | Admin only |
| `/shifts` | Shift Management | Admin + Cashier |
| `/coupons` | Discount Code Management | Admin only |
| `/suppliers` | Vendor Management | Admin only |
| `/tables` | Restaurant Floor Plan & Orders | Admin + Cashier |
| `/kitchen` | Kitchen Display (KOT Queue) | Admin + Cashier |
| `/expenses` | Expense Tracking | Admin only |

---

## 8. Default Login

**Default Store admin (tenant 1):**
```
Email:    admin@elites.com
Password: admin123
Role:     Admin
```

**SuperAdmin (platform owner — tenants manage karta hai):**
```
Email:    superadmin@elites.com
Password: super@123
Role:     SuperAdmin   (tenant_id = NULL)
```
> ⚠️ Production mein dono default passwords zaroor badlein.

---

## 9. Implemented Features Summary

| Feature | Backend | Frontend |
|---------|---------|----------|
| Multi-tenant (isolated data per shop) | ✅ | ✅ |
| SuperAdmin tenant management | ✅ | ✅ |
| Per-tenant invoice / customer / PO numbering | ✅ | ✅ |
| Barcode scan → cart | ✅ | ✅ |
| Barcode label print | ✅ | ✅ |
| Sales return / refund | ✅ | ✅ |
| Shift management + cash out | ✅ | ✅ |
| Coupon codes (flat / percentage) | ✅ | ✅ |
| Loyalty points (earn / redeem / expire) | ✅ | ✅ |
| Supplier + purchase orders | ✅ | ✅ |
| Product variants (size, color) | ✅ | ✅ |
| Low stock notifications | ✅ | ✅ |
| SKU auto-generate | ✅ | ✅ |
| Reports PDF / Excel export | ✅ | ✅ |
| Split payment (Cash + Card + Wallet) | ✅ | ✅ |
| Custom receipt (logo, footer, toggles) | ✅ | ✅ |
| Table management + KOT | ✅ | ✅ |
| Bill split (restaurant) | ✅ | ✅ |
| Kitchen display | ✅ | ✅ |
| Expense tracking | ✅ | ✅ |
| Touch screen optimization | — | ✅ |
| POS keyboard shortcuts (F2 / F4 / Esc) | — | ✅ |
| AI daily sales insights | — | ✅ |
| Dark / Light mode | — | ✅ |
| English / Urdu language toggle | — | ✅ |

---

## 10. Deployment Notes

> Environment variables ke liye Section 6 refer karein.

### System Flow

```
Browser (Port 9002)
    ↓
Next.js Frontend
    ↓  Axios + JWT Bearer Token
Express.js Backend (Port 5001)
    ↓  mysql2
MySQL Database

    +

Next.js API Route (/api/ai/insights)
    ↓
Google Gemini AI
    ↓
AI Insight Text → Dashboard
```

**Request lifecycle:**
1. User login karta hai → JWT token generate hota hai (**`tenant_id` embed**) → localStorage mein save
2. Har API request mein token automatically attach hota hai (`api.ts`)
3. Backend `authMiddleware.js` mein token verify hota hai → `req.user.tenant_id` set
4. Role-based access `roleMiddleware.js` / `superAdminMiddleware.js` enforce karta hai
5. Query **`WHERE tenant_id = req.user.tenant_id`** se scope hoti hai — user ko sirf apni dukan ka data milta hai
6. Data MySQL se fetch hota hai aur frontend par display hota hai

> **Multi-tenant deployment:** Detail steps ke liye `DEPLOY-VPS.md` (central server) aur `DEPLOY-LOCAL.md` dekhein. Ek hi app + ek hi database sab tenants ke liye; naya client = SuperAdmin se tenant create.

---

### Loyalty Points Expiry — Scheduled Task

Loyalty points 12 months ki inactivity ke baad expire hote hain. Yeh endpoint monthly schedule pe call hona chahiye. Ab yeh **API key** se protected hai (JWT nahi) — taake cron job bina login ke chal sake:

```
Method:  POST
URL:     http://localhost:5001/api/loyalty/expire
Header:  x-api-key: <CRON_API_KEY>
```

**Windows Task Scheduler setup:**
- Trigger: Monthly — 1st of every month, 12:00 AM
- Action: `curl.exe -X POST http://localhost:5001/api/loyalty/expire -H "x-api-key: YOUR_CRON_API_KEY"`

> Linux/VPS par yeh `crontab` se schedule hota hai (dekhein `DEPLOY-VPS.md`).

---

*Elites POS System — Complete Technical Reference*
