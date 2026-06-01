# Elites POS — Hamza ka Guide
### Har Feature Ko Kaise Use Karein

---

## 🕐 1. Shift Management (Shifts)

> **Kya hai?** Cashier apni duty shuru aur khatam karte waqt cash record karta hai.

### Shift Kaise Shuru Karein
1. Sidebar mein **"Shifts"** click karo
2. **"Open Shift"** button dabao
3. **Opening Cash** dalo — jitna cash drawer mein hai (e.g. `5000`)
4. **"Start Shift"** click karo ✅

### Shift ke Doran
- Sales karo — sab automatically us shift se link ho jaata hai
- Agar drawer se cash nikalna ho → **"Cash Out"** button dabao, reason aur amount dalo
- Agar extra cash daalna ho → **"Cash In"** button dabao

### Shift Kaise Band Karein
1. **"Close Shift"** button click karo
2. Drawer mein jo actual cash hai woh count karo aur **Closing Cash** mein dalo
3. System batayega: Expected cash kitna tha, actual kitna hai, **variance** kitna hai
4. **"Close Shift"** confirm karo ✅
5. Report print kar sakte ho

---

## 🏷️ 2. Discount Coupons

> **Kya hai?** Promo codes banao jo checkout pe apply ho saken.

### Coupon Kaise Banayein (Admin)
1. Sidebar mein **"Coupons"** click karo
2. **"New Coupon"** button dabao
3. Fill karo:
   - **Code** → e.g. `EID20`
   - **Type** → Percentage (%) ya Flat Amount (Rs.)
   - **Value** → e.g. `20` (matlab 20% off)
   - **Min Order** → e.g. `500` (minimum Rs. 500 ka order chahiye)
   - **Expiry Date** → optional
4. **"Create"** click karo ✅

### Customer Ko Discount Kaise Milegi
1. POS (Sales page) pe items cart mein daalo
2. **"Coupon"** field mein code type karo → e.g. `EID20`
3. **"Apply"** dabao — discount automatically calculate hoga
4. Checkout karo — receipt pe discount dikh jaayega

---

## 🚚 3. Supplier / Vendor Management

> **Kya hai?** Jo companies ya log aapko maal dete hain unka record rakho aur stock orders manage karo.

### Supplier Kaise Add Karein
1. Sidebar mein **"Suppliers"** click karo
2. **"Add Supplier"** button dabao
3. Naam, phone, email, address dalo
4. **"Create"** click karo ✅

### Purchase Order (PO) Kaise Banayein
> Jab stock mangwana ho supplier se

1. **"Purchase Orders"** tab click karo
2. **"New PO"** button dabao
3. Supplier select karo
4. **"Add Row"** se products add karo:
   - Product select karo
   - Quantity dalo (kitna mangwana hai)
   - Unit Cost dalo (supplier kitne mein de raha hai)
5. Expected delivery date dalo (optional)
6. **"Create PO"** click karo ✅

### PO Status Update Karein
| Status | Matlab |
|---|---|
| **Draft** | Abhi order bana hai, bheja nahi |
| **Sent** | Supplier ko order bhej diya |
| **Partially Received** | Kuch maal aa gaya, kuch baaki |
| **Received** | Poora maal aa gaya |
| **Cancelled** | Order cancel ho gaya |

### Maal Aane Pe Stock Receive Karein
1. PO ki row mein **"View Details"** click karo
2. **"Receive Stock"** button dabao
3. Har item ke liye jo quantity aayi hai woh dalo
4. **"Confirm Receive"** click karo ✅
5. **Inventory automatically update ho jaayegi!**

---

## ⭐ 4. Loyalty Points System

> **Kya hai?** Customer har purchase pe points earn karta hai jo baad mein discount mein use ho saken.

### Points Kaise Earn Hote Hain
- **PKR 100 kharch = 1 Point**
- Automatically milte hain har sale pe
- Customer ka account hona chahiye (Customer registered ho)

