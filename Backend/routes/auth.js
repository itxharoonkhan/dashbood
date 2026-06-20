const express = require('express');
const router = express.Router();
const db = require('../db');
const bcrypt = require('bcrypt');
const jwt = require('jsonwebtoken');

// Middleware
const verifyToken = require('../middleware/authMiddleware');
const checkRole = require('../middleware/roleMiddleware');

// ===============================
// CREATE USER (Admin ONLY)
// ===============================
router.post(
  '/create-cashier',
  verifyToken,
  checkRole(['admin']),
  async (req, res) => {
    try {
      let { name, email, password, role, permissions } = req.body;

      name = name?.trim();
      email = email?.trim()?.toLowerCase();
      password = password?.trim();

      if (!name || !email || !password) {
        return res.status(400).json({
          success: false,
          message: "Name, email, and password are required."
        });
      }

      const [existing] = await db.query(
        "SELECT id FROM users WHERE email = ?",
        [email]
      );

      if (existing && existing.length > 0) {
        return res.status(400).json({
          success: false,
          message: "A user with this email already exists."
        });
      }

      const hashedPassword = await bcrypt.hash(password, 10);
      const userRole = role || 'cashier';
      const userPermissions = JSON.stringify(permissions || []);

      await db.query(
        "INSERT INTO users (name, email, password, role, permissions, tenant_id) VALUES (?, ?, ?, ?, ?, ?)",
        [name, email, hashedPassword, userRole, userPermissions, req.user.tenant_id]
      );

      res.json({
        success: true,
        message: "User created successfully"
      });

    } catch (err) {
      console.error('Registration Error:', err);
      res.status(500).json({
        success: false,
        message: "Registration failed",
        error: err.message
      });
    }
  }
);

// ===============================
// LOGIN (WITH LOCK SYSTEM)
// ===============================
router.post('/login', async (req, res) => {
  try {
    let { email, password } = req.body;

    email = email?.trim()?.toLowerCase();
    password = password?.trim();

    if (!email || !password) {
      return res.status(400).json({ success: false, message: "Email and password required." });
    }

    const [rows] = await db.query("SELECT * FROM users WHERE email = ?", [email]);

    if (!rows || rows.length === 0) {
      return res.status(401).json({ success: false, message: "Invalid email or password." });
    }

    const user = rows[0];

    // Check tenant status (superadmin has tenant_id = null, skip check for them)
    if (user.tenant_id) {
      const [tenantRows] = await db.query("SELECT status FROM tenants WHERE id = ?", [user.tenant_id]);
      if (!tenantRows.length || tenantRows[0].status !== 'active') {
        return res.status(403).json({
          success: false,
          message: "Your business account has been suspended or deactivated. Please contact support at 03102751356."
        });
      }
    }

    // Check lock
    const now = new Date();
    let lockTime = null;
    if (user.lockUntil) {
      lockTime = (user.lockUntil instanceof Date) ? user.lockUntil : new Date(user.lockUntil);
    }

    if (lockTime && lockTime > now) {
      const remainingMs = lockTime.getTime() - now.getTime();
      const remainingMins = Math.max(1, Math.ceil(remainingMs / (60 * 1000)));
      return res.status(429).json({
        success: false,
        message: `Account locked. Please try again in ${remainingMins} minutes.`,
        lockUntil: lockTime.getTime()
      });
    }

    const isMatch = await bcrypt.compare(password, user.password);

    if (!isMatch) {
      const currentAttempts = parseInt(user.failedAttempts) || 0;
      const newAttempts = currentAttempts + 1;

      if (newAttempts >= 3) {
        const lockDuration = 30 * 60 * 1000;
        const lockUntil = new Date(Date.now() + lockDuration);
        await db.query("UPDATE users SET failedAttempts = ?, lockUntil = ? WHERE id = ?", [newAttempts, lockUntil, user.id]);
        return res.status(429).json({
          success: false,
          message: "Account locked for 30 mins due to 3 failed attempts.",
          lockUntil: lockUntil.getTime()
        });
      }

      await db.query("UPDATE users SET failedAttempts = ? WHERE id = ?", [newAttempts, user.id]);
      return res.status(401).json({
        success: false,
        message: `Invalid password. Attempt ${newAttempts} of 3.`
      });
    }

    await db.query("UPDATE users SET failedAttempts = 0, lockUntil = NULL WHERE id = ?", [user.id]);

    if (!process.env.JWT_SECRET) {
      throw new Error('JWT_SECRET is missing from .env');
    }

    let permissions = [];
    try {
      permissions = JSON.parse(user.permissions || '[]');
    } catch {
      permissions = [];
    }

    const token = jwt.sign(
      {
        id: user.id,
        role: user.role,
        permissions,
        tenant_id: user.tenant_id   // null for superadmin
      },
      process.env.JWT_SECRET,
      { expiresIn: '1d' }
    );

    res.json({
      success: true,
      token,
      user: {
        id: user.id,
        name: user.name,
        role: user.role,
        permissions,
        tenant_id: user.tenant_id
      }
    });

  } catch (err) {
    console.error('LOGIN CRASH:', err);
    res.status(500).json({
      success: false,
      message: "Server login error",
      error: err.message
    });
  }
});

