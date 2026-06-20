# Elites POS — Desktop App (Electron + SQLite)

> Yeh file pore desktop app banane ka roadmap hai.
> Kaam hone pe [ ] → [x] ho jaayega.

---

## Architecture

```
Electron (Windows .exe)
├── Next.js Frontend   → Electron window mein load hoga
├── Express.js Backend → Electron ke andar child process
└── SQLite Database    → local .db file (internet nahi chahiye)
```

> 🏢 **Multi-tenant note:** Desktop app **ek machine = ek dukaan** hota hai. Multi-tenant (kai shops ek server par)
> sirf **VPS/cloud** wale setup ke liye hai (dekho `DEPLOY-VPS.md` / `TENANT.md`). Desktop build par har install
> bas **Default Store (tenant 1)** ke taur par chalta hai — `tenant_id` columns DB mein rehte hain (schema same),
> lekin SuperAdmin/tenant-creation panel desktop par use nahi hota. License model bhi yahi hai: **1 shop = 1 license key**.
> (Agar future mein chahiye to desktop par bhi local multi-tenant on kiya ja sakta hai, par aam taur par zaroorat nahi.)

---

## Phase 1 — Dependencies Install

- [ ] **1.1** Root `package.json` banao (Electron ke liye)
- [ ] **1.2** Electron install karo: `npm install electron --save-dev`
- [ ] **1.3** Electron Builder install karo: `npm install electron-builder --save-dev`
- [ ] **1.4** Concurrently install karo: `npm install concurrently --save-dev`
- [ ] **1.5** Backend mein SQLite install karo: `npm install better-sqlite3`
- [ ] **1.6** MySQL2 dependency hataao Backend se (SQLite replace karega)

---

## Phase 2 — MySQL → SQLite Migration (Backend)

> Yeh sabse bara kaam hai — har route file mein db calls update hongi.

### 2.1 Database Connection
- [ ] `Backend/db.js` replace karo — mysql2 pool ki jagah better-sqlite3 connection
- [ ] SQLite file path set karo: `pos_system.db` (user ke Documents folder mein)

### 2.2 Schema — SQLite format mein convert karo
- [ ] `Backend/sqlite-schema.sql` banao — **schema.sql + saari tenant migrations ko mila kar** (tenant_id columns + `tenants` table include ho)
- [ ] MySQL specific syntax hataao (AUTO_INCREMENT → INTEGER PRIMARY KEY, ENUM → TEXT, etc.)
- [ ] Seed: **Default Store (tenant 1)** + admin user (`admin@elites.com`) — desktop ek tenant par chalta hai
- [ ] App pehli baar chale toh schema auto-create ho

### 2.3 Routes — Async/Await → Sync (better-sqlite3)
- [ ] `Backend/routes/auth.js` — SQLite syntax
- [ ] `Backend/routes/products.js` — SQLite syntax
- [ ] `Backend/routes/sales.js` — SQLite syntax (transactions)
- [ ] `Backend/routes/customers.js` — SQLite syntax
- [ ] `Backend/routes/reports.js` — SQLite syntax (JSON_ARRAYAGG replace)
- [ ] `Backend/routes/shifts.js` — SQLite syntax
- [ ] `Backend/routes/expenses.js` — SQLite syntax
- [ ] `Backend/routes/coupons.js` — SQLite syntax
- [ ] `Backend/routes/loyalty.js` — SQLite syntax
- [ ] `Backend/routes/suppliers.js` — SQLite syntax
- [ ] `Backend/routes/notifications.js` — SQLite syntax
- [ ] `Backend/routes/dashboard.js` — SQLite syntax
- [ ] `Backend/routes/settings.js` — SQLite syntax
- [ ] `Backend/routes/tables.js` — SQLite syntax
- [ ] `Backend/routes/orders.js` — SQLite syntax
- [ ] `Backend/routes/kitchen.js` — SQLite syntax
- [ ] `Backend/routes/menu.js` — SQLite syntax
- [ ] `Backend/routes/tenants.js` — SQLite syntax (desktop par optional — agar multi-tenant off hai to skip)
- [ ] `Backend/utils/tenantSequence.js` — SQLite syntax (per-tenant numbering; sync API mein convert)

### 2.4 Test
- [ ] Backend SQLite ke saath standalone test karo
- [ ] Login karo, sale banao, report dekho — sab kuch verify

---

## Phase 3 — Electron Setup

- [ ] **3.1** `electron/main.js` banao — main process file
  - App window create karo (1280x800)
  - Express backend ko child process mein start karo
  - Backend ready hone ke baad frontend load karo
  - App band hone pe backend bhi band karo

- [ ] **3.2** `electron/preload.js` banao — security bridge

- [ ] **3.3** `electron/splash.html` banao — loading screen
  - "Elites POS" logo
  - Loading bar
  - "Starting..." message

