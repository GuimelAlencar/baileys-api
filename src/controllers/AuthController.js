const AuthService = require('../services/AuthService');

async function login(req, res, next) {
  try {
    const { email, password } = req.body;
    const data = await AuthService.login(email, password);
    res.status(200).json({ success: true, data });
  } catch (err) {
    if (err.status) return res.status(err.status).json({ success: false, error: err.message });
    next(err);
  }
}

async function refresh(req, res, next) {
  try {
    const { refreshToken } = req.body;
    const data = await AuthService.refresh(refreshToken);
    res.status(200).json({ success: true, data });
  } catch (err) {
    if (err.status) return res.status(err.status).json({ success: false, error: err.message });
    next(err);
  }
}

async function logout(req, res, next) {
  try {
    await AuthService.logout(req.userId);
    res.status(200).json({ success: true, message: 'Logged out from all devices' });
  } catch (err) {
    next(err);
  }
}

module.exports = { login, refresh, logout };
