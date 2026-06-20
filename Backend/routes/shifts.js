const express = require('express');
const router = express.Router();
const db = require('../db');
const verifyToken = require('../middleware/authMiddleware');
const checkRole = require('../middleware/roleMiddleware');

const toPaise = (rupees) => Math.round(parseFloat(rupees) * 100);
const toRupees = (paise) => parseInt(paise) / 100;

// ===============================
// GET ACTIVE SHIFT (Admin + Cashier)
// ===============================
router.get('/active', verifyToken, checkRole(['admin', 'cashier']), async (req, res) => {
  try {
    const [rows] = await db.query(
      `SELECT s.*, u.name AS cashier_name
       FROM shifts s
       JOIN users u ON s.cashier_id = u.id
       WHERE s.cashier_id = ? AND s.status = 'open' AND s.tenant_id = ?
       LIMIT 1`,
      [req.user.id, req.user.tenant_id]
    );

    if (rows.length === 0) {
      return res.json({ success: true, data: null });
    }

    const shift = rows[0];
    res.json({
      success: true,
      data: {
        ...shift,
        opening_cash_rupees: toRupees(shift.opening_cash),
      }
    });
  } catch (err) {
    console.error('Active shift error:', err);
    res.status(500).json({ success: false, message: 'Failed to fetch active shift' });
  }
});

// ===============================
// GET ALL SHIFTS (Admin Only)
// ===============================
router.get('/', verifyToken, checkRole(['admin']), async (req, res) => {
  try {
    const [rows] = await db.query(`
      SELECT s.*, u.name AS cashier_name,
        COALESCE(
          (SELECT SUM(final_total) FROM sales WHERE shift_id = s.id AND status = 'completed'),
          0
        ) AS total_sales_rupees,
        COALESCE(
          (SELECT COUNT(*) FROM sales WHERE shift_id = s.id AND status = 'completed'),
          0
        ) AS transaction_count
      FROM shifts s
      JOIN users u ON s.cashier_id = u.id
      WHERE s.tenant_id = ? AND s.is_deleted = 0
      ORDER BY s.start_time DESC
    `, [req.user.tenant_id]);

    const data = rows.map(row => ({
      ...row,
      opening_cash_rupees: toRupees(row.opening_cash),
      closing_cash_rupees: row.closing_cash !== null ? toRupees(row.closing_cash) : null,
      expected_cash_rupees: row.expected_cash !== null ? toRupees(row.expected_cash) : null,
      variance_rupees: row.variance !== null ? toRupees(row.variance) : null,
      total_sales_rupees: parseFloat(row.total_sales_rupees) || 0,
      transaction_count: parseInt(row.transaction_count) || 0,
    }));

    res.json({ success: true, data });
  } catch (err) {
    console.error('Shifts list error:', err);
    res.status(500).json({ success: false, message: 'Failed to fetch shifts' });
  }
});

// ===============================
// OPEN SHIFT (Admin + Cashier)
// ===============================
router.post('/open', verifyToken, checkRole(['admin', 'cashier']), async (req, res) => {
  try {
    const { opening_cash } = req.body;

    if (opening_cash === undefined || opening_cash === null || isNaN(parseFloat(opening_cash))) {
      return res.status(400).json({ success: false, message: 'Opening cash amount is required' });
    }

    if (parseFloat(opening_cash) < 0) {
      return res.status(400).json({ success: false, message: 'Opening cash cannot be negative' });
    }

    const [existing] = await db.query(
      "SELECT id FROM shifts WHERE cashier_id = ? AND status = 'open' AND tenant_id = ?",
      [req.user.id, req.user.tenant_id]
    );

    if (existing.length > 0) {
      return res.status(400).json({ success: false, message: 'You already have an open shift. Close it before opening a new one.' });
    }

    const openingCashPaise = toPaise(opening_cash);

    const [result] = await db.query(
      "INSERT INTO shifts (cashier_id, opening_cash, start_time, status, tenant_id) VALUES (?, ?, NOW(), 'open', ?)",
      [req.user.id, openingCashPaise, req.user.tenant_id]
    );

    const [newShift] = await db.query(
      `SELECT s.*, u.name AS cashier_name FROM shifts s
       JOIN users u ON s.cashier_id = u.id WHERE s.id = ?`,
      [result.insertId]
    );

    res.json({
      success: true,
      message: 'Shift opened successfully',
      data: {
        ...newShift[0],
        opening_cash_rupees: toRupees(newShift[0].opening_cash),
      }
    });
  } catch (err) {
    console.error('Open shift error:', err);
    res.status(500).json({ success: false, message: 'Failed to open shift' });
  }
});

