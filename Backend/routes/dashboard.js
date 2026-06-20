const express = require('express');
const router = express.Router();
const db = require('../db');

// Middleware
const verifyToken = require('../middleware/authMiddleware');
const checkRole = require('../middleware/roleMiddleware');

// ===============================
// APPLY AUTH
// ===============================
router.use(verifyToken);

// ===============================
// GET ALL DASHBOARD DATA (Combined)
// ===============================
router.get('/all', checkRole(['admin', 'cashier']), async (req, res) => {
  try {
    const tid = req.user.tenant_id;

    const [
      [statsRows],
      [recentSales],
      [topCategories],
      [dailySales]
    ] = await Promise.all([
      db.query(`
        SELECT
          (
            IFNULL((SELECT SUM(final_total) FROM sales WHERE tenant_id = ? AND status != 'cancelled' AND DATE(created_at) = CURDATE()), 0) -
            IFNULL((SELECT SUM(sr.refund_amount) FROM sale_returns sr JOIN sales s ON sr.sale_id = s.id WHERE s.tenant_id = ? AND DATE(s.created_at) = CURDATE()), 0)
          ) AS todayRevenue,
          (SELECT COUNT(*) FROM sales WHERE tenant_id = ? AND status != 'cancelled' AND DATE(created_at) = CURDATE()) AS todaySales,
          (SELECT COUNT(*) FROM customers WHERE tenant_id = ?) AS totalCustomers,
          (SELECT COUNT(*) FROM products WHERE tenant_id = ? AND stock <= threshold) AS lowStock,
          (
            IFNULL((SELECT SUM(final_total) FROM sales WHERE tenant_id = ? AND status != 'cancelled' AND YEAR(created_at) = YEAR(CURDATE()) AND WEEK(created_at) = WEEK(CURDATE())), 0) -
            IFNULL((SELECT SUM(sr.refund_amount) FROM sale_returns sr JOIN sales s ON sr.sale_id = s.id WHERE s.tenant_id = ? AND YEAR(s.created_at) = YEAR(CURDATE()) AND WEEK(s.created_at) = WEEK(CURDATE())), 0)
          ) AS weekRevenue,
          (
            IFNULL((SELECT SUM(final_total) FROM sales WHERE tenant_id = ? AND status != 'cancelled' AND YEAR(created_at) = YEAR(CURDATE()) AND MONTH(created_at) = MONTH(CURDATE())), 0) -
            IFNULL((SELECT SUM(sr.refund_amount) FROM sale_returns sr JOIN sales s ON sr.sale_id = s.id WHERE s.tenant_id = ? AND YEAR(s.created_at) = YEAR(CURDATE()) AND MONTH(s.created_at) = MONTH(CURDATE())), 0)
          ) AS monthRevenue
      `, [tid, tid, tid, tid, tid, tid, tid, tid, tid]),
      db.query(`
        SELECT s.id, s.sale_number, s.final_total AS grand_total, s.payment_method, s.created_at AS sale_date,
               s.table_name,
               c.name AS customer_name,
               GROUP_CONCAT(CONCAT(sp.method, ':', ROUND(sp.amount, 2)) ORDER BY sp.id SEPARATOR '|') AS split_breakdown
        FROM sales s
        LEFT JOIN customers c ON s.customer_id = c.id
        LEFT JOIN sale_payments sp ON s.id = sp.sale_id
        WHERE s.tenant_id = ? AND s.status != 'cancelled' AND DATE(s.created_at) = CURDATE()
        GROUP BY s.id, s.sale_number, s.final_total, s.payment_method, s.created_at, s.table_name, c.name
        ORDER BY s.id DESC
      `, [tid]),
      db.query(`
        SELECT p.category, SUM(si.quantity) AS total_items_sold, SUM(si.quantity * si.price) AS total_revenue
        FROM sale_items si
        JOIN products p ON si.product_id = p.id
        JOIN sales s ON si.sale_id = s.id
        WHERE s.tenant_id = ?
        GROUP BY p.category ORDER BY total_revenue DESC LIMIT 5
      `, [tid]),
      db.query(`
        SELECT DATE(s.created_at) AS date, COUNT(DISTINCT s.id) AS sales_count,
          SUM(s.final_total) - IFNULL(SUM(ret_sum.refund_amount), 0) AS revenue
        FROM sales s
        LEFT JOIN (
          SELECT sale_id, SUM(refund_amount) AS refund_amount
          FROM sale_returns GROUP BY sale_id
        ) ret_sum ON s.id = ret_sum.sale_id
        WHERE s.tenant_id = ? AND s.status != 'cancelled' AND s.created_at >= DATE_SUB(CURDATE(), INTERVAL 7 DAY)
        GROUP BY DATE(s.created_at) ORDER BY date DESC
      `, [tid])
    ]);

    res.json({
      success: true,
      data: {
        stats: statsRows[0],
        recentSales,
        topCategories,
        dailySales
      }
    });

  } catch (err) {
    console.error('Error fetching all dashboard data:', err);
    res.status(500).json({
      success: false,
      message: "Error fetching dashboard data"
    });
  }
});

