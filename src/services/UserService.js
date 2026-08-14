const bcrypt = require('bcrypt');
const pool = require('../config/database');
const logger = require('../config/logger');

const SAFE_COLUMNS = `id, email, display_name AS "displayName", role, is_active AS "isActive", created_at AS "createdAt", updated_at AS "updatedAt"`;

async function create({ email, displayName, password, role }, requesterId) {
  if (!email || !displayName || !password || !role) {
    const err = new Error('email, displayName, password, and role are required');
    err.status = 400;
    throw err;
  }

  const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
  if (!emailRegex.test(email)) {
    const err = new Error('Invalid email format');
    err.status = 400;
    throw err;
  }

  if (password.length < 8) {
    const err = new Error('Password must be at least 8 characters');
    err.status = 400;
    throw err;
  }

  if (!['admin', 'operator'].includes(role)) {
    const err = new Error('role must be admin or operator');
    err.status = 400;
    throw err;
  }

  const normalized = email.toLowerCase().trim();
  const { rows: existing } = await pool.query('SELECT id FROM users WHERE email = $1', [normalized]);
  if (existing.length > 0) {
    const err = new Error('Email already registered');
    err.status = 409;
    throw err;
  }

  const passwordHash = await bcrypt.hash(password, 12);

  try {
    const { rows } = await pool.query(
      `INSERT INTO users (email, display_name, password_hash, role)
       VALUES ($1, $2, $3, $4)
       RETURNING ${SAFE_COLUMNS}`,
      [normalized, displayName.trim(), passwordHash, role]
    );

    logger.info({ adminId: requesterId, newUserId: rows[0].id, role }, 'User created');
    return rows[0];
  } catch (err) {
    if (err.code === '23505') {
      const conflict = new Error('Email already registered');
      conflict.status = 409;
      throw conflict;
    }
    throw err;
  }
}

async function findAll(page = 1, limit = 20) {
  const cappedLimit = Math.min(Math.max(parseInt(limit, 10) || 20, 1), 100);
  const safePage = Math.max(parseInt(page, 10) || 1, 1);
  const offset = (safePage - 1) * cappedLimit;

  const { rows } = await pool.query(
    `SELECT ${SAFE_COLUMNS} FROM users ORDER BY created_at DESC LIMIT $1 OFFSET $2`,
    [cappedLimit, offset]
  );

  const { rows: countRows } = await pool.query('SELECT COUNT(*)::int AS total FROM users');

  return { users: rows, total: countRows[0].total, page: safePage, limit: cappedLimit };
}

async function findById(id) {
  const { rows } = await pool.query(
    `SELECT ${SAFE_COLUMNS} FROM users WHERE id = $1`,
    [id]
  );
  if (!rows[0]) {
    const err = new Error('User not found');
    err.status = 404;
    throw err;
  }
  return rows[0];
}

async function update(id, { displayName, role }, requesterId) {
  if (id === requesterId) {
    const err = new Error('Cannot modify your own account');
    err.status = 400;
    throw err;
  }

  if (!displayName && !role) {
    const err = new Error('At least one of displayName or role must be provided');
    err.status = 400;
    throw err;
  }

  if (role && !['admin', 'operator'].includes(role)) {
    const err = new Error('role must be admin or operator');
    err.status = 400;
    throw err;
  }

  const setClauses = [];
  const params = [];

  if (displayName !== undefined) {
    params.push(displayName.trim());
    setClauses.push(`display_name = $${params.length}`);
  }
  if (role !== undefined) {
    params.push(role);
    setClauses.push(`role = $${params.length}`);
  }

  params.push(id);
  setClauses.push(`updated_at = NOW()`);

  const { rows } = await pool.query(
    `UPDATE users SET ${setClauses.join(', ')} WHERE id = $${params.length}
     RETURNING ${SAFE_COLUMNS}`,
    params
  );

  if (!rows[0]) {
    const err = new Error('User not found');
    err.status = 404;
    throw err;
  }

  logger.info(
    { adminId: requesterId, targetUserId: id, fields: Object.keys({ displayName, role }).filter(k => ({ displayName, role })[k] !== undefined) },
    'User updated'
  );

  return rows[0];
}

async function deactivate(id, requesterId) {
  if (id === requesterId) {
    const err = new Error('Cannot deactivate your own account');
    err.status = 400;
    throw err;
  }

  const client = await pool.connect();
  try {
    await client.query('BEGIN');

    const { rows } = await client.query(
      `UPDATE users SET is_active = false, updated_at = NOW()
       WHERE id = $1
       RETURNING ${SAFE_COLUMNS}`,
      [id]
    );

    if (!rows[0]) {
      await client.query('ROLLBACK');
      const err = new Error('User not found');
      err.status = 404;
      throw err;
    }

    await client.query(
      'UPDATE refresh_tokens SET is_revoked = true WHERE user_id = $1 AND is_revoked = false',
      [id]
    );

    await client.query('COMMIT');
    logger.info({ adminId: requesterId, targetUserId: id }, 'User deactivated');
    return rows[0];
  } catch (err) {
    await client.query('ROLLBACK');
    throw err;
  } finally {
    client.release();
  }
}

module.exports = { create, findAll, findById, update, deactivate };
