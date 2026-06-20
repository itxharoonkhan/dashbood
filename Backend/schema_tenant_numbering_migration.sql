-- ============================================================
-- PER-TENANT NUMBERING MIGRATION
-- ============================================================
-- Problem: sales.id / customers.id are GLOBAL auto-increment ids shared across
-- all tenants. The POS shows the invoice number as INV-{sales.id}, so a new
-- tenant's first sale showed e.g. INV-000133 (continuing tenant 1's sequence).
--
-- Fix: give each tenant its own sequence (sale_number, customer_number) that
-- starts at 1. The global id stays as the internal primary key (FKs depend on it).
--
-- Run AFTER the multi-tenant migration (needs tenant_id columns).
-- Already-applied steps will error harmlessly — ignore and continue.
-- The backfill (assigning per-tenant numbers to existing rows) is done by the
-- app's migration script; if running by hand, see the note below.
-- ============================================================

USE pos_system;

-- STEP 1: columns
ALTER TABLE sales     ADD COLUMN sale_number     INT NULL AFTER id;
ALTER TABLE customers ADD COLUMN customer_number INT NULL AFTER id;

-- STEP 2: backfill existing rows per tenant, ordered by id (MySQL 8+)
UPDATE sales s
JOIN (
  SELECT id, ROW_NUMBER() OVER (PARTITION BY tenant_id ORDER BY id) AS rn
  FROM sales
) t ON s.id = t.id
SET s.sale_number = t.rn;

UPDATE customers c
JOIN (
  SELECT id, ROW_NUMBER() OVER (PARTITION BY tenant_id ORDER BY id) AS rn
  FROM customers
) t ON c.id = t.id
SET c.customer_number = t.rn;

-- STEP 3: uniqueness per tenant (safety net against duplicate numbers)
ALTER TABLE sales     ADD UNIQUE KEY uniq_tenant_sale_number     (tenant_id, sale_number);
ALTER TABLE customers ADD UNIQUE KEY uniq_tenant_customer_number (tenant_id, customer_number);

SELECT 'Per-tenant numbering migration complete!' AS status;
