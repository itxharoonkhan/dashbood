const express = require('express');
const router = express.Router();
const db = require('../db');
const verifyToken = require('../middleware/authMiddleware');
const checkRole = require('../middleware/roleMiddleware');
const { nextTenantNumber } = require('../utils/tenantSequence');

router.use(verifyToken);

// ===============================
// REPORTS (define before /:id)
// ===============================
router.get('/reports', checkRole(['admin']), async (req, res) => {
  try {
    const { from, to } = req.query;
    let dateFilter = '1=1';
    const params = [];
    if (from && to) {
      dateFilter = 'po.created_at BETWEEN ? AND DATE_ADD(?, INTERVAL 1 DAY)';
      params.push(from, to);
    }

    const [supplierStats] = await db.query(`
      SELECT
        s.id, s.name, s.phone, s.email, s.status,
        COUNT(DISTINCT po.id) AS total_pos,
        IFNULL(SUM(poi.quantity_ordered * poi.unit_cost), 0) AS total_ordered_value,
        IFNULL(SUM(poi.quantity_received * poi.unit_cost), 0) AS total_received_value,
        SUM(CASE WHEN po.status IN ('draft','sent','partially_received') THEN 1 ELSE 0 END) AS pending_pos
      FROM suppliers s
      LEFT JOIN purchase_orders po ON po.supplier_id = s.id AND po.tenant_id = ? AND ${dateFilter}
      LEFT JOIN purchase_order_items poi ON poi.po_id = po.id
      WHERE s.is_deleted = 0 AND s.tenant_id = ?
      GROUP BY s.id
      ORDER BY total_received_value DESC
    `, [req.user.tenant_id, ...params, req.user.tenant_id]);

    const [pendingOrders] = await db.query(`
      SELECT
        po.id, po.po_number, po.created_at, po.expected_date, po.status,
        s.name AS supplier_name,
        IFNULL(SUM(poi.quantity_ordered * poi.unit_cost), 0) AS total_value
      FROM purchase_orders po
      JOIN suppliers s ON s.id = po.supplier_id
      LEFT JOIN purchase_order_items poi ON poi.po_id = po.id
      WHERE po.status IN ('draft','sent','partially_received') AND po.tenant_id = ?
      GROUP BY po.id
      ORDER BY po.created_at ASC
    `, [req.user.tenant_id]);

    const [topItems] = await db.query(`
      SELECT
        p.id, p.name AS product_name, p.sku,
        COUNT(DISTINCT poi.po_id) AS order_count,
        IFNULL(SUM(poi.quantity_ordered), 0) AS total_qty_ordered,
        IFNULL(SUM(poi.quantity_received), 0) AS total_qty_received
      FROM purchase_order_items poi
      JOIN products p ON p.id = poi.product_id
      JOIN purchase_orders po ON po.id = poi.po_id
      WHERE po.tenant_id = ? AND ${dateFilter}
      GROUP BY p.id
      ORDER BY total_qty_ordered DESC
      LIMIT 10
    `, [req.user.tenant_id, ...params]);

    res.json({ success: true, data: { supplierStats, pendingOrders, topItems } });
  } catch (err) {
    console.error('Supplier reports error:', err);
    res.status(500).json({ success: false, message: 'Failed to fetch supplier reports' });
  }
});

// ===============================
// PURCHASE ORDERS — LIST (define before /:id)
// ===============================
router.get('/purchase-orders', checkRole(['admin']), async (req, res) => {
  try {
    const { supplier_id, status } = req.query;
    let where = 'po.tenant_id = ?';
    const params = [req.user.tenant_id];
    if (supplier_id) { where += ' AND po.supplier_id = ?'; params.push(supplier_id); }
    if (status) { where += ' AND po.status = ?'; params.push(status); }

    const [rows] = await db.query(`
      SELECT
        po.id, po.po_number, po.status, po.expected_date, po.notes, po.created_at,
        s.id AS supplier_id, s.name AS supplier_name,
        COUNT(poi.id) AS item_count,
        IFNULL(SUM(poi.quantity_ordered * poi.unit_cost), 0) AS total_value,
        IFNULL(SUM(poi.quantity_ordered), 0) AS total_qty_ordered,
        IFNULL(SUM(poi.quantity_received), 0) AS total_qty_received
      FROM purchase_orders po
      JOIN suppliers s ON s.id = po.supplier_id
      LEFT JOIN purchase_order_items poi ON poi.po_id = po.id
      WHERE ${where}
      GROUP BY po.id
      ORDER BY po.created_at DESC
    `, params);

    res.json({ success: true, data: rows });
  } catch (err) {
    console.error('PO list error:', err);
    res.status(500).json({ success: false, message: 'Failed to fetch purchase orders' });
  }
});

