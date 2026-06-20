const express = require('express');
const router = express.Router();
const db = require('../db');
const multer = require('multer');
const csv = require('csv-parser');
const fs = require('fs');
const { Readable } = require('stream');

// Middleware
const verifyToken = require('../middleware/authMiddleware');
const checkRole = require('../middleware/roleMiddleware');

// Multer setup for CSV
const upload = multer({ storage: multer.memoryStorage() });

// ===============================
// APPLY AUTH
// ===============================
router.use(verifyToken);

// ===============================
// BULK IMPORT PRODUCTS (Admin ONLY)
// ===============================
router.post('/bulk-import', checkRole(['admin']), upload.single('file'), async (req, res) => {
  if (!req.file) {
    return res.status(400).json({ success: false, message: 'No file uploaded' });
  }

  const results = [];
  const stream = Readable.from(req.file.buffer.toString());

  stream
    .pipe(csv({
      mapHeaders: ({ header }) => header.trim().replace(/^[​‌‍‎‏﻿]/, '')
    }))
    .on('data', (data) => results.push(data))
    .on('error', (err) => {
      console.error('CSV parse error:', err);
      res.status(400).json({ success: false, message: 'Failed to parse CSV file: ' + err.message });
    })
    .on('end', async () => {
      const connection = await db.getConnection();
      try {
        await connection.beginTransaction();

        let importedCount = 0;
        let errors = [];

        for (const [index, row] of results.entries()) {
          try {
            const name = row.name || row.Name;
            const category = row.category || row.Category;
            const sku = row.sku || row.SKU;
            const price = parseFloat(row.selling_price || row.price || row.Price || 0);
            const cost = parseFloat(row.cost_price || row.cost || row.Cost || 0);
            const stock = parseInt(row.stock || row.Stock || 0);
            const threshold = parseInt(row.threshold || row.Threshold || 5);
            const unit = row.unit_type || row.unit || 'pcs';

            if (!name) {
              errors.push(`Row ${index + 1}: Name is missing`);
              continue;
            }

            if (sku) {
              const [existing] = await connection.query(
                "SELECT id FROM products WHERE sku = ? AND tenant_id = ?",
                [sku, req.user.tenant_id]
              );
              if (existing.length > 0) {
                errors.push(`Row ${index + 1}: SKU ${sku} already exists`);
                continue;
              }
            }

            await connection.query(
              `INSERT INTO products
              (name, category, sku, selling_price, cost_price, stock, threshold, unit_type, tenant_id, created_at)
              VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, NOW())`,
              [name, category, sku, price, cost, stock, threshold, unit, req.user.tenant_id]
            );
            importedCount++;
          } catch (rowErr) {
            errors.push(`Row ${index + 1}: ${rowErr.message}`);
          }
        }

        await connection.commit();
        res.json({
          success: true,
          message: `Successfully imported ${importedCount} products`,
          totalRows: results.length,
          errors: errors.length > 0 ? errors : null
        });
      } catch (err) {
        await connection.rollback();
        console.error('Bulk import error:', err);
        res.status(500).json({ success: false, message: 'Internal server error during import' });
      } finally {
        connection.release();
      }
    });
});

// ===============================
// GET ALL PRODUCTS (Admin + Cashier)
// ===============================
router.get('/', checkRole(['admin', 'cashier']), async (req, res) => {
  try {
    const { search = '', category = '' } = req.query;

    let sql = "SELECT * FROM products WHERE tenant_id = ? AND is_deleted = 0";
    let params = [req.user.tenant_id];

    if (search) {
      sql += " AND (name LIKE ? OR sku LIKE ? OR category LIKE ?)";
      params.push(`%${search}%`, `%${search}%`, `%${search}%`);
    }

    if (category) {
      sql += " AND category = ?";
      params.push(category);
    }

    sql += " ORDER BY id DESC";

    const [rows] = await db.query(sql, params);

    res.json({
      success: true,
      data: rows
    });

  } catch (err) {
    console.error(err);
    res.status(500).json({
      success: false,
      message: "Error fetching products"
    });
  }
});

