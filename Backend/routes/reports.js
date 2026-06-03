const express = require('express');
const router = express.Router();
const db = require('../db');

// 🔐 Middleware
const verifyToken = require('../middleware/authMiddleware');
const checkRole = require('../middleware/roleMiddleware');

// ===============================
// APPLY AUTH + ADMIN ONLY
// ===============================
router.use(verifyToken);
router.use(checkRole(['admin']));

// ===============================
// 📊 GET ALL REPORTS DATA (Combined)
// ===============================
router.get('/all', async (req, res) => {
  try {
    const { period = 'week' } = req.query;

    let dateFilter  = 's.created_at >= DATE_SUB(CURDATE(), INTERVAL 7 DAY)';
    let salesFilter = 'sales.created_at >= DATE_SUB(CURDATE(), INTERVAL 7 DAY)';
    if (period === 'today') {
      dateFilter  = 'DATE(s.created_at) = CURDATE()';
      salesFilter = 'DATE(sales.created_at) = CURDATE()';
    } else if (period === 'month') {
      dateFilter  = 's.created_at >= DATE_SUB(CURDATE(), INTERVAL 1 MONTH)';
      salesFilter = 'sales.created_at >= DATE_SUB(CURDATE(), INTERVAL 1 MONTH)';
    } else if (period === 'year') {
      dateFilter  = 's.created_at >= DATE_SUB(CURDATE(), INTERVAL 1 YEAR)';
      salesFilter = 'sales.created_at >= DATE_SUB(CURDATE(), INTERVAL 1 YEAR)';
    } else if (period === 'all') {
      dateFilter  = '1=1';
      salesFilter = '1=1';
    }

    const [
      [salesRows],
      [categoryRows],
      [taxRows],
      [profitRows]
    ] = await Promise.all([
      db.query(`
        SELECT DATE(s.created_at) AS date,
          SUM(s.final_total) - IFNULL(SUM(ret_sum.refund_amount), 0) AS revenue,
          COUNT(DISTINCT s.id) AS total_sales
        FROM sales s
        LEFT JOIN (
          SELECT sale_id, SUM(refund_amount) AS refund_amount
          FROM sale_returns GROUP BY sale_id
        ) ret_sum ON s.id = ret_sum.sale_id
        WHERE ${dateFilter}
        GROUP BY DATE(s.created_at) ORDER BY date ASC
      `),
      db.query(`
        SELECT p.category AS name,
          SUM(si.quantity * si.price) - IFNULL(SUM(sri_sum.returned_amount), 0) AS value
        FROM sale_items si
        JOIN products p ON si.product_id = p.id
        JOIN sales ON si.sale_id = sales.id
        LEFT JOIN (
          SELECT sale_item_id, SUM(quantity * price) AS returned_amount
          FROM sale_return_items GROUP BY sale_item_id
        ) sri_sum ON si.id = sri_sum.sale_item_id
        WHERE ${salesFilter}
        GROUP BY p.category ORDER BY value DESC
      `),
      db.query(`
        SELECT IFNULL(SUM(final_total - tax), 0) AS total_taxable_amount, IFNULL(SUM(tax), 0) AS total_tax
        FROM sales WHERE status = 'completed' AND ${salesFilter}
      `),
      db.query(`
        SELECT
          (
            SELECT IFNULL(SUM(final_total), 0)
            FROM sales
            WHERE status != 'cancelled' AND ${salesFilter}
          ) AS total_revenue,
          IFNULL(SUM(p.cost_price * si.quantity), 0) AS total_cost,
          IFNULL((
            SELECT SUM(sr.refund_amount)
            FROM sale_returns sr
            JOIN sales s_ref ON sr.sale_id = s_ref.id
            WHERE ${salesFilter.replace(/\bsales\b/g, 's_ref')}
          ), 0) AS total_refunded
        FROM sale_items si
        JOIN products p ON si.product_id = p.id
        JOIN sales ON si.sale_id = sales.id
        WHERE ${salesFilter}
      `)
    ]);

    const total_tax = taxRows[0].total_tax;
    const gross_revenue = profitRows[0].total_revenue;
    const total_refunded = profitRows[0].total_refunded;
    const revenue = gross_revenue - total_refunded;
    const cost = profitRows[0].total_cost;
    const profit = revenue - cost;

    res.json({
      success: true,
      data: {
        salesPerformance: salesRows,
        categoryDistribution: categoryRows,
        taxSummary: {
          total_taxable_amount: taxRows[0].total_taxable_amount,
          cgst: total_tax / 2,
          sgst: total_tax / 2,
          total_tax: total_tax
        },
        profitLoss: {
          total_revenue: revenue,
          total_cost: cost,
          gross_profit: profit,
          profit_margin: revenue ? ((profit / revenue) * 100).toFixed(2) : 0,
          net_profit: profit
        }
      }
    });

  } catch (err) {
    console.error('❌ Error fetching all reports data:', err);
    res.status(500).json({
      success: false,
      message: "Error fetching reports data"
    });
  }
});

