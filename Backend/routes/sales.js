const express = require('express');
const router = express.Router();
const db = require('../db');

// 🔐 Middleware
const verifyToken = require('../middleware/authMiddleware');
const checkRole = require('../middleware/roleMiddleware');


// ===============================
// CREATE SALE (Admin + Cashier)
// ===============================
router.post('/', verifyToken, checkRole(['admin', 'cashier']), async (req, res) => {
  const { customer_id: provided_id, items, discount = 0, payment_method, amount_paid, tax: frontendTax, customer_name, customer_phone } = req.body;

  if (!items || items.length === 0) {
    return res.status(400).json({
      success: false,
      message: "No items provided in cart"
    });
  }

  // ✅ Validate amount_paid
  if (amount_paid === undefined || amount_paid === null || typeof amount_paid !== 'number') {
    return res.status(400).json({
      success: false,
      message: "Valid payment amount is required"
    });
  }

  const connection = await db.getConnection();

  try {
    await connection.beginTransaction();

    // Link sale to cashier's active shift if one exists
    const [activeShift] = await connection.query(
      "SELECT id FROM shifts WHERE cashier_id = ? AND status = 'open' LIMIT 1",
      [req.user.id]
    );
    const shift_id = activeShift.length > 0 ? activeShift[0].id : null;

    let customer_id = provided_id;

    if (customer_name && !customer_id) {
      if (customer_phone) {
        // Name + Phone → phone se dhundo ya naya banao
        const [existing] = await connection.query(
          "SELECT id FROM customers WHERE phone = ?", [customer_phone]
        );
        if (existing.length > 0) {
          customer_id = existing[0].id;
          await connection.query("UPDATE customers SET name = ? WHERE id = ?", [customer_name, customer_id]);
        } else {
          const [newCustomer] = await connection.query(
            "INSERT INTO customers (name, phone, created_at) VALUES (?, ?, NOW())",
            [customer_name, customer_phone]
          );
          customer_id = newCustomer.insertId;
        }
      } else {
        // Sirf Name → customers table mein save karo (phone null), UI mein filter se chhupaayenge
        const [existing] = await connection.query(
          "SELECT id FROM customers WHERE name = ? AND (phone IS NULL OR phone = '') LIMIT 1",
          [customer_name]
        );
        if (existing.length > 0) {
          customer_id = existing[0].id;
        } else {
          const [newCustomer] = await connection.query(
            "INSERT INTO customers (name, created_at) VALUES (?, NOW())",
            [customer_name]
          );
          customer_id = newCustomer.insertId;
        }
      }
    }

    // ✅ Calculate totals
    let subtotal = 0;
    for (let item of items) {
      subtotal += item.quantity * item.price;
    }

    // Use frontend tax if provided, otherwise default to 0 or calculate
    let tax = frontendTax !== undefined ? frontendTax : 0;
    
    // trust the amount_paid 
    const final_total = amount_paid;

    // ✅ Insert Sale
    const [saleResult] = await connection.query(
      `INSERT INTO sales
      (customer_id, cashier_id, shift_id, total, discount, tax, final_total, payment_method, created_at)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?, NOW())`,
      [customer_id || null, req.user.id, shift_id, subtotal, discount, tax, final_total, payment_method]
    );

    const sale_id = saleResult.insertId;

    // ✅ Insert Sale Items + Update Stock
    for (let item of items) {
      // 🔍 Check stock first
      const [productRows] = await connection.query(
        "SELECT stock, name FROM products WHERE id = ?",
        [item.product_id]
      );

      if (productRows.length === 0) {
        throw new Error(`Product not found (ID: ${item.product_id})`);
      }

      const currentStock = productRows[0].stock;
      const productName = productRows[0].name;

      if (currentStock < item.quantity) {
        throw new Error(`Insufficient stock for ${productName}. Available: ${currentStock}`);
      }

      // 🧾 Insert item
      await connection.query(
        `INSERT INTO sale_items (sale_id, product_id, quantity, price)
         VALUES (?, ?, ?, ?)`,
        [sale_id, item.product_id, item.quantity, item.price]
      );

      // 📦 Update stock
      await connection.query(
        `UPDATE products
         SET stock = stock - ?
         WHERE id = ?`,
        [item.quantity, item.product_id]
      );
    }

    await connection.commit();

    res.json({
      success: true,
      message: "Sale completed successfully",
      sale_id,
      final_total,
      change: 0 // Frontend handles change calculation display
    });

  } catch (err) {
    if (connection) await connection.rollback();
    console.error('❌ Sale Error:', err.message);

    res.status(400).json({
      success: false,
      message: err.message || "Sale failed"
    });

  } finally {
    if (connection) connection.release();
  }
});

