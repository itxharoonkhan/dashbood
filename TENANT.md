# 🏢 Multi-Tenant System — Complete Guide
### (Boss ko Explain karne ke liye)

> ✅ **Status: IMPLEMENTED & LIVE.** Yeh system ban chuka hai aur database par verify ho chuka hai
> (orphan rows = 0, cross-tenant data leak = 0). Yeh document samjhata hai ke yeh kaise kaam karta hai.

---

## 🤔 Pehle Samjho — Tenant Kya Hota Hai?

**Tenant = Aapka Client (Customer / ek dukaan)**

Jaise ek building mein alag alag flats hote hain —
har family alag rehti hai, lekin building ek hi hoti hai.

Waise hi:
- **Building** = Aapka ek server + ek database
- **Flat** = Har client ka data
- **Family** = Har client ke users

```
Aapka Server
    │
    ├── 🏪 Default Store    (Tenant 1) — apna data, apna login
    ├── 👕 Hamza Garments   (Tenant 4) — apna data, apna login
    ├── 💊 Ahmed Medical    (Tenant 5) — apna data, apna login
    └── ☕ Cafe Delight     (Tenant 6) — apna data, apna login

Sab ka data EK database mein — lekin BILKUL ALAG (tenant_id se)
```

---

## 🟢 Naya Client Add Karna — Ab Kitna Asaan

```
Naya client aaya → Sirf yeh karo:
1. SuperAdmin se login karo
2. /superadmin panel → "Create Tenant" click karo
3. Client ka naam, email, password bharo  → Save
4. URL + login share karo
─────────────────────────────────────────────
Total: ~5 minute har baar
```

**Server par KUCH nahi karna** — koi naya database, backend, port, ya Nginx nahi.
10 clients = sirf ~50 minute ka kaam 🚀

> Pehle (bina tenant) har client ke liye alag database + backend + port + Nginx + SSL setup karna padta tha (~1.5 ghante per client). Ab woh zaroorat khatam.

---

## 🗄️ Database Mein Kya Hai

### `tenant_id` — Har Row Kis Client Ki Hai

```
products table:
id | tenant_id | name    | selling_price
1  |     1     | Burger  | 500      ← Default Store ka
2  |     1     | Pizza   | 800      ← Default Store ka
3  |     4     | T-Shirt | 1200     ← Hamza Garments ka
4  |     4     | Jeans   | 2500     ← Hamza Garments ka
```
**`tenant_id` = Client ka number** — har table is se filter hoti hai.

### `tenants` Table — Har Dukaan Ka Record
```
tenants table:
id | name            | email             | slug    | status  | plan
1  | Default Store   | admin@elites.com  | default | active  | pro
4  | Hamza Garments  | admin@hamza.com   | hamza   | active  | basic
```

---

## 🔐 Login Kaise Kaam Karta Hai

```
admin@elites.com  + password → Default Store ka dashboard
admin@hamza.com   + password → Hamza Garments ka dashboard

Dono SAME URL pe login karte hain.
Login ke baad har ek ko sirf apna apna data dikhta hai.
```

**System automatically samajhta hai (login token se):**
- Yeh user kis tenant ka hai → sirf usi tenant ka data dikhao.
- User ke JWT token mein uska `tenant_id` hota hai. Har API request us `tenant_id` se data filter karti hai.

---

## 🌐 URL Structure (Jo Implement Hua)

**Single URL + Login se detect** (yahi implement hua hai):
```
https://pos.elitespos.com/login
       → email/password se pata chalta hai kon sa client hai
       → uska data dikhta hai
```
- Subdomain (`pizza.elitespos.com`) ya URL-path wale tareeke abhi implement **nahi** hain — agar future mein chahiye to add ho sakte hain. Filhaal sab ek hi URL par login karte hain.

---

## 🔒 Security — Ek Client Doosre Ka Data Dekh Sakta Hai?

**Nahi. Bilkul nahi.** (Yeh database par test ho chuka hai — leak = 0.)

Har API query mein automatically filter lagta hai:

```javascript
// Jab Hamza Garments login kare
const tenantId = req.user.tenant_id   // token se aata hai (e.g. 4)

// Query hamesha tenant_id filter ke saath
SELECT * FROM products WHERE tenant_id = 4
//                           ↑
//          Sirf Hamza Garments ke products — kisi aur ka nahi
```

