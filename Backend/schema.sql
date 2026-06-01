-- ============================================================
-- Elites POS System - Database Schema
-- Database: pos_system
-- Run this file once to create all tables
-- ============================================================

CREATE DATABASE IF NOT EXISTS pos_system;
USE pos_system;

-- ============================================================
-- TABLE: users
-- ============================================================
CREATE TABLE IF NOT EXISTS users (
  id              INT AUTO_INCREMENT PRIMARY KEY,
  name            VARCHAR(100) NOT NULL,
  email           VARCHAR(100) NOT NULL UNIQUE,
  password        VARCHAR(255) NOT NULL,
  role            ENUM('admin', 'cashier') DEFAULT 'cashier',
  permissions     TEXT,
  failedAttempts  INT DEFAULT 0,
  lockUntil       DATETIME NULL,
  created_at      DATETIME DEFAULT NOW()
);

-- ============================================================
-- TABLE: products
-- ============================================================
CREATE TABLE IF NOT EXISTS products (
  id              INT AUTO_INCREMENT PRIMARY KEY,
  name            VARCHAR(200) NOT NULL,
  category        VARCHAR(100),
  sku             VARCHAR(100) UNIQUE,
  barcode         VARCHAR(100),
  description     TEXT,
  selling_price   DECIMAL(10,2) DEFAULT 0,
  cost_price      DECIMAL(10,2) DEFAULT 0,
  stock           INT DEFAULT 0,
  threshold       INT DEFAULT 5,
  unit_type       VARCHAR(50) DEFAULT 'pcs',
  image           TEXT,
  created_at      DATETIME DEFAULT NOW()
);

-- ============================================================
-- TABLE: customers
-- ============================================================
CREATE TABLE IF NOT EXISTS customers (
  id              INT AUTO_INCREMENT PRIMARY KEY,
  name            VARCHAR(100) NOT NULL,
  email           VARCHAR(100),
  phone           VARCHAR(20),
  address         TEXT,
  city            VARCHAR(100),
  pincode         VARCHAR(20),
  gst_number      VARCHAR(50),
  created_at      DATETIME DEFAULT NOW()
);

-- ============================================================
-- TABLE: sales
-- ============================================================
CREATE TABLE IF NOT EXISTS sales (
  id              INT AUTO_INCREMENT PRIMARY KEY,
  customer_id     INT,
  cashier_id      INT NULL,
  shift_id        INT NULL,
  total           DECIMAL(10,2) DEFAULT 0,
  discount        DECIMAL(10,2) DEFAULT 0,
  tax             DECIMAL(10,2) DEFAULT 0,
  final_total     DECIMAL(10,2) DEFAULT 0,
  payment_method  VARCHAR(50),
  status          ENUM('completed', 'cancelled') DEFAULT 'completed',
  created_at      DATETIME DEFAULT NOW(),
  FOREIGN KEY (customer_id) REFERENCES customers(id) ON DELETE SET NULL
);

-- ============================================================
-- TABLE: sale_payments  (split payment breakdown per sale)
-- ============================================================
CREATE TABLE IF NOT EXISTS sale_payments (
  id         INT AUTO_INCREMENT PRIMARY KEY,
  sale_id    INT NOT NULL,
  method     VARCHAR(50) NOT NULL,
  amount     DECIMAL(10,2) NOT NULL,
  created_at DATETIME DEFAULT NOW(),
  FOREIGN KEY (sale_id) REFERENCES sales(id) ON DELETE CASCADE
);

-- ============================================================
-- TABLE: sale_items
-- ============================================================
CREATE TABLE IF NOT EXISTS sale_items (
  id              INT AUTO_INCREMENT PRIMARY KEY,
  sale_id         INT NOT NULL,
  product_id      INT NOT NULL,
  quantity        INT NOT NULL,
  price           DECIMAL(10,2) NOT NULL,
  FOREIGN KEY (sale_id)    REFERENCES sales(id)    ON DELETE CASCADE,
  FOREIGN KEY (product_id) REFERENCES products(id) ON DELETE CASCADE
);

-- ============================================================
-- TABLE: sale_returns
-- ============================================================
CREATE TABLE IF NOT EXISTS sale_returns (
  id            INT AUTO_INCREMENT PRIMARY KEY,
  sale_id       INT NOT NULL,
  return_date   DATETIME DEFAULT NOW(),
  reason        VARCHAR(500),
  refund_amount DECIMAL(10,2) DEFAULT 0,
  FOREIGN KEY (sale_id) REFERENCES sales(id) ON DELETE CASCADE
);