// ===============================
// CLOSE SHIFT (Admin + Cashier)
// ===============================
router.put('/close', verifyToken, checkRole(['admin', 'cashier']), async (req, res) => {
  try {
    const { closing_cash } = req.body;

    if (closing_cash === undefined || closing_cash === null || isNaN(parseFloat(closing_cash))) {
      return res.status(400).json({ success: false, message: 'Closing cash amount is required' });
    }

    if (parseFloat(closing_cash) < 0) {
      return res.status(400).json({ success: false, message: 'Closing cash cannot be negative' });
    }

    const [shifts] = await db.query(
      "SELECT * FROM shifts WHERE cashier_id = ? AND status = 'open' AND tenant_id = ? LIMIT 1",
      [req.user.id, req.user.tenant_id]
    );

    if (shifts.length === 0) {
      return res.status(404).json({ success: false, message: 'No active shift found' });
    }

    const shift = shifts[0];

    const [salesRows] = await db.query(
      "SELECT COALESCE(SUM(final_total), 0) AS total_sales FROM sales WHERE shift_id = ? AND status = 'completed'",
      [shift.id]
    );

    const totalSalesRupees = parseFloat(salesRows[0].total_sales) || 0;
    const totalSalesPaise = toPaise(totalSalesRupees);

    const [movRows] = await db.query(
      "SELECT COALESCE(SUM(amount), 0) AS total_out FROM shift_cash_movements WHERE shift_id = ? AND type = 'cash_out'",
      [shift.id]
    );
    const totalCashOutPaise = parseInt(movRows[0].total_out) || 0;

    const openingCashPaise = parseInt(shift.opening_cash);
    const closingCashPaise = toPaise(closing_cash);
    const expectedCashPaise = openingCashPaise + totalSalesPaise - totalCashOutPaise;
    const variancePaise = closingCashPaise - expectedCashPaise;

    await db.query(
      `UPDATE shifts SET
        closing_cash = ?,
        expected_cash = ?,
        variance = ?,
        end_time = NOW(),
        status = 'closed'
       WHERE id = ?`,
      [closingCashPaise, expectedCashPaise, variancePaise, shift.id]
    );

    const [txCount] = await db.query(
      "SELECT COUNT(*) AS cnt FROM sales WHERE shift_id = ? AND status = 'completed'",
      [shift.id]
    );

    res.json({
      success: true,
      message: 'Shift closed successfully',
      data: {
        shift_id: shift.id,
        opening_cash_rupees: toRupees(openingCashPaise),
        total_sales_rupees: totalSalesRupees,
        expected_cash_rupees: toRupees(expectedCashPaise),
        closing_cash_rupees: toRupees(closingCashPaise),
        variance_rupees: toRupees(variancePaise),
        transaction_count: parseInt(txCount[0].cnt) || 0,
      }
    });
  } catch (err) {
    console.error('Close shift error:', err);
    res.status(500).json({ success: false, message: 'Failed to close shift' });
  }
});

// ===============================
// GET SHIFT REPORT (Admin + own shift for Cashier)
// ===============================
router.get('/:id/report', verifyToken, checkRole(['admin', 'cashier']), async (req, res) => {
  try {
    const { id } = req.params;

    const isAdmin = req.user.role === 'admin' || req.user.role === 'superadmin';
    const [shifts] = await db.query(
      `SELECT s.*, u.name AS cashier_name FROM shifts s
       JOIN users u ON s.cashier_id = u.id
       WHERE s.id = ? AND s.tenant_id = ? AND s.is_deleted = 0${isAdmin ? '' : ' AND s.cashier_id = ?'}`,
      isAdmin ? [id, req.user.tenant_id] : [id, req.user.tenant_id, req.user.id]
    );

    if (shifts.length === 0) {
      return res.status(404).json({ success: false, message: 'Shift not found' });
    }

    const shift = shifts[0];

    const [salesRows] = await db.query(
      `SELECT
        COUNT(*) AS transaction_count,
        COALESCE(SUM(final_total), 0) AS total_sales
       FROM sales
       WHERE shift_id = ? AND status = 'completed'`,
      [id]
    );

    const [movements] = await db.query(
      `SELECT id, type, amount, reason, created_at
       FROM shift_cash_movements WHERE shift_id = ? ORDER BY created_at ASC`,
      [id]
    );

    const totalCashOutRupees = movements
      .filter(m => m.type === 'cash_out')
      .reduce((sum, m) => sum + toRupees(m.amount), 0);

    res.json({
      success: true,
      data: {
        ...shift,
        opening_cash_rupees: toRupees(shift.opening_cash),
        closing_cash_rupees: shift.closing_cash !== null ? toRupees(shift.closing_cash) : null,
        expected_cash_rupees: shift.expected_cash !== null ? toRupees(shift.expected_cash) : null,
        variance_rupees: shift.variance !== null ? toRupees(shift.variance) : null,
        transaction_count: parseInt(salesRows[0].transaction_count) || 0,
        total_sales_rupees: parseFloat(salesRows[0].total_sales) || 0,
        total_cash_out_rupees: totalCashOutRupees,
        movements: movements.map(m => ({
          ...m,
          amount_rupees: toRupees(m.amount),
        })),
      }
    });
  } catch (err) {
    console.error('Shift report error:', err);
    res.status(500).json({ success: false, message: 'Failed to fetch shift report' });
  }
});

