const express = require('express');
const router = express.Router();
const db = require('../db');
const verifyToken = require('../middleware/authMiddleware');
const checkRole = require('../middleware/roleMiddleware');

router.use(verifyToken);

// ===============================
// HELPER — sync low-stock notifications (tenant-scoped)
// ===============================
async function syncLowStockNotifications(tenant_id) {
  try {
    // Auto-resolve: mark read any notifications where stock is now above threshold
    await db.query(`
      UPDATE notifications n
      JOIN products p ON p.id = n.product_id
      SET n.is_read = 1
      WHERE n.is_read = 0 AND n.tenant_id = ? AND p.stock > p.threshold
    `, [tenant_id]);

    // Find all currently low-stock products for this tenant
    const [lowStockProducts] = await db.query(`
      SELECT id, name, stock, threshold
      FROM products
      WHERE tenant_id = ? AND stock <= threshold
    `, [tenant_id]);

    for (const product of lowStockProducts) {
      const [existing] = await db.query(
        'SELECT id FROM notifications WHERE product_id = ? AND tenant_id = ? AND is_read = 0',
        [product.id, tenant_id]
      );

      if (existing.length === 0) {
        await db.query(
          'INSERT INTO notifications (product_id, product_name, current_stock, threshold, tenant_id) VALUES (?, ?, ?, ?, ?)',
          [product.id, product.name, product.stock, product.threshold, tenant_id]
        );
      } else {
        await db.query(
          'UPDATE notifications SET current_stock = ? WHERE product_id = ? AND tenant_id = ? AND is_read = 0',
          [product.stock, product.id, tenant_id]
        );
      }
    }
  } catch (err) {
    console.error('syncLowStockNotifications error:', err);
  }
}

// ===============================
// GET UNREAD COUNT (for badge polling)
// ===============================
router.get('/count', checkRole(['admin', 'cashier']), async (req, res) => {
  try {
    await syncLowStockNotifications(req.user.tenant_id);
    const [[{ count }]] = await db.query(
      'SELECT COUNT(*) AS count FROM notifications WHERE tenant_id = ? AND is_read = 0',
      [req.user.tenant_id]
    );
    res.json({ success: true, count: parseInt(count) });
  } catch (err) {
    console.error('Notification count error:', err);
    res.status(500).json({ success: false, count: 0 });
  }
});

// ===============================
// GET ALL UNREAD NOTIFICATIONS
// ===============================
router.get('/', checkRole(['admin', 'cashier']), async (req, res) => {
  try {
    await syncLowStockNotifications(req.user.tenant_id);
    const [rows] = await db.query(`
      SELECT n.id, n.product_id, n.product_name, n.current_stock, n.threshold, n.created_at
      FROM notifications n
      WHERE n.tenant_id = ? AND n.is_read = 0
      ORDER BY n.current_stock ASC, n.created_at DESC
    `, [req.user.tenant_id]);
    res.json({ success: true, data: rows });
  } catch (err) {
    console.error('Notifications fetch error:', err);
    res.status(500).json({ success: false, message: 'Failed to fetch notifications' });
  }
});

// ===============================
// MARK ALL AS READ
// ===============================
router.patch('/read-all', checkRole(['admin', 'cashier']), async (req, res) => {
  try {
    await db.query('UPDATE notifications SET is_read = 1 WHERE tenant_id = ? AND is_read = 0', [req.user.tenant_id]);
    res.json({ success: true, message: 'All notifications marked as read' });
  } catch (err) {
    console.error('Mark all read error:', err);
    res.status(500).json({ success: false, message: 'Failed to mark notifications as read' });
  }
});

router.patch('/:id/read', checkRole(['admin', 'cashier']), async (req, res) => {
  try {
    const { id } = req.params;
    await db.query('UPDATE notifications SET is_read = 1 WHERE id = ? AND tenant_id = ?', [id, req.user.tenant_id]);
    res.json({ success: true, message: 'Notification marked as read' });
  } catch (err) {
    console.error('Mark read error:', err);
    res.status(500).json({ success: false, message: 'Failed to mark notification as read' });
  }
});

module.exports = router;
