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
  id              INT PRIMARY KEY DEFAULT 1,
  store_name      VARCHAR(200) DEFAULT 'Elites POS',
  store_address   TEXT,
  store_phone     VARCHAR(50),
  store_email     VARCHAR(100),
  store_gstin     VARCHAR(50),
  currency        VARCHAR(10) DEFAULT 'PKR',
  tax_rate        DECIMAL(5,2) DEFAULT 5,
  items_per_page  INT DEFAULT 10,
  theme           VARCHAR(50) DEFAULT 'dark',
  invoice_prefix  VARCHAR(20) DEFAULT 'INV',
  low_stock_alert INT DEFAULT 5
);

-- ============================================================
-- DEFAULT DATA
-- ============================================================

-- Default settings row (id = 1, required by backend)
INSERT IGNORE INTO settings (id, store_name, currency, tax_rate, items_per_page, theme, invoice_prefix, low_stock_alert)
VALUES (1, 'Elites POS', 'PKR', 5, 10, 'dark', 'INV', 5);

-- ============================================================
-- FOR EXISTING INSTALLATIONS: run these ALTER statements once
-- ============================================================
-- ALTER TABLE sales ADD COLUMN IF NOT EXISTS cashier_id INT NULL;
-- ALTER TABLE sales ADD COLUMN IF NOT EXISTS shift_id INT NULL;

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
