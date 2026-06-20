# Elites POS System - Setup Guide

> **Multi-tenant system:** One deployment (one database + one backend) serves multiple shops (**tenants**). Each tenant's data is isolated by a `tenant_id` column — one shop never sees another's data. Tenants are identified by **login (JWT)**, not by subdomain. A **SuperAdmin** creates new tenants; each tenant has its own **Admin** and **Cashier** users.

## Prerequisites

Before you begin, ensure you have the following installed:

- **Node.js** (v18 or higher)
- **MySQL** (v5.7 or higher)
- **npm** or **yarn**

## Database Setup

1. **Start MySQL Server**
   - Make sure MySQL is running on your system
   - Default: `localhost:3306`

2. **Create Database**
   ```sql
   CREATE DATABASE pos_system;
   ```

3. **Import schema + multi-tenant migrations (in this order)**

   Open MySQL Workbench → run each file via *File → Open SQL Script → Execute*, or from the command line:
   ```bash
   cd Backend
   mysql -u root -p pos_system < schema.sql
   mysql -u root -p pos_system < schema_tenant_migration.sql            # tenants table + tenant_id columns + superadmin
   mysql -u root -p pos_system < schema_tenant_numbering_migration.sql  # per-tenant invoice/customer/PO numbers
   mysql -u root -p pos_system < schema_softdelete_migration.sql
   mysql -u root -p pos_system < schema_po_numbering_migration.sql
   mysql -u root -p pos_system < schema_image_longtext_migration.sql
   ```
   > ⚠️ Running only `schema.sql` is **not enough** — without the tenant migration the app will crash on the missing `tenant_id`.
   > `schema_tenant_migration.sql` auto-creates the **Default Store (tenant 1)** and the **SuperAdmin** user (`superadmin@elites.com` / `super@123`).

4. **Verify Database**
   ```sql
   USE pos_system;
   SHOW TABLES;                                -- should include `tenants`
   SELECT id, name FROM tenants;               -- Default Store (id 1)
   SHOW COLUMNS FROM sales LIKE 'tenant_id';   -- column must exist
   ```

## Backend Setup

1. **Navigate to Backend Directory**
   ```bash
   cd Backend
   ```

2. **Install Dependencies**
   ```bash
   npm install
   ```

3. **Configure Environment Variables**
   
   The `.env` file is already created with default settings. Edit if needed:
   ```env
   PORT=5001
   JWT_SECRET=elites-pos-secret-key-change-in-production-2024
   CRON_API_KEY=random-secret-for-scheduled-tasks
   
   DB_HOST=localhost
   DB_USER=root
   DB_PASSWORD=your_mysql_password
   DB_NAME=pos_system
   
   FRONTEND_URL=http://localhost:9002
   ```
   > `CRON_API_KEY` is used by scheduled tasks (e.g. loyalty points expiry) via the `x-api-key` header.

4. **Start Backend Server**
   ```bash
   # Development mode (with auto-reload)
   npm run dev
   
   # Production mode
   npm start
   ```

   The server will start on: `http://localhost:5001`

## Frontend Setup

1. **Navigate to Frontend Directory**
   ```bash
   cd frontend
   ```

2. **Install Dependencies**
   ```bash
   npm install
   ```

3. **Start Development Server**
   ```bash
   npm run dev
   ```

   The frontend will start on: `http://localhost:9002`

4. **Build for Production**
   ```bash
   npm run build
   npm start
   ```

## Default Login Credentials

**Default Store Admin (tenant 1):**
- Email: `admin@elites.com`
- Password: `admin123`

**SuperAdmin (manages tenants/shops):**
- Email: `superadmin@elites.com`
- Password: `super@123`

⚠️ **IMPORTANT**: Change both default passwords immediately after first login!

### Adding a new shop (tenant)
1. Log in as the **SuperAdmin**.
2. Go to the SuperAdmin dashboard (`/superadmin`) → **Create Tenant**.
3. Fill in the store details + the new shop's admin email/password.
4. Saving creates the tenant, its settings, and its admin user automatically — no server changes needed.

The new shop's users log in at the same URL; they only ever see their own tenant's data.

## Testing the Application

1. **Start Backend** (Terminal 1)
   ```bash
   cd Backend
   npm run dev
   ```

2. **Start Frontend** (Terminal 2)
   ```bash
   cd frontend
   npm run dev
   ```

3. **Access Application**
   - Open browser and navigate to: `http://localhost:9002`
   - Login with the admin credentials above

## Troubleshooting

### Backend Issues

**Problem: Database connection failed**
- Ensure MySQL is running
- Check database credentials in `.env`
- Verify database `pos_system` exists

