# Multi-Tenant System — Complete Workflow Guide
### Step-by-step: Pehli baar setup se le kar naye client add karne tak

---

## SYSTEM OVERVIEW

```
                    ┌─────────────────────────────┐
                    │      AAPKA EK SERVER         │
                    │   elitespos.com              │
                    └─────────────┬───────────────┘
                                  │
              ┌───────────────────┼───────────────────┐
              │                   │                   │
    ┌─────────▼────────┐ ┌───────▼───────┐ ┌────────▼───────┐
    │  Default Store   │ │  Pizza House  │ │ Hamza Garments │
    │  tenant_id = 1   │ │  tenant_id=2  │ │  tenant_id = 3 │
    │  admin@elites.com│ │admin@pizza.com│ │admin@hamza.com │
    └──────────────────┘ └───────────────┘ └────────────────┘

    Sab ka data ek hi database mein — lekin BILKUL ALAG (tenant_id se)
    (tenant_id = 1 hamesha "Default Store" — migration ke saath ban jata hai)
```

---

## STEP 1: PEHLI BAAR SETUP (Sirf ek baar)

### 1A — Database Migration Run Karo

MySQL Workbench ya terminal mein:

```sql
source C:/Users/Digital Lucent/Desktop/pos-system/Backend/schema_tenant_migration.sql
```

**Ye kya karta hai:**
- `tenants` table create karta hai (+ Default Store = tenant 1)
- Existing tables mein `tenant_id` column add karta hai
- Existing data ko `tenant_id = 1` assign karta hai (koi data nahi jaata)
- Super Admin user create karta hai

> 💡 Fresh DB par base `schema.sql` ke baad baaki migrations bhi chalao:
> `schema_tenant_numbering_migration.sql`, `schema_softdelete_migration.sql`,
> `schema_po_numbering_migration.sql`, `schema_image_longtext_migration.sql`.
> (Numbering migration har tenant ke invoice/customer/PO numbers ko **1 se** shuru karti hai.)

### 1B — Super Admin Credentials

```
Email    : superadmin@elites.com
Password : super@123
Role     : superadmin
```

> ⚠️ Production mein ye password zaroor change karo

### 1C — Backend Start Karo

```bash
cd Backend
npm start
```

### 1D — Frontend Start Karo

```bash
cd frontend
npm run dev
```

---

## STEP 2: SUPER ADMIN LOGIN

**URL:** `http://localhost:9002/login`

Email: `superadmin@elites.com`
Password: `super@123`

Login ke baad:
- Sidebar mein sirf **"Super Admin"** link dikhega
- Click karo → `/superadmin` page khulega

```
┌─────────────────────────────────────────────┐
│  SUPER ADMIN PANEL                          │
│                                             │
│  [+ Add Tenant]                             │
│                                             │
│  Tenant          Plan    Status   Revenue   │
│  ─────────────── ─────── ──────── ──────── │
│  Default Store   Pro     Active   Rs.0      │
└─────────────────────────────────────────────┘
```

---

## STEP 3: NAYA CLIENT (TENANT) ADD KARNA

Super Admin panel mein **"Add Tenant"** button click karo.

### Form Fields:

```
Business Info:
  Store Name    : Pizza House
  Slug          : pizza-house          ← URL-friendly naam (auto fill)
  Business Email: billing@pizza.com    ← Tenant ki contact email
  Plan          : Basic / Pro / Enterprise

Admin Account (is client ka login):
  Admin Name    : Haroon Khan
  Admin Email   : admin@pizzahouse.com ← Is se client login karega
  Admin Password: pizza@2024
```

### Click "Create Tenant"

**Backend mein kya hota hai:**
```
1. tenants table mein naya row insert hota hai   → tenant_id = 2
2. settings table mein naya row insert hota hai  → tenant_id = 2 (store info)
3. users table mein admin user create hota hai   → tenant_id = 2
```

---

## STEP 4: CLIENT KA LOGIN

Ab Pizza House ka admin apna login karega:

**URL:** `http://localhost:9002/login`

```
Email    : admin@pizzahouse.com
Password : pizza@2024
```

Login hone ke baad:
- Poora POS dashboard dikhega
- **Sirf apna data dikhega** — koi doosra tenant ka data nahi

### JWT Token mein kya hai:

```json
{
  "id": 3,
  "role": "admin",
  "tenant_id": 2,
  "permissions": []
}
```

Har API call ke saath ye token jata hai → backend automatically `tenant_id = 2` filter lagata hai.

---

## STEP 5: DATA ISOLATION — KYA HOTA HAI ANDAR

### Pizza House admin koi product add kare:

```
Frontend request:
POST /api/products
Body: { name: "Margherita", selling_price: 800 }
Headers: Authorization: Bearer <token>

Backend mein:
INSERT INTO products (name, selling_price, tenant_id)
VALUES ('Margherita', 800, 2)      ← tenant_id = 2 automatically
```

### Pizza House admin products dekhe:

```
Frontend request:
GET /api/products

Backend mein:
SELECT * FROM products WHERE tenant_id = 2
                             ↑
                   Sirf Pizza House ke products
```

