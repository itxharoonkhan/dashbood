-- ============================================================
-- Receipt Customization — Add columns to settings table
-- Run once per database installation
-- ============================================================

ALTER TABLE settings
  ADD COLUMN IF NOT EXISTS receipt_logo            TEXT         NULL,
  ADD COLUMN IF NOT EXISTS receipt_footer_message  VARCHAR(150) DEFAULT '',
  ADD COLUMN IF NOT EXISTS receipt_show_tax        TINYINT(1)   DEFAULT 1,
  ADD COLUMN IF NOT EXISTS receipt_show_donation   TINYINT(1)   DEFAULT 0;