// ===============================
// PURCHASE ORDERS — CREATE
// ===============================
router.post('/purchase-orders', checkRole(['admin']), async (req, res) => {
  const conn = await db.getConnection();
  try {
    await conn.beginTransaction();
    const { supplier_id, items, notes, expected_date } = req.body;

    if (!supplier_id) return res.status(400).json({ success: false, message: 'Supplier is required' });
    if (!items || items.length === 0) return res.status(400).json({ success: false, message: 'At least one item is required' });

    const [sup] = await conn.query('SELECT id FROM suppliers WHERE id = ? AND is_deleted = 0 AND tenant_id = ?', [supplier_id, req.user.tenant_id]);
    if (sup.length === 0) return res.status(404).json({ success: false, message: 'Supplier not found' });

    const po_number = await nextTenantNumber(conn, 'purchase_orders', req.user.tenant_id);
    const [poResult] = await conn.query(
      'INSERT INTO purchase_orders (po_number, supplier_id, notes, expected_date, created_by, tenant_id) VALUES (?, ?, ?, ?, ?, ?)',
      [po_number, supplier_id, notes || null, expected_date || null, req.user.id, req.user.tenant_id]
    );
    const poId = poResult.insertId;

    for (const item of items) {
      if (!item.product_id || !item.quantity_ordered || item.quantity_ordered <= 0) continue;
      await conn.query(
        'INSERT INTO purchase_order_items (po_id, product_id, quantity_ordered, unit_cost) VALUES (?, ?, ?, ?)',
        [poId, item.product_id, parseInt(item.quantity_ordered), parseFloat(item.unit_cost) || 0]
      );
    }

    await conn.commit();

    const [[po]] = await conn.query(`
      SELECT po.*, s.name AS supplier_name
      FROM purchase_orders po JOIN suppliers s ON s.id = po.supplier_id
      WHERE po.id = ?
    `, [poId]);

    res.json({ success: true, message: 'Purchase order created', data: po });
  } catch (err) {
    await conn.rollback();
    console.error('PO create error:', err);
    res.status(500).json({ success: false, message: 'Failed to create purchase order' });
  } finally {
    conn.release();
  }
});

// ===============================
// PURCHASE ORDERS — GET DETAIL (define before /:id routes)
// ===============================
router.get('/purchase-orders/:poId', checkRole(['admin']), async (req, res) => {
  try {
    const { poId } = req.params;

    const [[po]] = await db.query(`
      SELECT po.*, s.name AS supplier_name, s.phone AS supplier_phone, s.email AS supplier_email
      FROM purchase_orders po JOIN suppliers s ON s.id = po.supplier_id
      WHERE po.id = ? AND po.tenant_id = ?
    `, [poId, req.user.tenant_id]);

    if (!po) return res.status(404).json({ success: false, message: 'Purchase order not found' });

    const [items] = await db.query(`
      SELECT poi.*, p.name AS product_name, p.sku, p.stock AS current_stock
      FROM purchase_order_items poi
      JOIN products p ON p.id = poi.product_id
      WHERE poi.po_id = ?
    `, [poId]);

    res.json({ success: true, data: { ...po, items } });
  } catch (err) {
    console.error('PO detail error:', err);
    res.status(500).json({ success: false, message: 'Failed to fetch purchase order' });
  }
});

// ===============================
// PURCHASE ORDERS — UPDATE STATUS
// ===============================
router.patch('/purchase-orders/:poId/status', checkRole(['admin']), async (req, res) => {
  try {
    const { poId } = req.params;
    const { status } = req.body;
    const allowed = ['draft', 'sent', 'partially_received', 'received', 'cancelled'];
    if (!allowed.includes(status)) {
      return res.status(400).json({ success: false, message: 'Invalid status' });
    }

    const [[po]] = await db.query('SELECT id FROM purchase_orders WHERE id = ? AND tenant_id = ?', [poId, req.user.tenant_id]);
    if (!po) return res.status(404).json({ success: false, message: 'Purchase order not found' });

    await db.query('UPDATE purchase_orders SET status = ? WHERE id = ?', [status, poId]);
    res.json({ success: true, message: `Status updated to ${status}` });
  } catch (err) {
    console.error('PO status error:', err);
    res.status(500).json({ success: false, message: 'Failed to update status' });
  }
});

