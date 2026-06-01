const express = require('express');
const router = express.Router();
const db = require('../db');
const verifyToken = require('../middleware/authMiddleware');
const checkRole = require('../middleware/roleMiddleware');

router.use(verifyToken);

// ===============================
// VALIDATE COUPON (Admin + Cashier)
// ===============================
router.post('/validate', checkRole(['admin', 'cashier']), async (req, res) => {
  try {
    const { code, subtotal } = req.body;

    if (!code) {
      return res.status(400).json({ success: false, message: 'Coupon code is required' });
    }

    const [rows] = await db.query(
      "SELECT * FROM coupons WHERE code = ? AND is_deleted = 0",
      [code.trim().toUpperCase()]
    );

    if (rows.length === 0) {
      return res.status(404).json({ success: false, message: 'Invalid coupon code' });
    }

    const coupon = rows[0];

    if (!coupon.is_active) {
      return res.status(400).json({ success: false, message: 'This coupon is currently inactive' });
    }

    if (coupon.expiry_date && new Date(coupon.expiry_date) < new Date()) {
      return res.status(400).json({ success: false, message: 'This coupon has expired' });
    }

    if (coupon.usage_limit !== null && coupon.used_count >= coupon.usage_limit) {
      return res.status(400).json({ success: false, message: 'This coupon has reached its usage limit' });
    }

    const orderSubtotal = parseFloat(subtotal) || 0;
    if (orderSubtotal < parseFloat(coupon.min_order_value)) {
      return res.status(400).json({
        success: false,
        message: `Minimum order of Rs. ${parseFloat(coupon.min_order_value).toFixed(2)} required for this coupon`
      });
    }

    let discount = 0;
    if (coupon.type === 'flat') {
      discount = Math.min(parseFloat(coupon.value), orderSubtotal);
    } else {
      discount = (orderSubtotal * parseFloat(coupon.value)) / 100;
    }
    discount = parseFloat(discount.toFixed(2));

    res.json({
      success: true,
      message: `Coupon applied! You save Rs. ${discount.toFixed(2)}`,
      discount,
      coupon: {
        id: coupon.id,
        code: coupon.code,
        type: coupon.type,
        value: coupon.value,
      }
    });
  } catch (err) {
    console.error('❌ Coupon validate error:', err);
    res.status(500).json({ success: false, message: 'Failed to validate coupon' });
  }
});

// ===============================
// GET COUPON REPORTS (Admin Only)
// ===============================
router.get('/reports', checkRole(['admin']), async (req, res) => {
  try {
    const { period = 'month' } = req.query;

    let dateFilter = 'cu.used_at >= DATE_SUB(CURDATE(), INTERVAL 1 MONTH)';
    if (period === 'today') dateFilter = 'DATE(cu.used_at) = CURDATE()';
    else if (period === 'week') dateFilter = 'cu.used_at >= DATE_SUB(CURDATE(), INTERVAL 7 DAY)';
    else if (period === 'year') dateFilter = 'cu.used_at >= DATE_SUB(CURDATE(), INTERVAL 1 YEAR)';
    else if (period === 'all') dateFilter = '1=1';

    const [[summary]] = await db.query(`
      SELECT
        COUNT(*) AS total_uses,
        IFNULL(SUM(cu.discount), 0) AS total_discount,
        COUNT(DISTINCT cu.coupon_id) AS unique_coupons_used
      FROM coupon_usages cu
      WHERE ${dateFilter}
    `);

    const [topCoupons] = await db.query(`
      SELECT
        c.id, c.code, c.type, c.value,
        COUNT(cu.id) AS usage_count,
        IFNULL(SUM(cu.discount), 0) AS total_discount,
        IFNULL(AVG(s.final_total + cu.discount), 0) AS avg_order_value
      FROM coupons c
      LEFT JOIN coupon_usages cu ON c.id = cu.coupon_id AND ${dateFilter}
      LEFT JOIN sales s ON cu.sale_id = s.id
      WHERE c.is_deleted = 0
      GROUP BY c.id
      ORDER BY usage_count DESC
      LIMIT 5
    `);

    const [daily] = await db.query(`
      SELECT
        DATE(cu.used_at) AS date,
        COUNT(*) AS uses,
        IFNULL(SUM(cu.discount), 0) AS discount
      FROM coupon_usages cu
      WHERE ${dateFilter}
      GROUP BY DATE(cu.used_at)
      ORDER BY date ASC
    `);

    res.json({
      success: true,
      data: { summary, topCoupons, daily }
    });
  } catch (err) {
    console.error('❌ Coupon reports error:', err);
    res.status(500).json({ success: false, message: 'Failed to fetch coupon reports' });
  }
});

// ===============================
// GET ALL COUPONS (Admin Only)
// ===============================
router.get('/', checkRole(['admin']), async (req, res) => {
  try {
    const [rows] = await db.query(
      "SELECT * FROM coupons WHERE is_deleted = 0 ORDER BY created_at DESC"
    );
    res.json({ success: true, data: rows });
  } catch (err) {
    console.error('❌ Coupon list error:', err);
    res.status(500).json({ success: false, message: 'Failed to fetch coupons' });
  }
});

