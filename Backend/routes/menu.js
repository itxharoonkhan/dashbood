const express = require('express');
const router = express.Router();
const db = require('../db');

// Middleware
const verifyToken = require('../middleware/authMiddleware');
const checkRole = require('../middleware/roleMiddleware');

// ===============================
// APPLY AUTH
// ===============================
router.use(verifyToken);

// ===============================
// GET ALL MENU ITEMS (Admin + Cashier)
// ===============================
router.get('/', checkRole(['admin', 'cashier']), async (req, res) => {
  try {
    const { search = '', category = '' } = req.query;

    let sql = "SELECT id, name, category, selling_price AS price, stock, description, sku, image FROM products WHERE tenant_id = ?";
    let values = [req.user.tenant_id];

    if (search) {
      sql += " AND (name LIKE ? OR category LIKE ?)";
      values.push(`%${search}%`, `%${search}%`);
    }

    if (category && category !== 'all') {
      sql += " AND category = ?";
      values.push(category);
    }

    sql += " ORDER BY id DESC";

    const [rows] = await db.query(sql, values);

    const productIds = rows.map(r => r.id);
    const variantMap = {};
    if (productIds.length > 0) {
      const [variants] = await db.query(
        'SELECT * FROM product_variants WHERE product_id IN (?) AND is_active = 1 ORDER BY sort_order ASC',
        [productIds]
      );
      for (const v of variants) {
        if (!variantMap[v.product_id]) variantMap[v.product_id] = [];
        variantMap[v.product_id].push(v);
      }
    }

    const itemsWithVariants = rows.map(item => ({
      ...item,
      has_variants: !!(variantMap[item.id] && variantMap[item.id].length > 0),
      variants: variantMap[item.id] || [],
    }));

    res.json({
      success: true,
      data: {
        items: itemsWithVariants
      }
    });

  } catch (err) {
    console.error(err);
    res.status(500).json({
      success: false,
      message: "Error fetching menu items"
    });
  }
});

// ===============================
// GET CATEGORIES (Admin + Cashier)
// ===============================
router.get('/categories', checkRole(['admin', 'cashier']), async (req, res) => {
  try {
    const [rows] = await db.query(
      "SELECT DISTINCT category FROM products WHERE tenant_id = ? AND category IS NOT NULL AND category != ''",
      [req.user.tenant_id]
    );

    res.json({
      success: true,
      data: rows
    });

  } catch (err) {
    console.error(err);
    res.status(500).json({
      success: false,
      message: "Error fetching categories"
    });
  }
});

module.exports = router;
