-- ============================================================
-- Restaurant Mode — Run once on existing database
-- ============================================================

-- Step 1: Add mode column to settings
-- (Agar "Duplicate column" error aaye toh ignore karo — matlab pehle se hai)
ALTER TABLE settings
  ADD COLUMN mode ENUM('retail','restaurant') DEFAULT 'retail';

-- Step 2: Restaurant Tables
CREATE TABLE IF NOT EXISTS restaurant_tables (
  id            INT AUTO_INCREMENT PRIMARY KEY,
  name          VARCHAR(50)  NOT NULL,
  capacity      INT          DEFAULT 4,
  status        ENUM('available','occupied','bill_printed','split') DEFAULT 'available',
  floor_section VARCHAR(50)  DEFAULT 'Main',
  created_at    DATETIME     DEFAULT NOW()
);

-- Step 3: Restaurant Orders
CREATE TABLE IF NOT EXISTS restaurant_orders (
  id         INT AUTO_INCREMENT PRIMARY KEY,
  table_id   INT NOT NULL,
  waiter_id  INT NULL,
  pax        INT DEFAULT 1,
  status     ENUM('open','billed','paid','cancelled') DEFAULT 'open',
  notes      TEXT,
  created_at DATETIME DEFAULT NOW(),
  FOREIGN KEY (table_id) REFERENCES restaurant_tables(id) ON DELETE CASCADE
);

-- Step 4: Order Items
CREATE TABLE IF NOT EXISTS restaurant_order_items (
  id         INT AUTO_INCREMENT PRIMARY KEY,
  order_id   INT NOT NULL,
  product_id INT NOT NULL,
  kot_id     INT NULL,
  quantity   INT            NOT NULL DEFAULT 1,
  unit_price DECIMAL(10,2)  NOT NULL,
  notes      TEXT,
  status     ENUM('pending','cooking','ready','served') DEFAULT 'pending',
  created_at DATETIME DEFAULT NOW(),
  FOREIGN KEY (order_id)   REFERENCES restaurant_orders(id) ON DELETE CASCADE,
  FOREIGN KEY (product_id) REFERENCES products(id)          ON DELETE CASCADE
);

-- Step 5: KOTs
CREATE TABLE IF NOT EXISTS kots (
  id         INT AUTO_INCREMENT PRIMARY KEY,
  order_id   INT         NOT NULL,
  kot_number VARCHAR(30) NOT NULL,
  status     ENUM('pending','cooking','ready','served','billed') DEFAULT 'pending',
  printed_at DATETIME    DEFAULT NOW(),
  FOREIGN KEY (order_id) REFERENCES restaurant_orders(id) ON DELETE CASCADE
);

-- Step 6: Bill Splits
CREATE TABLE IF NOT EXISTS bill_splits (
  id           INT AUTO_INCREMENT PRIMARY KEY,
  order_id     INT           NOT NULL,
  split_type   ENUM('equal','by_item','by_amount') NOT NULL,
  person_label VARCHAR(50)   NOT NULL,
  amount       DECIMAL(10,2) NOT NULL,
  items_json   TEXT,
  paid         TINYINT(1)    DEFAULT 0,
  created_at   DATETIME      DEFAULT NOW(),
  FOREIGN KEY (order_id) REFERENCES restaurant_orders(id) ON DELETE CASCADE
);

-- Step 6b: Add kot_id to existing installs (skip if table was freshly created above)
-- Run this ONLY if restaurant_order_items already existed without kot_id:
-- ALTER TABLE restaurant_order_items ADD COLUMN kot_id INT NULL;

-- Step 7: Default 10 tables
INSERT IGNORE INTO restaurant_tables (id, name, capacity, floor_section) VALUES
(1,'T-01',4,'Main'),(2,'T-02',4,'Main'),(3,'T-03',2,'Main'),
(4,'T-04',6,'Main'),(5,'T-05',4,'Main'),(6,'T-06',4,'Main'),
(7,'T-07',2,'Main'),(8,'T-08',8,'VIP'), (9,'T-09',4,'VIP'),
(10,'T-10',6,'VIP');