### Points Kaise Redeem Hote Hain (Checkout Pe)
1. POS pe items cart mein daalo
2. Customer select karo (uske points dikh jaayenge)
3. **"Redeem Points"** toggle on karo
4. Kitne points lagane hain woh dalo
5. **1 Point = Rs. 1 discount**
6. Checkout karo ✅

### Loyalty Rules (Yaad Rakhein)
| Rule | Detail |
|---|---|
| Minimum redeem | 100 points hone chahiye |
| Maximum redeem | Bill ka sirf 30% points se pay ho sakta hai |
| Expiry | 12 mahine tak koi purchase nahi → points expire |
| Return pe | Points wapas account mein aa jaate hain |

### Customer Ki Points History Kaise Dekhein
1. Sidebar mein **"Customers"** click karo
2. Customer ka naam click karo
3. **Loyalty tab** mein poori history dikh jaayegi:
   - Total earned points
   - Total redeemed points
   - Current balance

---

## 📦 5. Product Variants

> **Kya hai?** Ek product ke multiple sizes ya types — har ek ka alag price. Jaise Burger → Small, Medium, Large.

### Variant Kaise Add Karein (Inventory mein)
1. Sidebar mein **"Inventory"** click karo
2. Kisi product ki row mein **Edit (✏️)** button dabao
3. Dialog ke andar neeche **"Variants"** section milega
4. **"+ Add Variant"** click karo
5. Har row mein dalo:
   - **Variant Name** → e.g. `Small`, `Medium`, `Large`
   - **Price** → e.g. `150`, `200`, `250`
6. Jitne chahein utne variants add karo
7. **"Save"** click karo ✅

### Naya Product Add Karte Waqt Variants
1. **"Add Product"** dialog mein bhi Variants section hoga
2. Same tarika — `+ Add Variant` se rows add karo
3. Product save hone ke saath variants bhi save ho jaayenge

### POS Terminal Pe Variant Kaise Select Hota Hai
1. Sales page pe koi variant-wala product click karo
2. **Popup khulega** — sab variants list mein dikhenge with prices
3. Jo size chahiye woh click karo
4. Cart mein add ho jaayega — naam aayega: **"Burger — Medium"**
5. Alag variants alag cart items hote hain — dono ek saath bhi ho sakte hain

### Example
```
Product: Burger
├── Small    → Rs. 150
├── Medium   → Rs. 200
└── Large    → Rs. 250
```
Customer ne Medium aur Large dono order kiye → cart mein 2 alag items.

### Variants Kaise Edit / Delete Karein
- Inventory → Product Edit → Variants section
- **X button** se variant remove karo
- Name ya price change karo
- Save karo → POS pe immediately update ho jaayega

---

## 🍽️ 6. Restaurant Mode — Table Management & KOT

> **Kya hai?** Restaurant ke liye table floor plan, kitchen order tickets (KOT), aur bill split system. Settings mein toggle ON karne se activate hota hai.

### Pehli Baar Setup (Admin)
1. Sidebar → **"Settings"** click karo
2. Neeche scroll karo → **"POS Mode"** card milega
3. **Restaurant Mode** toggle **ON** karo
4. **Save** dabao ✅
5. Sidebar mein **Tables** aur **Kitchen** links aa jaayenge

---

### Table Management (`/tables`)

#### Tables Ka Rang Kya Matlab Rakhta Hai
| Rang | Matlab |
|---|---|
| 🟢 **Green** | Table khali hai (Available) |
| 🔴 **Red** | Order chal raha hai (Occupied) |
| 🟠 **Orange** | Bill print ho chuka, payment baaki |
| 🟣 **Purple** | Bill split hua hai |

#### Naya Order Kaise Kholein
1. Sidebar → **"Tables"** click karo
2. Koi **Green (khali) table** click karo
3. **Order Panel** khul jaayega
4. Upar **Pax** set karo (kitne log hain)
5. Products search karo ya list se click karo → cart mein add ho jaayenge
6. **"Open Order + Send KOT"** dabao ✅
7. Table **Red** ho jaayegi — matlab order chal raha hai
8. Kitchen ko automatically KOT (ticket) chali jaayegi

