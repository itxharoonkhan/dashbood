const express = require('express');
const router = express.Router();
const db = require('../db');

const verifyToken = require('../middleware/authMiddleware');
const checkRole = require('../middleware/roleMiddleware');
const { nextTenantNumber } = require('../utils/tenantSequence');

router.use(verifyToken);

// ===============================
// GET orders (with optional table filter)
// ===============================
router.get('/', checkRole(['admin', 'cashier']), async (req, res) => {
  try {
    const { table_id, status } = req.query;
    let sql = `
      SELECT
        o.id, o.table_id, o.waiter_id, o.pax, o.status, o.notes, o.created_at,
        t.name AS table_name,
        COALESCE(SUM(oi.quantity * oi.unit_price), 0) AS total
      FROM restaurant_orders o
      JOIN restaurant_tables t ON t.id = o.table_id
      LEFT JOIN restaurant_order_items oi ON oi.order_id = o.id
      WHERE o.tenant_id = ?
    `;
    const params = [req.user.tenant_id];

    if (table_id) { sql += ' AND o.table_id = ?'; params.push(table_id); }
    if (status)   { sql += ' AND o.status = ?';   params.push(status);   }

    sql += ' GROUP BY o.id ORDER BY o.created_at DESC';

    const [orders] = await db.query(sql, params);
    res.json({ success: true, data: orders });
  } catch (err) {
    console.error(err);
    res.status(500).json({ success: false, message: 'Error fetching orders' });
  }
});

// ===============================
// GET single order with items
// ===============================
router.get('/:id', checkRole(['admin', 'cashier']), async (req, res) => {
  try {
    const [orders] = await db.query(`
      SELECT o.*, t.name AS table_name
      FROM restaurant_orders o
      JOIN restaurant_tables t ON t.id = o.table_id
      WHERE o.id = ? AND o.tenant_id = ?
    `, [req.params.id, req.user.tenant_id]);

    if (!orders.length) return res.status(404).json({ success: false, message: 'Order not found' });

    const [items] = await db.query(`
      SELECT oi.*, p.name AS product_name, p.category
      FROM restaurant_order_items oi
      JOIN products p ON p.id = oi.product_id
      WHERE oi.order_id = ?
      ORDER BY oi.created_at ASC
    `, [req.params.id]);

    const [kots] = await db.query(
      'SELECT * FROM kots WHERE order_id = ? ORDER BY printed_at ASC',
      [req.params.id]
    );

    const [splits] = await db.query(
      'SELECT * FROM bill_splits WHERE order_id = ? ORDER BY created_at ASC',
      [req.params.id]
    );

    res.json({ success: true, data: { ...orders[0], items, kots, splits } });
  } catch (err) {
    console.error(err);
    res.status(500).json({ success: false, message: 'Error fetching order' });
  }
});

// ===============================
// POST open a new order for a table
// ===============================
router.post('/', checkRole(['admin', 'cashier']), async (req, res) => {
  try {
    const { table_id, pax = 1, notes = '', waiter_name = '' } = req.body;
    if (!table_id) return res.status(400).json({ success: false, message: 'table_id is required' });

    const [table] = await db.query('SELECT * FROM restaurant_tables WHERE id = ? AND tenant_id = ?', [table_id, req.user.tenant_id]);
    if (!table.length) return res.status(404).json({ success: false, message: 'Table not found' });

    const [activeOrders] = await db.query(
      "SELECT id FROM restaurant_orders WHERE table_id = ? AND status IN ('open','billed') AND tenant_id = ?",
      [table_id, req.user.tenant_id]
    );
    if (activeOrders.length) {
      return res.status(400).json({
        success: false,
        message: 'Is table pe pehle se ek active order hai',
        existing_order_id: activeOrders[0].id
      });
    }

    if (table[0].status !== 'available') {
      return res.status(400).json({ success: false, message: 'Table is not available' });
    }

    const [result] = await db.query(
      'INSERT INTO restaurant_orders (table_id, waiter_id, pax, notes, waiter_name, tenant_id) VALUES (?, ?, ?, ?, ?, ?)',
      [table_id, req.user?.id || null, pax, notes, waiter_name || null, req.user.tenant_id]
    );

    await db.query("UPDATE restaurant_tables SET status = 'occupied' WHERE id = ? AND tenant_id = ?", [table_id, req.user.tenant_id]);

    res.status(201).json({
      success: true,
      message: 'Order opened',
      data: { order_id: result.insertId }
    });
  } catch (err) {
    console.error(err);
    res.status(500).json({ success: false, message: 'Error opening order' });
  }
});

