const express = require('express');
const router = express.Router();
const db = require('../db');

const verifyToken = require('../middleware/authMiddleware');
const checkRole = require('../middleware/roleMiddleware');

router.use(verifyToken);

// GET active KOTs for kitchen display
router.get('/kots', checkRole(['admin', 'cashier']), async (req, res) => {
  try {
    const [kots] = await db.query(`
      SELECT
        k.id, k.kot_number, k.status, k.printed_at,
        o.id         AS order_id,
        o.pax,
        t.name       AS table_name,
        t.floor_section
      FROM kots k
      JOIN restaurant_orders o ON o.id = k.order_id
      JOIN restaurant_tables t ON t.id = o.table_id
      WHERE k.status IN ('pending','cooking','ready')
      ORDER BY k.printed_at ASC
    `);

    // Attach only THIS KOT's items (linked via kot_id)
    for (const kot of kots) {
      const [items] = await db.query(`
        SELECT
          oi.id, oi.quantity, oi.notes, oi.status,
          p.name AS product_name
        FROM restaurant_order_items oi
        JOIN products p ON p.id = oi.product_id
        WHERE oi.kot_id = ?
      `, [kot.id]);
      kot.items = items;
    }

    res.json({ success: true, data: kots });
  } catch (err) {
    console.error(err);
    res.status(500).json({ success: false, message: 'Error fetching KOTs' });
  }
});

// PUT update KOT status
router.put('/kots/:kotId/status', checkRole(['admin', 'cashier']), async (req, res) => {
  try {
    const { status } = req.body;
    const allowed = ['pending', 'cooking', 'ready', 'served', 'billed'];
    if (!allowed.includes(status)) {
      return res.status(400).json({ success: false, message: 'Invalid status' });
    }

    await db.query('UPDATE kots SET status = ? WHERE id = ?', [status, req.params.kotId]);

    // Sync order items status if cooking/ready
    if (status === 'cooking' || status === 'ready' || status === 'served') {
      const [kot] = await db.query('SELECT order_id FROM kots WHERE id = ?', [req.params.kotId]);
      if (kot.length) {
        await db.query(
          "UPDATE restaurant_order_items SET status = ? WHERE order_id = ? AND status != 'served'",
          [status, kot[0].order_id]
        );
      }
    }

    res.json({ success: true, message: 'KOT status updated' });
  } catch (err) {
    console.error(err);
    res.status(500).json({ success: false, message: 'Error updating KOT status' });
  }
});

// PUT update single item status
router.put('/items/:itemId/status', checkRole(['admin', 'cashier']), async (req, res) => {
  try {
    const { status } = req.body;
    const allowed = ['pending', 'cooking', 'ready', 'served'];
    if (!allowed.includes(status)) {
      return res.status(400).json({ success: false, message: 'Invalid status' });
    }

    await db.query('UPDATE restaurant_order_items SET status = ? WHERE id = ?', [status, req.params.itemId]);
    res.json({ success: true, message: 'Item status updated' });
  } catch (err) {
    console.error(err);
    res.status(500).json({ success: false, message: 'Error updating item status' });
  }
});

module.exports = router;