// ===============================
// CREATE COUPON (Admin Only)
// ===============================
router.post('/', checkRole(['admin']), async (req, res) => {
  try {
    const { code, type, value, min_order_value, usage_limit, expiry_date, is_active } = req.body;

    if (!code || !type || value === undefined || value === null) {
      return res.status(400).json({ success: false, message: 'Code, type and value are required' });
    }

    if (!['flat', 'percentage'].includes(type)) {
      return res.status(400).json({ success: false, message: 'Type must be flat or percentage' });
    }

    if (parseFloat(value) <= 0) {
      return res.status(400).json({ success: false, message: 'Value must be greater than 0' });
    }

    if (type === 'percentage' && parseFloat(value) > 100) {
      return res.status(400).json({ success: false, message: 'Percentage cannot exceed 100' });
    }

    const upperCode = code.trim().toUpperCase();
    const [existing] = await db.query(
      "SELECT id FROM coupons WHERE code = ? AND is_deleted = 0",
      [upperCode]
    );
    if (existing.length > 0) {
      return res.status(400).json({ success: false, message: 'Coupon code already exists' });
    }

    const [result] = await db.query(
      `INSERT INTO coupons (code, type, value, min_order_value, usage_limit, expiry_date, is_active)
       VALUES (?, ?, ?, ?, ?, ?, ?)`,
      [
        upperCode,
        type,
        parseFloat(value),
        parseFloat(min_order_value) || 0,
        usage_limit ? parseInt(usage_limit) : null,
        expiry_date || null,
        is_active !== false ? 1 : 0
      ]
    );

    const [created] = await db.query("SELECT * FROM coupons WHERE id = ?", [result.insertId]);
    res.json({ success: true, message: 'Coupon created successfully', data: created[0] });
  } catch (err) {
    console.error('❌ Coupon create error:', err);
    res.status(500).json({ success: false, message: 'Failed to create coupon' });
  }
});

// ===============================
// UPDATE COUPON (Admin Only)
// ===============================
router.put('/:id', checkRole(['admin']), async (req, res) => {
  try {
    const { id } = req.params;
    const { code, type, value, min_order_value, usage_limit, expiry_date, is_active } = req.body;

    const [existing] = await db.query(
      "SELECT * FROM coupons WHERE id = ? AND is_deleted = 0",
      [id]
    );
    if (existing.length === 0) {
      return res.status(404).json({ success: false, message: 'Coupon not found' });
    }

    const coupon = existing[0];
    const upperCode = code ? code.trim().toUpperCase() : coupon.code;

    if (upperCode !== coupon.code) {
      const [dup] = await db.query(
        "SELECT id FROM coupons WHERE code = ? AND id != ? AND is_deleted = 0",
        [upperCode, id]
      );
      if (dup.length > 0) {
        return res.status(400).json({ success: false, message: 'Coupon code already exists' });
      }
    }

    const newType = type || coupon.type;
    const newValue = value !== undefined ? parseFloat(value) : coupon.value;

    if (newType === 'percentage' && newValue > 100) {
      return res.status(400).json({ success: false, message: 'Percentage cannot exceed 100' });
    }

    await db.query(
      `UPDATE coupons SET code=?, type=?, value=?, min_order_value=?, usage_limit=?, expiry_date=?, is_active=? WHERE id=?`,
      [
        upperCode,
        newType,
        newValue,
        parseFloat(min_order_value) || 0,
        usage_limit ? parseInt(usage_limit) : null,
        expiry_date || null,
        is_active !== undefined ? (is_active ? 1 : 0) : coupon.is_active,
        id
      ]
    );

    const [updated] = await db.query("SELECT * FROM coupons WHERE id = ?", [id]);
    res.json({ success: true, message: 'Coupon updated', data: updated[0] });
  } catch (err) {
    console.error('❌ Coupon update error:', err);
    res.status(500).json({ success: false, message: 'Failed to update coupon' });
  }
});

// ===============================
// TOGGLE ACTIVE / INACTIVE (Admin Only)
// ===============================
router.patch('/:id/toggle', checkRole(['admin']), async (req, res) => {
  try {
    const { id } = req.params;
    const [rows] = await db.query(
      "SELECT is_active FROM coupons WHERE id = ? AND is_deleted = 0",
      [id]
    );
    if (rows.length === 0) {
      return res.status(404).json({ success: false, message: 'Coupon not found' });
    }

    const newStatus = rows[0].is_active ? 0 : 1;
    await db.query("UPDATE coupons SET is_active = ? WHERE id = ?", [newStatus, id]);
    res.json({
      success: true,
      message: newStatus ? 'Coupon activated' : 'Coupon deactivated',
      is_active: newStatus
    });
  } catch (err) {
    console.error('❌ Coupon toggle error:', err);
    res.status(500).json({ success: false, message: 'Failed to toggle coupon status' });
  }
});

// ===============================
// SOFT DELETE COUPON (Admin Only)
// ===============================
router.delete('/:id', checkRole(['admin']), async (req, res) => {
  try {
    const { id } = req.params;
    const [rows] = await db.query(
      "SELECT id FROM coupons WHERE id = ? AND is_deleted = 0",
      [id]
    );
    if (rows.length === 0) {
      return res.status(404).json({ success: false, message: 'Coupon not found' });
    }

    await db.query(
      "UPDATE coupons SET is_deleted = 1, is_active = 0 WHERE id = ?",
      [id]
    );
    res.json({ success: true, message: 'Coupon deleted' });
  } catch (err) {
    console.error('❌ Coupon delete error:', err);
    res.status(500).json({ success: false, message: 'Failed to delete coupon' });
  }
});

module.exports = router;