// ===============================
// POST add items to order + generate KOT
// ===============================
router.post('/:id/items', checkRole(['admin', 'cashier']), async (req, res) => {
  try {
    const { items } = req.body;
    if (!items || !items.length) {
      return res.status(400).json({ success: false, message: 'Items are required' });
    }

    const orderId = req.params.id;

    const [orders] = await db.query(
      "SELECT * FROM restaurant_orders WHERE id = ? AND status = 'open' AND tenant_id = ?",
      [orderId, req.user.tenant_id]
    );
    if (!orders.length) return res.status(404).json({ success: false, message: 'Open order not found' });

    const productIds = items.map(i => i.product_id);
    const placeholders = productIds.map(() => '?').join(',');
    const [products] = await db.query(
      `SELECT id, selling_price FROM products WHERE id IN (${placeholders}) AND tenant_id = ?`,
      [...productIds, req.user.tenant_id]
    );
    const priceMap = {};
    products.forEach(p => { priceMap[p.id] = p.selling_price; });

    const kotNumber = `KOT-${orderId}-${Date.now()}`;
    const [kotResult] = await db.query(
      "INSERT INTO kots (order_id, kot_number, status) VALUES (?, ?, 'pending')",
      [orderId, kotNumber]
    );
    const kotId = kotResult.insertId;

    const insertedIds = [];
    for (const item of items) {
      const price = priceMap[item.product_id];
      if (!price) continue;
      const [res2] = await db.query(
        'INSERT INTO restaurant_order_items (order_id, product_id, quantity, unit_price, notes, kot_id) VALUES (?, ?, ?, ?, ?, ?)',
        [orderId, item.product_id, item.quantity || 1, price, item.notes || '', kotId]
      );
      insertedIds.push(res2.insertId);
    }

    res.status(201).json({
      success: true,
      message: 'Items added and KOT generated',
      data: { kot_id: kotResult.insertId, kot_number: kotNumber, inserted_items: insertedIds.length }
    });
  } catch (err) {
    console.error(err);
    res.status(500).json({ success: false, message: 'Error adding items' });
  }
});

// ===============================
// PATCH reduce / void a single sent item
// ===============================
router.patch('/:id/items/:itemId', checkRole(['admin', 'cashier']), async (req, res) => {
  const orderId = parseInt(req.params.id);
  const itemId  = parseInt(req.params.itemId);
  const { quantity } = req.body;
  try {
    const [orders] = await db.query('SELECT status FROM restaurant_orders WHERE id = ? AND tenant_id = ?', [orderId, req.user.tenant_id]);
    if (!orders.length) return res.status(404).json({ success: false, message: 'Order not found' });
    if (orders[0].status === 'paid') return res.status(400).json({ success: false, message: 'Order already completed' });

    if (quantity === 0) {
      await db.query('DELETE FROM restaurant_order_items WHERE id = ? AND order_id = ?', [itemId, orderId]);
      return res.json({ success: true, message: 'Item voided' });
    }
    await db.query(
      'UPDATE restaurant_order_items SET quantity = ? WHERE id = ? AND order_id = ?',
      [quantity, itemId, orderId]
    );
    res.json({ success: true, message: 'Item quantity updated' });
  } catch (err) {
    console.error(err);
    res.status(500).json({ success: false, message: 'Error updating item' });
  }
});

// ===============================
// PUT update order notes / pax
// ===============================
router.put('/:id', checkRole(['admin', 'cashier']), async (req, res) => {
  try {
    const { pax, notes } = req.body;
    await db.query(
      'UPDATE restaurant_orders SET pax = COALESCE(?, pax), notes = COALESCE(?, notes) WHERE id = ? AND tenant_id = ?',
      [pax ?? null, notes ?? null, req.params.id, req.user.tenant_id]
    );
    res.json({ success: true, message: 'Order updated' });
  } catch (err) {
    console.error(err);
    res.status(500).json({ success: false, message: 'Error updating order' });
  }
});