// ===============================
// 📊 1. SALES PERFORMANCE (Last 7 Days)
// ===============================
router.get('/sales-performance', async (req, res) => {
  try {
    const [rows] = await db.query(`
      SELECT
        DATE(created_at) AS date,
        SUM(final_total) AS revenue,
        COUNT(*) AS total_sales
      FROM sales
      WHERE status != 'cancelled' AND created_at >= DATE_SUB(CURDATE(), INTERVAL 7 DAY)
      GROUP BY DATE(created_at)
      ORDER BY date ASC
    `);

    res.json({
      success: true,
      data: rows
    });

  } catch (err) {
    console.error(err);
    res.status(500).json({
      success: false,
      message: "Error fetching sales performance"
    });
  }
});

// ===============================
// 🥧 2. CATEGORY DISTRIBUTION
// ===============================
router.get('/category-distribution', async (req, res) => {
  try {
    const [rows] = await db.query(`
      SELECT
        p.category AS name,
        SUM(si.quantity * si.price) AS value
      FROM sale_items si
      JOIN products p ON si.product_id = p.id
      JOIN sales s ON si.sale_id = s.id
      WHERE s.status != 'cancelled'
      GROUP BY p.category
      ORDER BY value DESC
    `);

    res.json({
      success: true,
      data: rows
    });

  } catch (err) {
    console.error(err);
    res.status(500).json({
      success: false,
      message: "Error fetching category distribution"
    });
  }
});

// ===============================
// 💰 3. TAX SUMMARY
// ===============================
router.get('/tax-summary', async (req, res) => {
  try {
    const [rows] = await db.query(`
      SELECT 
        IFNULL(SUM(final_total - tax), 0) AS total_taxable_amount,
        IFNULL(SUM(tax), 0) AS total_tax
      FROM sales
      WHERE status = 'completed'
    `);

    const total_tax = rows[0].total_tax;

    res.json({
      success: true,
      data: {
        total_taxable_amount: rows[0].total_taxable_amount,
        cgst: total_tax / 2,
        sgst: total_tax / 2,
        total_tax: total_tax
      }
    });

  } catch (err) {
    console.error(err);
    res.status(500).json({
      success: false,
      message: "Error fetching tax summary"
    });
  }
});

// ===============================
// 📈 4. PROFIT & LOSS
// ===============================
router.get('/profit-loss', async (req, res) => {
  try {
    const [rows] = await db.query(`
      SELECT
        IFNULL(SUM(si.price * si.quantity), 0) AS total_revenue,
        IFNULL(SUM(p.cost_price * si.quantity), 0) AS total_cost
      FROM sale_items si
      JOIN products p ON si.product_id = p.id
      JOIN sales s ON si.sale_id = s.id
      WHERE s.status != 'cancelled'
    `);

    const revenue = rows[0].total_revenue;
    const cost = rows[0].total_cost;
    const profit = revenue - cost;

    res.json({
      success: true,
      data: {
        total_revenue: revenue,
        total_cost: cost,
        gross_profit: profit,
        profit_margin: revenue ? ((profit / revenue) * 100).toFixed(2) : 0,
        net_profit: profit
      }
    });

  } catch (err) {
    console.error(err);
    res.status(500).json({
      success: false,
      message: "Error fetching profit/loss"
    });
  }
});

// ===============================
// 📅 5. DAILY SALES (Last 7 Days)
// ===============================
router.get('/daily-sales', async (req, res) => {
  try {
    const [rows] = await db.query(`
      SELECT
        DATE(created_at) AS date,
        COUNT(*) AS sales_count,
        SUM(final_total) AS revenue
      FROM sales
      WHERE status != 'cancelled' AND created_at >= DATE_SUB(CURDATE(), INTERVAL 7 DAY)
      GROUP BY DATE(created_at)
      ORDER BY date ASC
    `);

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

// ===============================
// 📦 EXPORT DETAILED DATA
// ===============================
router.get('/export-detail', async (req, res) => {
  try {
    const { period = 'week' } = req.query;

    let dateCondition = 's.created_at >= DATE_SUB(CURDATE(), INTERVAL 7 DAY)';
    if (period === 'today') dateCondition = 'DATE(s.created_at) = CURDATE()';
    else if (period === 'month') dateCondition = 's.created_at >= DATE_SUB(CURDATE(), INTERVAL 1 MONTH)';
    else if (period === 'year') dateCondition = 's.created_at >= DATE_SUB(CURDATE(), INTERVAL 1 YEAR)';
    else if (period === 'all') dateCondition = '1=1';

    const [rows] = await db.query(`
      SELECT
        s.id AS sale_id,
        DATE_FORMAT(s.created_at, '%Y-%m-%d %H:%i') AS date,
        IFNULL(c.name, 'Walk-in') AS customer_name,
        IFNULL(c.phone, '-') AS customer_phone,
        p.name AS product_name,
        p.category AS product_category,
        si.quantity,
        si.price AS unit_price,
        (si.quantity * si.price) AS item_total,
        s.tax,
        s.payment_method,
        s.final_total AS order_total,
        s.status
      FROM sales s
      LEFT JOIN customers c ON s.customer_id = c.id
      JOIN sale_items si ON s.id = si.sale_id
      JOIN products p ON si.product_id = p.id
      WHERE ${dateCondition}
      ORDER BY s.id ASC
    `);

    res.json({ success: true, data: rows });
  } catch (err) {
    console.error(err);
    res.status(500).json({ success: false, message: "Export failed" });
  }
});

module.exports = router;