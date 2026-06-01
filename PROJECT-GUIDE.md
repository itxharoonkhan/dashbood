# Elites POS System — Project Guide

Yeh guide poore POS system ka complete explanation hai. Har folder, file, aur feature ka kaam yahan explain kiya gaya hai.

---

## Table of Contents

1. [Project Overview](#1-project-overview)
2. [Folder Structure](#2-folder-structure)
3. [Backend — Poora Explanation](#3-backend)
4. [Frontend — Poora Explanation](#4-frontend)
5. [Database Tables](#5-database-tables)
6. [Environment Variables](#6-environment-variables)
7. [Pages / Routes](#7-pages--routes)
8. [Default Login](#8-default-login)

---

## 1. Project Overview

Yeh ek **full-stack Point of Sale (POS) system** hai jo retail shops ke liye banaya gaya hai.

| Part      | Technology         | Port  |
|-----------|--------------------|-------|
| Frontend  | Next.js 15 + React | 9002  |
| Backend   | Node.js + Express  | 5001  |
| Database  | MySQL              | 3306  |
| AI        | Google Gemini      | —     |

**Do roles hain:**
- **Admin** — sab kuch dekh aur kar sakta hai
- **Cashier** — sirf sales aur shift manage kar sakta hai

---

## 2. Folder Structure

```
pos-system/
├── Backend/                  ← Express.js API server
│   ├── index.js              ← Server entry point
│   ├── db.js                 ← MySQL connection pool
│   ├── schema.sql            ← Database tables ka structure
│   ├── nodemon.json          ← Dev server config
│   ├── middleware/
│   │   ├── authMiddleware.js ← JWT token check
│   │   ├── roleMiddleware.js ← Admin/cashier access control
│   │   └── errorMiddleware.js← Global error handler
│   └── routes/
│       ├── auth.js           ← Login / signup
│       ├── products.js       ← Inventory management
│       ├── sales.js          ← POS transactions
│       ├── dashboard.js      ← Analytics data
│       ├── customers.js      ← Customer database
│       ├── reports.js        ← Business reports
│       ├── settings.js       ← Store settings
│       ├── menu.js           ← POS menu (products for cashier)
│       ├── shifts.js         ← Cashier shift management
│       ├── coupons.js        ← Discount codes
│       ├── loyalty.js        ← Loyalty points
│       ├── suppliers.js      ← Vendor management
│       └── notifications.js  ← Low stock alerts
│
└── frontend/                 ← Next.js application
    └── src/
        ├── ai/               ← AI integration (Genkit + Gemini)
        ├── app/              ← Pages aur API routes
        ├── components/       ← Reusable UI components
        ├── contexts/         ← Global state (auth, theme, language)
        ├── hooks/            ← Custom React hooks
        └── lib/              ← Utilities, API client, types
```

---

## 3. Backend

### `index.js` — Server Entry Point

Yeh poore backend ka starting point hai.

- Port **5001** par server start karta hai
- CORS setup karta hai (frontend ko allow karta hai)
- Rate limiting lagata hai:
  - General API: **500 requests / 15 minutes**
  - Auth (login): **50 requests / 15 minutes** (brute force se bachao)
- Images ke liye **10MB** upload limit
- Saare 13 route modules yahan register hote hain
- Graceful shutdown handle karta hai

---

### `db.js` — Database Connection

- MySQL ke saath **connection pool** banata hai (max 10 connections)
- Promise-based API use karta hai (async/await support)
- Server start hone par connection test karta hai
- Agar DB connect na ho to error show karta hai

---

### Middleware (3 files)

#### `authMiddleware.js`
- Har protected route par JWT token check karta hai
- Token `Authorization: Bearer <token>` format mein aana chahiye
- Token expire ho jaye to `401 Unauthorized` return karta hai
- Valid token se `req.user` mein user info deta hai

#### `roleMiddleware.js`
- Check karta hai ke user admin hai ya cashier
- Admin-only routes cashier se protect karta hai
- Example: coupon create karna, reports dekhna, settings change karna

#### `errorMiddleware.js`
- Agar koi bhi route mein error aaye to yeh catch karta hai
- Consistent error format return karta hai
- Production mein detailed errors hide karta hai

---

### Routes — 13 API Modules

#### `auth.js` — Authentication
| Endpoint | Kaam |
|----------|------|
| `POST /api/auth/login` | Email + password se login, JWT token milta hai |
| `POST /api/auth/create-cashier` | Admin naya cashier account banata hai |

- Password **bcrypt** se hash hota hai
- Failed login attempts track hote hain (lockout feature)

---

#### `products.js` — Inventory
| Endpoint | Kaam |
|----------|------|
| `GET /api/products` | Saare products list |
| `POST /api/products` | Naya product add |
| `PUT /api/products/:id` | Product update |
| `DELETE /api/products/:id` | Product delete |
| `POST /api/products/import` | CSV file se bulk import |

- Category filter support
- Stock validation (negative stock nahi hogi)
- CSV import se hazaron products ek baar add ho sakte hain

---

#### `sales.js` — POS Transactions
| Endpoint | Kaam |
|----------|------|
| `POST /api/sales` | Naya sale create karo |
| `GET /api/sales` | Sales history |
| `GET /api/sales/:id` | Single sale detail |

- Payment methods: **Cash, Card, UPI**
- Coupon code apply hota hai
- Loyalty points earn/redeem hote hain
- Tax calculate hoti hai
- Stock automatically kam hoti hai

---

#### `dashboard.js` — Analytics
| Endpoint | Kaam |
|----------|------|
| `GET /api/dashboard` | Today ka revenue, sales count, low stock |
| `GET /api/dashboard/weekly` | 7 din ka data |
| `GET /api/dashboard/monthly` | Monthly breakdown |

- Real-time data deta hai
- Top selling categories
- Recent sales feed

---

#### `customers.js` — Customer Database
| Endpoint | Kaam |
|----------|------|
| `GET /api/customers` | Saare customers |
| `POST /api/customers` | Naya customer add |
| `PUT /api/customers/:id` | Customer update |
| `DELETE /api/customers/:id` | Customer delete |
| `GET /api/customers/phone/:phone` | Phone se customer dhundo (POS mein use) |

---

#### `reports.js` — Business Reports (Admin Only)
| Endpoint | Kaam |
|----------|------|
| `GET /api/reports/sales` | Sales overview (today/week/month/year) |
| `GET /api/reports/products` | Top 10 selling products |
| `GET /api/reports/categories` | Sales by category |
| `GET /api/reports/profit` | Profit margin calculation |

---

#### `settings.js` — Store Configuration
| Endpoint | Kaam |
|----------|------|
| `GET /api/settings` | Store settings fetch |
| `PUT /api/settings` | Settings update |

- Store name, address, phone, email
- Tax rate (percentage)
- Currency symbol
- Low stock alert threshold
- Theme (dark/light)

---

#### `menu.js` — POS Menu
| Endpoint | Kaam |
|----------|------|
| `GET /api/menu` | POS ke liye products (with variants) |

- Name ya SKU se search
- Category filter
- Stock status include hoti hai
- Sirf cashier ke liye optimized

---

#### `shifts.js` — Cashier Shift
| Endpoint | Kaam |
|----------|------|
| `GET /api/shifts/active` | Active shift check |
| `POST /api/shifts/open` | Shift start karo (opening cash) |
| `POST /api/shifts/close` | Shift band karo (closing balance) |
| `POST /api/shifts/cashout` | Shift mein cash nikalo |

- Opening aur closing cash track hoti hai
- Shift summary: total sales, refunds, cash variance

---

#### `coupons.js` — Discount Codes
| Endpoint | Kaam |
|----------|------|
| `GET /api/coupons` | Saare coupons |
| `POST /api/coupons` | Naya coupon banao (admin) |
| `PUT /api/coupons/:id` | Coupon update |
| `DELETE /api/coupons/:id` | Coupon delete |
| `POST /api/coupons/validate` | Code check karo (POS mein) |
| `PATCH /api/coupons/:id/toggle` | Active/inactive toggle |

- Types: **Flat** (fixed amount) ya **Percentage**
- Expiry date support
- Usage limit (e.g. sirf 100 baar use ho)

---

#### `loyalty.js` — Loyalty Points
| Endpoint | Kaam |
|----------|------|
| `GET /api/loyalty/:phone` | Customer ke points check |
| `POST /api/loyalty/earn` | Points add karo |
| `POST /api/loyalty/redeem` | Points use karo |

- **PKR 100 = 1 point** earn hota hai
- Minimum **100 points** chahiye redeem ke liye
- Maximum **30%** discount points se mil sakta hai

---

#### `suppliers.js` — Vendor Management
| Endpoint | Kaam |
|----------|------|
| `GET /api/suppliers` | Saare suppliers |
| `POST /api/suppliers` | Naya supplier |
| `PUT /api/suppliers/:id` | Supplier update |
| `DELETE /api/suppliers/:id` | Supplier delete |
| `GET /api/suppliers/:id/orders` | Supplier ke purchase orders |
| `POST /api/suppliers/:id/orders` | Naya purchase order |

---

#### `notifications.js` — Alerts
| Endpoint | Kaam |
|----------|------|
| `GET /api/notifications` | Saari notifications |
| `PATCH /api/notifications/:id/read` | Mark as read |
| `DELETE /api/notifications/clear` | Purani clear karo |

- Low stock products ki automatic notifications aati hain
- Bell icon mein unread count dikhta hai

---

## 4. Frontend

### `ai/` — Artificial Intelligence

#### `genkit.ts`
- Google Gemini AI ko initialize karta hai (**Gemini 2.0 Flash** model)
- Genkit framework configure karta hai

#### `flows/daily-sales-insights-summary.ts`
- Ek AI "flow" hai jo sales data leta hai
- Gemini se human-readable insight generate karta hai
- Example output: "Aaj ka best seller XYZ tha, revenue 20% upar raha"

---

### `hooks/` — Custom React Hooks

#### `use-mobile.ts`
- Check karta hai ke screen mobile size hai ya nahi
- Breakpoint: **768px**
- Sidebar hide/show karne mein use hota hai

#### `use-toast.ts`
- Toast notifications manage karta hai (top-right popup messages)
- Ek waqt mein sirf **1 toast** dikhta hai
- **3 seconds** mein auto-dismiss
- Success, error, warning types support

---

### `lib/` — Utilities

#### `api.ts`
- Axios ka configured instance hai
- Base URL: `http://localhost:5001/api`
- **Automatically JWT token** har request ke saath bhejta hai
- Agar **401** aaye to user ko login page par redirect karta hai
- Error logging karta hai console mein

#### `types.ts`
- TypeScript interfaces define hain:
  - `User` — id, name, email, role
  - `Product` — sku, name, price, cost, stock, category
  - `Customer` — name, email, phone, totalSpent, loyaltyPoints
  - `Sale` — items, subtotal, discount, tax, total, paymentMethod
  - `SaleItem` — productId, quantity, pricePerUnit, total

#### `utils.ts`
- Ek function hai: `cn()`
- Tailwind CSS classes ko merge karta hai (conflicts resolve karta hai)
- Example: `cn("px-4", condition && "text-red-500")`

#### `translations.ts`
- **230+ UI strings** English aur Urdu mein
- Har label, button, message dono languages mein hai
- Language switch hone par poora UI translate hota hai

#### `placeholder-images.ts`
- Demo ke liye sample product images ka data

---

### `contexts/` — Global State

#### `auth-context.tsx`
- Poori app mein user ka login state manage karta hai
- Token **localStorage** mein save hota hai
- Login/logout functions provide karta hai
- Protected routes check karta hai
- Public routes (login, signup) ko bypass karta hai

#### `language-context.tsx`
- English aur Urdu ke beech toggle
- Urdu ke liye **RTL** (right-to-left) direction set karta hai
- `t("key")` function se translations milti hain

#### `theme-context.tsx`
- Dark aur Light mode toggle
- Preference **localStorage** mein save hoti hai
- System preference bhi detect karta hai
- `<html>` tag par `dark` class add/remove karta hai

---

### `components/` — UI Components

#### `ui/` (40+ components)
Yeh sab **shadcn/ui + Radix UI** ke components hain:

| Component | Kaam |
|-----------|------|
| `button.tsx` | Buttons (primary, outline, ghost, destructive) |
| `input.tsx` | Text/number inputs (12-digit limit bhi yahan hai) |
| `dialog.tsx` | Modal popups |
| `select.tsx` | Dropdown selects |
| `table.tsx` | Data tables |
| `card.tsx` | Content cards |
| `badge.tsx` | Status labels |
| `switch.tsx` | Toggle switches |
| `toast.tsx` | Notification popups |
| `chart.tsx` | Recharts wrapper |
| `skeleton.tsx` | Loading placeholders |
| `separator.tsx` | Divider lines |

#### `layout/`
| File | Kaam |
|------|------|
| `dashboard-layout.tsx` | Main app layout — sidebar + header + content area |
| `app-sidebar.tsx` | Left navigation menu (saare pages ke links) |
| `notification-bell.tsx` | Header mein bell icon, unread count, dropdown |

#### `sales/`
| File | Kaam |
|------|------|
| `payment-dialog.tsx` | Payment method select karo (Cash/Card/UPI), coupon, loyalty points |
| `receipt-print-dialog.tsx` | Sale ka receipt preview aur print |

#### `inventory/`
| File | Kaam |
|------|------|
| `product-form-dialog.tsx` | Product add/edit ka form dialog |

#### `dashboard/`
| File | Kaam |
|------|------|
| `ai-insights.tsx` | AI se generated daily sales summary card |
| `DonutChart.tsx` | Category breakdown donut chart |

#### Root Components
| File | Kaam |
|------|------|
| `protected-route.tsx` | Login check — agar logged in nahi to redirect |
| `providers.tsx` | Saare contexts ek jagah wrap karta hai |
| `error-boundary.tsx` | React errors catch karta hai, crash nahi hone deta |
| `theme-toggle.tsx` | Dark/Light mode ka button |

---

### `app/` — Pages & API Routes

#### API Route (Backend ka kaam Next.js mein)
**`app/api/ai/insights/route.ts`**
- POST request leta hai (sales data)
- Genkit AI flow call karta hai
- 3 baar retry karta hai (503 error pe)
- AI-generated insight text return karta hai

---

## 5. Database Tables

| Table | Kaam |
|-------|------|
| `users` | Admin aur cashier accounts |
| `products` | Inventory — SKU, price, cost, stock, barcode |
| `customers` | Customer profiles + loyalty points |
| `sales` | Har transaction ka record |
| `sale_items` | Har sale ke andar kaunsa product kitna |
| `sale_returns` | Refunds tracking |
| `settings` | Store ka configuration |
| `shifts` | Cashier shift records |
| `coupons` | Discount codes |
| `loyalty` | Points ledger (har customer ke liye) |
| `suppliers` | Vendor information |
| `purchase_orders` | Supplier se order records |
| `notifications` | System alerts (low stock, etc.) |

---

## 6. Environment Variables

### Backend (`Backend/.env`)
```env
PORT=5001
JWT_SECRET=elites-pos-secret-key-change-in-production-2024
DB_HOST=localhost
DB_USER=root
DB_PASSWORD=abc12345
DB_NAME=pos_system
FRONTEND_URL=http://localhost:9002
```

### Frontend (`frontend/.env.local`)
```env
NEXT_PUBLIC_API_URL=http://localhost:5001/api
GOOGLE_GENAI_API_KEY=your-gemini-api-key
```

---

## 7. Pages / Routes

| URL | Page | Kaun dekh sakta hai |
|-----|------|---------------------|
| `/login` | Login form | Sab (public) |
| `/signup` | Register | Sab (public) |
| `/dashboard` | Stats, charts, AI insights | Admin + Cashier |
| `/sales` | POS terminal — cart, checkout | Admin + Cashier |
| `/inventory` | Products manage | Admin + Cashier |
| `/customers` | Customer list | Admin + Cashier |
| `/reports` | Sales reports, profit | Admin only |
| `/settings` | Store config | Admin only |
| `/shifts` | Shift open/close | Admin + Cashier |
| `/coupons` | Discount codes | Admin only |
| `/suppliers` | Vendor management | Admin only |

---

## 8. Default Login

```
Email:    admin@elites.com
Password: admin123
Role:     Admin
```

---

## How It All Connects

```
User Browser
    |
    | (Port 9002)
    v
Next.js Frontend
    |
    | axios (http://localhost:5001/api)
    | + JWT token header
    v
Express.js Backend
    |
    | mysql2
    v
MySQL Database
    
    +
    
Frontend (AI page)
    |
    | Next.js API route
    v
Google Gemini AI
    |
    v
AI Insight Text
```

1. User login karta hai → JWT token milta hai → localStorage mein save
2. Har request mein token auto-attach hota hai (`api.ts`)
3. Backend token verify karta hai (`authMiddleware.js`)
4. Role check hoti hai (`roleMiddleware.js`)
5. Data MySQL se aata hai
6. Frontend pe dikhta hai

---

*Yeh guide Elites POS System ka complete reference hai.*