// ===============================
// PUT mark order as billed (print bill)
// ===============================
router.put('/:id/bill', checkRole(['admin', 'cashier']), async (req, res) => {
  try {
    const [orders] = await db.query(
      "SELECT * FROM restaurant_orders WHERE id = ? AND status = 'open' AND tenant_id = ?",
      [req.params.id, req.user.tenant_id]
    );
    if (!orders.length) return res.status(404).json({ success: false, message: 'Open order not found' });

    await db.query("UPDATE restaurant_orders SET status = 'billed' WHERE id = ?", [req.params.id]);
    await db.query("UPDATE restaurant_tables SET status = 'bill_printed' WHERE id = ? AND tenant_id = ?", [orders[0].table_id, req.user.tenant_id]);

    const [items] = await db.query(`
      SELECT oi.quantity, oi.unit_price, oi.notes, p.name AS product_name
      FROM restaurant_order_items oi
      JOIN products p ON p.id = oi.product_id
      WHERE oi.order_id = ?
    `, [req.params.id]);

    const total = items.reduce((sum, i) => sum + (i.quantity * parseFloat(i.unit_price)), 0);

    res.json({ success: true, message: 'Bill printed', data: { items, total } });
  } catch (err) {
    console.error(err);
    res.status(500).json({ success: false, message: 'Error billing order' });
  }
});

// ===============================
// PUT reopen a billed order
// ===============================
router.put('/:id/reopen', checkRole(['admin', 'cashier']), async (req, res) => {
  try {
    const [orders] = await db.query(
      "SELECT * FROM restaurant_orders WHERE id = ? AND status = 'billed' AND tenant_id = ?",
      [req.params.id, req.user.tenant_id]
    );
    if (!orders.length) return res.status(404).json({ success: false, message: 'Billed order not found' });

    await db.query("UPDATE restaurant_orders SET status = 'open' WHERE id = ?", [req.params.id]);
    await db.query("UPDATE restaurant_tables SET status = 'occupied' WHERE id = ? AND tenant_id = ?", [orders[0].table_id, req.user.tenant_id]);

    res.json({ success: true, message: 'Order reopened' });
  } catch (err) {
    console.error(err);
    res.status(500).json({ success: false, message: 'Error reopening order' });
  }
});

// ===============================
// POST split bill
// ===============================
router.post('/:id/split', checkRole(['admin', 'cashier']), async (req, res) => {
  try {
    const { split_type, splits } = req.body;
    const validTypes = ['equal', 'by_item', 'by_amount'];
    if (!validTypes.includes(split_type)) {
      return res.status(400).json({ success: false, message: 'Invalid split_type' });
    }

    const orderId = req.params.id;

    // Verify order belongs to tenant
    const [orderCheck] = await db.query('SELECT id, table_id FROM restaurant_orders WHERE id = ? AND tenant_id = ?', [orderId, req.user.tenant_id]);
    if (!orderCheck.length) return res.status(404).json({ success: false, message: 'Order not found' });

    await db.query('DELETE FROM bill_splits WHERE order_id = ?', [orderId]);

    for (const s of splits) {
      await db.query(
        'INSERT INTO bill_splits (order_id, split_type, person_label, amount, items_json) VALUES (?, ?, ?, ?, ?)',
        [orderId, split_type, s.person_label, s.amount, s.items_json ? JSON.stringify(s.items_json) : null]
      );
    }

    await db.query("UPDATE restaurant_tables SET status = 'split' WHERE id = ? AND tenant_id = ?", [orderCheck[0].table_id, req.user.tenant_id]);

    res.json({ success: true, message: 'Bill split created' });
  } catch (err) {
    console.error(err);
    res.status(500).json({ success: false, message: 'Error splitting bill' });
  }
});

