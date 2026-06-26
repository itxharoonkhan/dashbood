-- Default tenant
INSERT INTO tenants (id, name, email, slug, status, plan, created_at)
VALUES (1, 'Default Store', 'admin@elites.com', 'default', 'active', 'pro', NOW())
ON CONFLICT (id) DO NOTHING;

-- Reset sequence
SELECT setval('tenants_id_seq', GREATEST((SELECT MAX(id) FROM tenants), 1));

-- Default admin user (password: admin123)
INSERT INTO users (name, email, password, role, permissions, tenant_id, created_at)
VALUES ('Admin', 'admin@elites.com', '$2b$10$92IXUNpkjO0rOQ5byMi.Ye4oKoEa3Ro9llC/.og/at2.uheWG/igi', 'admin', '[]', 1, NOW())
ON CONFLICT (email) DO NOTHING;

-- Super Admin user (password: super@123)
INSERT INTO users (name, email, password, role, permissions, tenant_id, created_at)
VALUES ('Super Admin', 'superadmin@elites.com', '$2b$10$wuRfdO2Y67YGzW/95njzfeXJOiHWxqBaGSk1HIJc8pdLp0AWonmqS', 'superadmin', '[]', NULL, NOW())
ON CONFLICT (email) DO NOTHING;

-- Default settings for tenant 1
INSERT INTO settings (tenant_id, store_name, currency, tax_rate, items_per_page, theme, invoice_prefix, low_stock_alert, loyalty_rate, loyalty_min_redeem, loyalty_max_percent, mode)
VALUES (1, 'Elites POS', 'PKR', 5, 10, 'dark', 'INV', 5, 100, 100, 30, 'retail')
ON CONFLICT (tenant_id) DO NOTHING;

-- Default 10 restaurant tables for tenant 1
INSERT INTO restaurant_tables (name, capacity, floor_section, tenant_id, created_at) VALUES
('T-01', 4, 'Main', 1, NOW()),
('T-02', 4, 'Main', 1, NOW()),
('T-03', 2, 'Main', 1, NOW()),
('T-04', 6, 'Main', 1, NOW()),
('T-05', 4, 'Main', 1, NOW()),
('T-06', 4, 'Main', 1, NOW()),
('T-07', 2, 'Main', 1, NOW()),
('T-08', 8, 'VIP',  1, NOW()),
('T-09', 4, 'VIP',  1, NOW()),
('T-10', 6, 'VIP',  1, NOW())
ON CONFLICT DO NOTHING;
