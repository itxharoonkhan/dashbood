# ☁️ Elites POS — VPS Deployment Guide (Multi-Tenant)

### Online Server pe Deploy karna — Ek hi app, Multiple Clients (tenants)

---

## 📌 Yeh Guide Kab Use Karo

- Client ko sirf URL dena ho — kuch install na karna pade
- Multiple clients ek hi system par manage karne ho
- Anywhere access chahiye (mobile, tablet, laptop)

---

## 🧠 Pehle Samjho — Multi-Tenant Structure

> ⚠️ **Purani guide har client ka alag database + alag backend banati thi. Ab zaroorat NAHI.**
> Ab system **multi-tenant** hai: **ek hi database, ek hi backend, ek hi frontend, ek hi URL.**
> Har client ek **"tenant"** hai. Data `tenant_id` se bilkul alag rehta hai (verified — ek tenant ka data dusre ko nahi dikhta).

```
Aapka VPS Server
│
├── ek Frontend (Next.js)          → pos.elitespos.com
├── ek Backend (Express, 1 port)   → pos.elitespos.com/api
├── ek MySQL Database (pos_system) → saare tenants ka data, tenant_id se alag
└── Nginx + SSL
```

**Naya client add karna = sirf SuperAdmin login karke ek tenant banata hai.**
**Server par kuch nahi badalta — koi naya database/backend/nginx nahi.** ✅

### Tenant kaise identify hota hai?
- Subdomain se NAHI.
- Har user apni **email + password** se login karta hai.
- Login par JWT token milta hai jisme us user ka `tenant_id` hota hai.
- App har query us `tenant_id` se scope karti hai → har client ko sirf apna data.

### 3 tarah ke users
| Role | Kaam | tenant_id |
|------|------|-----------|
| **superadmin** | Naye tenants (clients) banata hai | NULL |
| **admin** | Apni dukaan chalata hai (products, reports, users) | apne tenant ka |
| **cashier** | Sirf sales karta hai | apne tenant ka |

---

## 🛒 Step 1 — VPS Kharido

| Provider | Plan | Price (approx) |
|---|---|---|
| **DigitalOcean** | Basic Droplet | $6/mo (~Rs. 1,700) |
| **Hostinger** | KVM 1 | $5/mo (~Rs. 1,400) |
| **Vultr** | Cloud Compute | $6/mo |

**Specs:** Ubuntu 22.04 LTS · 2GB RAM · 50GB SSD · 1–2 vCPU
Purchase ke baad milega: `IP Address`, `username: root`, `password`.

---

## 🔑 Step 2 — VPS mein Login (SSH)

**Windows:** PuTTY (`putty.org`) → Host = VPS IP, Port 22 → root + password.
**Ya PowerShell:**
```bash
ssh root@YOUR_VPS_IP
```

---

## 🔧 Step 3 — Server Setup (Sirf Ek Baar)

```bash
# System update
apt update && apt upgrade -y

# Node.js 20
curl -fsSL https://deb.nodesource.com/setup_20.x | bash -
apt install -y nodejs

# MySQL
apt install -y mysql-server
mysql_secure_installation     # sab Y, root password set karo (yaad rakho!)

# Nginx
apt install -y nginx && systemctl enable nginx

# PM2 (app hamesha chalti rahe) + Git
npm install -g pm2
apt install -y git
```

---

## 🗄️ Step 4 — Database Setup (Multi-Tenant)

> ⚠️ **Sirf EK database banana hai.** Migrations sahi ORDER me chalao.

```bash
mysql -u root -p
```
MySQL mein:
```sql
CREATE DATABASE pos_system;
EXIT;
```

Ab schema + saari migrations import karo (is order mein):
```bash
cd /var/www/elites-pos/Backend

mysql -u root -p pos_system < schema.sql
mysql -u root -p pos_system < schema_tenant_migration.sql        # tenants + tenant_id columns + superadmin
mysql -u root -p pos_system < schema_tenant_numbering_migration.sql
mysql -u root -p pos_system < schema_softdelete_migration.sql
mysql -u root -p pos_system < schema_po_numbering_migration.sql
mysql -u root -p pos_system < schema_image_longtext_migration.sql
```

> ✅ `schema_tenant_migration.sql` apne aap:
> - `tenants` table banata hai (+ Default Store = tenant 1)
> - har table me `tenant_id` column add karta hai
> - **SuperAdmin** user bana deta hai → `superadmin@elites.com` / `super@123`

---

## 📦 Step 5 — Code Deploy karo

### 5.1 Code VPS pe bhejo (apne PC se)
```bash
scp -r C:\Users\Digital Lucent\Desktop\pos-system root@YOUR_VPS_IP:/var/www/elites-pos
```

### 5.2 Backend `.env` configure karo
```bash
nano /var/www/elites-pos/Backend/.env
```
```env
PORT=5001
JWT_SECRET=koi-lamba-random-secret-yahan
CRON_API_KEY=koi-aur-random-secret-yahan

DB_HOST=localhost
DB_USER=root
DB_PASSWORD=Your_MySQL_Root_Password
DB_NAME=pos_system

FRONTEND_URL=https://pos.elitespos.com
```

### 5.3 Backend start (PM2)
```bash
cd /var/www/elites-pos/Backend
npm install
pm2 start index.js --name pos-backend
pm2 save
```

