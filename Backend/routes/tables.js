const express = require('express');
const router = express.Router();
const db = require('../db');

const verifyToken = require('../middleware/authMiddleware');
const checkRole = require('../middleware/roleMiddleware');

router.use(verifyToken);

// GET all tables with current order summary
router.get('/', checkRole(['admin', 'cashier']), async (req, res) => {
  try {
    const [tables] = await db.query(`
      SELECT
        t.id, t.name, t.capacity, t.status, t.floor_section,
        o.id         AS order_id,
        o.pax,
        o.status     AS order_status,
        o.created_at AS order_opened_at,
        COALESCE(SUM(oi.quantity * oi.unit_price), 0) AS running_total,
        COUNT(oi.id) AS item_count
      FROM restaurant_tables t
      LEFT JOIN restaurant_orders o
        ON o.table_id = t.id AND o.status IN ('open','billed')
      LEFT JOIN restaurant_order_items oi
        ON oi.order_id = o.id
      GROUP BY t.id, o.id
      ORDER BY t.floor_section, t.name
    `);

    res.json({ success: true, data: tables });
  } catch (err) {
    console.error(err);
    res.status(500).json({ success: false, message: 'Error fetching tables' });
  }
});

// GET single table detail
router.get('/:id', checkRole(['admin', 'cashier']), async (req, res) => {
  try {
    const [rows] = await db.query('SELECT * FROM restaurant_tables WHERE id = ?', [req.params.id]);
    if (!rows.length) return res.status(404).json({ success: false, message: 'Table not found' });
    res.json({ success: true, data: rows[0] });
  } catch (err) {
    console.error(err);
    res.status(500).json({ success: false, message: 'Error fetching table' });
  }
});

// POST create table (admin only)
router.post('/', checkRole(['admin']), async (req, res) => {
  try {
    const { name, capacity = 4, floor_section = 'Main' } = req.body;
    if (!name) return res.status(400).json({ success: false, message: 'Table name is required' });

    const trimmedName = name.trim();
    const trimmedFloor = floor_section.trim() || 'Main';

    // Check duplicate name on same floor
    const [existing] = await db.query(
      'SELECT id FROM restaurant_tables WHERE name = ? AND floor_section = ?',
      [trimmedName, trimmedFloor]
    );
    if (existing.length) {
      return res.status(400).json({
        success: false,
        message: `"${trimmedName}" naam ki table "${trimmedFloor}" section mein pehle se maujood hai`
      });
    }

    const [result] = await db.query(
      'INSERT INTO restaurant_tables (name, capacity, floor_section) VALUES (?, ?, ?)',
      [trimmedName, capacity, trimmedFloor]
    );

    res.status(201).json({
      success: true,
      message: 'Table created',
      data: { id: result.insertId, name: trimmedName, capacity, floor_section: trimmedFloor, status: 'available' }
    });
  } catch (err) {
    if (err.code === 'ER_DUP_ENTRY') {
      return res.status(400).json({ success: false, message: 'Is naam ki table pehle se maujood hai' });
    }
    console.error(err);
    res.status(500).json({ success: false, message: 'Error creating table' });
  }
});

// PUT update table info (admin only)
router.put('/:id', checkRole(['admin']), async (req, res) => {
  try {
    const { name, capacity, floor_section } = req.body;
    await db.query(
      'UPDATE restaurant_tables SET name = ?, capacity = ?, floor_section = ? WHERE id = ?',
      [name, capacity, floor_section, req.params.id]
    );
    res.json({ success: true, message: 'Table updated' });
  } catch (err) {
    console.error(err);
    res.status(500).json({ success: false, message: 'Error updating table' });
  }
});

// PUT update table status (admin + cashier)
router.put('/:id/status', checkRole(['admin', 'cashier']), async (req, res) => {
  try {
    const { status } = req.body;
    const allowed = ['available', 'occupied', 'bill_printed', 'split'];
    if (!allowed.includes(status)) {
      return res.status(400).json({ success: false, message: 'Invalid status' });
    }

    await db.query('UPDATE restaurant_tables SET status = ? WHERE id = ?', [status, req.params.id]);
    res.json({ success: true, message: 'Table status updated' });
  } catch (err) {
    console.error(err);
    res.status(500).json({ success: false, message: 'Error updating table status' });
  }
});

// DELETE table (admin only, must not have open orders)
router.delete('/:id', checkRole(['admin']), async (req, res) => {
  try {
    const [open] = await db.query(
      "SELECT id FROM restaurant_orders WHERE table_id = ? AND status = 'open'",
      [req.params.id]
    );
    if (open.length) {
      return res.status(400).json({ success: false, message: 'Cannot delete table with open orders' });
    }

    await db.query('DELETE FROM restaurant_tables WHERE id = ?', [req.params.id]);
    res.json({ success: true, message: 'Table deleted' });
  } catch (err) {
    console.error(err);
    res.status(500).json({ success: false, message: 'Error deleting table' });
  }
});

module.exports = router;
