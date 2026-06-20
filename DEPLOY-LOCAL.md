# 🏪 Elites POS — Local Deployment Guide (Multi-Tenant ready)
### (Client ke Computer pe Install karna)

---

## 📌 Yeh Guide Kab Use Karo

- Client ki dukan mein jaake aap khud install karo
- Internet ki zaroorat nahi hogi daily use ke liye
- Ek hi location / branch ho
- Small shop ya restaurant ho

---

## 🧠 Multi-Tenant Note (Local ke liye)

> System ab **multi-tenant** hai — har table me `tenant_id` hota hai. Isliye database setup me
> **schema.sql ke saath saari migration files bhi chalani ZAROORI hain**, warna app `tenant_id`
> na milne par crash karegi.
>
> **Single local shop ke liye:** bas **Default Store (tenant 1)** use karo — `admin@elites.com` se login.
> Ek hi machine par multiple tenants chahiye to **SuperAdmin** (`superadmin@elites.com`) se tenant bana sakte ho (zaroori nahi).

---

## 💻 Step 1 — Client ke Computer pe Software Install karo

### 1.1 Node.js Install karo
1. Browser mein jao: `https://nodejs.org`
2. **LTS version** download karo (green wala button)
3. `.exe` file run karo, Next → Next → Install
4. Verify karo: Command Prompt kholo, type karo:
   ```
   node --version
   ```
   Agar version number aaye (jaise `v20.0.0`) toh install ho gaya ✅

### 1.2 MySQL Install karo
1. Browser mein jao: `https://dev.mysql.com/downloads/installer/`
2. **MySQL Installer** download karo
3. Install karte waqt:
   - Type: `Developer Default` select karo
   - Root password set karo — **yaad rakhna zaroori hai!**
   - Baaki sab Next → Execute → Finish
4. Verify karo: Command Prompt mein:
   ```
   mysql --version
   ```

---

## 📁 Step 2 — POS System Files Copy karo

### 2.1 Project folder copy karo
- Apna `pos-system` folder USB drive ya Google Drive se client ke computer pe copy karo
- Recommend location: `C:\elites-pos\`

### 2.2 Folder structure check karo
```
C:\elites-pos\
├── Backend\
├── frontend\
├── schema.sql
└── DEPLOY-LOCAL.md
```

---

## 🗄️ Step 3 — Database Setup karo

### 3.1 MySQL Workbench kholo
- Start Menu → MySQL → MySQL Workbench
- Root connection pe double click karo
- Password enter karo

### 3.2 Database banao
MySQL Workbench mein top mein **Query tab** mein yeh paste karo aur Run karo (⚡ button):
```sql
CREATE DATABASE pos_system;
```

### 3.3 Schema + Migrations import karo (ORDER zaroori hai)
File menu → Open SQL Script → har file kholo aur Execute (⚡) karo — **isi order me**:

1. `schema.sql`
2. `schema_tenant_migration.sql`  ← tenants + `tenant_id` columns + SuperAdmin banata hai
3. `schema_tenant_numbering_migration.sql`
4. `schema_softdelete_migration.sql`
5. `schema_po_numbering_migration.sql`
6. `schema_image_longtext_migration.sql`

> ⚠️ Sirf `schema.sql` chalana **kaafi nahi** — baaki migrations bhi chalao warna `tenant_id` error aayega.
> `schema_tenant_migration.sql` apne aap **Default Store (tenant 1)** aur **SuperAdmin** (`superadmin@elites.com` / `super@123`) bana deta hai.

### 3.4 Verify karo
```sql
USE pos_system;
SHOW TABLES;                                  -- tables ki list (tenants bhi honi chahiye)
SELECT id, name FROM tenants;                 -- Default Store (id 1) dikhe
SHOW COLUMNS FROM sales LIKE 'tenant_id';     -- tenant_id column maujood ho
```
Yeh teeno theek aaye toh database multi-tenant ready hai ✅

---

## ⚙️ Step 4 — Backend Configure karo

### 4.1 `.env` file edit karo
`C:\elites-pos\Backend\.env` file Notepad mein kholo:

```env
PORT=5001
JWT_SECRET=elites-pos-CLIENT-NAME-2024-secret

DB_HOST=localhost
DB_USER=root
DB_PASSWORD=Yahan_Client_Ka_MySQL_Password
DB_NAME=pos_system

FRONTEND_URL=http://localhost:9002
```

> ⚠️ `DB_PASSWORD` mein wahi password likho jo MySQL install karte waqt set kiya tha

### 4.2 Backend dependencies install karo
Command Prompt kholo, yeh commands ek ek karke chalao:
```bash
cd C:\elites-pos\Backend
npm install
```
Thodi dair lagegi — internet chahiye sirf is step ke liye

---

## 🎨 Step 5 — Frontend Configure karo

### 5.1 Dependencies install karo
```bash
cd C:\elites-pos\frontend
npm install
```

### 5.2 Production build banao
```bash
npm run build
```
> ⚠️ Yeh thodi dair lagegi (3-5 minutes) — wait karo

---

## 🚀 Step 6 — System Start karo (Daily Use)

### 6.1 Startup Script banao
`C:\elites-pos\` mein `START-POS.bat` naam ki file banao, yeh content paste karo:

```batch
@echo off
title Elites POS System
echo ================================
echo    Elites POS System Starting...
echo ================================

