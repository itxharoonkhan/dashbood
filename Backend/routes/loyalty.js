const express = require('express');
const router = express.Router();
const db = require('../db');
const verifyToken = require('../middleware/authMiddleware');
const checkRole = require('../middleware/roleMiddleware');

router.use(verifyToken);

// ===============================
// LOOKUP BY PHONE (POS checkout)
// ===============================
router.get('/lookup', checkRole(['admin', 'cashier']), async (req, res) => {
  try {
    const { phone } = req.query;
    if (!phone) return res.status(400).json({ success: false, message: 'Phone required' });

    const [[settings]] = await db.query(
      'SELECT loyalty_rate, loyalty_min_redeem, loyalty_max_percent FROM settings LIMIT 1'
    );
    const min_redeem = parseInt(settings?.loyalty_min_redeem) || 100;
    const max_percent = parseInt(settings?.loyalty_max_percent) || 30;
    const rate = parseFloat(settings?.loyalty_rate) || 100;

    const [[customer]] = await db.query(
      'SELECT id, name, phone, loyalty_points FROM customers WHERE phone = ?',
      [phone.trim()]
    );

    if (!customer) {
      return res.json({ success: true, found: false, min_redeem, max_percent, rate });
    }

    res.json({
      success: true,
      found: true,
      customer_id: customer.id,
      customer_name: customer.name,
      points: customer.loyalty_points,
      min_redeem,
      max_percent,
      rate
    });
  } catch (err) {
    console.error('❌ Loyalty lookup error:', err);
    res.status(500).json({ success: false, message: 'Failed to lookup loyalty info' });
  }
});

// ===============================
// CUSTOMER HISTORY + LIFETIME STATS
// ===============================
router.get('/customer/:customer_id', checkRole(['admin', 'cashier']), async (req, res) => {
  try {
    const { customer_id } = req.params;

    const [[customer]] = await db.query(
      'SELECT id, name, phone, loyalty_points FROM customers WHERE id = ?',
      [customer_id]
    );
    if (!customer) return res.status(404).json({ success: false, message: 'Customer not found' });

    const [transactions] = await db.query(
      `SELECT id, type, points, balance_after, note, sale_id, created_at
       FROM loyalty_transactions
       WHERE customer_id = ?
       ORDER BY created_at DESC
       LIMIT 50`,
      [customer_id]
    );

    // Lifetime stats from transaction log (source of truth)
    const [[stats]] = await db.query(`
      SELECT
        IFNULL(SUM(CASE WHEN type = 'earn'   THEN points ELSE 0 END), 0) AS lifetime_earned,
        IFNULL(SUM(CASE WHEN type = 'redeem' THEN points ELSE 0 END), 0) AS lifetime_redeemed,
        IFNULL(SUM(CASE WHEN type = 'expire' THEN points ELSE 0 END), 0) AS lifetime_expired,
        MAX(CASE WHEN type = 'earn' THEN created_at END) AS last_activity
      FROM loyalty_transactions
      WHERE customer_id = ?
    `, [customer_id]);

    res.json({ success: true, data: { customer, transactions, stats } });
  } catch (err) {
    console.error('❌ Loyalty history error:', err);
    res.status(500).json({ success: false, message: 'Failed to fetch loyalty history' });
  }
});

// ===============================
// EXPIRE POINTS (12 months inactivity)
// Run this via a scheduled task / cron
// ===============================
router.post('/expire', checkRole(['admin']), async (req, res) => {
  const connection = await db.getConnection();
  try {
    await connection.beginTransaction();

    // Find customers with points who had no earn activity in last 12 months
    const [toExpire] = await connection.query(`
      SELECT c.id, c.loyalty_points,
             MAX(lt.created_at) AS last_earn
      FROM customers c
      JOIN loyalty_transactions lt ON c.id = lt.customer_id AND lt.type = 'earn'
      WHERE c.loyalty_points > 0
      GROUP BY c.id
      HAVING last_earn < DATE_SUB(NOW(), INTERVAL 12 MONTH)
    `);

    let expired_count = 0;
    for (const cust of toExpire) {
      const pts = cust.loyalty_points;
      await connection.query('UPDATE customers SET loyalty_points = 0 WHERE id = ?', [cust.id]);
      await connection.query(
        `INSERT INTO loyalty_transactions (customer_id, sale_id, type, points, balance_after, note)
         VALUES (?, NULL, 'expire', ?, 0, ?)`,
        [cust.id, pts, '12 months inactivity — points expired']
      );
      expired_count++;
    }

    await connection.commit();
    res.json({ success: true, message: `${expired_count} customers' points expired` });
  } catch (err) {
    await connection.rollback();
    console.error('❌ Loyalty expire error:', err);
    res.status(500).json({ success: false, message: 'Failed to expire points' });
  } finally {
    connection.release();
  }
});

module.exports = router;
