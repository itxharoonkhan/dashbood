-- ============================================================
-- SOFT-DELETE MIGRATION — MySQL Workbench Compatible
-- Maqsad: products, customers, expenses, shifts, restaurant_tables
-- ko hard-delete se soft-delete pe le jana, taake "Delete" karne se
-- data permanently na mite — sirf hide ho, restore ho sake.
--
-- Pehle se chal chuki ALTER queries error de sakti hain agar column
-- pehle se exist karta ho — wo error ignore kar ke aglii line chalayein.
-- ============================================================

USE pos_system;

ALTER TABLE products          ADD COLUMN is_deleted TINYINT(1) DEFAULT 0;
ALTER TABLE customers         ADD COLUMN is_deleted TINYINT(1) DEFAULT 0;
ALTER TABLE expenses          ADD COLUMN is_deleted TINYINT(1) DEFAULT 0;
ALTER TABLE shifts            ADD COLUMN is_deleted TINYINT(1) DEFAULT 0;
ALTER TABLE restaurant_tables ADD COLUMN is_deleted TINYINT(1) DEFAULT 0;

-- Indexes (taake list queries pe is_deleted filter fast rahe)
ALTER TABLE products          ADD INDEX idx_is_deleted (is_deleted);
ALTER TABLE customers         ADD INDEX idx_is_deleted (is_deleted);
ALTER TABLE expenses          ADD INDEX idx_is_deleted (is_deleted);
ALTER TABLE shifts            ADD INDEX idx_is_deleted (is_deleted);
ALTER TABLE restaurant_tables ADD INDEX idx_is_deleted (is_deleted);

-- ============================================================
SELECT 'Soft-delete migration complete!' AS status;
-- ============================================================
