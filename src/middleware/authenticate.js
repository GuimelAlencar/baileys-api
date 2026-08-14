const jwt = require('jsonwebtoken');

const PUBLIC_PATHS = [
  '/auth/login',
  '/auth/refresh',
  '/health',
  '/api/status',
  '/api-docs',
  '/api-docs.json',
];

function authenticate(req, res, next) {
  if (PUBLIC_PATHS.some((p) => req.path === p || req.path.startsWith('/api-docs'))) {
    return next();
  }

  const authHeader = req.headers['authorization'];
  const token = authHeader && authHeader.startsWith('Bearer ') && authHeader.slice(7);

  if (!token) {
    return res.status(401).json({ success: false, error: 'Access token missing or expired' });
  }

  try {
    const payload = jwt.verify(token, process.env.JWT_SECRET);
    req.userId = payload.sub;
    next();
  } catch {
    res.status(401).json({ success: false, error: 'Access token missing or expired' });
  }
}

module.exports = authenticate;
