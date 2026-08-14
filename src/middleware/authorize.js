const pool = require('../config/database');

function authorize(roles) {
  return async (req, res, next) => {
    try {
      const { rows } = await pool.query(
        'SELECT id, role, is_active FROM users WHERE id = $1',
        [req.userId]
      );

      const user = rows[0];

      if (!user || !user.is_active) {
        return res.status(401).json({ success: false, error: 'Access token missing or expired' });
      }

      if (!roles.includes(user.role)) {
        return res.status(403).json({ success: false, error: 'Insufficient permissions' });
      }

      req.user = user;
      next();
    } catch (err) {
      next(err);
    }
  };
}

module.exports = authorize;