- [ ] **3.4** Root `package.json` scripts set karo:
  ```json
  "start": "concurrently \"node Backend/index.js\" \"next dev frontend\"",
  "electron": "electron .",
  "dev": "concurrently \"node Backend/index.js\" \"electron .\"",
  "build": "next build frontend && electron-builder"
  ```

---

## Phase 4 — Next.js Build Configuration

- [ ] **4.1** `frontend/next.config.js` update karo — static export ya local server
- [ ] **4.2** API base URL dynamic banao — `http://localhost:5001/api` (hardcode nahi)
- [ ] **4.3** Frontend build test karo: `npm run build` frontend folder mein

---

## Phase 5 — Electron Builder Config (.exe Installer)

- [ ] **5.1** `electron-builder.yml` banao root mein:
  ```yaml
  appId: com.elites.pos
  productName: Elites POS
  win:
    target: nsis
    icon: assets/icon.ico
  nsis:
    oneClick: false
    allowToChangeInstallationDirectory: true
    createDesktopShortcut: true
    createStartMenuShortcut: true
  files:
    - Backend/**
    - electron/**
    - frontend/.next/**
    - frontend/public/**
    - node_modules/**
  ```

- [ ] **5.2** App icon banao — `assets/icon.ico` (256x256)
- [ ] **5.3** Installer mein Node.js bundle karo (client pe Node install nahi chahiye)

---

## Phase 6 — Auto-Start & System Integration

- [ ] **6.1** Windows startup pe auto-start option (optional)
- [ ] **6.2** System tray icon — minimize karo tray mein, close nahi
- [ ] **6.3** App version number set karo (package.json mein)

---

## Phase 7 — Data & Backup

- [ ] **7.1** Database file location: `C:/Users/<user>/Documents/ElitesPOS/pos_system.db`
- [ ] **7.2** Settings mein "Backup Database" button — `.db` file copy karo
- [ ] **7.3** Settings mein "Restore Database" button — backup se restore karo

---

## Phase 10 — Developer Lock (Setup PIN)

> Client settings mein sirf general cheezein change kar sake — POS Mode aur Features sirf tum change kar sako.

- [ ] **10.1** Database mein `setup_pin` column add karo `settings` table mein
- [ ] **10.2** Settings page mein **2 sections** banao:

  **Section A — General** (Client khud change kar sakta):
  - Store Name, Logo, Tax Rate, Receipt Footer, Currency

  **Section B — System Settings** (PIN se lock):
  - POS Mode (Retail / Restaurant)
  - Feature toggles (Barcode, Loyalty, Coupons, Suppliers, Expenses, Shifts)

- [ ] **10.3** "System Settings" section pe lock icon — PIN dialog khule
- [ ] **10.4** Sahi PIN → settings unlock, galat PIN → access denied
- [ ] **10.5** PIN change karne ka option bhi PIN ke peeche rakho
- [ ] **10.6** Default PIN: `0000` — pehli install pe change karo

---

## Phase 11 — License Key System

> Har client ka alag license — copy/share nahi ho sakta.

### 11.1 Machine ID
- [ ] Electron mein Machine ID generate karo (CPU + HDD serial se)
- [ ] Machine ID app mein dikhao (activation screen pe)
- [ ] Format: `XXXX-XXXX-XXXX` (har PC ka alag)

### 11.2 Activation Screen
- [ ] App pehli baar khule → License Key maange:
  ```
  ┌──────────────────────────────────┐
  │     ELITES POS — Activation      │
  │                                  │
  │  Machine ID: AB3F-9X2K-7P1Q      │
  │  (Yeh ID developer ko bhejo)     │
  │                                  │
  │  License Key:                    │
  │  [____-____-____-____]           │
  │                                  │
  │  WhatsApp: 03XX-XXXXXXX          │
  │       [ Activate ]               │
  └──────────────────────────────────┘
  ```
- [ ] Key sahi → app khule, galat → band rahe
- [ ] Activated hone ke baad screen dobara na aaye

### 11.3 License Key Generator (Tumhare liye)
- [ ] Ek alag simple tool banao — `key-generator.exe` (sirf tumhare paas)
- [ ] Client ka Machine ID daalo → License Key generate ho
- [ ] Key WhatsApp/Email se bhejo client ko

### 11.4 Key Validation Logic
- [ ] Key Machine ID se mathematically linked ho
- [ ] Ek key sirf ek PC pe kaam kare
- [ ] Key SQLite mein save ho — internet nahi chahiye validate karne ke liye

### 11.5 Pricing Model
- [ ] 1 Shop  → 1 License Key → Rs. X
- [ ] 2 Shops → 2 License Keys → Rs. X (discount)
- [ ] Extra shop baad mein → naya key = extra payment

---

## Phase 12 — Advanced Security

> Client fraud se poori tarah protected raho.