-- ============================================================
-- TABLE: sale_return_items
-- ============================================================
CREATE TABLE IF NOT EXISTS sale_return_items (
  id            INT AUTO_INCREMENT PRIMARY KEY,
  return_id     INT NOT NULL,
  sale_item_id  INT,
  product_id    INT NOT NULL,
  quantity      INT NOT NULL,
  price         DECIMAL(10,2) NOT NULL,
  FOREIGN KEY (return_id)    REFERENCES sale_returns(id) ON DELETE CASCADE,
  FOREIGN KEY (product_id)   REFERENCES products(id)     ON DELETE CASCADE
);

-- ============================================================
-- TABLE: shifts
-- Amounts stored in paise (1 rupee = 100 paise)
-- ============================================================
CREATE TABLE IF NOT EXISTS shifts (
  id             INT AUTO_INCREMENT PRIMARY KEY,
  cashier_id     INT NOT NULL,
  opening_cash   BIGINT NOT NULL DEFAULT 0,
  closing_cash   BIGINT NULL,
  expected_cash  BIGINT NULL,
  variance       BIGINT NULL,
  start_time     DATETIME DEFAULT NOW(),
  end_time       DATETIME NULL,
  status         ENUM('open', 'closed') DEFAULT 'open',
  notes          TEXT,
  FOREIGN KEY (cashier_id) REFERENCES users(id) ON DELETE CASCADE
);

-- ============================================================
-- TABLE: settings
-- (only 1 row - id = 1)
-- ============================================================
CREATE TABLE IF NOT EXISTS settings (
  id                      INT PRIMARY KEY DEFAULT 1,
  store_name              VARCHAR(200) DEFAULT 'Elites POS',
  store_address           TEXT,
  store_phone             VARCHAR(50),
  store_email             VARCHAR(100),
  store_gstin             VARCHAR(50),
  currency                VARCHAR(10) DEFAULT 'PKR',
  tax_rate                DECIMAL(5,2) DEFAULT 5,
  items_per_page          INT DEFAULT 10,
  theme                   VARCHAR(50) DEFAULT 'dark',
  invoice_prefix          VARCHAR(20) DEFAULT 'INV',
  low_stock_alert         INT DEFAULT 5,
  receipt_logo            TEXT NULL,
  receipt_footer_message  VARCHAR(150) DEFAULT '',
  receipt_show_tax        TINYINT(1) DEFAULT 1,
  receipt_show_donation   TINYINT(1) DEFAULT 0
);

-- ============================================================
-- DEFAULT DATA
-- ============================================================

-- Default settings row (id = 1, required by backend)
INSERT IGNORE INTO settings (id, store_name, currency, tax_rate, items_per_page, theme, invoice_prefix, low_stock_alert)
VALUES (1, 'Elites POS', 'PKR', 5, 10, 'dark', 'INV', 5);

-- ============================================================
-- TABLE: shift_cash_movements
-- Tracks cash-in / cash-out events during a shift
-- ============================================================
CREATE TABLE IF NOT EXISTS shift_cash_movements (
  id         INT AUTO_INCREMENT PRIMARY KEY,
  shift_id   INT NOT NULL,
  type       ENUM('cash_in', 'cash_out') NOT NULL,
  amount     BIGINT NOT NULL DEFAULT 0,
  reason     VARCHAR(500),
  created_at DATETIME DEFAULT NOW(),
  FOREIGN KEY (shift_id) REFERENCES shifts(id) ON DELETE CASCADE
);

-- ============================================================
-- TABLE: coupons
-- ============================================================
CREATE TABLE IF NOT EXISTS coupons (
  id              INT AUTO_INCREMENT PRIMARY KEY,
  code            VARCHAR(50) NOT NULL UNIQUE,
  type            ENUM('flat', 'percentage') NOT NULL,
  value           DECIMAL(10,2) NOT NULL,
  min_order_value DECIMAL(10,2) DEFAULT 0,
  usage_limit     INT DEFAULT NULL,
  used_count      INT DEFAULT 0,
  expiry_date     DATE NULL,
  is_active       TINYINT(1) DEFAULT 1,
  is_deleted      TINYINT(1) DEFAULT 0,
  created_at      DATETIME DEFAULT NOW()
);

-- ============================================================
-- TABLE: coupon_usages
-- ============================================================
CREATE TABLE IF NOT EXISTS coupon_usages (
  id          INT AUTO_INCREMENT PRIMARY KEY,
  coupon_id   INT NOT NULL,
  sale_id     INT NOT NULL,
  discount    DECIMAL(10,2) NOT NULL,
  used_at     DATETIME DEFAULT NOW(),
  FOREIGN KEY (coupon_id) REFERENCES coupons(id) ON DELETE CASCADE,
  FOREIGN KEY (sale_id)   REFERENCES sales(id)   ON DELETE CASCADE
);