### Ahmed Medical ka admin products dekhe (alag login):

```
GET /api/products

Backend mein:
SELECT * FROM products WHERE tenant_id = 3
                             ↑
                   Sirf Ahmed Medical ke products
                   Pizza House ka koi bhi data nahi aayega
```

---

## STEP 6: TENANT MANAGEMENT (Super Admin)

Super Admin `/superadmin` pe ja kar:

### Tenant Status Change:
- **Active** → Normal operation
- **Inactive** → Login nahi kar sakta (maintenance)
- **Suspended** → Client ne payment nahi ki

### Tenant Plan Change:
- Basic → Pro → Enterprise

### Tenant Delete:
- Soft delete — data rehta hai, status = suspended
- Default tenant (id=1) delete nahi ho sakta

---

## STEP 7: CASHIER ADD KARNA (Tenant ke andar)

Pizza House ka admin khud apne cashier add karega:

1. **Settings → User Management** ya `/settings`
2. "Add Cashier" click karo
3. Name, email, password bharo

```
Backend mein:
INSERT INTO users (name, email, password, role, tenant_id)
VALUES ('Ali', 'ali@pizza.com', hash, 'cashier', 2)
                                                 ↑
                                     Same tenant_id as admin
```

Ab Ali login kare `ali@pizza.com` se → sirf Pizza House ka data dikhega, cashier permissions ke saath.

---

## COMPLETE FLOW DIAGRAM

```
[Aap - Super Admin]
        │
        ▼
 superadmin@elites.com login
        │
        ▼
 /superadmin panel
        │
        ├──► Add Tenant: "Pizza House"
        │         │
        │         ▼
        │    tenant_id = 2 create
        │    admin@pizzahouse.com create
        │
        ├──► Add Tenant: "Ahmed Medical"
        │         │
        │         ▼
        │    tenant_id = 3 create
        │    admin@ahmed.com create
        │
        └──► Monitor: Revenue, status, plan

[Pizza House Admin - admin@pizzahouse.com]
        │
        ▼
 Normal POS login
        │
        ▼
 JWT token → tenant_id = 2
        │
        ├──► Products add karo     → tenant_id = 2 filter
        ├──► Sales karo            → tenant_id = 2 filter
        ├──► Customers manage karo → tenant_id = 2 filter
        ├──► Reports dekho         → tenant_id = 2 ka data sirf
        └──► Cashier add karo      → tenant_id = 2 mein

[Ahmed Medical Admin - admin@ahmed.com]
        │
        ▼
 Same URL, Same app
        │
        ▼
 JWT token → tenant_id = 3
        │
        └──► Bilkul alag data, Pizza House kuch nahi dekh sakta
```

---

## PRICING / BILLING SETUP (Optional Future)

Abhi manual hai. Future mein:

```
Tenant Plan    Monthly Price   Features
───────────── ─────────────── ─────────────────────────────
Basic          Rs. 2,000       1 user, basic POS
Pro            Rs. 4,000       5 users, reports, loyalty
Enterprise     Rs. 8,000       Unlimited users, API access
```

Billing track karne ke liye `tenants` table mein `next_billing_date`, `amount` columns baad mein add kar sakte ho.

---

## QUICK REFERENCE — IMPORTANT FILES

```
pos-system/
├── Backend/
│   ├── schema_tenant_migration.sql     ← Database migration (ek baar run karo)
│   ├── routes/tenants.js               ← Super admin tenant CRUD API
│   ├── middleware/authMiddleware.js     ← tenant_id JWT se extract karta hai
│   ├── middleware/superAdminMiddleware.js ← Super admin guard
│   └── middleware/roleMiddleware.js     ← superadmin sab kuch kar sakta hai
│
└── frontend/src/app/
    ├── superadmin/page.tsx              ← Super admin panel UI
    └── login/page.tsx                  ← Shared login (sabke liye)
```

---

## CREDENTIALS SUMMARY

| Role | Email | Password | Access |
|---|---|---|---|
| Super Admin | superadmin@elites.com | super@123 | Sab tenants manage |
| Default Admin | admin@elites.com | admin123 | Sirf tenant 1 ka data |
| New Tenant Admin | jo aap set karo | jo aap set karo | Sirf apna data |

---

## TROUBLESHOOTING

**Q: Naya tenant login kare to "Invalid credentials" aaye?**
A: Migration SQL dobara run karo. Users table mein `tenant_id` column hona chahiye.

**Q: Super admin login ke baad superadmin page nahi dikh raha?**
A: Browser hard refresh karo (`Ctrl+Shift+R`). Purana token cache mein hoga.

**Q: Ek tenant ka data doosre ko dikh raha hai?**
A: Ye nahi ho sakta agar migration SQL correctly run hua ho. Verify karo:
```sql
SELECT id, tenant_id, name FROM products LIMIT 10;
```

**Q: New tenant ke products khaali hain?**
A: Sahi hai — naya tenant fresh start karta hai. Pehle products add karo.
