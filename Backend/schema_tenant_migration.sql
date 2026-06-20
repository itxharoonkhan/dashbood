-- ============================================================
-- MULTI-TENANT MIGRATION — MySQL Workbench Compatible
-- Pehle se chal chuki queries skip ho jayengi
-- ============================================================

USE pos_system;

-- ============================================================
-- STEP 1: tenants table (pehle se ban chuki hai — skip hogi)
-- ============================================================
CREATE TABLE IF NOT EXISTS tenants (
  id         INT AUTO_INCREMENT PRIMARY KEY,
  name       VARCHAR(200) NOT NULL,
  email      VARCHAR(100) NOT NULL UNIQUE,
  slug       VARCHAR(100) NOT NULL UNIQUE,
  status     ENUM('active','inactive','suspended') DEFAULT 'active',
  plan       ENUM('basic','pro','enterprise') DEFAULT 'basic',
  created_at DATETIME DEFAULT NOW()
);

INSERT IGNORE INTO tenants (id, name, email, slug, status, plan)
VALUES (1, 'Default Store', 'admin@elites.com', 'default', 'active', 'pro');

-- ============================================================
-- STEP 2: tenant_id columns add karo
-- Agar column already exist kare to error aaye — ignore karo
-- ============================================================
ALTER TABLE users              ADD COLUMN tenant_id INT NULL DEFAULT 1;
ALTER TABLE products           ADD COLUMN tenant_id INT NOT NULL DEFAULT 1;
ALTER TABLE customers          ADD COLUMN tenant_id INT NOT NULL DEFAULT 1;
ALTER TABLE sales              ADD COLUMN tenant_id INT NOT NULL DEFAULT 1;
ALTER TABLE settings           ADD COLUMN tenant_id INT NOT NULL DEFAULT 1;
ALTER TABLE shifts             ADD COLUMN tenant_id INT NOT NULL DEFAULT 1;
ALTER TABLE coupons            ADD COLUMN tenant_id INT NOT NULL DEFAULT 1;
ALTER TABLE suppliers          ADD COLUMN tenant_id INT NOT NULL DEFAULT 1;
ALTER TABLE restaurant_tables  ADD COLUMN tenant_id INT NOT NULL DEFAULT 1;
ALTER TABLE restaurant_orders  ADD COLUMN tenant_id INT NOT NULL DEFAULT 1;
ALTER TABLE notifications      ADD COLUMN tenant_id INT NOT NULL DEFAULT 1;
ALTER TABLE expenses           ADD COLUMN tenant_id INT NOT NULL DEFAULT 1;
ALTER TABLE purchase_orders    ADD COLUMN tenant_id INT NOT NULL DEFAULT 1;

-- ============================================================
-- STEP 3: superadmin role add karo
-- ============================================================
ALTER TABLE users MODIFY COLUMN role ENUM('superadmin','admin','cashier') DEFAULT 'cashier';

-- ============================================================
-- STEP 4: Indexes (performance)
-- ============================================================
ALTER TABLE products          ADD INDEX idx_tenant (tenant_id);
ALTER TABLE customers         ADD INDEX idx_tenant (tenant_id);
ALTER TABLE sales             ADD INDEX idx_tenant (tenant_id);
ALTER TABLE shifts            ADD INDEX idx_tenant (tenant_id);
ALTER TABLE coupons           ADD INDEX idx_tenant (tenant_id);
ALTER TABLE suppliers         ADD INDEX idx_tenant (tenant_id);
ALTER TABLE restaurant_tables ADD INDEX idx_tenant (tenant_id);
ALTER TABLE restaurant_orders ADD INDEX idx_tenant (tenant_id);
ALTER TABLE expenses          ADD INDEX idx_tenant (tenant_id);

-- ============================================================
-- STEP 5: Existing data ko tenant 1 assign karo
-- ============================================================
UPDATE users SET tenant_id = 1 WHERE tenant_id IS NULL AND role != 'superadmin';

-- ============================================================
-- STEP 6: Super Admin user
-- Email: superadmin@elites.com  |  Password: super@123
-- ============================================================
INSERT IGNORE INTO users (name, email, password, role, tenant_id, permissions)
VALUES (
  'Super Admin',
  'superadmin@elites.com',
  '$2b$10$wuRfdO2Y67YGzW/95njzfeXJOiHWxqBaGSk1HIJc8pdLp0AWonmqS',
  'superadmin',
  NULL,
  '[]'
);

-- ============================================================
SELECT 'Migration complete!' AS status;
-- ============================================================