-- ============================================================
-- FOR EXISTING INSTALLATIONS: run these ALTER statements once
-- ============================================================
-- ALTER TABLE sales ADD COLUMN IF NOT EXISTS cashier_id INT NULL;
-- ALTER TABLE sales ADD COLUMN IF NOT EXISTS shift_id INT NULL;
-- ALTER TABLE sales ADD COLUMN IF NOT EXISTS coupon_id INT NULL;
-- ALTER TABLE sales ADD COLUMN IF NOT EXISTS coupon_discount DECIMAL(10,2) DEFAULT 0;

-- ============================================================
-- TABLE: product_variants
-- ============================================================
CREATE TABLE IF NOT EXISTS product_variants (
  id          INT AUTO_INCREMENT PRIMARY KEY,
  product_id  INT NOT NULL,
  name        VARCHAR(100) NOT NULL,
  price       DECIMAL(10,2) NOT NULL DEFAULT 0,
  is_active   TINYINT(1) DEFAULT 1,
  sort_order  INT DEFAULT 0,
  FOREIGN KEY (product_id) REFERENCES products(id) ON DELETE CASCADE
);

-- ============================================================
-- TABLE: notifications (low stock alerts)
-- ============================================================
CREATE TABLE IF NOT EXISTS notifications (
  id            INT AUTO_INCREMENT PRIMARY KEY,
  product_id    INT NOT NULL,
  product_name  VARCHAR(200) NOT NULL,
  current_stock INT NOT NULL,
  threshold     INT NOT NULL,
  is_read       TINYINT(1) DEFAULT 0,
  created_at    DATETIME DEFAULT NOW(),
  FOREIGN KEY (product_id) REFERENCES products(id) ON DELETE CASCADE
);

-- ============================================================
-- TABLE: suppliers
-- ============================================================
CREATE TABLE IF NOT EXISTS suppliers (
  id          INT AUTO_INCREMENT PRIMARY KEY,
  name        VARCHAR(200) NOT NULL,
  phone       VARCHAR(50),
  email       VARCHAR(100),
  address     TEXT,
  status      ENUM('active', 'inactive') DEFAULT 'active',
  notes       TEXT,
  is_deleted  TINYINT(1) DEFAULT 0,
  created_at  DATETIME DEFAULT NOW()
);

-- ============================================================
-- TABLE: supplier_items (item-supplier mapping)
-- ============================================================
CREATE TABLE IF NOT EXISTS supplier_items (
  id              INT AUTO_INCREMENT PRIMARY KEY,
  supplier_id     INT NOT NULL,
  product_id      INT NOT NULL,
  unit_cost       DECIMAL(10,2) DEFAULT 0,
  lead_time_days  INT DEFAULT 0,
  is_primary      TINYINT(1) DEFAULT 0,
  UNIQUE KEY uq_supplier_product (supplier_id, product_id),
  FOREIGN KEY (supplier_id) REFERENCES suppliers(id) ON DELETE CASCADE,
  FOREIGN KEY (product_id)  REFERENCES products(id)  ON DELETE CASCADE
);

-- ============================================================
-- TABLE: purchase_orders
-- ============================================================
CREATE TABLE IF NOT EXISTS purchase_orders (
  id            INT AUTO_INCREMENT PRIMARY KEY,
  supplier_id   INT NOT NULL,
  status        ENUM('draft','sent','partially_received','received','cancelled') DEFAULT 'draft',
  notes         TEXT,
  expected_date DATE NULL,
  created_by    INT NULL,
  created_at    DATETIME DEFAULT NOW(),
  FOREIGN KEY (supplier_id) REFERENCES suppliers(id) ON DELETE CASCADE
);

-- ============================================================
-- TABLE: purchase_order_items
-- ============================================================
CREATE TABLE IF NOT EXISTS purchase_order_items (
  id                INT AUTO_INCREMENT PRIMARY KEY,
  po_id             INT NOT NULL,
  product_id        INT NOT NULL,
  quantity_ordered  INT NOT NULL DEFAULT 0,
  quantity_received INT NOT NULL DEFAULT 0,
  unit_cost         DECIMAL(10,2) DEFAULT 0,
  FOREIGN KEY (po_id)      REFERENCES purchase_orders(id) ON DELETE CASCADE,
  FOREIGN KEY (product_id) REFERENCES products(id)        ON DELETE CASCADE
);

-- Default admin user
-- Email: admin@elites.com  |  Password: admin123
-- (password is bcrypt hash of "admin123")
INSERT IGNORE INTO users (name, email, password, role, permissions)
VALUES (
  'Admin',
  'admin@elites.com',
  '$2b$10$92IXUNpkjO0rOQ5byMi.Ye4oKoEa3Ro9llC/.og/at2.uheWG/igi',
  'admin',
  '[]'
);

