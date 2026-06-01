# Elites POS — Features Tracker

---

## ✅ Mukammal Ho Chuke Features

### ✅ 1. Barcode Scanner (Sales page)
- USB barcode scanner se product scan karo → cart mein automatically add ho jata hai
- Backend mein `barcode` column already hai

### ✅ 2. Sales Return / Refund
- Customer product wapas kare toh refund process hoti hai
- Stock automatically restore ho jata hai
- Loyalty points bhi reverse hote hain return pe

### ✅ 3. Shift Management + Cash Out
- Cashier shift open kare, opening cash enter kare
- Shift close karte waqt cash count kare, end-of-shift report
- Cash Out — shift ke doran drawer se cash nikalne ka record
- Cash Out validation — available balance se zyada nahi nikal sakte
- Admin sirf closed shifts delete kar sakta hai

### ✅ 4. Discount / Coupon Codes
- Flat ya percentage discount dono support karta hai
- Expiry date aur usage limit set kar sakte hain
- Checkout pe code apply hota hai, invalid pe error dikhta hai

### ✅ 5. Loyalty Points System
- Har purchase pe points milte hain (configurable rate)
- Agla purchase karte waqt points se discount lo
- Return pe points reverse hote hain
- 12 mahine inactivity pe points expire hote hain

### ✅ 6. Supplier / Vendor Management
- Supplier ka naam, number, address save karo
- Purchase orders bana sakte hain restock ke liye

### ✅ 7. Product Variants
- Ek hi product ke alag sizes ya colors
- Har variant ka alag stock track hota hai

### ✅ 8. Low Stock Notifications
- Jab product threshold pe pahunche, bell icon mein alert aata hai
- Real-time alerts — dashboard pe bhi dikhtay hain

### ✅ 9. SKU Auto-Generate
- Category ke pehle 3 letters se SKU banta hai (BUR001, BIR001)
- Naya product add karte waqt automatically generate hota hai
- Admin manually bhi change kar sakta hai

### ✅ 10. Reports PDF / Excel Export
- Sales, inventory, P&L reports download ho sakti hain
- Formatted Excel with summary, tax column, ascending order

### ✅ 11. Split Payment
- Cash + Card + Wallet combination mein ek sale mein payment
- Sirf cash pe change milta hai — card/wallet exact hona chahiye
- Max 3 payment rows

### ✅ 12. Split Payment — Dashboard Feed
- Real-time sales feed mein "Cash + Card" ya "Cash + Wallet" format mein dikhta hai
- Detail dialog mein har method ka amount alag alag

### ✅ 13. Input Digit Limit (12 digits)
- Saare number inputs globally 12 digits tak limited hain
- `frontend/src/components/ui/input.tsx` mein globally applied

### ✅ 14. Coupon Form Focus Fix
- Coupon form mein kuch bhi type karte waqt focus nahi toot ta
- `CouponForm` component ko parent se bahar move kiya — React re-render bug fix

### ✅ 15. Shift History Filters
- Cashier ke naam se filter kar sakte hain
- Date range (from / to) se filter
- Status filter: All / Open / Closed
- "X of Y shifts" counter bhi dikhta hai

### ✅ 16. Barcode Field in Product Form
- Add Product form mein SKU ke saath barcode field hai
- Edit Product form mein bhi barcode field hai
- Barcode scan karke ya manually type karke enter kar sakte hain
- Backend API (`POST /products`, `PUT /products/:id`) mein barcode properly save hota hai

### ✅ 16. Camera-Based Barcode Scanner
- POS Terminal (Sales page) mein barcode input ke saath **📷 Camera button**
- Click karo → dialog khulta hai with live camera feed
- **Scan frame** (corner brackets + animated scan line) — barcode align karne ke liye
- Barcode detect hone pe: dialog band, `handleBarcodeSearch()` call, product cart mein
- **Multi-camera support**: back/front camera, Switch button agar multiple cameras hon
- Back camera automatically prefer hoti hai (mobile pe)
- Permission denied ya camera nahi → clear error message
- **2 second cooldown** — ek scan ke baad dobara scan nahi hoga immediately
- Library: `@zxing/browser` (CODE128, EAN-13, EAN-8, QR, aur 20+ formats)
- File: `frontend/src/components/sales/camera-scanner.tsx`

### ✅ 17. Barcode Label Print
- Inventory page mein har product row pe 🖨️ (Print Label) button
- Dialog mein product name, barcode value dikhta hai
- Copies selector: 1 se 50 tak (+ / − counter)
- Print window mein labels grid mein (3 per row, A4)
- Label design: Product name (bold) + CODE128 barcode (scannable) + barcode number + price
- Agar barcode field khali ho → SKU use hota hai, woh bhi khali ho → `ITEM-{id}`
- JsBarcode CDN se load hota hai — koi npm package install nahi
- Mobile cards mein bhi "Label" button available hai
- **Tested:** 8 products pe buttons confirm, dialog sahi khula, quantity counter min/max sahi, print window 2 labels render kiye ✅