// ===============================
// SUGGEST NEXT GLOBAL SKU
// ===============================
router.get('/next-sku', checkRole(['admin', 'cashier']), async (req, res) => {
  try {
    const [rows] = await db.query(
      `SELECT sku FROM products WHERE sku IS NOT NULL AND sku != '' AND tenant_id = ? ORDER BY id DESC`,
      [req.user.tenant_id]
    );

    let nextNum = 1;

    for (const row of rows) {
      const sku = row.sku || '';
      const match = sku.match(/(\d+)$/);
      if (match) {
        const num = parseInt(match[1]);
        if (num >= nextNum) nextNum = num + 1;
      }
    }

    let padWidth = 3;
    if (rows.length > 0) {
      const lastSku = rows[0].sku || '';
      const match = lastSku.match(/(\d+)$/);
      if (match) padWidth = Math.max(match[1].length, 3);
    }

    const sku = String(nextNum).padStart(padWidth, '0');
    res.json({ success: true, sku });
  } catch (err) {
    console.error(err);
    res.status(500).json({ success: false, message: 'Error generating SKU' });
  }
});

// ===============================
// GENERATE NEXT SKU FOR CATEGORY
// ===============================
router.get('/generate-sku', checkRole(['admin', 'cashier']), async (req, res) => {
  try {
    const { category } = req.query;
    if (!category) return res.status(400).json({ success: false, message: "Category required" });

    const prefix = category.trim().toUpperCase().substring(0, 3);

    const [rows] = await db.query(
      `SELECT sku FROM products WHERE sku LIKE ? AND tenant_id = ? ORDER BY sku DESC LIMIT 1`,
      [`${prefix}%`, req.user.tenant_id]
    );

    let nextNumber = 1;
    if (rows.length > 0) {
      const lastSku = rows[0].sku;
      const lastNum = parseInt(lastSku.replace(prefix, '')) || 0;
      nextNumber = lastNum + 1;
    }

    const sku = `${prefix}${String(nextNumber).padStart(3, '0')}`;

    res.json({ success: true, sku });
  } catch (err) {
    console.error(err);
    res.status(500).json({ success: false, message: "Error generating SKU" });
  }
});

// ===============================
// GET CATEGORIES
// ===============================
router.get('/categories/list', checkRole(['admin', 'cashier']), async (req, res) => {
  try {
    const [rows] = await db.query(
      "SELECT DISTINCT category FROM products WHERE tenant_id = ? AND is_deleted = 0",
      [req.user.tenant_id]
    );

    const categories = rows.map(r => r.category);

    res.json({
      success: true,
      data: categories
    });

  } catch (err) {
    console.error(err);
    res.status(500).json({
      success: false,
      message: "Error fetching categories"
    });
  }
});