// ===============================
// GET ALL SALES (Admin ONLY)
// ===============================
router.get('/', verifyToken, checkRole(['admin']), async (req, res) => {
  try {
    const [rows] = await db.query(`
      SELECT 
        s.*, 
        c.name AS customer_name
      FROM sales s
      LEFT JOIN customers c ON s.customer_id = c.id
      ORDER BY s.id DESC
    `);

    res.json({
      success: true,
      data: rows
    });

  } catch (err) {
    console.error(err);
    res.status(500).json({
      success: false,
      message: "Error fetching sales"
    });
  }
});

// ===============================
// GET ALL RETURNS (Admin ONLY) — must be before /:id
// ===============================
router.get('/returns/list', verifyToken, checkRole(['admin']), async (req, res) => {
  try {
    const [rows] = await db.query(`
      SELECT
        sr.id,
        sr.sale_id,
        sr.return_date,
        sr.reason,
        sr.refund_amount,
        c.name AS customer_name,
        COUNT(sri.id) AS items_count
      FROM sale_returns sr
      JOIN sales s ON sr.sale_id = s.id
      LEFT JOIN customers c ON s.customer_id = c.id
      LEFT JOIN sale_return_items sri ON sr.id = sri.return_id
      GROUP BY sr.id
      ORDER BY sr.id DESC
    `);
    res.json({ success: true, data: rows });
  } catch (err) {
    console.error(err);
    res.status(500).json({ success: false, message: "Error fetching returns" });
  }
});

// ===============================
// GET SINGLE SALE (Admin ONLY)
// ===============================
router.get('/:id', verifyToken, checkRole(['admin']), async (req, res) => {
  try {
    const { id } = req.params;

    const [saleRows] = await db.query(
      "SELECT * FROM sales WHERE id = ?",
      [id]
    );

    if (saleRows.length === 0) {
      return res.status(404).json({
        success: false,
        message: "Sale not found"
      });
    }

    const [itemsRows] = await db.query(
      `SELECT 
        si.*, 
        p.name AS product_name 
       FROM sale_items si
       JOIN products p ON si.product_id = p.id
       WHERE si.sale_id = ?`,
      [id]
    );

    res.json({
      success: true,
      data: {
        sale: saleRows[0],
        items: itemsRows
      }
    });

  } catch (err) {
    console.error(err);
    res.status(500).json({
      success: false,
      message: "Error fetching sale"
    });
  }
});

// ===============================
// GET RETURNS FOR A SALE (Admin ONLY)
// ===============================
router.get('/:id/returns', verifyToken, checkRole(['admin']), async (req, res) => {
  try {
    const { id } = req.params;

    const [returnRows] = await db.query(`
      SELECT sr.id, sr.return_date, sr.reason, sr.refund_amount
      FROM sale_returns sr
      WHERE sr.sale_id = ?
      ORDER BY sr.id DESC
    `, [id]);

    const [itemRows] = await db.query(`
      SELECT sri.sale_item_id, SUM(sri.quantity) AS qty_returned
      FROM sale_return_items sri
      JOIN sale_returns sr ON sri.return_id = sr.id
      WHERE sr.sale_id = ?
      GROUP BY sri.sale_item_id
    `, [id]);

    const returned_qtys = {};
    for (const r of itemRows) {
      returned_qtys[r.sale_item_id] = parseInt(r.qty_returned);
    }

    res.json({ success: true, data: { returns: returnRows, returned_qtys } });
  } catch (err) {
    console.error(err);
    res.status(500).json({ success: false, message: "Error fetching sale returns" });
  }
});