// ===============================
// PURCHASE ORDERS — RECEIVE STOCK
// ===============================
router.post('/purchase-orders/:poId/receive', checkRole(['admin']), async (req, res) => {
  const conn = await db.getConnection();
  try {
    await conn.beginTransaction();
    const { poId } = req.params;
    const { items } = req.body;

    if (!items || items.length === 0) {
      return res.status(400).json({ success: false, message: 'No items to receive' });
    }

    const [[po]] = await conn.query('SELECT * FROM purchase_orders WHERE id = ? AND tenant_id = ?', [poId, req.user.tenant_id]);
    if (!po) return res.status(404).json({ success: false, message: 'PO not found' });
    if (po.status === 'cancelled') return res.status(400).json({ success: false, message: 'Cannot receive on a cancelled PO' });

    for (const item of items) {
      const qty = parseInt(item.quantity_received) || 0;
      if (qty <= 0) continue;

      const [[poItem]] = await conn.query(
        'SELECT * FROM purchase_order_items WHERE id = ? AND po_id = ?',
        [item.po_item_id, poId]
      );
      if (!poItem) continue;

      const newReceived = poItem.quantity_received + qty;
      const cappedReceived = Math.min(newReceived, poItem.quantity_ordered);

      await conn.query(
        'UPDATE purchase_order_items SET quantity_received = ? WHERE id = ?',
        [cappedReceived, poItem.id]
      );

      await conn.query(
        'UPDATE products SET stock = stock + ? WHERE id = ?',
        [qty, poItem.product_id]
      );
    }

    const [allItems] = await conn.query(
      'SELECT quantity_ordered, quantity_received FROM purchase_order_items WHERE po_id = ?',
      [poId]
    );
    const allReceived = allItems.every(i => i.quantity_received >= i.quantity_ordered);
    const anyReceived = allItems.some(i => i.quantity_received > 0);
    const newStatus = allReceived ? 'received' : (anyReceived ? 'partially_received' : po.status);

    await conn.query('UPDATE purchase_orders SET status = ? WHERE id = ?', [newStatus, poId]);
    await conn.commit();

    res.json({ success: true, message: 'Stock received and inventory updated', status: newStatus });
  } catch (err) {
    await conn.rollback();
    console.error('Receive stock error:', err);
    res.status(500).json({ success: false, message: 'Failed to receive stock' });
  } finally {
    conn.release();
  }
});

// ===============================
// SUPPLIERS — LIST
// ===============================
router.get('/', checkRole(['admin']), async (req, res) => {
  try {
    const [rows] = await db.query(`
      SELECT
        s.*,
        COUNT(DISTINCT si.id) AS mapped_items,
        COUNT(DISTINCT po.id) AS total_pos
      FROM suppliers s
      LEFT JOIN supplier_items si ON si.supplier_id = s.id
      LEFT JOIN purchase_orders po ON po.supplier_id = s.id
      WHERE s.is_deleted = 0 AND s.tenant_id = ?
      GROUP BY s.id
      ORDER BY s.created_at DESC
    `, [req.user.tenant_id]);
    res.json({ success: true, data: rows });
  } catch (err) {
    console.error('Suppliers list error:', err);
    res.status(500).json({ success: false, message: 'Failed to fetch suppliers' });
  }
});

// ===============================
// SUPPLIERS — CREATE
// ===============================
router.post('/', checkRole(['admin']), async (req, res) => {
  try {
    const { name, phone, email, address, notes, status } = req.body;
    if (!name || !name.trim()) {
      return res.status(400).json({ success: false, message: 'Supplier name is required' });
    }

    const [result] = await db.query(
      'INSERT INTO suppliers (name, phone, email, address, notes, status, tenant_id) VALUES (?, ?, ?, ?, ?, ?, ?)',
      [name.trim(), phone || null, email || null, address || null, notes || null, status || 'active', req.user.tenant_id]
    );

    const [[created]] = await db.query('SELECT * FROM suppliers WHERE id = ?', [result.insertId]);
    res.json({ success: true, message: 'Supplier created', data: created });
  } catch (err) {
    console.error('Supplier create error:', err);
    res.status(500).json({ success: false, message: 'Failed to create supplier' });
  }
});

// ===============================
// SUPPLIERS — GET ITEM MAPPINGS
// ===============================
router.get('/:id/items', checkRole(['admin']), async (req, res) => {
  try {
    const { id } = req.params;
    const [rows] = await db.query(`
      SELECT si.*, p.name AS product_name, p.sku, p.stock AS current_stock, p.threshold
      FROM supplier_items si
      JOIN products p ON p.id = si.product_id
      WHERE si.supplier_id = ?
      ORDER BY si.is_primary DESC, p.name ASC
    `, [id]);
    res.json({ success: true, data: rows });
  } catch (err) {
    console.error('Supplier items error:', err);
    res.status(500).json({ success: false, message: 'Failed to fetch supplier items' });
  }
});