### ✅ 18. Custom Receipt Design
- Store logo upload — receipt ke upar print hota hai (PNG/JPG/WEBP, max 2MB)
- Custom footer message — textarea, max 150 chars, live character count
- Toggle: Tax line dikhe ya nahi (default on)
- Toggle: Donation line dikhe ya nahi (default off)
- Settings page: `/receipt-settings` (admin only)
- Backend: `GET/PUT /api/settings/receipt`, `POST/DELETE /api/settings/receipt/logo`
- Receipt print dialog mein live apply hota hai har sale pe

### ✅ 18. Table Management + KOT System (Restaurant Mode)
- Floor plan: Tables ko sections mein dekho (Main, VIP, etc.)
- Table status: Available (green), Occupied (red), Bill Printed (orange), Split (purple)
- Admin tables add/delete kar sakta hai
- **Order Panel**: Table click karo → products add karo → order open karo
- **Waiter Name**: Har order ke saath waiter ka naam save hota hai
- **Guests counter**: Kitne log baithe hain (header mein)
- **KOT Slip Print**: "Send KOT" dabao → waiter ke liye kitchen slip automatically print hoti hai
  - Slip mein: Table name, KOT number, time, items + notes
  - Waiter slip lekar kitchen counter pe deta hai (koi screen/tablet nahi chahiye)
- **Bill Print**: Sab items ka bill print — customer ko dikhane ke liye
- **Complete Payment**: Cash/Card/Wallet — payment complete hone pe receipt automatically print
  - Receipt mein: Logo, store name, invoice #, table, guests, waiter, items, total, change
  - Invoice # POS terminal ke saath match karta hai (same sales table)
- **Add More Items**: Bill print ke baad bhi aur items add kar sakte hain → naya KOT
- **Bill Split**: Equal ya by-amount — har person alag pay kar sakta hai
- **Sales Integration**: Table payment → automatically `sales` table mein record → dashboard feed + reports mein dikhta hai
- **Re-open Order**: Bill print hone ke baad customer kuch aur mangaye toh reopen
- Settings mein toggle: Retail / Restaurant mode
- Migration file: `Backend/migrations/restaurant_mode.sql`
- DB tables: `restaurant_tables`, `restaurant_orders`, `restaurant_order_items`, `kots`, `bill_splits`
- MySQL column: `ALTER TABLE restaurant_orders ADD COLUMN waiter_name VARCHAR(100) NULL`
- MySQL column: `ALTER TABLE sales ADD COLUMN table_name VARCHAR(50) NULL`

---

## ⚠️ Adhoore Kaam (Karna Baaki Hai)

---

<!-- ### 3. Expense Tracking
**Kya banana hai:**
- Admin shop ke kharchay record kare (rent, bijli, staff salary, etc.)
- Expense categories: Fixed / Variable
- Monthly expense summary report mein bhi aaye
- P&L report mein deduct ho

**Kahan banana hai:**
- New page: `frontend/src/app/expenses/page.tsx`
- New route: `Backend/routes/expenses.js` (CRUD + monthly summary)
- New DB table: `expenses (id, category, description, amount, date, created_by)`
- Sidebar mein "Expenses" link add karo -->

---

### 4. POS Keyboard Shortcuts
**Kya banana hai:**

| Shortcut | Kaam |
|----------|------|
| `F2` | Search bar focus |
| `F4` | Checkout / Payment open |
| `Esc` | Cart clear / Dialog band |
| `Enter` | Confirm action |
| `+` / `-` | Selected item ki quantity |

**Kahan banana hai:**
- `frontend/src/app/sales/page.tsx` — `useEffect` mein `keydown` listeners add karo

---

### 5. Custom Receipt Design
**Kya banana hai:**
- Settings mein section: Receipt Customization
- Store logo upload (receipt pe print ho)
- Custom footer message (e.g. "Thank you! Visit again")
- Toggle: Tax line dikhe ya nahi, Donation line dikhe ya nahi

**Kahan banana hai:**
- `frontend/src/app/settings/page.tsx` — receipt settings section
- `Backend/routes/settings.js` — naye fields: `receipt_logo`, `receipt_footer`, `show_tax_on_receipt`
- `frontend/src/components/sales/receipt-print-dialog.tsx` — in settings ko read karo

---

### 6. Camera-Based Barcode Scanner
**Kya banana hai:**
- Phone ya laptop camera se barcode scan ho
- Sales page pe "Scan with Camera" button
- `@zxing/library` ya `html5-qrcode` use karni hogi

