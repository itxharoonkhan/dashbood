-- ============================================================
-- PER-TENANT PURCHASE ORDER NUMBERING MIGRATION
-- ============================================================
-- Same problem as sales/customers: purchase_orders.id is a GLOBAL auto-increment
-- id shared across all tenants, but the UI shows PO-{id}, so a new tenant's
-- first PO showed e.g. PO-0007 (continuing another tenant's sequence).
--
-- Fix: give each tenant its own po_number starting at 1. The global id stays as
-- the internal primary key (FKs / purchase_order_items.po_id depend on it).
--
-- Run AFTER the multi-tenant migration (needs tenant_id) and after
-- schema_tenant_numbering_migration.sql. Already-applied steps error harmlessly.
-- ============================================================

USE pos_system;

-- STEP 1: column
ALTER TABLE purchase_orders ADD COLUMN po_number INT NULL AFTER id;

-- STEP 2: backfill existing rows per tenant, ordered by id (MySQL 8+)
UPDATE purchase_orders po
JOIN (
  SELECT id, ROW_NUMBER() OVER (PARTITION BY tenant_id ORDER BY id) AS rn
  FROM purchase_orders
) t ON po.id = t.id
SET po.po_number = t.rn;

-- STEP 3: uniqueness per tenant (safety net against duplicate numbers)
ALTER TABLE purchase_orders ADD UNIQUE KEY uniq_tenant_po_number (tenant_id, po_number);

SELECT 'Per-tenant PO numbering migration complete!' AS status;
