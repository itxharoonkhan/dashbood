const express = require('express');
const router = express.Router();
const db = require('../db');

// Middleware
const verifyToken = require('../middleware/authMiddleware');
const checkRole = require('../middleware/roleMiddleware');
const { nextTenantNumber } = require('../utils/tenantSequence');

// ===============================
// APPLY AUTH TO ALL ROUTES
// ===============================
router.use(verifyToken);

// ===============================
// GET ALL CUSTOMERS (Admin + Cashier)
// ===============================
router.get('/', checkRole(['admin', 'cashier']), async (req, res) => {
  try {
    const query = `
      SELECT
        c.*,
        COUNT(s.id) AS totalOrders,
        IFNULL(SUM(s.final_total), 0) AS totalSpent
      FROM customers c
      LEFT JOIN sales s ON c.id = s.customer_id
      WHERE c.phone IS NOT NULL AND c.phone != '' AND c.tenant_id = ? AND c.is_deleted = 0
      GROUP BY c.id
      ORDER BY c.id DESC
    `;
    const [rows] = await db.query(query, [req.user.tenant_id]);

    res.json({
      success: true,
      data: rows
    });

  } catch (err) {
    console.error(err);
    res.status(500).json({
      success: false,
      message: "Error fetching customers"
    });
  }
});

// ===============================
// GET SINGLE CUSTOMER
// ===============================
router.get('/:id', checkRole(['admin', 'cashier']), async (req, res) => {
  try {
    const { id } = req.params;

    const query = `
      SELECT
        c.*,
        COUNT(s.id) AS totalOrders,
        IFNULL(SUM(s.final_total), 0) AS totalSpent
      FROM customers c
      LEFT JOIN sales s ON c.id = s.customer_id
      WHERE c.id = ? AND c.tenant_id = ? AND c.is_deleted = 0
      GROUP BY c.id
    `;
    const [rows] = await db.query(query, [id, req.user.tenant_id]);

    if (rows.length === 0) {
      return res.status(404).json({
        success: false,
        message: "Customer not found"
      });
    }

    res.json({
      success: true,
      data: rows[0]
    });

  } catch (err) {
    console.error(err);
    res.status(500).json({
      success: false,
      message: "Error fetching customer"
    });
  }
});

// ===============================
// CREATE CUSTOMER
// ===============================
router.post('/', checkRole(['admin', 'cashier']), async (req, res) => {
  try {
    const { name, email, phone, address, city, pincode, gst_number } = req.body;

    if (!name) {
      return res.status(400).json({
        success: false,
        message: "Customer name is required"
      });
    }

    const connection = await db.getConnection();
    try {
      await connection.beginTransaction();

      // Per-tenant customer number (1, 2, 3... scoped to this tenant)
      const customer_number = await nextTenantNumber(connection, 'customers', req.user.tenant_id);

      const [result] = await connection.query(
        `INSERT INTO customers
        (customer_number, name, email, phone, address, city, pincode, gst_number, tenant_id, created_at)
        VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, NOW())`,
        [customer_number, name, email, phone, address, city, pincode, gst_number, req.user.tenant_id]
      );

      await connection.commit();

      res.json({
        success: true,
        message: "Customer created successfully",
        id: result.insertId,
        customer_number
      });
    } catch (txErr) {
      await connection.rollback();
      throw txErr;
    } finally {
      connection.release();
    }

  } catch (err) {
    console.error(err);
    res.status(500).json({
      success: false,
      message: "Error creating customer"
    });
  }
});

// ===============================
// UPDATE CUSTOMER (Admin ONLY)
// ===============================
router.put('/:id', checkRole(['admin']), async (req, res) => {
  try {
    const { id } = req.params;
    const updates = req.body;

    const [existing] = await db.query(
      "SELECT * FROM customers WHERE id = ? AND tenant_id = ? AND is_deleted = 0",
      [id, req.user.tenant_id]
    );

    if (existing.length === 0) {
      return res.status(404).json({
        success: false,
        message: "Customer not found"
      });
    }

    const fields = [];
    const values = [];
    const allowedFields = ['name', 'email', 'phone', 'address', 'city', 'pincode', 'gst_number'];

    for (const field of allowedFields) {
      if (field in updates) {
        fields.push(`${field} = ?`);
        values.push(updates[field] === '' ? null : updates[field]);
      }
    }

    if (fields.length === 0) {
      return res.status(400).json({
        success: false,
        message: "No fields to update"
      });
    }

    values.push(id);
    values.push(req.user.tenant_id);

    const [result] = await db.query(
      `UPDATE customers SET ${fields.join(', ')} WHERE id = ? AND tenant_id = ?`,
      values
    );

    if (result.affectedRows === 0) {
      return res.status(404).json({
        success: false,
        message: "Customer not found"
      });
    }

    const [updatedRows] = await db.query(
      "SELECT * FROM customers WHERE id = ?",
      [id]
    );

    res.json({
      success: true,
      message: "Customer updated successfully",
      data: updatedRows[0]
    });

  } catch (err) {
    console.error(err);
    res.status(500).json({
      success: false,
      message: "Error updating customer"
    });
  }
});

// ===============================
// DELETE CUSTOMER (Admin ONLY) — soft delete, recoverable via /restore
// ===============================
router.delete('/:id', checkRole(['admin']), async (req, res) => {
  try {
    const { id } = req.params;

    const [result] = await db.query(
      "UPDATE customers SET is_deleted = 1 WHERE id = ? AND tenant_id = ? AND is_deleted = 0",
      [id, req.user.tenant_id]
    );

    if (result.affectedRows === 0) {
      return res.status(404).json({
        success: false,
        message: "Customer not found"
      });
    }

    res.json({
      success: true,
      message: "Customer deleted successfully"
    });

  } catch (err) {
    console.error(err);
    res.status(500).json({
      success: false,
      message: "Error deleting customer"
    });
  }
});

// ===============================
// GET DELETED CUSTOMERS (Admin ONLY) — recovery list
// ===============================
router.get('/trash/list', checkRole(['admin']), async (req, res) => {
  try {
    const [rows] = await db.query(
      "SELECT * FROM customers WHERE tenant_id = ? AND is_deleted = 1 ORDER BY id DESC",
      [req.user.tenant_id]
    );
    res.json({ success: true, data: rows });
  } catch (err) {
    console.error(err);
    res.status(500).json({ success: false, message: "Error fetching deleted customers" });
  }
});

// ===============================
// RESTORE DELETED CUSTOMER (Admin ONLY)
// ===============================
router.put('/:id/restore', checkRole(['admin']), async (req, res) => {
  try {
    const { id } = req.params;
    const [result] = await db.query(
      "UPDATE customers SET is_deleted = 0 WHERE id = ? AND tenant_id = ? AND is_deleted = 1",
      [id, req.user.tenant_id]
    );
    if (result.affectedRows === 0) {
      return res.status(404).json({ success: false, message: "Deleted customer not found" });
    }
    res.json({ success: true, message: "Customer restored successfully" });
  } catch (err) {
    console.error(err);
    res.status(500).json({ success: false, message: "Error restoring customer" });
  }
});

module.exports = router;