#### Baad Mein Aur Items Add Karna
1. Red table pe click karo
2. Nayi items cart mein add karo
3. **"Send KOT"** dabao → kitchen ko naya ticket jaayega
4. Jo items pehle se kitchen ko gayi hain unpe **"Sent to kitchen"** badge dikhi hai

#### Bill Print Karna
1. Table pe click karo
2. **"Print Bill"** dabao
3. Table **Orange** ho jaayegi
4. Customer ko bill dikha sakte ho

#### Payment Complete Karna
1. Table pe click karo
2. **"Complete Payment"** dabao ✅
3. Table wapas **Green** ho jaayegi — agle customer ke liye tayar

---

### KOT System — Kitchen Display (`/kitchen`)

> **KOT = Kitchen Order Ticket** — jab order hoti hai toh kitchen ko yeh ticket milti hai

#### Kitchen Display Kaise Kaam Karta Hai
1. Sidebar → **"Kitchen"** click karo
2. Saari active KOTs dikhti hain
3. Page **har 10 second** mein automatically refresh hota hai
4. **"Refresh Now"** button se manually bhi refresh kar sakte ho

#### KOT Ka Rang aur Status
| Rang | Status | Matlab |
|---|---|---|
| 🟡 Yellow | Pending | Kitchen ko mili, abhi shuru nahi |
| 🟠 Orange | Cooking | Khaana ban raha hai |
| 🟢 Green | Ready | Tayyar hai, serve karo |
| 🔵 Blue | Served | Customer ko mil gaya |

#### KOT Status Kaise Badlein (Kitchen Staff)
1. Kitchen page pe KOT card dekhein
2. **"Start Cooking"** dabao → Pending se Cooking
3. **"Mark Ready"** dabao → Cooking se Ready
4. **"Mark Served"** dabao → Ready se Served

#### KOT Card Pe Kya Dikhta Hai
- Table ka naam (e.g. T-01)
- KOT number
- Kitne minute pehle order aayi
- Pax (kitne log)
- Items list with quantity

---

### Bill Split — Ek Bill Ko Alag Karna

> **Kab use karein?** Jab customers mein se har koi apna apna hissa pay karna chaahe

1. Table pe click karo → Order Panel khule
2. **"Split Bill"** button dabao
3. **Split Method** choose karo:
   - **Equal Split** → Sab mein barabar divide (recommended)
   - **By Amount** → Khud amount dalo har person ke liye
4. Persons ke naam daal sakte ho (optional)
5. **"Save Split"** dabao ✅
6. Table **Purple** ho jaayegi
7. Jab koi person pay kare → uske naam ke saath **"Pay"** dabao
8. Jab sab pay kar dein → table automatically **Green** ho jaayegi

---

### Naya Table Add Karna (Admin)
1. Tables page pe upar **"Add Table"** button
2. Table naam dalo (e.g. T-11)
3. Capacity dalo (kitne log baith sakte hain)
4. Floor Section dalo (e.g. Main, VIP, Outdoor)
5. **"Add Table"** click karo ✅

### Table Delete Karna (Admin)
- Sirf **Green (khali)** tables delete ho sakti hain
- Table card pe hover karo → upar right corner mein 🗑️ icon aayega
- Click karo → delete ✅

---

### Pura Workflow — Ek Customer Ka Safar

```
1. Table khali (Green) → Click karo
2. Pax set karo (e.g. 2 log)
3. Items add karo → "Open Order + Send KOT"
4. Table Red ho gayi ✅
5. Kitchen mein KOT dikhi → "Start Cooking" → "Mark Ready"
6. Khaana serve karo → "Mark Served"
7. Baad mein aur order → "Send KOT" (repeat)
8. Bill time → "Print Bill" → Table Orange
9. Payment → "Complete Payment" → Table Green ✅
```

---

## 🏷️ 7. Barcode Label Print

> **Kya hai?** Inventory mein kisi bhi product ka barcode label print karo — ek ya multiple copies — jo product pe chipkaya ja sake.

