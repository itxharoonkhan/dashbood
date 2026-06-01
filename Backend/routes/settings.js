const express = require('express');
const router = express.Router();
const path = require('path');
const fs = require('fs');
const multer = require('multer');
const db = require('../db');

// 🔐 Middleware
const verifyToken = require('../middleware/authMiddleware');
const checkRole = require('../middleware/roleMiddleware');

// ===============================
// MULTER — Receipt Logo Upload
// ===============================
const logoDir = path.join(__dirname, '../uploads/receipt');

const logoStorage = multer.diskStorage({
  destination: (req, file, cb) => {
    if (!fs.existsSync(logoDir)) fs.mkdirSync(logoDir, { recursive: true });
    cb(null, logoDir);
  },
  filename: (req, file, cb) => {
    const ext = path.extname(file.originalname).toLowerCase();
    cb(null, `receipt-logo-${Date.now()}${ext}`);
  },
});

const logoUpload = multer({
  storage: logoStorage,
  limits: { fileSize: 2 * 1024 * 1024 },
  fileFilter: (req, file, cb) => {
    const allowed = ['image/png', 'image/jpeg', 'image/webp'];
    if (allowed.includes(file.mimetype)) {
      cb(null, true);
    } else {
      cb(new Error('Only PNG, JPG, and WEBP files are allowed'));
    }
  },
});

// ===============================
// GET FULL SETTINGS (Admin + Cashier)
// ===============================
router.get('/', verifyToken, checkRole(['admin', 'cashier']), async (req, res) => {
  try {
    const [rows] = await db.query("SELECT * FROM settings WHERE id = 1");

    res.json({
      success: true,
      data: rows[0] || {}
    });

  } catch (err) {
    console.error(err);
    res.status(500).json({
      success: false,
      message: "Error fetching settings"
    });
  }
});

// ===============================
// UPDATE FULL SETTINGS (Admin ONLY)
// ===============================
router.put('/', verifyToken, checkRole(['admin']), async (req, res) => {
  try {
    const updates = req.body;

    // ✅ Build dynamic update query
    const fields = [];
    const values = [];
    const allowedFields = ['store_name', 'store_address', 'store_phone', 'store_email', 'store_gstin', 'currency', 'tax_rate', 'items_per_page', 'theme', 'invoice_prefix', 'low_stock_alert', 'mode'];

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

    values.push(1);

    const [result] = await db.query(
      `UPDATE settings SET ${fields.join(', ')} WHERE id=?`,
      values
    );

    if (result.affectedRows === 0) {
      return res.status(404).json({
        success: false,
        message: "Settings not found"
      });
    }

    // ✅ Fetch updated settings
    const [updatedRows] = await db.query(
      "SELECT * FROM settings WHERE id = 1"
    );

    res.json({
      success: true,
      message: "Settings updated successfully",
      data: updatedRows[0]
    });

  } catch (err) {
    console.error(err);
    res.status(500).json({
      success: false,
      message: "Error updating settings"
    });
  }
});

// ===============================
// GET STORE INFO (Admin + Cashier)
// ===============================
router.get('/store', verifyToken, checkRole(['admin', 'cashier']), async (req, res) => {
  try {
    const [rows] = await db.query(`
      SELECT 
        store_name,
        store_address,
        store_phone,
        store_email,
        store_gstin
      FROM settings
      WHERE id = 1
    `);

    res.json({
      success: true,
      data: rows[0] || {}
    });

  } catch (err) {
    console.error(err);
    res.status(500).json({
      success: false,
      message: "Error fetching store info"
    });
  }
});

// ===============================
// UPDATE STORE INFO (Admin ONLY)
// ===============================
router.put('/store', verifyToken, checkRole(['admin']), async (req, res) => {
  try {
    const {
      store_name,
      store_address,
      store_phone,
      store_email,
      store_gstin
    } = req.body;

    await db.query(`
      UPDATE settings SET 
        store_name = ?, 
        store_address = ?, 
        store_phone = ?, 
        store_email = ?, 
        store_gstin = ?
      WHERE id = 1
    `, [
      store_name,
      store_address,
      store_phone,
      store_email,
      store_gstin
    ]);

    res.json({
      success: true,
      message: "Store info updated successfully"
    });

  } catch (err) {
    console.error(err);
    res.status(500).json({
      success: false,
      message: "Error updating store info"
    });
  }
});

