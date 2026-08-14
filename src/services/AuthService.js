const crypto = require('crypto');
const bcrypt = require('bcrypt');
const jwt = require('jsonwebtoken');
const pool = require('../config/database');
const logger = require('../config/logger');

function ttlToSeconds(ttl) {
  const match = String(ttl).match(/^(\d+)(s|m|h|d)?$/);
  if (!match) return 900;
  const n = parseInt(match[1], 10);
  const unit = match[2] || 's';
  const multipliers = { s: 1, m: 60, h: 3600, d: 86400 };
  return n * (multipliers[unit] || 1);
}

function hashToken(raw) {
  return crypto.createHash('sha256').update(raw).digest('hex');
}

async function login(email, password) {
  if (!email || !password) {
    const err = new Error('Email and password are required');
    err.status = 400;
    throw err;
  }

  const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
  if (!emailRegex.test(email)) {
    const err = new Error('Invalid email format');
    err.status = 400;
    throw err;
  }

  const { rows } = await pool.query(
    'SELECT id, email, password_hash, role, is_active FROM users WHERE email = $1',
    [email.toLowerCase()]
  );
  const user = rows[0];

  if (!user) {
    logger.warn({ email }, 'Login failed: user not found');
    const err = new Error('Invalid email or password');
    err.status = 401;
    throw err;
  }

  if (!user.is_active) {
    logger.warn({ userId: user.id }, 'Login failed: account inactive');
    const err = new Error('Account is inactive');
    err.status = 401;
    throw err;
  }

  const passwordMatch = await bcrypt.compare(password, user.password_hash);
  if (!passwordMatch) {
    logger.warn({ userId: user.id }, 'Login failed: wrong password');
    const err = new Error('Invalid email or password');
    err.status = 401;
    throw err;
  }

  const ttl = process.env.JWT_ACCESS_TTL || '15m';
  const accessToken = jwt.sign({ sub: user.id }, process.env.JWT_SECRET, { expiresIn: ttl });

  const rawRefresh = crypto.randomBytes(32).toString('hex');
  const tokenHash = hashToken(rawRefresh);
  const expiresAt = new Date(Date.now() + 7 * 24 * 60 * 60 * 1000);

  await pool.query(
    'INSERT INTO refresh_tokens (user_id, token_hash, expires_at) VALUES ($1, $2, $3)',
    [user.id, tokenHash, expiresAt]
  );

  logger.info({ userId: user.id }, 'Login successful');

  return {
    accessToken,
    refreshToken: rawRefresh,
    expiresIn: ttlToSeconds(ttl),
  };
}

async function refresh(rawToken) {
  if (!rawToken) {
    const err = new Error('refreshToken is required');
    err.status = 400;
    throw err;
  }

  const tokenHash = hashToken(rawToken);

  const { rows } = await pool.query(
    `SELECT rt.id, rt.user_id, rt.expires_at, u.is_active
     FROM refresh_tokens rt
     JOIN users u ON u.id = rt.user_id
     WHERE rt.token_hash = $1 AND rt.is_revoked = false AND rt.expires_at > NOW()`,
    [tokenHash]
  );
  const record = rows[0];

  if (!record) {
    const err = new Error('Refresh token is invalid or expired');
    err.status = 401;
    throw err;
  }

  if (!record.is_active) {
    const err = new Error('Refresh token is invalid or expired');
    err.status = 401;
    throw err;
  }

  await pool.query('UPDATE refresh_tokens SET is_revoked = true WHERE id = $1', [record.id]);

  const ttl = process.env.JWT_ACCESS_TTL || '15m';
  const accessToken = jwt.sign({ sub: record.user_id }, process.env.JWT_SECRET, { expiresIn: ttl });

  const newRaw = crypto.randomBytes(32).toString('hex');
  const newHash = hashToken(newRaw);
  const expiresAt = new Date(Date.now() + 7 * 24 * 60 * 60 * 1000);

  await pool.query(
    'INSERT INTO refresh_tokens (user_id, token_hash, expires_at) VALUES ($1, $2, $3)',
    [record.user_id, newHash, expiresAt]
  );

  logger.info({ userId: record.user_id }, 'Token refreshed');

  return {
    accessToken,
    refreshToken: newRaw,
    expiresIn: ttlToSeconds(ttl),
  };
}

async function logout(userId) {
  const { rowCount } = await pool.query(
    'UPDATE refresh_tokens SET is_revoked = true WHERE user_id = $1 AND is_revoked = false',
    [userId]
  );

  logger.info({ userId, revokedCount: rowCount }, 'Logout: all sessions revoked');
  return rowCount;
}

module.exports = { login, refresh, logout };
