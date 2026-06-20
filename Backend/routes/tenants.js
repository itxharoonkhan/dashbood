const express = require('express');
const router = express.Router();
const db = require('../db');
const bcrypt = require('bcrypt');
const verifyToken = require('../middleware/authMiddleware');
const checkSuperAdmin = require('../middleware/superAdminMiddleware');

router.use(verifyToken);
router.use(checkSuperAdmin);

// GET all tenants
router.get('/', async (req, res) => {
  try {
    const [tenants] = await db.query(`
      SELECT t.*,
        (SELECT COUNT(*) FROM users WHERE tenant_id = t.id) AS user_count,
        (SELECT COUNT(*) FROM sales WHERE tenant_id = t.id) AS sale_count,
        (SELECT IFNULL(SUM(final_total),0) FROM sales WHERE tenant_id = t.id AND status != 'cancelled') AS total_revenue
      FROM tenants t ORDER BY t.created_at DESC
    `);
    res.json({ success: true, data: tenants });
  } catch (err) {
    res.status(500).json({ success: false, message: err.message });
  }
});

// GET single tenant
router.get('/:id', async (req, res) => {
  try {
    const [rows] = await db.query('SELECT * FROM tenants WHERE id = ?', [req.params.id]);
    if (!rows.length) return res.status(404).json({ success: false, message: 'Tenant not found' });
    res.json({ success: true, data: rows[0] });
  } catch (err) {
    res.status(500).json({ success: false, message: err.message });
  }
});

// CREATE tenant + admin user
router.post('/', async (req, res) => {
  const { name, email, slug, plan, mode, admin_email, admin_password, admin_name } = req.body;
  if (!name || !email || !slug || !admin_email || !admin_password) {
    return res.status(400).json({ success: false, message: 'name, email, slug, admin_email, admin_password required' });
  }
  const businessMode = mode === 'restaurant' ? 'restaurant' : 'retail';

  const conn = await db.getConnection();
  try {
    await conn.beginTransaction();

    const [existing] = await conn.query('SELECT id FROM tenants WHERE email = ? OR slug = ?', [email, slug]);
    if (existing.length) {
      await conn.rollback();
      conn.release();
      return res.status(400).json({ success: false, message: 'Tenant with this email or slug already exists' });
    }

    const [result] = await conn.query(
      'INSERT INTO tenants (name, email, slug, plan) VALUES (?, ?, ?, ?)',
      [name, email, slug.toLowerCase().replace(/\s+/g, '-'), plan || 'basic']
    );
    const tenant_id = result.insertId;

    // Create settings row for this tenant
    await conn.query(
      `INSERT INTO settings (id, tenant_id, store_name, currency, tax_rate, items_per_page, theme, invoice_prefix, low_stock_alert, loyalty_rate, loyalty_min_redeem, loyalty_max_percent, mode)
       VALUES (?, ?, ?, 'PKR', 5, 10, 'dark', 'INV', 5, 100, 100, 30, ?)`,
      [tenant_id, tenant_id, name, businessMode]
    );

    // Create admin user for this tenant
    const hashedPw = await bcrypt.hash(admin_password, 10);
    await conn.query(
      'INSERT INTO users (name, email, password, role, permissions, tenant_id) VALUES (?, ?, ?, ?, ?, ?)',
      [admin_name || 'Admin', admin_email, hashedPw, 'admin', '[]', tenant_id]
    );

    await conn.commit();
    res.json({ success: true, message: 'Tenant created successfully', tenant_id });
  } catch (err) {
    await conn.rollback();
    res.status(500).json({ success: false, message: err.message });
  } finally {
    conn.release();
  }
});

// UPDATE tenant (status, plan, name)
router.put('/:id', async (req, res) => {
  try {
    const { name, status, plan } = req.body;
    const fields = [], vals = [];
    if (name !== undefined) { fields.push('name = ?'); vals.push(name); }
    if (status !== undefined) { fields.push('status = ?'); vals.push(status); }
    if (plan !== undefined) { fields.push('plan = ?'); vals.push(plan); }
    if (!fields.length) return res.status(400).json({ success: false, message: 'Nothing to update' });
    vals.push(req.params.id);
    await db.query(`UPDATE tenants SET ${fields.join(', ')} WHERE id = ?`, vals);
    res.json({ success: true, message: 'Tenant updated' });
  } catch (err) {
    res.status(500).json({ success: false, message: err.message });
  }
});

// DELETE tenant (soft: set status = 'suspended')
router.delete('/:id', async (req, res) => {
  try {
    if (req.params.id == 1) {
      return res.status(400).json({ success: false, message: 'Cannot delete the default tenant' });
    }
    await db.query("UPDATE tenants SET status = 'suspended' WHERE id = ?", [req.params.id]);
    res.json({ success: true, message: 'Tenant suspended' });
  } catch (err) {
    res.status(500).json({ success: false, message: err.message });
  }
});

module.exports = router;