### Label Pe Kya Hota Hai
```
┌──────────────────────┐
│    Product Name      │  ← Product ka naam
│  ||||||||||||||||    │  ← Scannable barcode
│    111111112211      │  ← Barcode number
│      Rs. 150         │  ← Price
└──────────────────────┘
Label size: 5cm × 3cm
```

### Label Kaise Print Karein
1. Sidebar → **"Inventory"** click karo
2. Kisi bhi product ki row mein **🖨️ (Printer icon)** button dabao
3. Dialog khulega — product naam aur barcode number dikhe ga
4. **Copies** select karo — kitne labels chahiye (1 se 50 tak)
   - **`+`** dabao → copies badhaao
   - **`−`** dabao → copies ghataao
   - Ya seedha number type karo box mein
5. **"Print X Labels"** button dabao ✅
6. Browser mein print window khulega → labels grid mein dikhenge
7. **Print** karo (Ctrl+P) ya printer automatically dialog aayega

### Barcode Ka Source
| Product mein kya hai | Label mein kya barcode aayega |
|---|---|
| Barcode field filled | Wahi barcode use hoga |
| Barcode khali, SKU hai | SKU use hoga |
| Dono khali | `ITEM-{id}` auto-generate hoga |

### Tips
- **Thermal printer** ke liye label size CSS mein `4cm × 2.5cm` recommend hai
- Ek A4 page pe **3 labels per row** print hote hain
- **Mobile** pe bhi kaam karta hai — product card mein "Label" button hai
- Barcode **CODE128 format** hai — standard barcode scanner se scan hoga

---

## 📋 Quick Reference — Kaunsa Feature Kahan Hai

| Feature | Sidebar Menu | Kaun Use Kar Sakta Hai |
|---|---|---|
| Shifts | Shifts | Admin + Cashier |
| Coupons banao | Coupons | Sirf Admin |
| Coupon apply karo | Sales (POS) | Admin + Cashier |
| Suppliers | Suppliers | Sirf Admin |
| Purchase Orders | Suppliers → PO Tab | Sirf Admin |
| Loyalty Points earn | Automatic (har sale pe) | — |
| Points redeem karo | Sales (POS) | Admin + Cashier |
| Points history | Customers | Admin + Cashier |
| Variants add karo | Inventory → Edit Product | Sirf Admin |
| Variant select karo | Sales (POS) → Product click | Admin + Cashier |
| Barcode label print | Inventory → 🖨️ button | Admin + Cashier |
| Camera barcode scan | Sales (POS) → 📷 button | Admin + Cashier |
| Restaurant Mode ON | Settings → POS Mode toggle | Sirf Admin |
| Tables dekhna | Tables | Admin + Cashier |
| Order kholna | Tables → Table click | Admin + Cashier |
| Kitchen dekhna | Kitchen | Admin + Cashier |
| KOT status update | Kitchen → KOT card buttons | Admin + Cashier |
| Bill split | Tables → Table click → Split Bill | Admin + Cashier |

---

## 📷 8. Camera Barcode Scanner

> **Kya hai?** Phone ya laptop ka camera use karke product ka barcode scan karo — USB scanner ki zarurat nahi. POS Terminal (Sales page) pe available hai.

### Kaise Use Karein
1. Sidebar → **"POS Terminal"** click karo
2. Upar search bar ke saath **📷 Camera icon** button dikhega
3. **Camera button** click karo
4. Browser permission maangega → **"Allow"** click karo ✅
5. Camera dialog khulega — live video feed dikhega
6. Product ka barcode **scan frame ke andar** rakho
7. Barcode automatically detect hoga → dialog band ho jaayega
8. Product **cart mein add** ho jaayega ✅

### Scan Frame Kya Hai
```
┌──────────────────────────┐
│                          │
│   ┌──────────────────┐   │  ← Yahan barcode rakho
│   │ ————————————————  │   │  ← Yeh line upar neeche move karti hai
│   └──────────────────┘   │
│                          │
└──────────────────────────┘
```
- **Corner brackets** ke andar barcode align karo
- **Moving line** barcode pe aane do — scan ho jaayega