### 5.4 Frontend build + start
```bash
cd /var/www/elites-pos/frontend
npm install
echo "NEXT_PUBLIC_API_URL=https://pos.elitespos.com/api" > .env.local
npm run build
pm2 start npm --name pos-frontend -- start     # port 9002
pm2 save
pm2 startup     # server reboot par auto-start
```

---

## 🌐 Step 6 — Domain + Nginx + SSL (Ek hi baar)

### 6.1 Domain DNS
Domain provider (Namecheap/GoDaddy) → DNS:
```
Type: A    Name: pos    Value: YOUR_VPS_IP    TTL: 3600
```
(`pos.elitespos.com` → aapka server)

### 6.2 Nginx config (sirf EK file)
```bash
nano /etc/nginx/sites-available/pos.elitespos.com
```
```nginx
server {
    listen 80;
    server_name pos.elitespos.com;

    location / {
        proxy_pass http://localhost:9002;
        proxy_http_version 1.1;
        proxy_set_header Upgrade $http_upgrade;
        proxy_set_header Connection 'upgrade';
        proxy_set_header Host $host;
        proxy_cache_bypass $http_upgrade;
    }

    location /api {
        proxy_pass http://localhost:5001;
        proxy_http_version 1.1;
        proxy_set_header Host $host;
        proxy_set_header X-Real-IP $remote_addr;
    }
}
```
```bash
ln -s /etc/nginx/sites-available/pos.elitespos.com /etc/nginx/sites-enabled/
nginx -t && systemctl reload nginx
```

### 6.3 Free SSL (HTTPS)
```bash
apt install -y certbot python3-certbot-nginx
certbot --nginx -d pos.elitespos.com
```

---

## 🏪 Step 7 — Naya Client (Tenant) Add karna

> 🎉 **Yahi sabse bada faida hai — server par KUCH NAHI karna.**
> Naya client = SuperAdmin ek tenant bana deta hai. Bas.

1. Browser: `https://pos.elitespos.com`
2. **SuperAdmin** se login: `superadmin@elites.com` / `super@123`
   > ⚠️ Pehli baar login ke baad yeh password zaroor badlo!
3. Tenants page → **"Create Tenant"** → bharo:
   - Store name, email, slug, plan
   - Mode: `retail` ya `restaurant`
   - Client ka **admin email + password**
4. Save → naya tenant + uska admin user ban gaya.
5. Client ko do:
   ```
   URL:      https://pos.elitespos.com
   Email:    admin@clientname.com
   Password: (jo aapne set kiya)
   ```

Client login karega → sirf apna data dekhega. Uske products, sales, customers — sab `tenant_id` se alag. ✅

> Internally yeh API chalti hai: `POST /api/tenants` (sirf superadmin). UI se ya direct API se tenant ban sakta hai.

---

## 👥 Step 8 — Clients Management Table (apne liye)

| Client | Admin Email | Tenant | Plan | Mode |
|---|---|---|---|---|
| Pizza House | admin@pizza.com | 2 | pro | restaurant |
| Hamza Garments | admin@hamza.com | 4 | basic | retail |

> Sab ek hi URL par. Tenant column sirf aapke record ke liye.

---

## 🔄 Step 9 — App Update karna (naya feature)

```bash
# Apne PC se updated code bhejo
scp -r C:\Users\Digital Lucent\Desktop\pos-system\frontend root@YOUR_VPS_IP:/var/www/elites-pos/
scp -r C:\Users\Digital Lucent\Desktop\pos-system\Backend  root@YOUR_VPS_IP:/var/www/elites-pos/

# VPS pe
cd /var/www/elites-pos/frontend && npm install && npm run build
cd /var/www/elites-pos/Backend  && npm install
pm2 restart all
```
> Naye DB column/feature ho to us migration ki `.sql` file bhi `mysql -u root -p pos_system < file.sql` se chalao.

---

## 💾 Step 10 — Daily Backup (Bahut Zaroori)

Ab sirf **ek database** backup karna hai (sab tenants usi me hain):
```bash
crontab -e
```
```
0 2 * * * mysqldump -u root -pYourPassword pos_system > /backups/pos_$(date +\%Y\%m\%d).sql
```
Har raat 2 baje auto backup. (`mkdir -p /backups` ek baar bana lo.)

---

## 🔒 Security Checklist

- [ ] SuperAdmin ka default password (`super@123`) badla
- [ ] `JWT_SECRET` aur `CRON_API_KEY` lambe random hain
- [ ] MySQL root password strong
- [ ] SSL/HTTPS on
- [ ] Daily backup chal raha hai
- [ ] Har client ka admin password unique

---

## 🔧 Common Problems

| Problem | Solution |
|---|---|
| `502 Bad Gateway` | `pm2 status` — backend/frontend chal rahe? |
| URL nahi khula | DNS propagation (24h tak) |
| SSL error | `certbot renew` |
| Tenant ka data nahi dikh raha | User ka `tenant_id` sahi hai? `users` table check karo |
| DB error | `pm2 logs pos-backend` |

### PM2 Commands
```bash
pm2 list            # running processes
pm2 logs pos-backend
pm2 restart all
pm2 monit
```

---

## ✅ New Client Checklist (ab kitna chota!)

- [ ] SuperAdmin se login
- [ ] Create Tenant (store + admin user)
- [ ] Client ko URL + admin credentials diye
- [ ] Client ne login karke products add kiye
- [ ] (Optional) settings — store name, tax, logo
- [ ] Client details apni table me save

> Bas. Koi server work nahi. 🎉
