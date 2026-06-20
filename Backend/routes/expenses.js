const express = require('express');
const router = express.Router();
const db = require('../db');
const verifyToken = require('../middleware/authMiddleware');
const checkRole = require('../middleware/roleMiddleware');

router.use(verifyToken);

// ===============================
// GET EXPENSES (Admin = all tenant, Cashier = own)
// ===============================
router.get('/', checkRole(['admin', 'cashier']), async (req, res) => {
  try {
    const { from, to, category } = req.query;
    const isAdmin = req.user.role === 'admin' || req.user.role === 'superadmin';

    const params = [];
    const conditions = ['e.tenant_id = ?', 'e.is_deleted = 0'];
    params.push(req.user.tenant_id);

    if (!isAdmin) {
      conditions.push('e.created_by = ?');
      params.push(req.user.id);
    }

    if (from && to) {
      conditions.push('e.expense_date BETWEEN ? AND ?');
      params.push(from, to);
    }

    if (category) {
      conditions.push('e.category = ?');
      params.push(category);
    }

    const where = 'WHERE ' + conditions.join(' AND ');

    const [rows] = await db.query(
      `SELECT e.*, u.name AS created_by_name
       FROM expenses e
       JOIN users u ON e.created_by = u.id
       ${where}
       ORDER BY e.expense_date DESC, e.created_at DESC`,
      params
    );

    res.json({ success: true, data: rows });
  } catch (err) {
    console.error('Expenses list error:', err);
    res.status(500).json({ success: false, message: 'Failed to fetch expenses' });
  }
});

// ===============================
// GET SUMMARY (Admin Only)
// ===============================
router.get('/summary', checkRole(['admin']), async (req, res) => {
  try {
    const { from, to } = req.query;
    const params = [req.user.tenant_id];
    let dateFilter = '';

    if (from && to) {
      dateFilter = 'AND expense_date BETWEEN ? AND ?';
      params.push(from, to);
    }

    const [[byCategory], [byMonth], [totals]] = await Promise.all([
      db.query(
        `SELECT category, SUM(amount) AS total
         FROM expenses WHERE tenant_id = ? AND is_deleted = 0 ${dateFilter}
         GROUP BY category ORDER BY total DESC`,
        params
      ),
      db.query(
        `SELECT DATE_FORMAT(expense_date, '%Y-%m') AS month, SUM(amount) AS total
         FROM expenses WHERE tenant_id = ? AND is_deleted = 0 ${dateFilter}
         GROUP BY month ORDER BY month ASC`,
        params
      ),
      db.query(
        `SELECT
           IFNULL(SUM(amount), 0) AS total_all,
           IFNULL(SUM(CASE WHEN expense_date = CURDATE() THEN amount END), 0) AS today,
           IFNULL(SUM(CASE WHEN expense_date >= DATE_FORMAT(CURDATE(),'%Y-%m-01') THEN amount END), 0) AS this_month,
           COUNT(*) AS total_entries
         FROM expenses WHERE tenant_id = ? AND is_deleted = 0 ${dateFilter}`,
        params
      ),
    ]);

    res.json({
      success: true,
      data: {
        byCategory,
        byMonth,
        totals: totals[0],
      },
    });
  } catch (err) {
    console.error('Expenses summary error:', err);
    res.status(500).json({ success: false, message: 'Failed to fetch summary' });
  }
});

// ===============================
// CREATE EXPENSE (Admin + Cashier)
// ===============================
router.post('/', checkRole(['admin', 'cashier']), async (req, res) => {
  try {
    const { title, amount, category, payment_method, notes, expense_date } = req.body;

    if (!title || !category || !expense_date) {
      return res.status(400).json({ success: false, message: 'Title, category, and date are required' });
    }

    const parsed = parseFloat(amount);
    if (amount === undefined || amount === null || amount === '' || isNaN(parsed) || parsed <= 0) {
      return res.status(400).json({ success: false, message: 'Amount must be greater than 0' });
    }

    const [activeShift] = await db.query(
      "SELECT id FROM shifts WHERE cashier_id = ? AND status = 'open' AND tenant_id = ? LIMIT 1",
      [req.user.id, req.user.tenant_id]
    );
    const shift_id = activeShift.length > 0 ? activeShift[0].id : null;

    const [result] = await db.query(
      `INSERT INTO expenses (title, amount, category, payment_method, notes, expense_date, created_by, shift_id, tenant_id)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)`,
      [
        title.trim(),
        parsed,
        category,
        payment_method || 'cash',
        notes?.trim() || null,
        expense_date,
        req.user.id,
        shift_id,
        req.user.tenant_id
      ]
    );

    const [rows] = await db.query(
      `SELECT e.*, u.name AS created_by_name FROM expenses e JOIN users u ON e.created_by = u.id WHERE e.id = ?`,
      [result.insertId]
    );

    res.status(201).json({ success: true, data: rows[0] });
  } catch (err) {
    console.error('Create expense error:', err);
    res.status(500).json({ success: false, message: 'Failed to create expense' });
  }
});