// ===============================
// PUT mark split portion as paid
// ===============================
router.put('/:id/split/:splitId/pay', checkRole(['admin', 'cashier']), async (req, res) => {
  const connection = await db.getConnection();
  try {
    await connection.beginTransaction();
    const orderId = req.params.id;

    await connection.query('UPDATE bill_splits SET paid = 1 WHERE id = ? AND order_id = ?', [req.params.splitId, orderId]);

    const [unpaid] = await connection.query(
      'SELECT id FROM bill_splits WHERE order_id = ? AND paid = 0',
      [orderId]
    );

    if (!unpaid.length) {
      const [orderRows] = await connection.query('SELECT * FROM restaurant_orders WHERE id = ? AND tenant_id = ?', [orderId, req.user.tenant_id]);
      const order = orderRows[0];

      const [items] = await connection.query(`
        SELECT oi.product_id, oi.quantity, oi.unit_price
        FROM restaurant_order_items oi WHERE oi.order_id = ?
      `, [orderId]);

      const total = items.reduce((sum, i) => sum + (i.quantity * parseFloat(i.unit_price)), 0);

      const [shifts] = await connection.query(
        "SELECT id FROM shifts WHERE cashier_id = ? AND status = 'open' ORDER BY start_time DESC LIMIT 1",
        [req.user?.id || null]
      );
      const shiftId = shifts.length ? shifts[0].id : null;

      const sale_number = await nextTenantNumber(connection, 'sales', req.user.tenant_id);
      const [saleResult] = await connection.query(
        `INSERT INTO sales (sale_number, cashier_id, shift_id, total, discount, tax, final_total, payment_method, status, tenant_id, created_at)
         VALUES (?, ?, ?, ?, 0, 0, ?, 'split', 'completed', ?, NOW())`,
        [sale_number, req.user?.id || null, shiftId, total, total, req.user.tenant_id]
      );
      const saleId = saleResult.insertId;

      for (const item of items) {
        await connection.query(
          'INSERT INTO sale_items (sale_id, product_id, quantity, price) VALUES (?, ?, ?, ?)',
          [saleId, item.product_id, item.quantity, item.unit_price]
        );
        await connection.query(
          'UPDATE products SET stock = GREATEST(stock - ?, 0) WHERE id = ?',
          [item.quantity, item.product_id]
        );
      }

      const [allSplits] = await connection.query(
        'SELECT person_label, amount FROM bill_splits WHERE order_id = ?', [orderId]
      );
      for (const s of allSplits) {
        await connection.query(
          'INSERT INTO sale_payments (sale_id, method, amount) VALUES (?, ?, ?)',
          [saleId, `split-${s.person_label}`, s.amount]
        );
      }

      await connection.query("UPDATE restaurant_orders SET status = 'paid' WHERE id = ?", [orderId]);
      await connection.query("UPDATE restaurant_tables SET status = 'available' WHERE id = ? AND tenant_id = ?", [order.table_id, req.user.tenant_id]);
      await connection.query(
        "UPDATE kots SET status = 'billed' WHERE order_id = ? AND status != 'billed'", [orderId]
      );
    }

    await connection.commit();
    connection.release();
    res.json({ success: true, message: 'Split portion marked as paid' });
  } catch (err) {
    await connection.rollback();
    connection.release();
    console.error(err);
    res.status(500).json({ success: false, message: 'Error marking split as paid' });
  }
});