// ===============================
// GET ALL ACCOUNTS (Admin Only)
// ===============================
router.get('/accounts', verifyToken, checkRole(['admin']), async (req, res) => {
  try {
    const isSuperAdmin = req.user.role === 'superadmin';
    const [rows] = await db.query(
      isSuperAdmin
        ? "SELECT id, name, email, role, permissions, failedAttempts, lockUntil, tenant_id, created_at FROM users ORDER BY created_at DESC"
        : "SELECT id, name, email, role, permissions, failedAttempts, lockUntil, created_at FROM users WHERE tenant_id = ? ORDER BY created_at DESC",
      isSuperAdmin ? [] : [req.user.tenant_id]
    );
    res.json({ success: true, data: rows });
  } catch (err) {
    console.error('Accounts Fetch Error:', err);
    res.status(500).json({ success: false, message: "Failed to fetch accounts", error: err.message });
  }
});

// ===============================
// UNLOCK ACCOUNT (Admin Only)
// ===============================
router.put('/unlock/:id', verifyToken, checkRole(['admin']), async (req, res) => {
  try {
    const { id } = req.params;
    const isSuperAdmin = req.user.role === 'superadmin';
    const [result] = await db.query(
      isSuperAdmin
        ? "UPDATE users SET failedAttempts = 0, lockUntil = NULL WHERE id = ?"
        : "UPDATE users SET failedAttempts = 0, lockUntil = NULL WHERE id = ? AND tenant_id = ?",
      isSuperAdmin ? [id] : [id, req.user.tenant_id]
    );
    if (result.affectedRows === 0) {
      return res.status(404).json({ success: false, message: "User not found" });
    }
    res.json({ success: true, message: "Account unlocked successfully" });
  } catch (err) {
    console.error('Unlock Error:', err);
    res.status(500).json({ success: false, message: "Failed to unlock account", error: err.message });
  }
});

// ===============================
// DELETE ACCOUNT (Admin Only)
// ===============================
router.delete('/accounts/:id', verifyToken, checkRole(['admin']), async (req, res) => {
  try {
    const { id } = req.params;
    const isSuperAdmin = req.user.role === 'superadmin';

    const [target] = await db.query(
      isSuperAdmin
        ? "SELECT email, role FROM users WHERE id = ?"
        : "SELECT email, role FROM users WHERE id = ? AND tenant_id = ?",
      isSuperAdmin ? [id] : [id, req.user.tenant_id]
    );
    if (!target || target.length === 0) {
      return res.status(404).json({ success: false, message: "User not found" });
    }
    if (target[0].role === 'admin') {
      const [[{ adminCount }]] = await db.query(
        isSuperAdmin
          ? "SELECT COUNT(*) AS adminCount FROM users WHERE role = 'admin'"
          : "SELECT COUNT(*) AS adminCount FROM users WHERE role = 'admin' AND tenant_id = ?",
        isSuperAdmin ? [] : [req.user.tenant_id]
      );
      if (adminCount <= 1) {
        return res.status(400).json({ success: false, message: "Cannot delete the last admin account." });
      }
    }

    const [result] = await db.query(
      isSuperAdmin
        ? "DELETE FROM users WHERE id = ?"
        : "DELETE FROM users WHERE id = ? AND tenant_id = ?",
      isSuperAdmin ? [id] : [id, req.user.tenant_id]
    );

    if (result.affectedRows === 0) {
      return res.status(404).json({ success: false, message: "User not found" });
    }

    res.json({ success: true, message: "Account deleted successfully" });
  } catch (err) {
    console.error('Delete Account Error:', err);
    res.status(500).json({ success: false, message: "Failed to delete account", error: err.message });
  }
});

// ===============================
// GET PROFILE
// ===============================
router.get('/profile', verifyToken, async (req, res) => {
  try {
    const [rows] = await db.query("SELECT id, name, email, role, permissions, tenant_id FROM users WHERE id = ?", [req.user.id]);
    if (!rows || rows.length === 0) return res.status(404).json({ success: false, message: "User not found" });

    const user = rows[0];
    let perms = [];
    try {
      perms = JSON.parse(user.permissions || '[]');
    } catch {
      perms = [];
    }
    res.json({
      success: true,
      data: {
        ...user,
        permissions: perms
      }
    });
  } catch (err) {
    console.error('Profile Error:', err);
    res.status(500).json({ success: false, message: "Profile fetch failed", error: err.message });
  }
});

module.exports = router;
