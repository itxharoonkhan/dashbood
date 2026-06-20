const express = require('express');
const router = express.Router();
const db = require('../db');

// Middleware
const verifyToken = require('../middleware/authMiddleware');
const checkRole = require('../middleware/roleMiddleware');
const { nextTenantNumber } = require('../utils/tenantSequence');


// ===============================
// CREATE SALE (Admin + Cashier)
// ===============================
router.post('/', verifyToken, checkRole(['admin', 'cashier']), async (req, res) => {
  const { customer_id: provided_id, items, discount = 0, payment_method, payments, amount_paid, cash_received, tax: frontendTax, customer_name, customer_phone, coupon_code, coupon_discount = 0, loyalty_points_redeem = 0 } = req.body;
  const isSplit = Array.isArray(payments) && payments.length >= 2;
  const resolvedPaymentMethod = isSplit ? 'split' : payment_method;

  if (!items || items.length === 0) {
    return res.status(400).json({
      success: false,
      message: "No items provided in cart"
    });
  }

  if (amount_paid === undefined || amount_paid === null || typeof amount_paid !== 'number') {
    return res.status(400).json({
      success: false,
      message: "Valid payment amount is required"
    });
  }

  const connection = await db.getConnection();

  try {
    await connection.beginTransaction();

    // Link sale to cashier's active shift if one exists (scoped to tenant)
    const [activeShift] = await connection.query(
      "SELECT id FROM shifts WHERE cashier_id = ? AND status = 'open' AND tenant_id = ? LIMIT 1",
      [req.user.id, req.user.tenant_id]
    );
    const shift_id = activeShift.length > 0 ? activeShift[0].id : null;

    let customer_id = provided_id;

    if (customer_name && !customer_id) {
      if (customer_phone) {
        const [existing] = await connection.query(
          "SELECT id FROM customers WHERE phone = ? AND tenant_id = ?", [customer_phone, req.user.tenant_id]
        );
        if (existing.length > 0) {
          customer_id = existing[0].id;
          await connection.query("UPDATE customers SET name = ? WHERE id = ?", [customer_name, customer_id]);
        } else {
          const customer_number = await nextTenantNumber(connection, 'customers', req.user.tenant_id);
          const [newCustomer] = await connection.query(
            "INSERT INTO customers (customer_number, name, phone, tenant_id, created_at) VALUES (?, ?, ?, ?, NOW())",
            [customer_number, customer_name, customer_phone, req.user.tenant_id]
          );
          customer_id = newCustomer.insertId;
        }
      } else {
        const [existing] = await connection.query(
          "SELECT id FROM customers WHERE name = ? AND (phone IS NULL OR phone = '') AND tenant_id = ? LIMIT 1",
          [customer_name, req.user.tenant_id]
        );
        if (existing.length > 0) {
          customer_id = existing[0].id;
        } else {
          const customer_number = await nextTenantNumber(connection, 'customers', req.user.tenant_id);
          const [newCustomer] = await connection.query(
            "INSERT INTO customers (customer_number, name, tenant_id, created_at) VALUES (?, ?, ?, NOW())",
            [customer_number, customer_name, req.user.tenant_id]
          );
          customer_id = newCustomer.insertId;
        }
      }
    }

    let subtotal = 0;
    for (let item of items) {
      subtotal += item.quantity * item.price;
    }

    let tax = frontendTax !== undefined ? frontendTax : 0;
    const appliedCouponDiscount = parseFloat(coupon_discount) || 0;
    const pointsToRedeem = parseInt(loyalty_points_redeem) || 0;
    const final_total = amount_paid;

    if (pointsToRedeem > 0) {
      if (!customer_id && !customer_phone) {
        throw new Error('Customer required for loyalty points redemption');
      }
    }

    // Validate coupon within transaction if provided (scoped to tenant)
    let coupon_id = null;
    if (coupon_code) {
      const [couponRows] = await connection.query(
        "SELECT * FROM coupons WHERE code = ? AND is_active = 1 AND is_deleted = 0 AND tenant_id = ?",
        [coupon_code.trim().toUpperCase(), req.user.tenant_id]
      );
      if (couponRows.length > 0) {
        const c = couponRows[0];
        const limitOk = c.usage_limit === null || c.used_count < c.usage_limit;
        const notExpired = !c.expiry_date || new Date(c.expiry_date) >= new Date();
        if (limitOk && notExpired) {
          coupon_id = c.id;
        }
      }
    }

    if (isSplit) {
      const splitSum = payments.reduce((s, p) => s + (parseFloat(p.amount) || 0), 0);
      if (Math.abs(splitSum - amount_paid) > 0.01) {
        throw new Error(`Split payment sum (${splitSum}) does not match total (${amount_paid})`);
      }
    }

    const cashReceivedVal = (typeof cash_received === 'number' && cash_received > 0) ? cash_received : null;

    // Per-tenant invoice number (1, 2, 3... scoped to this tenant)
    const sale_number = await nextTenantNumber(connection, 'sales', req.user.tenant_id);

    // Insert Sale with tenant_id
    const [saleResult] = await connection.query(
      `INSERT INTO sales
      (sale_number, customer_id, cashier_id, shift_id, total, discount, tax, final_total, cash_received, payment_method, coupon_id, coupon_discount, loyalty_points_redeemed, tenant_id, created_at)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, NOW())`,
      [sale_number, customer_id || null, req.user.id, shift_id, subtotal, discount, tax, final_total, cashReceivedVal, resolvedPaymentMethod, coupon_id, appliedCouponDiscount, pointsToRedeem, req.user.tenant_id]
    );

    const sale_id = saleResult.insertId;

    // Insert Sale Items + Update Stock
    for (let item of items) {
      const [productRows] = await connection.query(
        "SELECT stock, name FROM products WHERE id = ? AND tenant_id = ?",
        [item.product_id, req.user.tenant_id]
      );

      if (productRows.length === 0) {
        throw new Error(`Product not found (ID: ${item.product_id})`);
      }

      const currentStock = productRows[0].stock;
      const productName = productRows[0].name;

      if (currentStock < item.quantity) {
        throw new Error(`Insufficient stock for ${productName}. Available: ${currentStock}`);
      }

      await connection.query(
        `INSERT INTO sale_items (sale_id, product_id, quantity, price)
         VALUES (?, ?, ?, ?)`,
        [sale_id, item.product_id, item.quantity, item.price]
      );

      await connection.query(
        `UPDATE products SET stock = stock - ? WHERE id = ?`,
        [item.quantity, item.product_id]
      );
    }

    // Insert split payment breakdown
    if (isSplit) {
      for (const p of payments) {
        await connection.query(
          "INSERT INTO sale_payments (sale_id, method, amount) VALUES (?, ?, ?)",
          [sale_id, p.method, parseFloat(p.amount) || 0]
        );
      }
    }

    // Record coupon usage
    if (coupon_id && appliedCouponDiscount > 0) {
      await connection.query(
        "INSERT INTO coupon_usages (coupon_id, sale_id, discount) VALUES (?, ?, ?)",
        [coupon_id, sale_id, appliedCouponDiscount]
      );
      await connection.query(
        "UPDATE coupons SET used_count = used_count + 1 WHERE id = ?",
        [coupon_id]
      );
    }

    // Loyalty: Redeem points (deduct before commit)
    if (pointsToRedeem > 0 && customer_id) {
      const [[cust]] = await connection.query(
        'SELECT loyalty_points FROM customers WHERE id = ? FOR UPDATE',
        [customer_id]
      );
      if (!cust || cust.loyalty_points < pointsToRedeem) {
        throw new Error('Insufficient loyalty points');
      }
      const newBalance = cust.loyalty_points - pointsToRedeem;
      await connection.query(
        'UPDATE customers SET loyalty_points = ? WHERE id = ?',
        [newBalance, customer_id]
      );
      await connection.query(
        `INSERT INTO loyalty_transactions (customer_id, sale_id, type, points, balance_after, note)
         VALUES (?, ?, 'redeem', ?, ?, ?)`,
        [customer_id, sale_id, pointsToRedeem, newBalance, `Redeemed at sale #${sale_number}`]
      );
    }

    await connection.commit();

    // Loyalty: Earn points (after commit — non-blocking)
    let points_earned = 0;
    if (customer_id) {
      try {
        const [[loyaltySettings]] = await db.query(
          'SELECT loyalty_rate FROM settings WHERE tenant_id = ?',
          [req.user.tenant_id]
        );
        const rate = parseFloat(loyaltySettings?.loyalty_rate) || 100;
        points_earned = Math.floor(final_total / rate);
        if (points_earned > 0) {
          const [[cust]] = await db.query(
            'SELECT loyalty_points FROM customers WHERE id = ?', [customer_id]
          );
          const newBal = (cust?.loyalty_points || 0) + points_earned;
          await db.query(
            'UPDATE customers SET loyalty_points = ? WHERE id = ?', [newBal, customer_id]
          );
          await db.query(
            `INSERT INTO loyalty_transactions (customer_id, sale_id, type, points, balance_after, note)
             VALUES (?, ?, 'earn', ?, ?, ?)`,
            [customer_id, sale_id, points_earned, newBal, `Earned from sale #${sale_number}`]
          );
        }
      } catch (loyaltyErr) {
        console.warn('Loyalty earn failed (non-critical):', loyaltyErr.message);
      }
    }

    res.json({
      success: true,
      message: "Sale completed successfully",
      sale_id,
      sale_number,
      final_total,
      change: 0,
      points_earned
    });

  } catch (err) {
    if (connection) await connection.rollback();
    console.error('Sale Error:', err.message);

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
      WHERE s.tenant_id = ?
      ORDER BY s.id DESC
    `, [req.user.tenant_id]);

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
    const { startDate, endDate } = req.query;
    const dateRx = /^\d{4}-\d{2}-\d{2}$/;
    const useDateRange = startDate && endDate && dateRx.test(startDate) && dateRx.test(endDate);
    const dateFilter   = useDateRange ? 'AND DATE(sr.return_date) BETWEEN ? AND ?' : '';
    const dateParams   = useDateRange ? [startDate, endDate] : [];

    const [rows] = await db.query(`
      SELECT
        sr.id,
        sr.sale_id,
        s.sale_number,
        sr.return_date,
        sr.reason,
        sr.refund_amount,
        c.name AS customer_name,
        COUNT(sri.id) AS items_count
      FROM sale_returns sr
      JOIN sales s ON sr.sale_id = s.id
      LEFT JOIN customers c ON s.customer_id = c.id
      LEFT JOIN sale_return_items sri ON sr.id = sri.return_id
      WHERE s.tenant_id = ? ${dateFilter}
      GROUP BY sr.id
      ORDER BY sr.id DESC
    `, [req.user.tenant_id, ...dateParams]);
    res.json({ success: true, data: rows });
  } catch (err) {
    console.error(err);
    res.status(500).json({ success: false, message: "Error fetching returns" });
  }
});

// ===============================
// LOOKUP SALE BY PER-TENANT INVOICE NUMBER (Admin ONLY)
// Receipts show the per-tenant sale_number, so returns are looked up by it.
// Must be defined before '/:id' so 'lookup' isn't captured as an id.
// ===============================
router.get('/lookup/:number', verifyToken, checkRole(['admin']), async (req, res) => {
  try {
    const number = parseInt(req.params.number, 10);
    if (!Number.isInteger(number)) {
      return res.status(400).json({ success: false, message: "Invalid invoice number" });
    }

    const [saleRows] = await db.query(
      `SELECT s.*, c.name AS customer_name, c.phone AS customer_phone
       FROM sales s LEFT JOIN customers c ON s.customer_id = c.id
       WHERE s.sale_number = ? AND s.tenant_id = ?`,
      [number, req.user.tenant_id]
    );

    if (saleRows.length === 0) {
      return res.status(404).json({ success: false, message: "Sale not found for this invoice number" });
    }

    const sale = saleRows[0];

    const [itemsRows] = await db.query(
      `SELECT si.*, p.name AS product_name
       FROM sale_items si JOIN products p ON si.product_id = p.id
       WHERE si.sale_id = ?`,
      [sale.id]
    );

    const [paymentsRows] = await db.query(
      "SELECT method, amount FROM sale_payments WHERE sale_id = ? ORDER BY id",
      [sale.id]
    );

    res.json({ success: true, data: { sale, items: itemsRows, payments: paymentsRows } });
  } catch (err) {
    console.error(err);
    res.status(500).json({ success: false, message: "Error looking up sale" });
  }
});

// ===============================
// GET SINGLE SALE (Admin ONLY)
// ===============================
router.get('/:id', verifyToken, checkRole(['admin']), async (req, res) => {
  try {
    const { id } = req.params;

    const [saleRows] = await db.query(
      `SELECT s.*, c.name AS customer_name, c.phone AS customer_phone
       FROM sales s LEFT JOIN customers c ON s.customer_id = c.id
       WHERE s.id = ? AND s.tenant_id = ?`,
      [id, req.user.tenant_id]
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

    const [paymentsRows] = await db.query(
      "SELECT method, amount FROM sale_payments WHERE sale_id = ? ORDER BY id",
      [id]
    );

    res.json({
      success: true,
      data: {
        sale: saleRows[0],
        items: itemsRows,
        payments: paymentsRows
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

    // Verify sale belongs to tenant
    const [saleCheck] = await db.query("SELECT id FROM sales WHERE id = ? AND tenant_id = ?", [id, req.user.tenant_id]);
    if (!saleCheck.length) return res.status(404).json({ success: false, message: "Sale not found" });

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

    const [saleRows] = await connection.query("SELECT * FROM sales WHERE id = ? AND tenant_id = ?", [id, req.user.tenant_id]);
    if (saleRows.length === 0) throw new Error("Sale not found");
    if (saleRows[0].status === 'cancelled') throw new Error("Cannot return a cancelled sale");

    const [originalItems] = await connection.query("SELECT * FROM sale_items WHERE sale_id = ?", [id]);

    const sale = saleRows[0];
    const saleSubtotal = parseFloat(sale.total) || 0;
    const finalTotal  = parseFloat(sale.final_total) || 0;

    let returnedSubtotal = 0;

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

      returnedSubtotal += item.quantity * parseFloat(original.price);
    }

    const ratio = saleSubtotal > 0 ? Math.min(returnedSubtotal / saleSubtotal, 1) : 0;
    const refundAmount = parseFloat((finalTotal * ratio).toFixed(2));

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

    // Loyalty: Reverse earned points + Restore redeemed points (non-blocking)
    let points_reversed = 0;
    let points_restored = 0;
    if (sale.customer_id) {
      try {
        const [[loyaltySettings]] = await db.query('SELECT loyalty_rate FROM settings WHERE tenant_id = ?', [req.user.tenant_id]);
        const rate = parseFloat(loyaltySettings?.loyalty_rate) || 100;

        const [[cust]] = await db.query('SELECT loyalty_points FROM customers WHERE id = ?', [sale.customer_id]);
        let balance = cust?.loyalty_points || 0;

        const pointsEarned = Math.floor(finalTotal / rate);
        const pointsToReverse = Math.floor(pointsEarned * ratio);
        if (pointsToReverse > 0) {
          points_reversed = pointsToReverse;
          balance = Math.max(0, balance - pointsToReverse);
          await db.query('UPDATE customers SET loyalty_points = ? WHERE id = ?', [balance, sale.customer_id]);
          await db.query(
            `INSERT INTO loyalty_transactions (customer_id, sale_id, type, points, balance_after, note)
             VALUES (?, ?, 'reverse', ?, ?, ?)`,
            [sale.customer_id, sale.id, pointsToReverse, balance, `Earned pts reversed — return on sale #${sale.id}`]
          );
        }

        const redeemedPts = parseInt(sale.loyalty_points_redeemed) || 0;
        const pointsToRestore = Math.floor(redeemedPts * ratio);
        if (pointsToRestore > 0) {
          points_restored = pointsToRestore;
          balance = balance + pointsToRestore;
          await db.query('UPDATE customers SET loyalty_points = ? WHERE id = ?', [balance, sale.customer_id]);
          await db.query(
            `INSERT INTO loyalty_transactions (customer_id, sale_id, type, points, balance_after, note)
             VALUES (?, ?, 'earn', ?, ?, ?)`,
            [sale.customer_id, sale.id, pointsToRestore, balance, `Redeemed pts restored — return on sale #${sale.id}`]
          );
        }
      } catch (loyaltyErr) {
        console.warn('Loyalty return adjustment failed (non-critical):', loyaltyErr.message);
      }
    }

    res.json({ success: true, message: "Return processed successfully", refund_amount: refundAmount, return_id, points_reversed, points_restored });

  } catch (err) {
    await connection.rollback();
    console.error('Return Error:', err.message);
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

    const [saleRows] = await connection.query(
      "SELECT * FROM sales WHERE id = ? AND tenant_id = ?",
      [id, req.user.tenant_id]
    );

    if (saleRows.length === 0) {
      throw new Error("Sale not found");
    }

    if (saleRows[0].status === 'cancelled') {
      throw new Error("Sale already cancelled");
    }

    const [items] = await connection.query(
      "SELECT * FROM sale_items WHERE sale_id = ?",
      [id]
    );

    for (let item of items) {
      await connection.query(
        `UPDATE products SET stock = stock + ? WHERE id = ?`,
        [item.quantity, item.product_id]
      );
    }

    await connection.query(
      "UPDATE sales SET status = 'cancelled' WHERE id = ?",
      [id]
    );

    await connection.commit();

    // Loyalty: Reverse earned points + restore redeemed points (non-blocking)
    const sale = saleRows[0];
    if (sale.customer_id) {
      try {
        const [[loyaltySettings]] = await db.query('SELECT loyalty_rate FROM settings WHERE tenant_id = ?', [req.user.tenant_id]);
        const rate = parseFloat(loyaltySettings?.loyalty_rate) || 100;

        const [[cust]] = await db.query('SELECT loyalty_points FROM customers WHERE id = ?', [sale.customer_id]);
        let balance = cust?.loyalty_points || 0;

        const pointsEarned = Math.floor(parseFloat(sale.final_total) / rate);
        if (pointsEarned > 0) {
          balance = Math.max(0, balance - pointsEarned);
          await db.query('UPDATE customers SET loyalty_points = ? WHERE id = ?', [balance, sale.customer_id]);
          await db.query(
            `INSERT INTO loyalty_transactions (customer_id, sale_id, type, points, balance_after, note)
             VALUES (?, ?, 'reverse', ?, ?, ?)`,
            [sale.customer_id, sale.id, pointsEarned, balance, `Earn reversed — sale #${sale.id} cancelled`]
          );
        }

        const pointsRedeemed = parseInt(sale.loyalty_points_redeemed) || 0;
        if (pointsRedeemed > 0) {
          balance = balance + pointsRedeemed;
          await db.query('UPDATE customers SET loyalty_points = ? WHERE id = ?', [balance, sale.customer_id]);
          await db.query(
            `INSERT INTO loyalty_transactions (customer_id, sale_id, type, points, balance_after, note)
             VALUES (?, ?, 'reverse', ?, ?, ?)`,
            [sale.customer_id, sale.id, pointsRedeemed, balance, `Redeemed points restored — sale #${sale.id} cancelled`]
          );
        }
      } catch (loyaltyErr) {
        console.warn('Loyalty cancel reversal failed (non-critical):', loyaltyErr.message);
      }
    }

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