echo Starting Backend...
start "Backend" cmd /k "cd /d C:\elites-pos\Backend && node index.js"

timeout /t 3

echo Starting Frontend...
start "Frontend" cmd /k "cd /d C:\elites-pos\frontend && npm start"

timeout /t 5

echo Opening Browser...
start chrome "http://localhost:9002"

echo ================================
echo POS System is Running!
echo Open: http://localhost:9002
echo ================================
```

### 6.2 Desktop Shortcut banao
- `START-POS.bat` file pe Right Click → Send to → Desktop (create shortcut)
- Shortcut ka naam badlo: `Elites POS`
- Ab roz sirf yeh shortcut double click karo — sab kuch automatically start ho jaye ga

---

## 👤 Step 7 — Client Ka Admin Account Setup

> Single local shop = **Default Store (tenant 1)** use karo. Yahi sabse simple hai.

### 7.1 Pehli baar login karo
- Browser mein jao: `http://localhost:9002`
- Email: `admin@elites.com`  (yeh Default Store / tenant 1 ka admin hai)
- Password: `admin123`

### 7.2 Settings configure karo
Settings page pe jao:
- **Store Name**: Client ki dukan ka naam
- **Tax Rate**: Client ki local tax rate
- **Currency**: PKR
- **Mode**: retail ya restaurant
- **Receipt Footer**: "Thank you! Please visit again"

### 7.3 Naya admin account banao
- Sidebar → "Create User"
- Client ki email aur apni marzi ka password set karo
- Role: Admin
- (Yeh naya user bhi tenant 1 me hi banega — wahi Default Store)
- Phir purana `admin@elites.com` account delete karo

### 7.4 Products add karo
- Inventory → Add Product (ya Bulk Import CSV se)
- Categories set karo
- Stock quantities enter karo

### 7.5 (Optional) Ek hi machine par multiple shops?
Aam taur par local install me iski zaroorat nahi. Lekin agar chahiye to:
- `superadmin@elites.com` / `super@123` se login karo
- Tenants → **Create Tenant** → naya shop + uska admin banao
- ⚠️ SuperAdmin ka default password zaroor badlo.

---

## 🖨️ Step 8 — Printer Setup

### Receipt Printer (Thermal)
1. Printer USB se connect karo
2. Driver install karo (CD ya manufacturer website se)
3. Control Panel → Devices and Printers mein check karo
4. POS mein print karo → System ka default printer use hoga

### Barcode Scanner
- USB se connect karo — plug and play
- Koi driver install nahi karna
- POS mein product field mein cursor rakh ke scan karo

---

## 💾 Step 9 — Daily Backup Setup

### Manual Backup (Har roz)
Command Prompt mein yeh command chalao:
```bash
mysqldump -u root -p pos_system > C:\elites-pos\backup\backup_%date%.sql
```

### Automatic Backup Script banao
`C:\elites-pos\BACKUP.bat`:
```batch
@echo off
set backupDir=C:\elites-pos\backup
set date=%date:~10,4%-%date:~4,2%-%date:~7,2%
mysqldump -u root -pYourPassword pos_system > "%backupDir%\backup_%date%.sql"
echo Backup complete: backup_%date%.sql
```

Windows Task Scheduler mein daily raat 11 baje schedule karo.

---

## 🔧 Common Problems aur Solutions

| Problem | Solution |
|---|---|
| `Cannot connect to database` | MySQL service start karo: Services → MySQL → Start |
| `Port 5001 already in use` | Task Manager mein Node.js close karo, dobara start karo |
| `Page not found` | Frontend start hua ya nahi check karo |
| Browser nahi khula | Manually `http://localhost:9002` type karo |
| Printer nahi chal raha | Default printer check karo Windows settings mein |

---

## 📞 Support Notes (Apne Liye)

```
Client Name: _______________
Install Date: _______________
MySQL Password: _______________
Admin Email: _______________
Admin Password: _______________
Computer Name: _______________
Windows Version: _______________
```

---

## ✅ Installation Checklist

- [ ] Node.js installed
- [ ] MySQL installed
- [ ] Database created aur schema imported
- [ ] .env file configured
- [ ] npm install done (Backend)
- [ ] npm install + build done (Frontend)
- [ ] START-POS.bat banaya
- [ ] Desktop shortcut banaya
- [ ] Store settings configure ki
- [ ] Client ka admin account banaya
- [ ] Products add kiye
- [ ] Printer connected aur tested
- [ ] Backup script setup kiya
- [ ] Client ko training di