// ===============================
// SUPPLIERS — ADD / UPDATE ITEM MAPPING
// ===============================
router.post('/:id/items', checkRole(['admin']), async (req, res) => {
  try {
    const { id } = req.params;
    const { product_id, unit_cost, lead_time_days, is_primary } = req.body;

    if (!product_id) return res.status(400).json({ success: false, message: 'Product is required' });

    const [existing] = await db.query(
      'SELECT id FROM supplier_items WHERE supplier_id = ? AND product_id = ?',
      [id, product_id]
    );

    if (existing.length > 0) {
      await db.query(
        'UPDATE supplier_items SET unit_cost = ?, lead_time_days = ?, is_primary = ? WHERE supplier_id = ? AND product_id = ?',
        [parseFloat(unit_cost) || 0, parseInt(lead_time_days) || 0, is_primary ? 1 : 0, id, product_id]
      );
    } else {
      await db.query(
        'INSERT INTO supplier_items (supplier_id, product_id, unit_cost, lead_time_days, is_primary) VALUES (?, ?, ?, ?, ?)',
        [id, product_id, parseFloat(unit_cost) || 0, parseInt(lead_time_days) || 0, is_primary ? 1 : 0]
      );
    }

    res.json({ success: true, message: 'Item mapping saved' });
  } catch (err) {
    console.error('Supplier item map error:', err);
    res.status(500).json({ success: false, message: 'Failed to save item mapping' });
  }
});

// ===============================
// SUPPLIERS — REMOVE ITEM MAPPING
// ===============================
router.delete('/:id/items/:mapId', checkRole(['admin']), async (req, res) => {
  try {
    const { id, mapId } = req.params;
    await db.query('DELETE FROM supplier_items WHERE id = ? AND supplier_id = ?', [mapId, id]);
    res.json({ success: true, message: 'Mapping removed' });
  } catch (err) {
    console.error('Remove mapping error:', err);
    res.status(500).json({ success: false, message: 'Failed to remove mapping' });
  }
});

// ===============================
// SUPPLIERS — UPDATE
// ===============================
router.put('/:id', checkRole(['admin']), async (req, res) => {
  try {
    const { id } = req.params;
    const { name, phone, email, address, notes, status } = req.body;

    const [[sup]] = await db.query('SELECT id FROM suppliers WHERE id = ? AND is_deleted = 0 AND tenant_id = ?', [id, req.user.tenant_id]);
    if (!sup) return res.status(404).json({ success: false, message: 'Supplier not found' });

    if (!name || !name.trim()) {
      return res.status(400).json({ success: false, message: 'Supplier name is required' });
    }

    await db.query(
      'UPDATE suppliers SET name = ?, phone = ?, email = ?, address = ?, notes = ?, status = ? WHERE id = ? AND tenant_id = ?',
      [name.trim(), phone || null, email || null, address || null, notes || null, status || 'active', id, req.user.tenant_id]
    );

    const [[updated]] = await db.query('SELECT * FROM suppliers WHERE id = ?', [id]);
    res.json({ success: true, message: 'Supplier updated', data: updated });
  } catch (err) {
    console.error('Supplier update error:', err);
    res.status(500).json({ success: false, message: 'Failed to update supplier' });
  }
});

// ===============================
// SUPPLIERS — TOGGLE STATUS
// ===============================
router.patch('/:id/toggle', checkRole(['admin']), async (req, res) => {
  try {
    const { id } = req.params;
    const [[sup]] = await db.query('SELECT status FROM suppliers WHERE id = ? AND is_deleted = 0 AND tenant_id = ?', [id, req.user.tenant_id]);
    if (!sup) return res.status(404).json({ success: false, message: 'Supplier not found' });

    const newStatus = sup.status === 'active' ? 'inactive' : 'active';
    await db.query('UPDATE suppliers SET status = ? WHERE id = ? AND tenant_id = ?', [newStatus, id, req.user.tenant_id]);
    res.json({ success: true, message: `Supplier ${newStatus}`, status: newStatus });
  } catch (err) {
    console.error('Supplier toggle error:', err);
    res.status(500).json({ success: false, message: 'Failed to toggle supplier status' });
  }
});

// ===============================
// SUPPLIERS — SOFT DELETE
// ===============================
router.delete('/:id', checkRole(['admin']), async (req, res) => {
  try {
    const { id } = req.params;
    const [[sup]] = await db.query('SELECT id FROM suppliers WHERE id = ? AND is_deleted = 0 AND tenant_id = ?', [id, req.user.tenant_id]);
    if (!sup) return res.status(404).json({ success: false, message: 'Supplier not found' });

    await db.query('UPDATE suppliers SET is_deleted = 1, status = ? WHERE id = ? AND tenant_id = ?', ['inactive', id, req.user.tenant_id]);
    res.json({ success: true, message: 'Supplier deleted' });
  } catch (err) {
    console.error('Supplier delete error:', err);
    res.status(500).json({ success: false, message: 'Failed to delete supplier' });
  }
});

module.exports = router;