**Kahan banana hai:**
- New component: `frontend/src/components/sales/camera-scanner.tsx`
- `frontend/src/app/sales/page.tsx` — button add karo jo scanner open kare

---

## 📋 Quick Status Table

| Feature | Backend | Frontend | Status |
|---------|---------|----------|--------|
| Barcode scan → cart | ✅ | ✅ | Done |
| Barcode field in product form | ✅ | ✅ | Done |
| Barcode label print | ✅ | ✅ | Done |
| Camera barcode scan | — | ✅ | Done |
| Shift history filters | — | ✅ | Done |
| POS keyboard shortcuts | — | ✅ | Done |
| Custom receipt design | ✅ | ✅ | Done |
| Expense tracking | ❌ | ❌ | **Pending** |
| Split payment | ✅ | ✅ | Done |
| Loyalty points | ✅ | ✅ | Done |
| Supplier management | ✅ | ✅ | Done |
| Reports export | ✅ | ✅ | Done |
| Table management | ✅ | ✅ | Done |
| KOT slip print | ✅ | ✅ | Done |
| Bill split (table) | ✅ | ✅ | Done |
| Restaurant → sales integration | ✅ | ✅ | Done |

---

## 🔮 Future Features (Baad Mein)

### Multiple Branches
- Alag shop locations ka alag inventory aur sales
- Admin ko saari branches ka combined view

### Sales Target / Goal
- Daily ya monthly target set karo
- Dashboard pe progress bar

### Roster / Staff Scheduling
- Admin pehle se plan kare kon kab aayega
- Weekly calendar view
- Attendance vs schedule comparison
- **Kab banao:** Jab staff 5+ ho jaye

<!-- 
### Receipt Email / WhatsApp
- Sale ke baad customer ko receipt email ya WhatsApp pe bhejo
- Settings mein toggle: auto-send on / off
- Customer ka email/phone number profile mein save ho
- **Kab banao:** Jab customer database grow ho jaye -->

### ~~Restaurant Mode~~ ✅ Mukammal Ho Gaya
- Table management, KOT slip, bill split — sab implement ho gaya
- Details Feature #18 mein dekho

---

## ⚙️ Deployment Yaad Daasht

> ⚠️ Deploy karte waqt yeh zaroor karna — warna features kaam nahi karenge

### Windows Task Scheduler — Loyalty Points Expiry
- Loyalty points expire hote hain agar customer 12 months tak koi order na kare
- **Windows Task Scheduler** mein ek monthly task set karo
- Task yeh API call karega: `POST http://localhost:5001/api/loyalty/expire`
- Header: `Authorization: Bearer <admin_token>`
- Schedule: Har mahine ki 1 tarikh, raat 12 baje

**Task banane ka tarika:**
1. Task Scheduler kholo → Create Basic Task
2. Trigger: Monthly → 1st of every month → 12:00 AM
3. Action: Start a program → `curl.exe`
4. Arguments: `-X POST http://localhost:5001/api/loyalty/expire -H "Authorization: Bearer YOUR_TOKEN"`

---

## 🏪 Kon Kon Se Business Yeh POS Use Kar Sakte Hain

> Elites POS ek **General Retail POS System** hai — restaurant ke liye nahi, dukan aur shop ke liye hai.

| # | Business Type | Suitable? | Notes |
|---|---|---|---|
| 1 | Kapde / Garments ki Dukan | ✅ Bilkul | Variants (size/color) + inventory |
| 2 | Grocery / General Store | ✅ Bilkul | Barcode scan + bulk import |
| 3 | Electronics Shop | ✅ Bilkul | SKU + variants + supplier management |
<!-- | 4 | Medical / Pharmacy Store | ✅ Bilkul | Expiry tracking future mein add ho sakta hai | -->
| 5 | Cosmetics / Beauty Shop | ✅ Bilkul | Loyalty points customers ko attract karte hain |
| 6 | Stationery / Books Shop | ✅ Bilkul | Barcode + categories |
| 7 | Shoe Store | ✅ Bilkul | Size variants ke saath |
| 8 | Mobile Accessories Shop | ✅ Bilkul | SKU auto-generate + low stock alerts |
| 9 | Bakery / Sweet Shop | ✅ Bilkul | Unit types (kg, g) support karta hai |+
| 10 | Hardware / Tools Shop | ✅ Bilkul | Supplier + purchase orders |
| 11 | Restaurant / Cafe | ✅ Bilkul | Table management + KOT + Bill split implement ho gaya |
| 12 | Online-Only Store | ❌ Suitable Nahi | Yeh in-person POS hai |

### Sabse Zyada Suitable Businesses
- **Retail shops** jahan counter pe customer aata hai aur saman khareedta hai
- Jahan **barcode scanner** use hoti hai
- Jahan **shift-wise** cashier kaam karte hain
- Jahan **loyalty program** se customers ko wapas laana ho