// ===============================
// GET PRODUCT BY BARCODE
// ===============================
router.get('/barcode/:code', checkRole(['admin', 'cashier']), async (req, res) => {
  try {
    const { code } = req.params;

    const [rows] = await db.query(
      "SELECT * FROM products WHERE barcode = ? AND tenant_id = ? AND is_deleted = 0 LIMIT 1",
      [code, req.user.tenant_id]
    );

    if (rows.length === 0) {
      return res.status(404).json({
        success: false,
        message: "Product not found with this barcode"
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
      message: "Error fetching product by barcode"
    });
  }
});

// ===============================
// GET SINGLE PRODUCT
// ===============================
router.get('/:id', checkRole(['admin', 'cashier']), async (req, res) => {
  try {
    const { id } = req.params;

    const [rows] = await db.query(
      "SELECT * FROM products WHERE id = ? AND tenant_id = ? AND is_deleted = 0",
      [id, req.user.tenant_id]
    );

    if (rows.length === 0) {
      return res.status(404).json({
        success: false,
        message: "Product not found"
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
      message: "Error fetching product"
    });
  }
});

// ===============================
// CREATE PRODUCT (Admin ONLY)
// ===============================
router.post('/', checkRole(['admin']), async (req, res) => {
  try {
    const {
      name,
      category,
      sku,
      barcode,
      description,
      selling_price,
      cost_price,
      stock,
      threshold,
      unit_type,
      image
    } = req.body;

    if (!name) {
      return res.status(400).json({
        success: false,
        message: "Product name is required"
      });
    }

    const sellingPrice = parseFloat(selling_price) || 0;
    const costPrice = parseFloat(cost_price) || 0;
    const stockQty = parseInt(stock) || 0;
    const stockThreshold = parseInt(threshold) || 5;

    if (sku && sku.trim() !== '') {
      const [existing] = await db.query(
        "SELECT id FROM products WHERE sku = ? AND tenant_id = ? AND is_deleted = 0",
        [sku.trim(), req.user.tenant_id]
      );

      if (existing.length > 0) {
        return res.status(400).json({
          success: false,
          message: "SKU already exists"
        });
      }
    }

    try {
      const [result] = await db.query(
        `INSERT INTO products
        (name, category, sku, barcode, description, selling_price, cost_price, stock, threshold, unit_type, image, tenant_id, created_at)
        VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, NOW())`,
        [
          name,
          category || null,
          sku || null,
          barcode || null,
          description || null,
          sellingPrice,
          costPrice,
          stockQty,
          stockThreshold,
          unit_type || 'pcs',
          image || null,
          req.user.tenant_id
        ]
      );

      const [createdRows] = await db.query("SELECT * FROM products WHERE id = ?", [result.insertId]);

      res.json({
        success: true,
        message: "Product created successfully",
        id: result.insertId,
        data: createdRows[0]
      });
    } catch (dbErr) {
      console.error('Database Error during product creation:', dbErr);
      return res.status(500).json({
        success: false,
        message: "Database Error: " + dbErr.message,
        error_code: dbErr.code
      });
    }

  } catch (err) {
    console.error('Server Error:', err);
    res.status(500).json({
      success: false,
      message: "Internal Server Error: " + err.message
    });
  }
});

// ===============================
// UPDATE PRODUCT (Admin ONLY)
// ===============================
router.put('/:id', checkRole(['admin']), async (req, res) => {
  try {
    const { id } = req.params;
    const updates = req.body;

    const [existing] = await db.query(
      "SELECT * FROM products WHERE id = ? AND tenant_id = ? AND is_deleted = 0",
      [id, req.user.tenant_id]
    );

    if (existing.length === 0) {
      return res.status(404).json({
        success: false,
        message: "Product not found"
      });
    }

    const fields = [];
    const values = [];
    const allowedFields = ['name', 'category', 'sku', 'barcode', 'description', 'selling_price', 'cost_price', 'stock', 'threshold', 'unit_type', 'image'];

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
      `UPDATE products SET ${fields.join(', ')} WHERE id = ? AND tenant_id = ?`,
      values
    );

    if (result.affectedRows === 0) {
      return res.status(404).json({
        success: false,
        message: "Product not found"
      });
    }

    const [updatedRows] = await db.query(
      "SELECT * FROM products WHERE id = ?",
      [id]
    );

    res.json({
      success: true,
      message: "Product updated successfully",
      data: updatedRows[0]
    });

  } catch (err) {
    console.error(err);
    res.status(500).json({
      success: false,
      message: "Error updating product"
    });
  }
});

// ===============================
// DELETE PRODUCT (Admin ONLY) — soft delete, recoverable via /restore
// ===============================
router.delete('/:id', checkRole(['admin']), async (req, res) => {
  try {
    const { id } = req.params;

    const [result] = await db.query(
      "UPDATE products SET is_deleted = 1 WHERE id = ? AND tenant_id = ? AND is_deleted = 0",
      [id, req.user.tenant_id]
    );

    if (result.affectedRows === 0) {
      return res.status(404).json({
        success: false,
        message: "Product not found"
      });
    }

    res.json({
      success: true,
      message: "Product deleted successfully"
    });

  } catch (err) {
    console.error(err);
    res.status(500).json({
      success: false,
      message: "Error deleting product"
    });
  }
});

// ===============================
// GET DELETED PRODUCTS (Admin ONLY) — recovery list
// ===============================
router.get('/trash/list', checkRole(['admin']), async (req, res) => {
  try {
    const [rows] = await db.query(
      "SELECT * FROM products WHERE tenant_id = ? AND is_deleted = 1 ORDER BY id DESC",
      [req.user.tenant_id]
    );
    res.json({ success: true, data: rows });
  } catch (err) {
    console.error(err);
    res.status(500).json({ success: false, message: "Error fetching deleted products" });
  }
});

// ===============================
// RESTORE DELETED PRODUCT (Admin ONLY)
// ===============================
router.put('/:id/restore', checkRole(['admin']), async (req, res) => {
  try {
    const { id } = req.params;
    const [result] = await db.query(
      "UPDATE products SET is_deleted = 0 WHERE id = ? AND tenant_id = ? AND is_deleted = 1",
      [id, req.user.tenant_id]
    );
    if (result.affectedRows === 0) {
      return res.status(404).json({ success: false, message: "Deleted product not found" });
    }
    res.json({ success: true, message: "Product restored successfully" });
  } catch (err) {
    console.error(err);
    res.status(500).json({ success: false, message: "Error restoring product" });
  }
});

// ===============================
// GET VARIANTS FOR A PRODUCT
// ===============================
router.get('/:id/variants', checkRole(['admin', 'cashier']), async (req, res) => {
  try {
    // Verify product belongs to tenant first
    const [product] = await db.query(
      'SELECT id FROM products WHERE id = ? AND tenant_id = ?',
      [req.params.id, req.user.tenant_id]
    );
    if (!product.length) {
      return res.status(404).json({ success: false, message: 'Product not found' });
    }
    const [rows] = await db.query(
      'SELECT * FROM product_variants WHERE product_id = ? AND is_active = 1 ORDER BY sort_order ASC, id ASC',
      [req.params.id]
    );
    res.json({ success: true, data: rows });
  } catch (err) {
    console.error('Variants fetch error:', err);
    res.status(500).json({ success: false, message: 'Failed to fetch variants' });
  }
});

// ===============================
// SAVE ALL VARIANTS FOR A PRODUCT (replace all)
// ===============================
router.post('/:id/variants', checkRole(['admin']), async (req, res) => {
  const conn = await db.getConnection();
  try {
    await conn.beginTransaction();
    const { variants } = req.body;
    const productId = req.params.id;

    // Verify product belongs to tenant
    const [product] = await conn.query(
      'SELECT id FROM products WHERE id = ? AND tenant_id = ?',
      [productId, req.user.tenant_id]
    );
    if (!product.length) {
      await conn.rollback();
      return res.status(404).json({ success: false, message: 'Product not found' });
    }

    await conn.query('DELETE FROM product_variants WHERE product_id = ?', [productId]);

    if (variants && variants.length > 0) {
      for (let i = 0; i < variants.length; i++) {
        const v = variants[i];
        if (!v.name || v.name.trim() === '') continue;
        await conn.query(
          'INSERT INTO product_variants (product_id, name, price, sort_order) VALUES (?, ?, ?, ?)',
          [productId, v.name.trim(), parseFloat(v.price) || 0, i]
        );
      }
    }

    await conn.commit();
    const [rows] = await conn.query(
      'SELECT * FROM product_variants WHERE product_id = ? ORDER BY sort_order ASC',
      [productId]
    );
    res.json({ success: true, message: 'Variants saved', data: rows });
  } catch (err) {
    await conn.rollback();
    console.error('Variants save error:', err);
    res.status(500).json({ success: false, message: 'Failed to save variants' });
  } finally {
    conn.release();
  }
});

module.exports = router;