// ===============================
// DASHBOARD STATS (Admin + Cashier)
// ===============================
router.get('/stats', checkRole(['admin', 'cashier']), async (req, res) => {
  try {
    const tid = req.user.tenant_id;
    const [rows] = await db.query(`
      SELECT
        (
          IFNULL((SELECT SUM(final_total) FROM sales WHERE tenant_id = ? AND status != 'cancelled' AND DATE(created_at) = CURDATE()), 0) -
          IFNULL((SELECT SUM(sr.refund_amount) FROM sale_returns sr JOIN sales s ON sr.sale_id = s.id WHERE s.tenant_id = ? AND DATE(s.created_at) = CURDATE()), 0)
        ) AS todayRevenue,
        (SELECT COUNT(*) FROM sales WHERE tenant_id = ? AND status != 'cancelled' AND DATE(created_at) = CURDATE()) AS todaySales,
        (SELECT COUNT(*) FROM customers WHERE tenant_id = ?) AS totalCustomers,
        (SELECT COUNT(*) FROM products WHERE tenant_id = ? AND stock <= threshold) AS lowStock,
        (
          IFNULL((SELECT SUM(final_total) FROM sales WHERE tenant_id = ? AND status != 'cancelled' AND YEAR(created_at) = YEAR(CURDATE()) AND WEEK(created_at) = WEEK(CURDATE())), 0) -
          IFNULL((SELECT SUM(sr.refund_amount) FROM sale_returns sr JOIN sales s ON sr.sale_id = s.id WHERE s.tenant_id = ? AND YEAR(s.created_at) = YEAR(CURDATE()) AND WEEK(s.created_at) = WEEK(CURDATE())), 0)
        ) AS weekRevenue,
        (
          IFNULL((SELECT SUM(final_total) FROM sales WHERE tenant_id = ? AND status != 'cancelled' AND YEAR(created_at) = YEAR(CURDATE()) AND MONTH(created_at) = MONTH(CURDATE())), 0) -
          IFNULL((SELECT SUM(sr.refund_amount) FROM sale_returns sr JOIN sales s ON sr.sale_id = s.id WHERE s.tenant_id = ? AND YEAR(s.created_at) = YEAR(CURDATE()) AND MONTH(s.created_at) = MONTH(CURDATE())), 0)
        ) AS monthRevenue
    `, [tid, tid, tid, tid, tid, tid, tid, tid, tid]);

    res.json({
      success: true,
      data: rows[0]
    });

  } catch (err) {
    console.error(err);
    res.status(500).json({
      success: false,
      message: "Error fetching dashboard stats"
    });
  }
});

// ===============================
// RECENT SALES (Admin + Cashier)
// ===============================
router.get('/recent-sales', checkRole(['admin', 'cashier']), async (req, res) => {
  try {
    const [rows] = await db.query(`
      SELECT
        s.id,
        s.sale_number,
        s.final_total AS grand_total,
        s.payment_method,
        s.created_at AS sale_date,
        s.table_name,
        c.name AS customer_name
      FROM sales s
      LEFT JOIN customers c ON s.customer_id = c.id
      WHERE s.tenant_id = ? AND s.status != 'cancelled'
      ORDER BY s.id DESC
      LIMIT 5
    `, [req.user.tenant_id]);

    res.json({
      success: true,
      data: rows
    });

  } catch (err) {
    console.error(err);
    res.status(500).json({
      success: false,
      message: "Error fetching recent sales"
    });
  }
});

// ===============================
// TOP CATEGORIES (Admin + Cashier)
// ===============================
router.get('/top-categories', checkRole(['admin', 'cashier']), async (req, res) => {
  try {
    const [rows] = await db.query(`
      SELECT
        p.category,
        SUM(si.quantity) AS total_items_sold,
        SUM(si.quantity * si.price) AS total_revenue
      FROM sale_items si
      JOIN products p ON si.product_id = p.id
      JOIN sales s ON si.sale_id = s.id
      WHERE s.tenant_id = ?
      GROUP BY p.category
      ORDER BY total_revenue DESC
      LIMIT 5
    `, [req.user.tenant_id]);

    res.json({
      success: true,
      data: rows
    });

  } catch (err) {
    console.error(err);
    res.status(500).json({
      success: false,
      message: "Error fetching top categories"
    });
  }
});

// ===============================
// INSIGHTS (Admin + Cashier)
// ===============================
router.get('/insights', checkRole(['admin', 'cashier']), async (req, res) => {
  try {
    const [lowStockItems] = await db.query(`
      SELECT name, stock, threshold
      FROM products
      WHERE tenant_id = ? AND stock <= threshold
      LIMIT 5
    `, [req.user.tenant_id]);

    const insights = [
      {
        type: 'info',
        title: 'System Status',
        message: 'POS system is running smoothly'
      }
    ];

    if (lowStockItems.length > 0) {
      insights.push({
        type: 'warning',
        title: 'Low Stock Alert',
        message: 'Some products are low in stock',
        items: lowStockItems
      });
    }

    res.json({
      success: true,
      data: insights
    });

  } catch (err) {
    console.error(err);
    res.status(500).json({
      success: false,
      message: "Error fetching insights"
    });
  }
});

// ===============================
// DAILY SALES (Last 7 Days) - Admin + Cashier
// ===============================
router.get('/daily-sales', checkRole(['admin', 'cashier']), async (req, res) => {
  try {
    const [rows] = await db.query(`
      SELECT DATE(s.created_at) AS date, COUNT(DISTINCT s.id) AS sales_count,
        SUM(s.final_total) - IFNULL(SUM(ret_sum.refund_amount), 0) AS revenue
      FROM sales s
      LEFT JOIN (
        SELECT sale_id, SUM(refund_amount) AS refund_amount
        FROM sale_returns GROUP BY sale_id
      ) ret_sum ON s.id = ret_sum.sale_id
      WHERE s.tenant_id = ? AND s.created_at >= DATE_SUB(CURDATE(), INTERVAL 7 DAY)
      GROUP BY DATE(s.created_at)
      ORDER BY date DESC
    `, [req.user.tenant_id]);

    res.json({
      success: true,
      data: rows
    });

  } catch (err) {
    console.error(err);
    res.status(500).json({
      success: false,
      message: "Error fetching daily sales"
    });
  }
});

module.exports = router;