// ===============================
// GET RECEIPT SETTINGS (Admin + Cashier)
// ===============================
router.get('/receipt', verifyToken, checkRole(['admin', 'cashier']), async (req, res) => {
  try {
    const [rows] = await db.query(`
      SELECT receipt_logo, receipt_footer_message, receipt_show_tax, receipt_show_donation
      FROM settings WHERE id = 1
    `);
    res.json({ success: true, data: rows[0] || {} });
  } catch (err) {
    console.error(err);
    res.status(500).json({ success: false, message: 'Error fetching receipt settings' });
  }
});

// ===============================
// UPDATE RECEIPT SETTINGS — text + toggles (Admin ONLY)
// ===============================
router.put('/receipt', verifyToken, checkRole(['admin']), async (req, res) => {
  try {
    const { receipt_footer_message, receipt_show_tax, receipt_show_donation } = req.body;

    if (receipt_footer_message !== undefined && receipt_footer_message.length > 150) {
      return res.status(400).json({
        success: false,
        message: 'Footer message cannot exceed 150 characters',
      });
    }

    await db.query(
      `UPDATE settings SET
        receipt_footer_message = ?,
        receipt_show_tax       = ?,
        receipt_show_donation  = ?
       WHERE id = 1`,
      [
        receipt_footer_message ?? '',
        receipt_show_tax ? 1 : 0,
        receipt_show_donation ? 1 : 0,
      ]
    );

    const [updated] = await db.query(`
      SELECT receipt_logo, receipt_footer_message, receipt_show_tax, receipt_show_donation
      FROM settings WHERE id = 1
    `);

    res.json({
      success: true,
      message: 'Receipt settings updated successfully',
      data: updated[0],
    });
  } catch (err) {
    console.error(err);
    res.status(500).json({ success: false, message: 'Error updating receipt settings' });
  }
});

// ===============================
// UPLOAD RECEIPT LOGO (Admin ONLY)
// ===============================
router.post(
  '/receipt/logo',
  verifyToken,
  checkRole(['admin']),
  (req, res, next) => {
    logoUpload.single('logo')(req, res, (err) => {
      if (err instanceof multer.MulterError) {
        const msg =
          err.code === 'LIMIT_FILE_SIZE'
            ? 'File size exceeds 2MB limit'
            : err.message;
        return res.status(400).json({ success: false, message: msg });
      }
      if (err) {
        return res.status(400).json({ success: false, message: err.message });
      }
      next();
    });
  },
  async (req, res) => {
    try {
      if (!req.file) {
        return res.status(400).json({ success: false, message: 'No file uploaded' });
      }

      // Remove old logo file if present
      const [rows] = await db.query('SELECT receipt_logo FROM settings WHERE id = 1');
      const oldLogo = rows[0]?.receipt_logo;
      if (oldLogo) {
        const oldPath = path.join(__dirname, '..', oldLogo.replace(/^\//, ''));
        if (fs.existsSync(oldPath)) fs.unlinkSync(oldPath);
      }

      const logoUrl = `/uploads/receipt/${req.file.filename}`;
      await db.query('UPDATE settings SET receipt_logo = ? WHERE id = 1', [logoUrl]);

      res.json({
        success: true,
        message: 'Logo uploaded successfully',
        data: { receipt_logo: logoUrl },
      });
    } catch (err) {
      console.error(err);
      res.status(500).json({ success: false, message: 'Error uploading logo' });
    }
  }
);

// ===============================
// DELETE RECEIPT LOGO (Admin ONLY)
// ===============================
router.delete('/receipt/logo', verifyToken, checkRole(['admin']), async (req, res) => {
  try {
    const [rows] = await db.query('SELECT receipt_logo FROM settings WHERE id = 1');
    const oldLogo = rows[0]?.receipt_logo;
    if (oldLogo) {
      const filePath = path.join(__dirname, '..', oldLogo.replace(/^\//, ''));
      if (fs.existsSync(filePath)) fs.unlinkSync(filePath);
    }

    await db.query('UPDATE settings SET receipt_logo = NULL WHERE id = 1');

    res.json({ success: true, message: 'Logo removed successfully' });
  } catch (err) {
    console.error(err);
    res.status(500).json({ success: false, message: 'Error removing logo' });
  }
});

module.exports = router;