// ===============================
// PROCESS RETURN (Admin ONLY)
// ===============================
router.post('/:id/return', verifyToken, checkRole(['admin']), async (req, res) => {
  const { id } = req.params;
  const { items, reason } = req.body;

  if (!items || items.length === 0) {
    return res.status(400).json({ success: false, message: "No items selected for return" });
  }

  const connection = await db.getConnection();
  try {
    await connection.beginTransaction();

    const [saleRows] = await connection.query("SELECT * FROM sales WHERE id = ?", [id]);
    if (saleRows.length === 0) throw new Error("Sale not found");
    if (saleRows[0].status === 'cancelled') throw new Error("Cannot return a cancelled sale");

    const [originalItems] = await connection.query("SELECT * FROM sale_items WHERE sale_id = ?", [id]);

    // Proportional tax rate from original sale
    const saleSubtotal = parseFloat(saleRows[0].total) || 0;
    const saleTax = parseFloat(saleRows[0].tax) || 0;
    const taxRate = saleSubtotal > 0 ? saleTax / saleSubtotal : 0;

    let refundAmount = 0;

    for (const item of items) {
      const original = originalItems.find(oi => oi.id === item.sale_item_id);
      if (!original) throw new Error(`Item (id: ${item.sale_item_id}) not found in this sale`);

      const [alreadyReturnedRows] = await connection.query(`
        SELECT COALESCE(SUM(sri.quantity), 0) AS returned
        FROM sale_return_items sri
        JOIN sale_returns sr ON sri.return_id = sr.id
        WHERE sr.sale_id = ? AND sri.sale_item_id = ?
      `, [id, item.sale_item_id]);

      const alreadyReturned = parseInt(alreadyReturnedRows[0].returned) || 0;
      const available = original.quantity - alreadyReturned;

      if (item.quantity > available) {
        throw new Error(`Cannot return ${item.quantity} units — only ${available} available to return`);
      }

      const itemSubtotal = item.quantity * parseFloat(original.price);
      refundAmount += itemSubtotal + (itemSubtotal * taxRate);
    }
    refundAmount = parseFloat(refundAmount.toFixed(2));

    const [returnResult] = await connection.query(
      "INSERT INTO sale_returns (sale_id, reason, refund_amount, return_date) VALUES (?, ?, ?, NOW())",
      [id, reason || null, refundAmount]
    );

    const return_id = returnResult.insertId;

    for (const item of items) {
      const original = originalItems.find(oi => oi.id === item.sale_item_id);
      await connection.query(
        "INSERT INTO sale_return_items (return_id, sale_item_id, product_id, quantity, price) VALUES (?, ?, ?, ?, ?)",
        [return_id, item.sale_item_id, original.product_id, item.quantity, original.price]
      );
      await connection.query(
        "UPDATE products SET stock = stock + ? WHERE id = ?",
        [item.quantity, original.product_id]
      );
    }

    await connection.commit();
    res.json({ success: true, message: "Return processed successfully", refund_amount: refundAmount, return_id });

  } catch (err) {
    await connection.rollback();
    console.error('❌ Return Error:', err.message);
    res.status(400).json({ success: false, message: err.message || "Return failed" });
  } finally {
    connection.release();
  }
});

// ===============================
// CANCEL SALE (Admin ONLY)
// ===============================
router.put('/:id/cancel', verifyToken, checkRole(['admin']), async (req, res) => {
  const { id } = req.params;

  const connection = await db.getConnection();

  try {
    await connection.beginTransaction();

    // 🔍 Check sale
    const [saleRows] = await connection.query(
      "SELECT * FROM sales WHERE id = ?",
      [id]
    );

    if (saleRows.length === 0) {
      throw new Error("Sale not found");
    }

    if (saleRows[0].status === 'cancelled') {
      throw new Error("Sale already cancelled");
    }

    // 🔍 Get items
    const [items] = await connection.query(
      "SELECT * FROM sale_items WHERE sale_id = ?",
      [id]
    );

    // 📦 Restore stock
    for (let item of items) {
      await connection.query(
        `UPDATE products 
         SET stock = stock + ? 
         WHERE id = ?`,
        [item.quantity, item.product_id]
      );
    }

    // ❌ Cancel sale
    await connection.query(
      "UPDATE sales SET status = 'cancelled' WHERE id = ?",
      [id]
    );

    await connection.commit();

    res.json({
      success: true,
      message: "Sale cancelled and stock restored"
    });

  } catch (err) {
    await connection.rollback();

    console.error(err);

    res.status(400).json({
      success: false,
      message: err.message || "Cancel failed"
    });

  } finally {
    connection.release();
  }
});

module.exports = router;