// ===============================
// UPDATE EXPENSE (Admin = any, Cashier = own)
// ===============================
router.put('/:id', checkRole(['admin', 'cashier']), async (req, res) => {
  try {
    const { id } = req.params;
    const { title, amount, category, payment_method, notes, expense_date } = req.body;

    const [existing] = await db.query('SELECT * FROM expenses WHERE id = ? AND tenant_id = ? AND is_deleted = 0', [id, req.user.tenant_id]);
    if (existing.length === 0) {
      return res.status(404).json({ success: false, message: 'Expense not found' });
    }

    if (req.user.role !== 'admin' && req.user.role !== 'superadmin' && existing[0].created_by !== req.user.id) {
      return res.status(403).json({ success: false, message: 'Not authorized to edit this expense' });
    }

    const parsed = parseFloat(amount);
    if (isNaN(parsed) || parsed <= 0) {
      return res.status(400).json({ success: false, message: 'Amount must be greater than 0' });
    }

    await db.query(
      `UPDATE expenses SET title=?, amount=?, category=?, payment_method=?, notes=?, expense_date=? WHERE id=? AND tenant_id=?`,
      [title.trim(), parsed, category, payment_method || 'cash', notes?.trim() || null, expense_date, id, req.user.tenant_id]
    );

    const [rows] = await db.query(
      `SELECT e.*, u.name AS created_by_name FROM expenses e JOIN users u ON e.created_by = u.id WHERE e.id = ?`,
      [id]
    );

    res.json({ success: true, data: rows[0] });
  } catch (err) {
    console.error('Update expense error:', err);
    res.status(500).json({ success: false, message: 'Failed to update expense' });
  }
});

// ===============================
// DELETE EXPENSE (Admin = any, Cashier = own) — soft delete, recoverable via /restore
// ===============================
router.delete('/:id', checkRole(['admin', 'cashier']), async (req, res) => {
  try {
    const { id } = req.params;

    const [existing] = await db.query('SELECT * FROM expenses WHERE id = ? AND tenant_id = ? AND is_deleted = 0', [id, req.user.tenant_id]);
    if (existing.length === 0) {
      return res.status(404).json({ success: false, message: 'Expense not found' });
    }

    if (req.user.role !== 'admin' && req.user.role !== 'superadmin' && existing[0].created_by !== req.user.id) {
      return res.status(403).json({ success: false, message: 'Not authorized to delete this expense' });
    }

    await db.query('UPDATE expenses SET is_deleted = 1 WHERE id = ? AND tenant_id = ?', [id, req.user.tenant_id]);
    res.json({ success: true, message: 'Expense deleted' });
  } catch (err) {
    console.error('Delete expense error:', err);
    res.status(500).json({ success: false, message: 'Failed to delete expense' });
  }
});

// ===============================
// GET DELETED EXPENSES (Admin ONLY) — recovery list
// ===============================
router.get('/trash/list', checkRole(['admin']), async (req, res) => {
  try {
    const [rows] = await db.query(
      `SELECT e.*, u.name AS created_by_name FROM expenses e JOIN users u ON e.created_by = u.id
       WHERE e.tenant_id = ? AND e.is_deleted = 1 ORDER BY e.id DESC`,
      [req.user.tenant_id]
    );
    res.json({ success: true, data: rows });
  } catch (err) {
    console.error('Expenses trash list error:', err);
    res.status(500).json({ success: false, message: 'Failed to fetch deleted expenses' });
  }
});

// ===============================
// RESTORE DELETED EXPENSE (Admin ONLY)
// ===============================
router.put('/:id/restore', checkRole(['admin']), async (req, res) => {
  try {
    const { id } = req.params;
    const [result] = await db.query(
      'UPDATE expenses SET is_deleted = 0 WHERE id = ? AND tenant_id = ? AND is_deleted = 1',
      [id, req.user.tenant_id]
    );
    if (result.affectedRows === 0) {
      return res.status(404).json({ success: false, message: 'Deleted expense not found' });
    }
    res.json({ success: true, message: 'Expense restored successfully' });
  } catch (err) {
    console.error('Restore expense error:', err);
    res.status(500).json({ success: false, message: 'Failed to restore expense' });
  }
});

module.exports = router;