// ===============================
// CASH OUT / CASH IN (Admin + Cashier — active shift only)
// ===============================
router.post('/:id/cash-movement', verifyToken, checkRole(['admin', 'cashier']), async (req, res) => {
  try {
    const { id } = req.params;
    const { type, amount, reason } = req.body;

    if (!['cash_out', 'cash_in'].includes(type)) {
      return res.status(400).json({ success: false, message: 'Type must be cash_out or cash_in' });
    }
    if (!amount || isNaN(parseFloat(amount)) || parseFloat(amount) <= 0) {
      return res.status(400).json({ success: false, message: 'Valid amount required' });
    }

    const [rows] = await db.query('SELECT * FROM shifts WHERE id = ? AND tenant_id = ?', [id, req.user.tenant_id]);
    if (rows.length === 0) return res.status(404).json({ success: false, message: 'Shift not found' });
    if (rows[0].status !== 'open') return res.status(400).json({ success: false, message: 'Shift is not open' });

    if (type === 'cash_out') {
      const [salesRows] = await db.query(
        "SELECT COALESCE(SUM(final_total), 0) AS total_sales FROM sales WHERE shift_id = ? AND status = 'completed'",
        [id]
      );
      const [movRows] = await db.query(
        "SELECT COALESCE(SUM(amount), 0) AS total_out FROM shift_cash_movements WHERE shift_id = ? AND type = 'cash_out'",
        [id]
      );

      const openingPaise = parseInt(rows[0].opening_cash);
      const salesPaise = toPaise(parseFloat(salesRows[0].total_sales) || 0);
      const prevOutPaise = parseInt(movRows[0].total_out) || 0;
      const availablePaise = openingPaise + salesPaise - prevOutPaise;
      const requestedPaise = toPaise(amount);

      if (requestedPaise > availablePaise) {
        return res.status(400).json({
          success: false,
          message: `Drawer mein sirf Rs. ${toRupees(availablePaise).toFixed(2)} available hain. Itna cash nahi nikal sakte.`
        });
      }
    }

    const amountPaise = toPaise(amount);
    await db.query(
      'INSERT INTO shift_cash_movements (shift_id, type, amount, reason) VALUES (?, ?, ?, ?)',
      [id, type, amountPaise, reason || null]
    );

    res.json({ success: true, message: `${type === 'cash_out' ? 'Cash Out' : 'Cash In'} recorded` });
  } catch (err) {
    console.error('Cash movement error:', err);
    res.status(500).json({ success: false, message: 'Failed to record cash movement' });
  }
});

// ===============================
// DELETE SHIFT (Admin Only — closed shifts) — soft delete, recoverable via /restore
// ===============================
router.delete('/:id', verifyToken, checkRole(['admin']), async (req, res) => {
  try {
    const { id } = req.params;

    const [rows] = await db.query('SELECT * FROM shifts WHERE id = ? AND tenant_id = ? AND is_deleted = 0', [id, req.user.tenant_id]);
    if (rows.length === 0) {
      return res.status(404).json({ success: false, message: 'Shift not found' });
    }

    if (rows[0].status === 'open') {
      return res.status(400).json({ success: false, message: 'Cannot delete an open shift. Close it first.' });
    }

    // Soft delete only — sales.shift_id stays intact so historical reports still link correctly
    await db.query('UPDATE shifts SET is_deleted = 1 WHERE id = ? AND tenant_id = ?', [id, req.user.tenant_id]);

    res.json({ success: true, message: 'Shift deleted successfully' });
  } catch (err) {
    console.error('Delete shift error:', err);
    res.status(500).json({ success: false, message: 'Failed to delete shift' });
  }
});

// ===============================
// GET DELETED SHIFTS (Admin ONLY) — recovery list
// ===============================
router.get('/trash/list', verifyToken, checkRole(['admin']), async (req, res) => {
  try {
    const [rows] = await db.query(
      `SELECT s.*, u.name AS cashier_name FROM shifts s
       JOIN users u ON s.cashier_id = u.id
       WHERE s.tenant_id = ? AND s.is_deleted = 1 ORDER BY s.start_time DESC`,
      [req.user.tenant_id]
    );
    res.json({ success: true, data: rows });
  } catch (err) {
    console.error('Shifts trash list error:', err);
    res.status(500).json({ success: false, message: 'Failed to fetch deleted shifts' });
  }
});

// ===============================
// RESTORE DELETED SHIFT (Admin ONLY)
// ===============================
router.put('/:id/restore', verifyToken, checkRole(['admin']), async (req, res) => {
  try {
    const { id } = req.params;
    const [result] = await db.query(
      'UPDATE shifts SET is_deleted = 0 WHERE id = ? AND tenant_id = ? AND is_deleted = 1',
      [id, req.user.tenant_id]
    );
    if (result.affectedRows === 0) {
      return res.status(404).json({ success: false, message: 'Deleted shift not found' });
    }
    res.json({ success: true, message: 'Shift restored successfully' });
  } catch (err) {
    console.error('Restore shift error:', err);
    res.status(500).json({ success: false, message: 'Failed to restore shift' });
  }
});

module.exports = router;
