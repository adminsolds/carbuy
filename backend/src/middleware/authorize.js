const authorize = (...roles) => (req, res, next) => {
  const userRole = req.user?.role;
  if (!userRole || !roles.includes(userRole)) {
    return res.status(403).json({ error: 'Forbidden. Insufficient permissions.' });
  }
  return next();
};

module.exports = authorize;
