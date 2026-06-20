const checkSuperAdmin = (req, res, next) => {
  if (req.user?.role !== 'superadmin') {
    return res.status(403).json({ success: false, message: "Super admin access required" });
  }
  next();
};
module.exports = checkSuperAdmin;