Chahe koi try bhi kare — doosre tenant ka data access nahi kar sakta.

---

## 📊 Kin Tables Mein `tenant_id` Hai

```
✅ users             — har client ke alag staff (superadmin ka tenant_id NULL)
✅ products          — har client ke alag products
✅ sales             — har client ki alag sales
✅ customers         — har client ke alag customers
✅ suppliers         — har client ke alag suppliers
✅ purchase_orders   — har client ke alag orders
✅ shifts            — har client ki alag shifts
✅ coupons           — har client ke alag coupons
✅ settings          — har client ki alag settings (store name, tax, mode)
✅ restaurant_tables — har client ke alag tables
✅ restaurant_orders — har client ke alag orders
✅ notifications     — har client ke alag alerts
✅ expenses          — har client ke alag expenses
```
> Categories alag table nahi — woh `products` mein ek column hai, isliye automatically tenant ke saath scope ho jati hai.

---

## 🔢 Bonus — Har Client Ki Apni Numbering

Har tenant ke invoice, customer, aur purchase-order numbers **1 se shuru** hote hain:
```
Default Store ka invoice:  1, 2, 3, ...
Hamza Garments ka invoice: 1, 2, 3, ...   (alag, mix nahi hote)
```
Yeh `utils/tenantSequence.js` se handle hota hai.

---

## 💰 Business Faida

| | Bina Tenant | Tenant System (ab) |
|---|---|---|
| Servers/backends | 1 server + kai alag backends | 1 server + 1 backend |
| Cost | zyada resources | ~Rs. 1,700/month (chahe 5 client ho ya 50) |
| Naya client setup | ~1.5 ghante | ~5 minute |
| Scale | mushkil | 100 clients asaan |

### Income Calculator
```
10 clients × Rs. 3,000/month = Rs. 30,000
Server cost                  = Rs. 1,700
─────────────────────────────────────────
Net Profit                   = Rs. 28,300/month 🎉
```

---

## 📋 Super Admin vs Client Admin

### Aap (Super Admin) — `superadmin@elites.com`
```
https://pos.elitespos.com/superadmin
│
├── Tenants List (saare clients)
├── Create New Tenant (5 min mein naya client)
├── Client ka plan / status change (active / suspend)
└── Har client ke users, sales count, revenue
```

### Client (Tenant Admin) — e.g. admin@hamza.com
```
https://pos.elitespos.com   (same URL, apna login)
│
├── Sirf apni dukan ka dashboard
├── Sirf apne products / sales / customers
└── Apne cashiers bana sakta hai (auto apne tenant mein)
```

---

## 🔑 Default Accounts

| Role | Email | Password | tenant_id |
|------|-------|----------|-----------|
| SuperAdmin | superadmin@elites.com | super@123 | NULL |
| Default Store Admin | admin@elites.com | admin123 | 1 |

> ⚠️ Production mein dono passwords zaroor badlein.

---

## ❓ Boss Ke Liye Summary (Simple Words)

```
Q: Har client ke liye alag server chahiye?
A: Nahi — ek server pe 100 clients chal sakte hain

Q: Data secure hai?
A: Haan — koi client doosre ka data nahi dekh sakta (verify ho chuka)

Q: Naya client add karna mushkil hai?
A: Nahi — SuperAdmin panel se 5 minute mein ready

Q: Agar ek client band ho jaye?
A: Us tenant ka status "suspend" karo — baaki sab clients theek chalte rahenge

Q: Backup kaise hoga?
A: Ek backup = saare clients ka data — bohot easy

Q: Kharcha kitna?
A: Ek server Rs. 1,700/month — chahe 5 clients ho ya 50
```

---

## ✅ Ab Kya Karna Hai (Next Step)

System ready hai. Naya client onboard karne ke liye:

1. **SuperAdmin** se login karo (`superadmin@elites.com`)
2. `/superadmin` → **Create Tenant** → client ki detail bharo
3. Client ko URL + uske admin ka email/password do
4. Bas — client apni dukan chalana shuru kar de 🎉

> Deployment ke liye `DEPLOY-VPS.md` (central server) ya `DEPLOY-LOCAL.md` dekho.
> Workflow detail ke liye `TENANT-WORKFLOW.md`.
