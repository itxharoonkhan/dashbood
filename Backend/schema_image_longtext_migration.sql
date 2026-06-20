-- Migration: widen products.image to LONGTEXT
-- Reason: product images are stored as base64 data URLs (up to ~5MB).
-- TEXT only holds 64KB, which caused "Data too long for column 'image'" (HTTP 500)
-- when adding/updating a product with an image.
-- Run once against the existing database.

ALTER TABLE products MODIFY COLUMN image LONGTEXT;