**Problem: `Unknown column 'tenant_id'` / queries failing**
- The multi-tenant migrations were not run. Run `schema_tenant_migration.sql` (and the other migrations) as shown in Database Setup.

**Problem: JWT_SECRET error**
- Make sure `JWT_SECRET` is set in `.env` file
- Use a strong, unique secret in production

**Problem: CORS errors**
- The CORS is configured to allow `http://localhost:9002`
- If frontend runs on different port, update `FRONTEND_URL` in `.env`

### Frontend Issues

**Problem: API calls failing**
- Ensure backend is running on port 5001
- Check browser console for specific errors
- Verify CORS is properly configured

**Problem: Build errors**
```bash
# Clear cache and reinstall
rm -rf node_modules .next
npm install
npm run build
```

## Project Structure

```
pos-system/
├── Backend/                 # Express.js API server
│   ├── middleware/         # auth, role, superAdmin, apiKey, error
│   ├── routes/            # API route handlers (incl. tenants.js)
│   ├── utils/             # tenantSequence.js (per-tenant numbering)
│   ├── db.js              # Database connection
│   ├── index.js           # Main server file
│   ├── schema.sql         # Base database schema
│   ├── schema_tenant_migration.sql            # Multi-tenant migration
│   ├── schema_tenant_numbering_migration.sql  # Per-tenant numbering
│   ├── schema_*_migration.sql                 # Other migrations
│   └── .env               # Environment variables
├── frontend/               # Next.js React application
│   ├── src/
│   │   ├── app/          # Page components (incl. superadmin/)
│   │   ├── components/   # Reusable components
│   │   ├── lib/          # Utilities and API client
│   │   └── contexts/     # React contexts
│   └── public/           # Static assets
└── SETUP_GUIDE.md        # This file
```

## API Endpoints

> All tenant-scoped routes automatically filter by the logged-in user's `tenant_id` (from the JWT). Users only see their own shop's data.

### Tenants (SuperAdmin only)
- `GET /api/tenants` - List all tenants (shops)
- `GET /api/tenants/:id` - Get single tenant
- `POST /api/tenants` - Create tenant (+ its settings & admin user)
- `PUT /api/tenants/:id` - Update tenant (name, status, plan)
- `DELETE /api/tenants/:id` - Suspend tenant (soft)

### Authentication
- `POST /api/auth/login` - User login (JWT includes `tenant_id`)
- `GET /api/auth/profile` - Get user profile (protected)
- `POST /api/auth/create-cashier` - Create cashier (auto-linked to caller's tenant)

### Products
- `GET /api/products` - Get all products (protected)
- `GET /api/products/:id` - Get single product (protected)
- `POST /api/products` - Create product (admin only)
- `PUT /api/products/:id` - Update product (admin only)
- `DELETE /api/products/:id` - Delete product (admin only)

### Sales
- `POST /api/sales` - Create sale (protected)
- `GET /api/sales` - Get all sales (admin only)
- `GET /api/sales/:id` - Get single sale (admin only)
- `PUT /api/sales/:id/cancel` - Cancel sale (admin only)

### Customers
- `GET /api/customers` - Get all customers (protected)
- `POST /api/customers` - Create customer (protected)
- `PUT /api/customers/:id` - Update customer (admin only)
- `DELETE /api/customers/:id` - Delete customer (admin only)

### Dashboard
- `GET /api/dashboard/stats` - Get dashboard statistics (admin only)
- `GET /api/dashboard/recent-sales` - Get recent sales (protected)
- `GET /api/dashboard/top-categories` - Get top categories (admin only)

### Reports
- `GET /api/reports/sales-performance` - Sales performance (admin only)
- `GET /api/reports/category-distribution` - Category distribution (admin only)
- `GET /api/reports/tax-summary` - Tax summary (admin only)
- `GET /api/reports/profit-loss` - Profit & loss (admin only)

### Settings
- `GET /api/settings` - Get settings (admin only)
- `PUT /api/settings` - Update settings (admin only)
- `GET /api/settings/store` - Get store info (protected)
- `PUT /api/settings/store` - Update store info (admin only)

## Security Notes

1. **Change default JWT_SECRET** in production (and set a strong `CRON_API_KEY`)
2. **Change default admin AND superadmin passwords** after first login
3. **Use strong database passwords** in production
4. **Enable HTTPS** in production
5. **Set NODE_ENV=production** in production environment
6. **Regularly update dependencies** to patch security vulnerabilities
7. **Tenant isolation** is enforced in every query via `tenant_id` — never remove these filters when editing routes

## Support

For issues or questions:
- Check the troubleshooting section above
- Review console logs for specific error messages
- Ensure all prerequisites are met
- Verify database and servers are running