// ===============================
// PUT complete / close order (full payment) + sync to sales table
// ===============================
router.put('/:id/complete', checkRole(['admin', 'cashier']), async (req, res) => {
  const connection = await db.getConnection();
  try {
    await connection.beginTransaction();

    const { payment_method = 'cash', payments } = req.body;
    const isSplit = Array.isArray(payments) && payments.length >= 2;
    const orderId = req.params.id;

    const [orders] = await connection.query(
      "SELECT * FROM restaurant_orders WHERE id = ? AND status = 'billed' AND tenant_id = ?",
      [orderId, req.user.tenant_id]
    );
    if (!orders.length) {
      await connection.rollback();
      connection.release();
      return res.status(400).json({ success: false, message: 'Pehle bill print karo, phir payment complete karo' });
    }
    const order = orders[0];

    const [items] = await connection.query(`
      SELECT oi.product_id, oi.quantity, oi.unit_price,
             p.name AS product_name, p.stock
      FROM restaurant_order_items oi
      JOIN products p ON p.id = oi.product_id
      WHERE oi.order_id = ?
    `, [orderId]);

    if (!items.length) {
      await connection.rollback();
      connection.release();
      return res.status(400).json({ success: false, message: 'Order mein koi items nahi hain' });
    }

    const total = items.reduce((sum, i) => sum + (i.quantity * parseFloat(i.unit_price)), 0);

    const [shifts] = await connection.query(
      "SELECT id FROM shifts WHERE cashier_id = ? AND status = 'open' ORDER BY start_time DESC LIMIT 1",
      [req.user?.id || null]
    );
    const shiftId = shifts.length ? shifts[0].id : null;

    const [tableRows] = await connection.query(
      'SELECT name FROM restaurant_tables WHERE id = ?', [order.table_id]
    );
    const tableName = tableRows.length ? tableRows[0].name : null;

    const sale_number = await nextTenantNumber(connection, 'sales', req.user.tenant_id);
    const [saleResult] = await connection.query(
      `INSERT INTO sales (sale_number, cashier_id, shift_id, total, discount, tax, final_total, payment_method, status, table_name, tenant_id, created_at)
       VALUES (?, ?, ?, ?, 0, 0, ?, ?, 'completed', ?, ?, NOW())`,
      [sale_number, req.user?.id || null, shiftId, total, total, isSplit ? 'split' : payment_method, tableName, req.user.tenant_id]
    );
    const saleId = saleResult.insertId;

    for (const item of items) {
      await connection.query(
        'INSERT INTO sale_items (sale_id, product_id, quantity, price) VALUES (?, ?, ?, ?)',
        [saleId, item.product_id, item.quantity, item.unit_price]
      );
      await connection.query(
        'UPDATE products SET stock = GREATEST(stock - ?, 0) WHERE id = ?',
        [item.quantity, item.product_id]
      );
    }

    if (isSplit) {
      for (const p of payments) {
        await connection.query(
          'INSERT INTO sale_payments (sale_id, method, amount) VALUES (?, ?, ?)',
          [saleId, p.method, p.amount]
        );
      }
    } else {
      await connection.query(
        'INSERT INTO sale_payments (sale_id, method, amount) VALUES (?, ?, ?)',
        [saleId, payment_method, total]
      );
    }

    await connection.query("UPDATE restaurant_orders SET status = 'paid' WHERE id = ?", [orderId]);
    await connection.query("UPDATE restaurant_tables SET status = 'available' WHERE id = ? AND tenant_id = ?", [order.table_id, req.user.tenant_id]);
    await connection.query(
      "UPDATE kots SET status = 'billed' WHERE order_id = ? AND status != 'billed'",
      [orderId]
    );

    await connection.commit();
    connection.release();

    res.json({ success: true, message: 'Order completed, table freed, sale recorded', data: { sale_id: saleId, sale_number } });
  } catch (err) {
    await connection.rollback();
    connection.release();
    console.error('Complete order error:', err.message, err.sqlMessage || '');
    res.status(500).json({ success: false, message: err.sqlMessage || err.message || 'Error completing order' });
  }
});

// ===============================
// PUT cancel order
// ===============================
router.put('/:id/cancel', checkRole(['admin']), async (req, res) => {
  try {
    const [orders] = await db.query(
      "SELECT * FROM restaurant_orders WHERE id = ? AND status = 'open' AND tenant_id = ?",
      [req.params.id, req.user.tenant_id]
    );
    if (!orders.length) return res.status(404).json({ success: false, message: 'Open order not found' });

    await db.query("UPDATE restaurant_orders SET status = 'cancelled' WHERE id = ?", [req.params.id]);
    await db.query("UPDATE restaurant_tables SET status = 'available' WHERE id = ? AND tenant_id = ?", [orders[0].table_id, req.user.tenant_id]);

    res.json({ success: true, message: 'Order cancelled' });
  } catch (err) {
    console.error(err);
    res.status(500).json({ success: false, message: 'Error cancelling order' });
  }
});

module.exports = router;
