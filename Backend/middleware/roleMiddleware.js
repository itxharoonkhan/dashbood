const checkRole = (allowedRoles) => (req, res, next) => {
  // superadmin bypasses all role restrictions
  if (req.user?.role === 'superadmin') return next();
  if (!req.user || !allowedRoles.includes(req.user.role)) {
    return res.status(403).json({ success: false, message: "Access denied. Insufficient permissions." });
  }
  next();
};
module.exports = checkRole;
