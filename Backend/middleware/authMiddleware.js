const jwt = require('jsonwebtoken');

const verifyToken = (req, res, next) => {
  try {
    const authHeader = req.headers['authorization'];

    if (!authHeader) {
      return res.status(401).json({ success: false, message: "No token provided" });
    }

    const parts = authHeader.split(' ');
    if (parts.length !== 2 || parts[0] !== 'Bearer') {
      return res.status(401).json({ success: false, message: "Invalid token format" });
    }

    const token = parts[1];
    const secret = process.env.JWT_SECRET;
    if (!secret) {
      console.error('CRITICAL: JWT_SECRET is not set in environment variables');
      return res.status(500).json({ success: false, message: "Server configuration error" });
    }

    const decoded = jwt.verify(token, secret);

    req.user = {
      id: decoded.id,
      role: decoded.role,
      tenant_id: decoded.tenant_id ?? null,   // null for superadmin
      permissions: decoded.permissions || []
    };

    next();
  } catch (err) {
    console.error('JWT Verification Error:', err.message);

    if (err.name === 'TokenExpiredError') {
      return res.status(401).json({ success: false, message: "Token has expired. Please login again." });
    }
    return res.status(403).json({ success: false, message: "Invalid token. Access denied." });
  }
};

module.exports = verifyToken;