### Multiple Cameras (Mobile pe)
- Agar device mein front aur back dono cameras hain
- Dialog mein **"Switch"** button aayega
- Click karo → camera badal jaayega
- **Back camera** automatically prefer hoti hai (zyada clear scan ke liye)

### Scan ke Baad Kya Hoga
| Scenario | Kya hoga |
|---|---|
| Product mila + stock hai | Cart mein add, dialog band, beep sound ✅ |
| Product mila + out of stock | Error toast, dialog band ❌ |
| Barcode nahi mila DB mein | "Barcode nahi mila" error ❌ |
| Camera permission denied | "Allow karo" error message |
| Camera nahi device pe | "Koi camera nahi mila" error |

### Tips
- **Achhi roshni** ho toh scan fast hota hai
- Barcode **seedha** (teda nahi) rakho frame ke andar
- **2 second cooldown** hota hai — ek scan ke baad dobara automatically nahi scan hoga
- USB scanner bhi sath sath kaam karta hai — dono available hain

---

## ⌨️ 9. POS Keyboard Shortcuts

> **Kya hai?** POS Terminal (Sales page) pe mouse ki jagah keyboard se kaam karo — faster billing!

### Shortcuts Table

| Key | Kaam |
|-----|------|
| `F2` | Search bar pe focus jaata hai |
| `F4` | Payment dialog khulta hai (cart khali nahi hona chahiye) |
| `Esc` | Dialog band karo / selected item deselect karo |
| `↑` Arrow Up | Cart mein upar wala item select karo |
| `↓` Arrow Down | Cart mein neeche wala item select karo |
| `+` ya `=` | Selected item ki quantity +1 karo |
| `-` | Selected item ki quantity -1 karo (1 pe aake remove hoga) |

### Kaise Use Karein

**Search (F2):**
1. Koi bhi key dabao → `F2` dabao
2. Search bar focus ho jaayega — type karo product ka naam

**Payment (F4):**
1. Cart mein items daalo
2. `F4` dabao → Payment dialog khul jaayega
3. Amount enter karo → Enter ya mouse se confirm

**Cart Item Select + Quantity (+/-):**
1. `↓` Arrow Down dabao → pehla item highlight ho jaayega (purple border)
2. `↓` aur `↑` se alag item pe jao
3. `+` dabao → quantity +1
4. `-` dabao → quantity -1 (agar 1 pe aa jaaye toh item remove ho jaayega)
5. `Esc` dabao → deselect

### Tips
- Shortcuts sirf **Sales (POS)** page pe kaam karte hain
- Input box mein type karte waqt `+`/`-` shortcuts **nahi** chalenge (conflict se bachao)
- Search placeholder mein `(F2)` likh diya hai — reminder ke liye

---

## ⚠️ Common Mistakes (Jo Avoid Karein)

1. **Shift band kiye bina POS use karna** → Shift pehle open karo
2. **Coupon code galat type karna** → Code capital letters mein hona chahiye (e.g. `EID20` not `eid20`)
3. **Customer select kiye bina points redeem karna** → Pehle customer select karo POS pe
4. **PO banane ke baad stock receive nahi karna** → Maal aane pe zaroor "Receive Stock" karo warna inventory update nahi hogi
5. **Inactive supplier pe PO banana** → Supplier active hona chahiye
6. **Variant wale product ka base price** → Agar variants hain toh POS pe variant ka price use hoga, base price ignore hoga
7. **Restaurant Mode ke baad sidebar mein Tables/Kitchen nahi dikh raha** → Settings mein Save dabao aur page reload karo
8. **Red table pe order nahi khul raha** → Table already occupied hai, us table ki existing order dekhein
9. **KOT kitchen pe nahi dikh rahi** → Kitchen page pe "Refresh Now" dabao ya 10 second wait karo
10. **Bill split mein unequal amount** → "Save Split" se pehle balance indicator green hona chahiye
11. **Label print mein barcode nahi dikh raha** → Product ka barcode ya SKU field fill karo Inventory mein
12. **Print window nahi khul raha** → Browser ka popup blocker off karo (Allow popups for localhost)

---

*