### 12.1 License Expiry System
- [ ] License Key mein expiry date embed karo (1 saal default)
- [ ] App har start pe expiry check kare
- [ ] 30 din pehle warning dikhao: `"License 30 din mein expire hogi — renew karo"`
- [ ] Expire hone pe **Grace Period** (7 din) — sirf basic sales, reports/settings band
- [ ] Grace Period khatam → App bilkul band
- [ ] Renewal = naya License Key bhejo client ko

```
Timeline:
Day 1      → License Active ✅
Day 335    → "30 din baaki" warning ⚠️
Day 365    → Grace Period shuru 🟡
Day 372    → App band 🔴
```

---

### 12.2 Trial Mode (14 Din)
- [ ] Fresh install pe automatically 14 din trial
- [ ] Trial mein sab features available
- [ ] Har start pe: `"Trial: X din baaki"`
- [ ] Day 15 → Activation screen aaye
- [ ] Trial extend nahi ho sakta (Machine ID se track)

---

### 12.3 Encrypted Database (SQLCipher)
- [ ] `better-sqlite3` ki jagah `@journeyapps/sqlcipher` use karo
- [ ] Database password app ke andar hidden ho (client ko pata na chale)
- [ ] DB Browser se kholne ki koshish → sirf garbage dikhega
- [ ] Backup bhi encrypted ho

---

### 12.4 Receipt Watermark
- [ ] Har receipt ke neeche: `Powered by Elites POS`
- [ ] Watermark Settings mein remove nahi ho sakta (PIN ke peeche bhi nahi)
- [ ] Font small rakho — professional lage

---

### 12.5 Code Protection (ASAR Pack)
- [ ] Electron Builder mein ASAR enable karo
- [ ] JavaScript code `.asar` archive mein pack ho
- [ ] Source code directly readable nahi hoga
- [ ] Extra: `javascript-obfuscator` se code obfuscate karo build pe

---

### 12.6 Remote Kill Switch (Optional — Internet chahiye)
- [ ] Mahine mein 1 baar tumhare server pe ping kare
- [ ] Ping: Machine ID + License Key bheje
- [ ] Tumhara server respond kare: `active` ya `revoked`
- [ ] `revoked` → Next start pe app band
- [ ] Internet na ho → Last check se 30 din tak chale (offline grace)
- [ ] Kab use karo: Client payment band kare, fraud kare

---

### 12.7 Tamper Detection
- [ ] App apni critical files ka hash check kare start pe
- [ ] Hash match na kare → `"App files corrupt hain, reinstall karo"` → band
- [ ] Ye prevent karta hai: Koi developer hire karke license check remove na kare

---

### 12.8 Anti-Screenshot / Screen Capture (Optional)
- [ ] Electron mein `setContentProtection(true)` — screen record nahi ho sakta
- [ ] Competitor apna data screenshot karke apni app mein na dale

---

## Phase 8 — Build & Test

- [ ] **8.1** Development mode mein test karo: `npm run dev`
- [ ] **8.2** Production build banao: `npm run build`
- [ ] **8.3** `.exe` installer test karo — fresh Windows machine pe install karo
- [ ] **8.4** Sab features test karo:
  - [ ] Login / Logout
  - [ ] Sale banana
  - [ ] Inventory add karo
  - [ ] Report dekho
  - [ ] Expenses add karo
  - [ ] Receipt print karo
  - [ ] Shift open/close karo
- [ ] **8.5** App band karo → wapas kholo → data preserved hai

---

## Phase 9 — Client Delivery

- [ ] **9.1** Final `.exe` installer rename karo: `ElitesPOS-Setup-v1.0.exe`
- [ ] **9.2** Client ko install guide do (1 page PDF)
- [ ] **9.3** Default login credentials do: `admin@elites.com / admin123`
- [ ] **9.4** Client se test karwao — approval lo

---

## Summary

| Phase | Kaam | Est. Time |
|---|---|---|
| Phase 1 | Dependencies | 30 min |
| Phase 2 | MySQL → SQLite | 2 din |
| Phase 3 | Electron Setup | 4 ghante |
| Phase 4 | Next.js Config | 1 ghanta |
| Phase 5 | Installer Config | 2 ghante |
| Phase 6 | System Integration | 2 ghante |
| Phase 7 | Data & Backup | 2 ghante |
| Phase 8 | Build & Test | 1 din |
| Phase 9 | Client Delivery | 1 ghanta |
| Phase 10 | Developer Lock (Setup PIN) | 3 ghante |
| Phase 11 | License Key System | 1 din |
| Phase 12 | Advanced Security | 1 din |
| **Total** | | **~7 din** |

---

## Notes

- SQLite database ek single file hai — backup lena aur restore karna aasaan
- Internet ki zaroorat kabhi nahi hogi
- Ek baar `.exe` install karo — kaam shuru
- Update dena ho toh naya `.exe` bhejo — install karo, data safe rahega
